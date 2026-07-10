import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/benchmark",
  testMatch: "mock-performance.spec.ts",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  outputDir: "test-results/benchmark",
  preserveOutput: "always",
  use: {
    baseURL: "http://127.0.0.1:4173/10th/",
    serviceWorkers: "allow",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium-benchmark",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/10th/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
