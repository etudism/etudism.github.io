import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/manual",
  timeout: 30 * 60 * 1_000,
  expect: { timeout: 20 * 60 * 1_000 },
  fullyParallel: false,
  forbidOnly: true,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173/10th/",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/10th/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
