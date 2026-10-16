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
  async function scratchRuntime(fakeCurlBody: string) {
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
    await writeFile(fakeCurl, fakeCurlBody);
    await chmod(fakeCurl, 0o755);
    const capturePath = join(directory, "curl-args.txt");
    return { directory, scriptLink, binaryDirectory, capturePath };
  }

  function runScript(setup: Awaited<ReturnType<typeof scratchRuntime>>, args: string[]) {
    return spawnSync("bash", [setup.scriptLink, ...args], {
      cwd: setup.directory,
      env: { ...process.env, PATH: `${setup.binaryDirectory}:${process.env.PATH ?? ""}`, CAPTURE: setup.capturePath },
      encoding: "utf8",
    });
  }

  it("prints control API errors to stderr and exits non-zero", async () => {
    const setup = await scratchRuntime(
      "#!/bin/sh\nprintf '%s\\n%s' '{\"error\":\"No idle simulated rider is available.\"}' '409'\n",
    );

    const result = runScript(setup, ["do", "request-trip"]);

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HTTP 409");
    expect(result.stderr).toContain("No idle simulated rider is available.");
  });

  it("sets a global key without a tenant argument", async () => {
    const setup = await scratchRuntime(
      "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$CAPTURE\"\nprintf '%s\\n%s' '{\"config\":{},\"changed\":[\"speedFactor\"]}' '200'\n",
    );

    const result = runScript(setup, ["set", "speedFactor", "12"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const captured = await readFile(setup.capturePath, "utf8");
    expect(captured).toContain('{"speedFactor":12}');
  });

  it("rejects a tenant key without a tenant argument", async () => {
    const setup = await scratchRuntime("#!/bin/sh\nexit 0\n");

    const result = runScript(setup, ["set", "onlineDrivers", "2"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("tenant key");
  });

  it("surfaces the API error message in an accessible error toast", async () => {
    const panel = await readFile(panelPath, "utf8");

    expect(panel).toContain('const message = body && typeof body.error === "string" ? body.error : "Request failed (" + response.status + ")";');
    expect(panel).toContain('showToast("Action failed: " + error.message, "error")');
    expect(panel).toContain('toast.setAttribute("role", kind === "error" ? "alert" : "status")');
  });
});
