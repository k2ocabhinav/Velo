function runtimeEnv(): Record<string, string | undefined> | undefined {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };

  return runtime.process?.env;
}

export function getEnvValue(name: string): string | undefined {
  return runtimeEnv()?.[name];
}

export function getApiBaseUrl(): string {
  const baseUrl =
    getEnvValue("VELO_API_BASE_URL") ??
    getEnvValue("NEXT_PUBLIC_API_BASE_URL") ??
    "http://localhost:8080";

  return baseUrl.replace(/\/$/, "");
}

