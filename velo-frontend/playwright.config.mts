import { defineConfig, devices } from "@playwright/test";

const adminBaseURL = process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:3000";
const riderBaseURL = process.env.PLAYWRIGHT_RIDER_BASE_URL ?? "http://127.0.0.1:3001";
const enableRiderProject = process.env.PLAYWRIGHT_ENABLE_RIDER === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "on-first-retry" },
  webServer: [
    {
      command: "npm run dev --workspace @velo/admin",
      url: adminBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    ...(enableRiderProject
      ? [
          {
            command: "npm run dev --workspace @velo/rider",
            url: riderBaseURL,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000
          }
        ]
      : [])
  ],
  projects: [
    {
      name: "admin-chromium",
      testMatch: /admin-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminBaseURL
      }
    },
    ...(enableRiderProject
      ? [
          {
            name: "rider-chromium",
            testMatch: /rider-.*\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              baseURL: riderBaseURL
            }
          }
        ]
      : [])
  ]
});
