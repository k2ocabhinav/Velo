import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parseCliArgs, HELP_TEXT } from "./config.ts";
import { loadRouteCatalogue } from "./geo/route-catalogue.ts";
import { SimLogger } from "./log.ts";
import { SafetyError, validateOptions } from "./safety.ts";
import { SystemClock } from "./sim/clock.ts";
import { TenantOrchestrator } from "./sim/tenant-orchestrator.ts";

export async function runCli(args: string[], allowValue: string | undefined): Promise<void> {
  const parsed = parseCliArgs(args);
  if (parsed.help) {
    process.stdout.write(HELP_TEXT);
    return;
  }
  const options = validateOptions(parsed, allowValue);
  const clock = new SystemClock();
  const logger = new SimLogger(clock);
  const catalogue = await loadRouteCatalogue();
  const orchestrator = new TenantOrchestrator({
    apiBaseUrl: options.apiBaseUrl,
    tenants: options.tenants,
    catalogue,
    seed: options.seed,
    speed: options.speed,
    paused: options.paused,
    clock,
    logger,
  });
  const control = orchestrator.createControlServer(options.controlPort);
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.event(options.tenants[0]!, "system", "shutdown", signal);
    const forceExit = setTimeout(() => process.exit(0), 4_800);
    await control.close();
    await orchestrator.stop();
    if (forceExit) {
      clearTimeout(forceExit);
    }
    process.exitCode = 0;
  };

  try {
    await control.listen();
    process.stdout.write(`[sim] control server http://127.0.0.1:${options.controlPort}\n`);
    process.once("SIGINT", () => { void shutdown("SIGINT"); });
    process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
    await orchestrator.start();
  } catch (error) {
    process.stderr.write(`[sim] ${error instanceof Error ? error.message : "Simulator startup failed"}\n`);
    await control.close();
    await orchestrator.stop();
    process.exitCode = error instanceof SafetyError ? 2 : 1;
  }
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(resolve(entry)).href);
}

if (isMainModule()) {
  void runCli(process.argv.slice(2), process.env.VELO_SIM_ALLOW).catch((error: unknown) => {
    process.stderr.write(`[sim] ${error instanceof Error ? error.message : "Simulator failed"}\n`);
    process.exitCode = error instanceof SafetyError ? 2 : 1;
  });
}
