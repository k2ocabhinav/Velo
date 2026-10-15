import { VeloHttpClient, type SimApi } from "../api/http-client.ts";
import { StompSession, type StompSession as StompSessionType } from "../api/stomp-session.ts";
import { ControlServer } from "../control/server.ts";
import { ActionExecutor } from "../control/action-executor.ts";
import { EventHub } from "../control/event-hub.ts";
import { applyPreset, isPresetName } from "../control/presets.ts";
import { applyConfigPatch, defaultConfig, type ConfigContext, type PatchResult, type SimConfig } from "../control/runtime-config.ts";
import { loadState, saveState } from "../control/state-store.ts";
import type { ControlStatus, RouteCatalogue, SimAccount, SimTenant, TenantSlug } from "../types.ts";
import { SIM_TENANTS } from "../config.ts";
import { SimLogger } from "../log.ts";
import { SystemClock, SimulationClock, type Clock } from "./clock.ts";
import type { RidePlan, RideRegistry } from "./contracts.ts";
import { DriverBot } from "./driver-bot.ts";
import { poissonDelayMs, SeededRandom, type RandomSource } from "./random.ts";
import { RiderBot } from "./rider-bot.ts";

interface TenantRuntime extends RideRegistry {
  tenant: SimTenant;
  tenantId?: number;
  brandName?: string;
  riders: RiderBot[];
  drivers: DriverBot[];
  plans: Map<number, RidePlan>;
  firstOffers: Set<number>;
  requestsCreating: number;
  forceDeclinesRemaining: number;
  arrivals?: Promise<void>;
  arrivalController: AbortController;
  arrivalWakeController: AbortController;
  random: SeededRandom;
  forceDeclines(count: number): void;
  setDriverOnline(driver: DriverBot, online: boolean): Promise<void>;
}

export interface TenantOrchestratorOptions {
  apiBaseUrl: string;
  tenants: TenantSlug[];
  catalogue: RouteCatalogue;
  seed: number;
  speed: number;
  paused: boolean;
  stateFile?: string;
  clock?: Clock;
  logger?: SimLogger;
  apiFactory?: (apiBaseUrl: string) => SimApi;
  stompFactory?: (account: SimAccount, api: SimApi) => StompSessionType;
  startBackgroundLoops?: boolean;
}

const MAX_SAVE_DELAY_MS = 500;

export class TenantOrchestrator {
  private readonly clock: Clock;
  private readonly logger: SimLogger;
  private readonly eventHub = new EventHub();
  private readonly apiFactory: (apiBaseUrl: string) => SimApi;
  private readonly runtimes = new Map<TenantSlug, TenantRuntime>();
  private readonly accountApis = new Map<string, SimApi>();
  private readonly loggedInApis = new Set<SimApi>();
  private readonly randomStreams = new Map<string, SeededRandom>();
  private readonly startedAt: number;
  private readonly context: ConfigContext;
  private readonly actionExecutor: ActionExecutor;
  private configValue: SimConfig;
  private speedValue: number;
  private pausedValue: boolean;
  private lastLoginStartedAt: number | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private stateLoaded = false;
  private startupComplete = false;
  private readonly startupController = new AbortController();
  private readonly shutdownController = new AbortController();
  private readonly options: TenantOrchestratorOptions;

  constructor(options: TenantOrchestratorOptions) {
    this.options = options;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? new SimLogger(this.clock);
    this.logger.setEventPublisher((event) => this.eventHub.publish(event));
    this.apiFactory = options.apiFactory ?? ((apiBaseUrl) => new VeloHttpClient({ apiBaseUrl, now: () => this.clock.now() }));
    this.context = makeConfigContext(options.tenants, options.catalogue);
    const defaults = defaultConfig(this.context, options.seed);
    const cliConfig = applyConfigPatch(defaults, { speedFactor: options.speed, paused: options.paused }, this.context);
    this.configValue = cliConfig.ok ? cliConfig.config : defaults;
    this.speedValue = this.configValue.speedFactor;
    this.pausedValue = this.configValue.paused;
    this.startedAt = this.clock.now();

    for (const slug of options.tenants) {
      const runtime = {
        tenant: SIM_TENANTS[slug],
        riders: [],
        drivers: [],
        plans: new Map<number, RidePlan>(),
        firstOffers: new Set<number>(),
        requestsCreating: 0,
        forceDeclinesRemaining: 0,
        arrivalController: new AbortController(),
        arrivalWakeController: new AbortController(),
        random: new SeededRandom(deriveSeed(this.configValue.seed, slug)),
        beginRequest() { this.requestsCreating += 1; },
        endRequest() { this.requestsCreating = Math.max(0, this.requestsCreating - 1); },
        isRequestBeingCreated() { return this.requestsCreating > 0; },
        register(plan: RidePlan) { this.plans.set(plan.requestId, plan); },
        owns(requestId: number) { return this.plans.has(requestId); },
        get(requestId: number) { return this.plans.get(requestId); },
        claimFirstOffer(requestId: number) {
          if (this.firstOffers.has(requestId)) return false;
          this.firstOffers.add(requestId);
          return true;
        },
        consumeForcedDecline() {
          if (this.forceDeclinesRemaining <= 0) return false;
          this.forceDeclinesRemaining -= 1;
          return true;
        },
        forceDeclines(count: number) { this.forceDeclinesRemaining += count; },
        complete(requestId: number) {
          const plan = this.plans.get(requestId);
          this.plans.delete(requestId);
          plan?.onCompleted();
        },
        setDriverOnline: async (driver: DriverBot, online: boolean) => this.setDriverOnline(slug, driver, online),
      } satisfies TenantRuntime;
      this.runtimes.set(slug, runtime);
    }

    this.actionExecutor = new ActionExecutor({
      context: this.context,
      catalogue: options.catalogue,
      clock: this.clock,
      shutdownSignal: this.shutdownController.signal,
      tenant: (slug) => this.runtimes.get(slug as TenantSlug),
      config: (slug) => this.configValue.tenants[slug]!,
      publish: (tenant, type, message, data) => this.eventHub.publish({ tenant, type, message, ...(data ? { data } : {}) }),
    });
  }

  async start(): Promise<void> {
    if (this.startupComplete || this.stopping) return;
    await this.restoreState();
    let retryDelay = 1_000;
    while (!this.stopping) {
      try {
        await this.startAttempt();
        this.startupComplete = true;
        for (const runtime of this.runtimes.values()) {
          this.logger.event(runtime.tenant.slug, "system", "simulator ready");
        }
        return;
      } catch (error) {
        await this.cleanupStartupAttempt();
        if (this.stopping) return;
        this.logger.error("default", "system", "startup", error);
        this.logger.event("default", "system", "simulator retry", `${retryDelay}ms`);
        try {
          await this.clock.sleep(retryDelay, this.startupController.signal);
        } catch {
          return;
        }
        retryDelay = Math.min(30_000, retryDelay * 2);
      }
    }
  }

  createControlServer(port: number): ControlServer {
    return new ControlServer(port, {
      status: () => this.status(),
      pois: () => this.options.catalogue.pois,
      getConfig: () => this.getConfig(),
      patchConfig: (patch) => this.patchConfig(patch),
      applyPreset: (body) => this.applyPresetPatch(body),
      executeAction: (name, body) => this.actionExecutor.execute(name, body),
      events: this.eventHub,
    });
  }

  getConfig(): SimConfig {
    return structuredClone(this.configValue);
  }

  patchConfig(patch: unknown): PatchResult {
    const result = applyConfigPatch(this.configValue, patch, this.context);
    if (result.ok && result.changed.length > 0) this.commitConfig(result.config, result.changed);
    return result;
  }

  status(): ControlStatus {
    const tenants = [...this.runtimes.values()].map((runtime) => {
      const drivers = runtime.tenant.drivers.map((account) => {
        const driver = runtime.drivers.find((candidate) => candidate.accountKey === account.key);
        return {
          email: account.email,
          name: account.displayName,
          state: driver?.state ?? "offline" as const,
          poi: driver?.poi ?? null,
          rideId: driver?.rideId ?? null,
          delayedUntil: driver?.delayedUntil ?? null,
        };
      });
      const riders = runtime.tenant.riders.map((account) => {
        const rider = runtime.riders.find((candidate) => candidate.account.key === account.key);
        return {
          email: account.email,
          name: account.displayName,
          state: rider?.state ?? "idle" as const,
          rideRequestId: rider?.activeRequestId ?? null,
        };
      });
      return {
        slug: runtime.tenant.slug,
        name: runtime.brandName ?? runtime.tenant.name,
        currency: runtime.tenant.currency,
        drivers,
        riders,
        pendingRequests: riders.filter((rider) => rider.state === "requested").length,
        activeTrips: drivers.filter((driver) => driver.rideId !== null).length,
        completedTrips: runtime.drivers.reduce((total, driver) => total + driver.completedRides, 0),
      };
    });
    return {
      paused: this.pausedValue,
      speedFactor: this.speedValue,
      uptimeSec: Math.max(0, Math.floor((this.clock.now() - this.startedAt) / 1_000)),
      tenants,
      recentErrors: this.logger.recentErrors(),
    };
  }

  setSpeed(factor: number): void {
    this.patchConfig({ speedFactor: factor });
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    this.startupController.abort(new Error("Simulator is shutting down"));
    this.shutdownController.abort(new Error("Simulator is shutting down"));
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    for (const runtime of this.runtimes.values()) {
      runtime.arrivalController.abort(new Error("Simulator is shutting down"));
      runtime.arrivalWakeController.abort(new Error("Simulator is shutting down"));
      for (const rider of runtime.riders) rider.stop();
      for (const driver of runtime.drivers) driver.stopMovement();
    }

    await this.flushState();
    const drivers = [...this.runtimes.values()].flatMap((runtime) => runtime.drivers);
    await settleWithin(Promise.all(drivers.map(async (driver) => {
      try {
        await driver.setUnavailable();
        this.logger.event(driver.tenant, driver.name, "offline");
      } catch (error) {
        this.logger.error(driver.tenant, driver.name, "set unavailable", error);
      }
    })), 2_500);
    await settleWithin(Promise.allSettled([
      ...[...this.runtimes.values()].flatMap((runtime) => runtime.drivers.map((driver) => driver.closeSocket())),
      ...[...this.runtimes.values()].flatMap((runtime) => runtime.riders.map((rider) => rider.closeSocket())),
    ]), 1_000);
    await settleWithin(Promise.all([...this.loggedInApis].map(async (api) => {
      try {
        await api.logout();
      } catch (error) {
        this.logger.error("default", "system", "logout", error);
      }
    })), 1_000);
    await settleWithin(Promise.allSettled([...this.runtimes.values()].map((runtime) => runtime.arrivals ?? Promise.resolve())), 250);
  }

  private async startAttempt(): Promise<void> {
    const accounts = [...this.runtimes.values()].flatMap((runtime) => [
      ...runtime.tenant.riders,
      ...runtime.tenant.drivers,
    ]);
    const identities = new Map<string, Awaited<ReturnType<SimApi["login"]>>>();
    for (const account of accounts) {
      await this.staggerLogin();
      this.assertRunning();
      const api = this.apiFor(account);
      const identity = await api.login(account.email, account.password);
      this.loggedInApis.add(api);
      identities.set(account.key, identity);
      this.assertRunning();
    }

    for (const runtime of this.runtimes.values()) {
      const firstAccount = accounts.find((account) => account.tenant === runtime.tenant.slug);
      if (!firstAccount) throw new Error(`Tenant ${runtime.tenant.slug} has no simulator accounts`);
      const branding = await this.apiFor(firstAccount).getTenantBranding(runtime.tenant.slug);
      this.assertRunning();
      if (!Number.isSafeInteger(branding.tenantId) || branding.tenantId < 1) {
        throw new Error(`Tenant branding did not include a valid id for ${runtime.tenant.slug}`);
      }
      runtime.tenantId = branding.tenantId;
      runtime.brandName = branding.brandName || runtime.tenant.name;
    }

    for (const account of accounts) {
      const identity = identities.get(account.key);
      const runtime = this.runtimes.get(account.tenant);
      if (!identity || !runtime || identity.email.toLowerCase() !== account.email.toLowerCase()
        || identity.role !== account.role || identity.tenantId !== runtime.tenantId
        || !account.email.endsWith(`@${runtime.tenant.simDomain}`)) {
        throw new Error(`Refusing account ${account.key}: logged-in identity does not match tenant ${account.tenant} and role ${account.role}`);
      }
    }

    for (const runtime of this.runtimes.values()) {
      for (const account of runtime.tenant.riders) {
        const api = this.apiFor(account);
        const rider = new RiderBot(
          account,
          api,
          this.stompFor(account, api),
          this.options.catalogue,
          this.clock,
          this.randomFor(account),
          this.logger,
          runtime,
        );
        runtime.riders.push(rider);
      }
    }
    for (const runtime of this.runtimes.values()) {
      for (const rider of runtime.riders) {
        await rider.start();
        this.assertRunning();
      }
    }

    for (const runtime of this.runtimes.values()) {
      for (const [index, account] of runtime.tenant.drivers.entries()) {
        const api = this.apiFor(account);
        const driver = new DriverBot({
          account,
          api,
          stomp: this.stompFor(account, api),
          catalogue: this.options.catalogue,
          clock: this.clock,
          simulationClock: new SimulationClock(this.clock, () => this.speedValue),
          random: this.randomFor(account),
          speedFactor: () => this.speedValue,
          logger: this.logger,
          registry: runtime,
          config: () => this.configValue.tenants[runtime.tenant.slug]!,
        });
        runtime.drivers.push(driver);
        await driver.start(index < this.configValue.tenants[runtime.tenant.slug]!.onlineDrivers);
        this.assertRunning();
      }
    }

    if (this.options.startBackgroundLoops !== false) {
      for (const runtime of this.runtimes.values()) {
        for (const driver of runtime.drivers) driver.startIdleRepositioning();
        runtime.arrivals = this.arrivalLoop(runtime);
      }
    }
  }

  private async restoreState(): Promise<void> {
    if (this.stateLoaded) return;
    if (this.options.stateFile) {
      this.configValue = await loadState(this.options.stateFile, this.context, this.configValue);
    }
    this.stateLoaded = true;
    this.speedValue = this.configValue.speedFactor;
    this.pausedValue = this.configValue.paused;
    this.reseed(this.configValue.seed);
  }

  private async cleanupStartupAttempt(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      runtime.arrivalController.abort(new Error("Startup attempt failed"));
      runtime.arrivalWakeController.abort(new Error("Startup attempt failed"));
      for (const rider of runtime.riders) {
        rider.stop();
        await rider.closeSocket().catch(() => undefined);
      }
      for (const driver of runtime.drivers) {
        driver.stopMovement();
        await driver.setUnavailable().catch(() => undefined);
        await driver.closeSocket().catch(() => undefined);
      }
      runtime.riders = [];
      runtime.drivers = [];
      runtime.plans.clear();
      runtime.firstOffers.clear();
      runtime.requestsCreating = 0;
      runtime.forceDeclinesRemaining = 0;
      runtime.tenantId = undefined;
      runtime.brandName = undefined;
      runtime.arrivalController = new AbortController();
      runtime.arrivalWakeController = new AbortController();
    }
    await Promise.all([...this.loggedInApis].map((api) => api.logout().catch(() => undefined)));
    this.loggedInApis.clear();
    this.accountApis.clear();
    this.lastLoginStartedAt = null;
  }

  private commitConfig(config: SimConfig, changed: string[]): void {
    const previousSeed = this.configValue.seed;
    this.configValue = structuredClone(config);
    this.speedValue = config.speedFactor;
    this.pausedValue = config.paused;
    if (previousSeed !== config.seed) this.reseed(config.seed);
    for (const runtime of this.runtimes.values()) {
      this.wakeArrivalLoop(runtime);
      const tenantConfig = config.tenants[runtime.tenant.slug]!;
      this.reconcileDrivers(runtime, tenantConfig.onlineDrivers);
    }
    this.scheduleSave();
    this.logger.event("default", "control", "config changed", changed.join(", "));
  }

  private applyPresetPatch(body: unknown): PatchResult {
    if (!isRecord(body)) return { ok: false, error: "preset body must be a JSON object" };
    for (const key of Object.keys(body)) {
      if (key !== "name" && key !== "tenant") return { ok: false, error: `unknown preset field "${key}"` };
    }
    if (!isPresetName(body.name)) return { ok: false, error: `unknown preset "${String(body.name)}"` };
    if (body.tenant !== undefined && typeof body.tenant !== "string") {
      return { ok: false, error: "tenant must be a string" };
    }
    const result = applyPreset(this.configValue, body.name, body.tenant, this.context);
    if (result.ok && result.changed.length > 0) this.commitConfig(result.config, result.changed);
    return result;
  }

  private async setDriverOnline(slug: TenantSlug, driver: DriverBot, online: boolean): Promise<void> {
    await driver.setOnline(online);
    const runtime = this.runtimes.get(slug);
    if (!runtime) return;
    const onlineDrivers = runtime.drivers.filter((candidate) => candidate.wantsOnline).length;
    const result = applyConfigPatch(this.configValue, { tenants: { [slug]: { onlineDrivers } } }, this.context);
    if (result.ok && result.changed.length > 0) this.commitConfig(result.config, result.changed);
  }

  private reconcileDrivers(runtime: TenantRuntime, count: number): void {
    const desired = new Set(runtime.drivers.filter((driver) => driver.wantsOnline).slice(0, count));
    for (const driver of runtime.drivers) {
      if (desired.size >= count) break;
      if (!driver.wantsOnline) desired.add(driver);
    }
    for (const driver of runtime.drivers) {
      void driver.setOnline(desired.has(driver)).catch((error: unknown) => {
        this.logger.error(runtime.tenant.slug, driver.accountKey, "apply online driver config", error);
      });
    }
  }

  private wakeArrivalLoop(runtime: TenantRuntime): void {
    runtime.arrivalWakeController.abort(new Error("Runtime config changed"));
    runtime.arrivalWakeController = new AbortController();
  }

  private async arrivalLoop(runtime: TenantRuntime): Promise<void> {
    while (!this.stopping) {
      const wakeController = runtime.arrivalWakeController;
      const signal = AbortSignal.any([
        runtime.arrivalController.signal,
        wakeController.signal,
        this.shutdownController.signal,
      ]);
      const tenantConfig = this.configValue.tenants[runtime.tenant.slug]!;
      const delay = this.pausedValue || tenantConfig.requestIntervalSec === 0
        ? 1_000
        : poissonDelayMs(runtime.random, this.speedValue, tenantConfig.requestIntervalSec);
      try {
        await this.clock.sleep(delay, signal);
      } catch {
        if (this.stopping || runtime.arrivalController.signal.aborted) return;
        continue;
      }
      if (this.pausedValue || this.stopping || tenantConfig.requestIntervalSec === 0) continue;
      const availableRiders = runtime.riders.filter((rider) => rider.state === "idle");
      if (availableRiders.length === 0) continue;
      const rider = availableRiders[Math.floor(runtime.random.next() * availableRiders.length)]!;
      await rider.requestRide({ airportShare: tenantConfig.airportShare, hotspots: tenantConfig.hotspots });
    }
  }

  private scheduleSave(): void {
    if (!this.options.stateFile) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void saveState(this.options.stateFile!, this.configValue).catch((error: unknown) => {
        this.logger.error("default", "system", "save runtime state", error);
      });
    }, MAX_SAVE_DELAY_MS);
    this.saveTimer.unref?.();
  }

  private async flushState(): Promise<void> {
    if (!this.options.stateFile) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      await saveState(this.options.stateFile, this.configValue);
    } catch (error) {
      this.logger.error("default", "system", "save runtime state", error);
    }
  }

  private reseed(seed: number): void {
    for (const runtime of this.runtimes.values()) runtime.random.reset(deriveSeed(seed, runtime.tenant.slug));
    for (const [key, stream] of this.randomStreams) stream.reset(deriveSeed(seed, key));
  }

  private apiFor(account: SimAccount): SimApi {
    let api = this.accountApis.get(account.key);
    if (!api) {
      api = this.apiFactory(this.options.apiBaseUrl);
      this.accountApis.set(account.key, api);
    }
    return api;
  }

  private stompFor(account: SimAccount, api: SimApi): StompSessionType {
    if (this.options.stompFactory) return this.options.stompFactory(account, api);
    const endpoint = new URL("/ws/websocket", this.options.apiBaseUrl);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    return new StompSession({
      api,
      webSocketUrl: endpoint.toString(),
      clock: this.clock,
      random: new SeededRandom(deriveSeed(this.configValue.seed, `${account.key}:stomp`)),
      onReconnect: () => this.logger.event(account.tenant, account.key, "WebSocket reconnecting"),
    });
  }

  private randomFor(account: SimAccount): RandomSource {
    let stream = this.randomStreams.get(account.key);
    if (!stream) {
      stream = new SeededRandom(deriveSeed(this.configValue.seed, account.key));
      this.randomStreams.set(account.key, stream);
    }
    return stream;
  }

  private async staggerLogin(): Promise<void> {
    if (this.lastLoginStartedAt !== null) {
      const wait = 600 - (this.clock.now() - this.lastLoginStartedAt);
      if (wait > 0) await this.clock.sleep(wait, this.startupController.signal);
    }
    this.lastLoginStartedAt = this.clock.now();
  }

  private assertRunning(): void {
    if (this.stopping) throw new Error("Simulator startup was interrupted by shutdown");
  }
}

function makeConfigContext(tenants: TenantSlug[], catalogue: RouteCatalogue): ConfigContext {
  const fleetSizes: Record<string, number> = {};
  for (const slug of tenants) fleetSizes[slug] = SIM_TENANTS[slug].drivers.length;
  return {
    fleetSizes,
    poiIds: catalogue.pois.map((poi) => poi.id),
    airportPoiIds: catalogue.pois.filter((poi) => poi.kind === "airport").map((poi) => poi.id),
    poiKinds: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.kind])),
    poiWeights: Object.fromEntries(catalogue.pois.map((poi) => [poi.id, poi.weight])),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deriveSeed(seed: number, input: string): number {
  let hash = seed >>> 0;
  for (const character of input) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  return hash || 1;
}

async function settleWithin(promise: Promise<unknown>, maximumMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    promise.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => { timeout = setTimeout(resolve, maximumMs); }),
  ]);
  if (timeout) clearTimeout(timeout);
}
