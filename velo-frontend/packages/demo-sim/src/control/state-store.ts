import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { applyConfigPatch } from "./runtime-config.ts";
import type { ConfigContext, SimConfig } from "./runtime-config.ts";

/** Reads persisted config and re-validates it against the context; a missing or invalid file falls back. */
export async function loadState(path: string, ctx: ConfigContext, fallback: SimConfig): Promise<SimConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    return fallback;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  const result = applyConfigPatch(fallback, parsed, ctx);
  return result.ok ? result.config : fallback;
}

/** Atomically persists the config by writing a sibling temp file and renaming it into place. */
export async function saveState(path: string, config: SimConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try {
    await rename(tempPath, path);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
