import type { SimAccount, SimTenant, TenantSlug } from "./types.ts";

const SIM_PASSWORD = "password123";

function accounts(
  tenant: TenantSlug,
  role: SimAccount["role"],
  prefix: string,
  domain: string,
  names: string[],
  vehiclePrefix?: string,
  firstVehicleNumber = 0,
): SimAccount[] {
  return names.map((displayName, index) => {
    const number = index + 1;
    return {
      key: `${prefix}${number}`,
      displayName,
      email: `${prefix}${number}@${domain}`,
      password: SIM_PASSWORD,
      role,
      tenant,
      ...(vehiclePrefix ? { vehicleId: `${vehiclePrefix}${firstVehicleNumber + number}` } : {}),
    };
  });
}

export const SIM_TENANTS: Record<TenantSlug, SimTenant> = {
  default: {
    slug: "default",
    name: "Velo Business",
    currency: "INR",
    simDomain: "sim.velobusiness.demo",
    drivers: accounts("default", "DRIVER", "driver", "sim.velobusiness.demo", [
      "Arjun Rao", "Meera Iyer", "Kabir Shah", "Nikhil Menon", "Sana Qureshi", "Rohit Kulkarni",
    ], "KA01SV", 1000),
    riders: accounts("default", "RIDER", "rider", "sim.velobusiness.demo", [
      "Priya Nair", "Daniel Brooks", "Aisha Khan", "Tom Becker",
    ]),
  },
  "saffron-routes": {
    slug: "saffron-routes",
    name: "Saffron Routes",
    currency: "INR",
    simDomain: "sim.saffronroutes.demo",
    drivers: accounts("saffron-routes", "DRIVER", "chauffeur", "sim.saffronroutes.demo", [
      "Imran Sheikh", "Lakshmi Prasad", "Vivek Hegde", "Farhan Ali", "Deepa Rao", "Suresh Gowda",
    ], "KA03SS", 2000),
    riders: accounts("saffron-routes", "RIDER", "guest", "sim.saffronroutes.demo", [
      "Kavya Reddy", "Marco Rossi", "Neha Gupta", "James Wilson",
    ]),
  },
};

export interface CliOptions {
  apiBaseUrl: string;
  controlPort: number;
  seed: number;
  speed: number;
  paused: boolean;
  stateFile?: string;
  tenants: TenantSlug[];
  help: boolean;
}

export const HELP_TEXT = `Velo demo fleet simulator

Usage:
  VELO_SIM_ALLOW=1 node src/main.ts [options]

Options:
  --api <url>                 Local API base URL (default: http://localhost:8080)
  --control-port <port>       Loopback control server port (default: 8790)
  --seed <integer>            Deterministic random seed (default: 42)
  --speed <factor>            Simulation speed, 1–20 (default: 4)
  --state-file <path>         Runtime state file (default: repo/.demo-runtime/sim-state.json)
  --paused                    Start without new rider requests
  --tenants <slugs>           Comma-separated: default,saffron-routes
  --help                      Show this help
`;

function parseInteger(value: string | undefined, label: string): number {
  if (!value || !/^-?\d+$/.test(value)) {
    throw new Error(`${label} must be an integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return parsed;
}

export function parseCliArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  let paused = false;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--paused") {
      paused = true;
      continue;
    }
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument}`);
    }
    const name = argument.slice(2);
    if (!["api", "control-port", "seed", "speed", "state-file", "tenants"].includes(name)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}`);
    }
    if (values.has(name)) {
      throw new Error(`Option ${argument} may be provided only once`);
    }
    values.set(name, value);
    index += 1;
  }

  const apiBaseUrl = values.get("api") ?? "http://localhost:8080";
  const controlPort = parseInteger(values.get("control-port") ?? "8790", "--control-port");
  const seed = parseInteger(values.get("seed") ?? "42", "--seed");
  const speed = Number(values.get("speed") ?? "4");
  if (!Number.isInteger(speed) || speed < 1 || speed > 20) {
    throw new Error("--speed must be an integer from 1 to 20");
  }
  if (controlPort < 1 || controlPort > 65535) {
    throw new Error("--control-port must be from 1 to 65535");
  }

  const rawTenants = (values.get("tenants") ?? "default,saffron-routes").split(",");
  const tenants: TenantSlug[] = [];
  for (const rawTenant of rawTenants) {
    const slug = rawTenant.trim();
    if (slug !== "default" && slug !== "saffron-routes") {
      throw new Error(`Tenant is not allowlisted: ${slug || "(empty)"}`);
    }
    if (tenants.includes(slug)) {
      throw new Error(`Tenant was provided more than once: ${slug}`);
    }
    tenants.push(slug);
  }
  if (tenants.length === 0) {
    throw new Error("Select at least one tenant with --tenants");
  }

  return {
    apiBaseUrl,
    controlPort,
    seed,
    speed,
    paused,
    ...(values.has("state-file") ? { stateFile: values.get("state-file")! } : {}),
    tenants,
    help,
  };
}
