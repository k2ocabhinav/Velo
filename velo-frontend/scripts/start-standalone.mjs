#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  console.error(`[standalone-start] ${message}`);
  process.exit(1);
}

function hasJsChunks(chunksDir) {
  if (!existsSync(chunksDir)) {
    return false;
  }
  return readdirSync(chunksDir).some((entry) => entry.endsWith(".js"));
}

function copyStaticAssets(staticSrc, staticDest) {
  mkdirSync(dirname(staticDest), { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true, force: true });
}

const app = process.argv[2];
const port = process.argv[3];

if (!app || !port) {
  fail("Usage: node ../../scripts/start-standalone.mjs <app> <port>");
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const appRoot = resolve(repoRoot, "apps", app);
const appNextDir = resolve(appRoot, ".next");
const staticSrc = resolve(appNextDir, "static");
const staticDest = resolve(appNextDir, "standalone", "apps", app, ".next", "static");
const chunksDir = resolve(staticDest, "chunks");
const serverPath = resolve(appNextDir, "standalone", "apps", app, "server.js");

if (!existsSync(serverPath)) {
  fail(`Standalone server not found at ${serverPath}. Run build first.`);
}

if (!existsSync(staticSrc)) {
  fail(`Static assets not found at ${staticSrc}. Run build first.`);
}

copyStaticAssets(staticSrc, staticDest);

if (!hasJsChunks(chunksDir)) {
  fail(`No JS chunks found in ${chunksDir}`);
}

const child = spawn(process.execPath, [serverPath], {
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
  },
  stdio: "inherit",
});

const syncDelaysMs = [250, 1_000, 2_500, 5_000, 10_000];
const syncTimers = syncDelaysMs.map((delayMs) =>
  setTimeout(() => {
    try {
      copyStaticAssets(staticSrc, staticDest);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[standalone-start] failed to sync static assets: ${message}`);
    }
  }, delayMs)
);

const healthTimer = setInterval(() => {
  try {
    if (!hasJsChunks(chunksDir)) {
      copyStaticAssets(staticSrc, staticDest);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[standalone-start] failed to sync static assets: ${message}`);
  }
}, 500);

const healthStopTimer = setTimeout(() => {
  clearInterval(healthTimer);
}, 15_000);

child.on("exit", (code, signal) => {
  clearInterval(healthTimer);
  clearTimeout(healthStopTimer);
  for (const timer of syncTimers) {
    clearTimeout(timer);
  }

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
