import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/public",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalTimeout: 10 * 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-public" }],
  ],
  outputDir: "test-results/public",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "https://etudism.github.io/10th/",
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
    actionTimeout: 10_000,
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "public-chromium",
      use: { browserName: "chromium" },
    },
  ],
});
