import { expect, test as base } from "@playwright/test";

type DiagnosticsFixtures = {
  pageDiagnostics: void;
};

/**
 * Every browser test fails on uncaught page errors, console errors, or HTTP
 * error responses. This keeps production-preview regressions visible instead
 * of allowing an otherwise successful interaction to hide them.
 */
export const test = base.extend<DiagnosticsFixtures>({
  pageDiagnostics: [
    async ({ page }, use) => {
      const failures: string[] = [];

      page.on("console", (message) => {
        if (message.type() === "error") {
          failures.push(`console.error: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        failures.push(`pageerror: ${error.message}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 400) {
          failures.push(`${response.status()} ${response.url()}`);
        }
      });

      await use();

      expect.soft(failures, "unexpected browser diagnostics").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
