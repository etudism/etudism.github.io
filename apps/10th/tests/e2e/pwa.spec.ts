import { expect, test } from "./fixtures";
import { UI } from "./story-helpers";

test.describe("production PWA", () => {
  test("serves the app shell, assets, manifest, and service worker under /10th/", async ({
    page,
    request,
  }) => {
    const requiredPaths = [
      "/10th/",
      "/10th/manifest.webmanifest",
      "/10th/version.json",
      "/10th/sw.js",
      "/10th/icon-192.png",
      "/10th/icon-512.png",
      "/10th/icon-maskable-512.png",
    ];

    for (const path of requiredPaths) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
    }

    const manifestResponse = await request.get("/10th/manifest.webmanifest");
    const manifest = (await manifestResponse.json()) as {
      start_url?: string;
      scope?: string;
      display?: string;
    };
    expect(manifest).toMatchObject({
      start_url: "/10th/",
      scope: "/10th/",
      display: "standalone",
    });

    const versionResponse = await request.get("/10th/version.json");
    const version = (await versionResponse.json()) as Record<string, unknown>;
    expect(version).toMatchObject({
      appVersion: "0.2.0",
      defaultModel: "Qwen3-0.6B-q4f16_1-MLC",
      performancePipeline: "v2",
    });
    expect(version.buildSha).toMatch(/^(?:[0-9a-f]{40}|unknown)$/u);

    const workerResponse = await request.get("/10th/sw.js");
    const workerSource = await workerResponse.text();
    expect(workerSource).not.toMatch(/\.(?:bin|gguf|safetensors|params)["']/u);

    await page.goto("./");
    await expect(
      page.getByRole("heading", { name: UI.inputHeading }),
    ).toBeVisible();

    const initialRequests = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((entry) => entry.name),
    );
    expect(initialRequests).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/WebLLM|webllm\.worker|lib-/u),
      ]),
    );

    const shellAssets = await page
      .locator('script[src], link[rel="stylesheet"][href]')
      .evaluateAll((elements) =>
        elements
          .map(
            (element) =>
              element.getAttribute("src") ?? element.getAttribute("href"),
          )
          .filter((path): path is string => path !== null),
      );
    expect(shellAssets.length).toBeGreaterThanOrEqual(2);
    for (const asset of shellAssets) {
      expect(asset).toMatch(/^\/10th\//u);
      const response = await request.get(asset);
      expect(response.status(), asset).toBe(200);
    }

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return {
        scope: ready.scope,
        scriptURL: ready.active?.scriptURL ?? null,
      };
    });
    expect(registration.scope).toBe("http://127.0.0.1:4173/10th/");
    expect(registration.scriptURL).toBe("http://127.0.0.1:4173/10th/sw.js");
  });

  test("reloads the app shell while offline after service-worker activation", async ({
    context,
    page,
  }) => {
    await page.goto("./?provider=mock&mockDelay=0");
    await expect(
      page.getByRole("heading", { name: UI.inputHeading }),
    ).toBeVisible();
    await page.evaluate(async () => navigator.serviceWorker.ready);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect
      .poll(() =>
        page.evaluate(() => navigator.serviceWorker.controller !== null),
      )
      .toBe(true);

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: UI.inputHeading }),
      ).toBeVisible();
      await expect(page.locator(".wordmark")).toContainText("終われる物語");
    } finally {
      await context.setOffline(false);
    }
  });
});
