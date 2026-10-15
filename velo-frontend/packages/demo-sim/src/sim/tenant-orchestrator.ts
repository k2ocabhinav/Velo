import { VeloHttpClient, type SimApi } from "../api/http-client.ts";
import { StompSession } from "../api/stomp-session.ts";
import { ControlServer } from "../control/server.ts";
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
  riders: RiderBot[];
  drivers: DriverBot[];
  plans: Map<number, RidePlan>;
  firstOffers: Set<number>;
  requestsCreating: number;
  arrivals?: Promise<void>;
  arrivalController: AbortController;
  random: RandomSource;
}

export interface TenantOrchestratorOptions {
  apiBaseUrl: string;
  tenants: TenantSlug[];
  catalogue: RouteCatalogue;
  seed: number;
  speed: number;
  paused: boolean;
  clock?: Clock;
  logger?: SimLogger;
  apiFactory?: (apiBaseUrl: string) => SimApi;
}

export class TenantOrchestrator {
  private readonly clock: Clock;
  private readonly logger: SimLogger;
  private readonly apiFactory: (apiBaseUrl: string) => SimApi;
  private readonly runtimes = new Map<TenantSlug, TenantRuntime>();
  private readonly accountApis = new Map<string, SimApi>();
  private readonly loggedInApis = new Set<SimApi>();
  private readonly startedAt: number;
  private speedValue: number;
  private pausedValue: boolean;
  private lastLoginStartedAt: number | null = null;
  private stopping = false;
  private readonly options: TenantOrchestratorOptions;

  constructor(options: TenantOrchestratorOptions) {
    this.options = options;
    this.clock = options.clock ?? new SystemClock();
    this.logger = options.logger ?? new SimLogger(this.clock);
    this.apiFactory = options.apiFactory ?? ((apiBaseUrl) => new VeloHttpClient({ apiBaseUrl, now: () => this.clock.now() }));
    this.speedValue = options.speed;
    this.pausedValue = options.paused;
    this.startedAt = this.clock.now();
    for (const slug of options.tenants) {
      const runtime: TenantRuntime = {
        tenant: SIM_TENANTS[slug],
        riders: [],
        drivers: [],
        plans: new Map(),
        firstOffers: new Set(),
        requestsCreating: 0,
        arrivalController: new AbortController(),
        random: new SeededRandom(deriveSeed(options.seed, slug)),
        beginRequest() { this.requestsCreating += 1; },
        endRequest() { this.requestsCreating = Math.max(0, this.requestsCreating - 1); },
        isRequestBeingCreated() { return this.requestsCreating > 0; },
        register(plan) { this.plans.set(plan.requestId, plan); },
        owns(requestId) { return this.plans.has(requestId); },
        get(requestId) { return this.plans.get(requestId); },
        claimFirstOffer(requestId) {
          if (this.firstOffers.has(requestId)) {
            return false;
          }
          this.firstOffers.add(requestId);
          return true;
        },
        complete(requestId) {
          const plan = this.plans.get(requestId);
          this.plans.delete(requestId);
          plan?.onCompleted();
        },
      };
      this.runtimes.set(slug, runtime);
    }
  }

  async start(): Promise<void> {
    const accounts = [...this.runtimes.values()].flatMap((runtime) => [
      ...runtime.tenant.riders,
      ...runtime.tenant.drivers,
    ]);
    for (const runtime of this.runtimes.values()) {
      const firstAccount = accounts.find((account) => account.tenant === runtime.tenant.slug);
      if (!firstAccount) {
        throw new Error(`Tenant ${runtime.tenant.slug} has no simulator accounts`);
      }
      const api = this.apiFor(firstAccount);
      const branding = await api.getTenantBranding(runtime.tenant.slug);
      this.assertRunning();
      if (!Number.isSafeInteger(branding.tenantId) || branding.tenantId < 1) {
        throw new Error(`Tenant branding did not include a valid id for ${runtime.tenant.slug}`);
      }
      runtime.tenantId = branding.tenantId;
    }

    for (const account of accounts) {
      await this.staggerLogin();
      this.assertRunning();
      const api = this.apiFor(account);
      const identity = await api.login(account.email, account.password);
      this.loggedInApis.add(api);
      if (this.stopping) {
        await api.logout().catch(() => undefined);
        this.assertRunning();
      }
      const runtime = this.runtimes.get(account.tenant);
      if (!runtime || identity.email.toLowerCase() !== account.email.toLowerCase()
        || identity.role !== account.role || identity.tenantId !== runtime.tenantId
        || !account.email.endsWith(`@${runtime.tenant.simDomain}`)) {
        throw new Error(`Refusing account ${account.key}: logged-in identity does not match tenant ${account.tenant} and role ${account.role}`);
      }
    }

    for (const runtime of this.runtimes.values()) {
      for (const account of runtime.tenant.riders) {
        const api = this.apiFor(account);
        const stomp = this.stompFor(account, api);
        runtime.riders.push(new RiderBot(account, api, stomp, this.options.catalogue, this.clock, this.randomFor(account), this.logger, runtime));
      }
    }
    for (const runtime of this.runtimes.values()) {
      for (const rider of runtime.riders) {
        await rider.start();
        this.assertRunning();
      }
    }
    for (const runtime of this.runtimes.values()) {
      for (const account of runtime.tenant.drivers) {
        const api = this.apiFor(account);
        const stomp = this.stompFor(account, api);
        const driver = new DriverBot({
          account,
          api,
          stomp,
          catalogue: this.options.catalogue,
          clock: this.clock,
          simulationClock: new SimulationClock(this.clock, () => this.speedValue),
          random: this.randomFor(account),
          speedFactor: () => this.speedValue,
          logger: this.logger,
          registry: runtime,
        });
        runtime.drivers.push(driver);
      }
    }
    for (const runtime of this.runtimes.values()) {
      for (const driver of runtime.drivers) {
        await driver.start();
        this.assertRunning();
      }
    }
    for (const runtime of this.runtimes.values()) {
      for (const driver of runtime.drivers) {
        driver.startIdleRepositioning();
      }
    }

    for (const runtime of this.runtimes.values()) {
      this.assertRunning();
      runtime.arrivals = this.arrivalLoop(runtime);
    }
    for (const runtime of this.runtimes.values()) {
      this.logger.event(runtime.tenant.slug, "system", "simulator ready");
    }
  }

  createControlServer(port: number): ControlServer {
    return new ControlServer(port, {
      status: () => this.status(),
      pause: () => {
        this.pausedValue = true;
        this.logger.event("default", "control", "paused");
      },
      resume: () => {
        this.pausedValue = false;
        this.logger.event("default", "control", "resumed");
      },
      setSpeed: (factor) => {
        this.setSpeed(factor);
        this.logger.event("default", "control", "speed set", factor);
      },
    });
  }

  status(): ControlStatus {
    const tenants: ControlStatus["tenants"] = {};
    for (const [slug, runtime] of this.runtimes) {
      tenants[slug] = {
        drivers: runtime.drivers.map((driver) => ({ name: driver.name, state: driver.state, rideId: driver.rideId })),
        activeTrips: runtime.drivers.filter((driver) => driver.rideId !== null).length,
        completedCount: runtime.drivers.reduce((total, driver) => total + driver.completedRides, 0),
        recentErrors: this.logger.recentErrors(slug),
      };
    }
    return {
      paused: this.pausedValue,
      speed: this.speedValue,
      uptimeSeconds: Math.max(0, Math.floor((this.clock.now() - this.startedAt) / 1_000)),
      tenants,
    };
  }

  setSpeed(factor: number): void {
    if (!Number.isInteger(factor) || factor < 1 || factor > 20) {
      throw new RangeError("Speed factor must be an integer from 1 to 20");
    }
    this.speedValue = factor;
  }

  async stop(): Promise<void> {
    if (this.stopping) {
      return;
    }
    this.stopping = true;
    for (const runtime of this.runtimes.values()) {
      runtime.arrivalController.abort(new Error("Simulator is shutting down"));
    }
    for (const runtime of this.runtimes.values()) {
      for (const rider of runtime.riders) {
        rider.stop();
      }
      for (const driver of runtime.drivers) {
        driver.stopMovement();
      }
    }

    const drivers = [...this.runtimes.values()].flatMap((runtime) => runtime.drivers);
    await settleWithin(Promise.all(drivers.map(async (driver) => {
      try {
        await driver.setUnavailable();
        this.logger.event(driver.tenant, driver.name, "offline");
      } catch (error) {
        this.logger.error("default", driver.name, "set unavailable", error);
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

  private async arrivalLoop(runtime: TenantRuntime): Promise<void> {
    while (!this.stopping) {
      try {
        await this.clock.sleep(poissonDelayMs(runtime.random, this.speedValue), runtime.arrivalController.signal);
      } catch {
        return;
      }
      if (this.pausedValue || this.stopping) {
        continue;
      }
      const availableRiders = runtime.riders.filter((rider) => rider.activeRequestId === null);
      if (availableRiders.length === 0) {
        continue;
      }
      const rider = availableRiders[Math.floor(runtime.random.next() * availableRiders.length)]!;
      await rider.requestRide();
    }
  }

  private apiFor(account: SimAccount): SimApi {
    let api = this.accountApis.get(account.key);
    if (!api) {
      api = this.apiFactory(this.options.apiBaseUrl);
      this.accountApis.set(account.key, api);
    }
    return api;
  }

  private stompFor(account: SimAccount, api: SimApi): StompSession {
    const endpoint = new URL("/ws/websocket", this.options.apiBaseUrl);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    return new StompSession({
      api,
      webSocketUrl: endpoint.toString(),
      clock: this.clock,
      random: new SeededRandom(deriveSeed(this.options.seed, `${account.key}:stomp`)),
      onReconnect: () => this.logger.event(account.tenant, account.key, "WebSocket reconnecting"),
    });
  }

  private randomFor(account: SimAccount): RandomSource {
    return new SeededRandom(deriveSeed(this.options.seed, account.key));
  }

  private async staggerLogin(): Promise<void> {
    if (this.lastLoginStartedAt !== null) {
      const wait = 600 - (this.clock.now() - this.lastLoginStartedAt);
      if (wait > 0) {
        await this.clock.sleep(wait);
      }
    }
    this.lastLoginStartedAt = this.clock.now();
  }

  private assertRunning(): void {
    if (this.stopping) {
      throw new Error("Simulator startup was interrupted by shutdown");
    }
  }
}

function deriveSeed(seed: number, input: string): number {
  let hash = seed >>> 0;
  for (const character of input) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0;
  }
  return hash || 1;
}

async function settleWithin(promise: Promise<unknown>, maximumMs: number): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    promise.then(() => undefined, () => undefined),
    new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, maximumMs);
    }),
  ]);
  if (timeout) {
    clearTimeout(timeout);
  }
}
