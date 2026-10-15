import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const demoSimScript = fileURLToPath(new URL("../../../../../scripts/demo-sim.sh", import.meta.url));
const panelPath = fileURLToPath(new URL("../../src/control/panel.html", import.meta.url));

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("demo simulator error feedback", () => {
  it("prints control API errors to stderr and exits non-zero", async () => {
    const directory = await mkdtemp(join(tmpdir(), "demo-sim-cli-"));
    temporaryDirectories.push(directory);
    const scriptsDirectory = join(directory, "scripts");
    const runtimeDirectory = join(directory, ".demo-runtime");
    const binaryDirectory = join(directory, "bin");
    await Promise.all([
      mkdir(scriptsDirectory, { recursive: true }),
      mkdir(runtimeDirectory, { recursive: true }),
      mkdir(binaryDirectory, { recursive: true }),
    ]);
    const scriptLink = join(scriptsDirectory, "demo-sim.sh");
    await symlink(demoSimScript, scriptLink);
    await writeFile(join(runtimeDirectory, "sim.port"), "8795\n");
    const fakeCurl = join(binaryDirectory, "curl");
    await writeFile(fakeCurl, "#!/bin/sh\nprintf '%s\\n%s' '{\"error\":\"No idle simulated rider is available.\"}' '409'\n");
    await chmod(fakeCurl, 0o755);

    const result = spawnSync("bash", [scriptLink, "do", "request-trip"], {
      cwd: directory,
      env: { ...process.env, PATH: `${binaryDirectory}:${process.env.PATH ?? ""}` },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HTTP 409");
    expect(result.stderr).toContain("No idle simulated rider is available.");
  });

  it("surfaces the API error message in an accessible error toast", async () => {
    const panel = await readFile(panelPath, "utf8");

    expect(panel).toContain('const message = body && typeof body.error === "string" ? body.error : "Request failed (" + response.status + ")";');
    expect(panel).toContain('showToast("Action failed: " + error.message, "error")');
    expect(panel).toContain('toast.setAttribute("role", kind === "error" ? "alert" : "status")');
  });
});
