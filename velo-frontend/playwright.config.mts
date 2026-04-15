import { defineConfig, devices } from "@playwright/test";

const adminBaseURL = process.env.PLAYWRIGHT_ADMIN_BASE_URL ?? "http://127.0.0.1:4101";
const riderBaseURL = process.env.PLAYWRIGHT_RIDER_BASE_URL ?? "http://127.0.0.1:4102";
const driverBaseURL = process.env.PLAYWRIGHT_DRIVER_BASE_URL ?? "http://127.0.0.1:4103";
const includeAdminWebkit = process.env.PLAYWRIGHT_INCLUDE_WEBKIT === "1";

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
    {
      command: "npm run dev --workspace @velo/driver",
      url: driverBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    },
    {
      command: "npm run dev --workspace @velo/rider",
      url: riderBaseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000
    }
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
    ...(includeAdminWebkit
      ? [
          {
            name: "admin-webkit",
            testMatch: /admin-.*\.spec\.ts/,
            use: {
              ...devices["Desktop Safari"],
              baseURL: adminBaseURL
            }
          },
        ]
      : []),
    {
      name: "driver-chromium",
      testMatch: /driver-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: driverBaseURL
      }
    },
    {
      name: "rider-chromium",
      testMatch: /rider-.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: riderBaseURL
      }
    }
  ]
});
