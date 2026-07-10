/// <reference types="node" />

import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_ORIGIN = "https://etudism.github.io";
const PUBLIC_APP_URL = `${PUBLIC_ORIGIN}/10th/`;
const REPOSITORY_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

const UI = {
  inputHeading: "あなたが今退屈しているのは？",
  inputLabel: "いま感じている停滞や、変わらなさ",
  inputSubmit: "物語の入口へ",
  modelHeading: "物語を書く方法を選ぶ",
  demoStart: "デモで始める",
  openingHeading: "最初の場面",
  departurePhrase:
    "「じゃあ行ってみる？ 行ってみたら何か変わるかもしれないよ？」",
  openPage: "頁をひらく",
  branchPhrase: "「もうすこしここを見て回る？　他のところに行ってみる？」",
  stay: "もう少しここを見て回る",
  move: "他のところに行ってみる",
  closurePhrase: "この物語はここで終わることができます。終わりますか？",
  continueReading: "読書を続ける",
  endReading: "読書を終える",
  endingHeading: "終幕",
} as const;

const WEBLLM_REQUEST =
  /(?:WebLLMNarrativeProvider-|webllm\.worker-|\/lib-[^/]+\.js|huggingface|mlc-ai|qwen|gemma|\.wasm(?:$|\?))/iu;

type PublicDiagnosticsFixtures = {
  publicDiagnostics: void;
};

const test = base.extend<PublicDiagnosticsFixtures>({
  publicDiagnostics: [
    async ({ context, page }, use) => {
      const failures: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          failures.push(`console.error: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        failures.push(`pageerror: ${error.message}`);
      });
      context.on("response", (response) => {
        if (response.status() >= 400) {
          failures.push(`HTTP ${response.status()} ${response.url()}`);
        }
      });
      context.on("requestfailed", (request) => {
        failures.push(
          `requestfailed ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`,
        );
      });

      await use();

      expect
        .soft(failures, "unexpected public browser diagnostics")
        .toEqual([]);
    },
    { auto: true },
  ],
});

interface PublicVersion {
  buildSha: string;
  buildTime: string;
  appVersion: string;
  defaultModel: string;
  performancePipeline: string;
}

interface PublicManifest {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  lang: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;
}

type BranchChoice = "stay" | "move";

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function getWithoutRedirect(request: APIRequestContext, url: string) {
  const response = await request.get(url, {
    failOnStatusCode: false,
    maxRedirects: 0,
  });
  expect(response.status(), url).toBe(200);
  expect(response.url(), url).toBe(url);
  return response;
}

async function expectScene(
  page: Page,
  macroPart: number,
  scene: number,
): Promise<void> {
  await expect(
    page.getByRole("heading", {
      name: `第${macroPart}景 · ${scene} / 5`,
    }),
  ).toBeVisible();
  await expect(page.locator("article.reading-view")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function chooseBranch(
  page: Page,
  choice: BranchChoice,
  macroPart: number,
  expectedScene: number,
): Promise<void> {
  await page
    .getByRole("button", { name: choice === "stay" ? UI.stay : UI.move })
    .click();
  await expectScene(page, macroPart, expectedScene);
}

async function reachClosure(
  page: Page,
  macroPart: number,
  choices: readonly [BranchChoice, BranchChoice, BranchChoice, BranchChoice],
): Promise<void> {
  for (const [index, choice] of choices.entries()) {
    await chooseBranch(page, choice, macroPart, index + 2);
  }
  await expect(page.getByText(UI.closurePhrase, { exact: true })).toBeVisible();
}

async function persistedActiveSession(page: Page): Promise<{
  macroPartIndex?: number;
  sceneIndexInMacro?: number;
  status?: string;
} | null> {
  return page.evaluate(
    () =>
      new Promise((resolveSession, rejectSession) => {
        const openRequest = indexedDB.open("complete-reading-story-poc", 1);
        openRequest.onerror = () =>
          rejectSession(
            openRequest.error ?? new Error("IndexedDB open failed"),
          );
        openRequest.onsuccess = () => {
          const database = openRequest.result;
          if (!database.objectStoreNames.contains("sessions")) {
            database.close();
            resolveSession(null);
            return;
          }
          const transaction = database.transaction("sessions", "readonly");
          const getRequest = transaction.objectStore("sessions").get("active");
          getRequest.onerror = () => {
            database.close();
            rejectSession(
              getRequest.error ?? new Error("IndexedDB session read failed"),
            );
          };
          getRequest.onsuccess = () => {
            const value = getRequest.result as
              | {
                  macroPartIndex?: number;
                  sceneIndexInMacro?: number;
                  status?: string;
                }
              | undefined;
            database.close();
            resolveSession(value ?? null);
          };
        };
      }),
  );
}

test("published metadata, shell assets, manifest, and scoped service worker match the deployment artifact", async ({
  context,
  page,
  request,
}) => {
  const cacheBust = `public-e2e=${Date.now()}`;
  const indexResponse = await request.get(`./?${cacheBust}`);
  expect(indexResponse.status()).toBe(200);
  const indexHtml = await indexResponse.text();
  expect(indexHtml.length).toBeGreaterThan(500);
  expect(indexHtml).toContain("/10th/assets/");
  expect(indexHtml).not.toMatch(/(?:src|href)=["']\/assets\//u);

  const localVersion = JSON.parse(
    await readFile(resolve(REPOSITORY_ROOT, "10th/version.json"), "utf8"),
  ) as PublicVersion;
  const versionResponse = await request.get(`./version.json?${cacheBust}`);
  expect(versionResponse.status()).toBe(200);
  const version = (await versionResponse.json()) as PublicVersion;
  expect(version).toEqual(localVersion);
  expect(version).toMatchObject({
    appVersion: "0.2.0",
    defaultModel: "Qwen3-0.6B-q4f16_1-MLC",
    performancePipeline: "v2",
  });
  expect(version.buildSha).toMatch(/^[0-9a-f]{40}$/u);
  expect(Number.isFinite(Date.parse(version.buildTime))).toBe(true);

  const assetReferences = [
    ...indexHtml.matchAll(/(?:src|href)=["']([^"']+)["']/gu),
  ]
    .map((match) => match[1])
    .filter((reference): reference is string =>
      Boolean(reference?.startsWith("/10th/")),
    );
  expect(assetReferences.length).toBeGreaterThanOrEqual(3);
  for (const reference of new Set(assetReferences)) {
    expect(reference).not.toMatch(
      /(?:WebLLMNarrativeProvider|webllm\.worker|\/lib-)/u,
    );
    const response = await request.get(`${PUBLIC_ORIGIN}${reference}`);
    expect(response.status(), reference).toBe(200);
    expect((await response.body()).byteLength, reference).toBeGreaterThan(0);
  }

  const manifestResponse = await request.get(
    `./manifest.webmanifest?${cacheBust}`,
  );
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as PublicManifest;
  expect(manifest).toMatchObject({
    id: "/10th/",
    start_url: "/10th/",
    scope: "/10th/",
    display: "standalone",
    lang: "ja",
  });
  expect(manifest.icons).toEqual([
    {
      src: "/10th/icon-192.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/10th/icon-512.png",
      sizes: "512x512",
      type: "image/png",
    },
    {
      src: "/10th/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ]);
  for (const icon of manifest.icons) {
    const response = await request.get(`${PUBLIC_ORIGIN}${icon.src}`);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect((await response.body()).byteLength).toBeGreaterThan(0);
  }

  const workerResponse = await request.get(`./sw.js?${cacheBust}`);
  expect(workerResponse.status()).toBe(200);
  const workerSource = await workerResponse.text();
  expect(workerSource.length).toBeGreaterThan(1_000);
  const precacheStart = workerSource.indexOf("precacheAndRoute([");
  const precacheEnd = workerSource.indexOf("],{}", precacheStart);
  expect(precacheStart).toBeGreaterThanOrEqual(0);
  expect(precacheEnd).toBeGreaterThan(precacheStart);
  const precacheSource = workerSource.slice(precacheStart, precacheEnd);
  expect(precacheSource).not.toContain("version.json");
  expect(precacheSource).not.toMatch(
    /(?:WebLLMNarrativeProvider|webllm\.worker|\/lib-)/u,
  );
  expect(workerSource).not.toMatch(/\.(?:bin|gguf|safetensors|params)["']/u);

  const browserRequests: string[] = [];
  context.on("request", (request) => browserRequests.push(request.url()));
  await page.goto("./?provider=mock&mockDelay=0&debug=1&benchmark=1", {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByRole("heading", { name: UI.inputHeading }),
  ).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/10th/manifest.webmanifest",
  );
  const debugPanel = page.locator("details.debug-panel");
  await expect(debugPanel).toHaveAttribute("open", "");
  const debugBuildSha = await debugPanel
    .locator("dt", { hasText: /^Build SHA$/u })
    .evaluate((term) => term.nextElementSibling?.textContent?.trim() ?? "");
  const debugPipeline = await debugPanel
    .locator("dt", { hasText: /^Pipeline$/u })
    .evaluate((term) => term.nextElementSibling?.textContent?.trim() ?? "");
  expect(debugBuildSha).toBe(version.buildSha);
  expect(debugPipeline).toBe("v2");

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const registration =
          await navigator.serviceWorker.getRegistration("/10th/");
        return {
          scope: registration?.scope ?? "",
          scriptURL: registration?.active?.scriptURL ?? "",
        };
      }),
    )
    .toEqual({
      scope: PUBLIC_APP_URL,
      scriptURL: `${PUBLIC_APP_URL}sw.js`,
    });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""),
    )
    .toBe(`${PUBLIC_APP_URL}sw.js`);
  const registrationScopes = await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistrations()).map(
      (registration) => registration.scope,
    ),
  );
  expect(registrationScopes).toContain(PUBLIC_APP_URL);
  expect(registrationScopes).not.toContain(`${PUBLIC_ORIGIN}/`);
  expect(browserRequests.filter((url) => WEBLLM_REQUEST.test(url))).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test("published Mock path shows an immediate opening, restores after continue, and reaches an ending", async ({
  context,
  page,
}) => {
  const requestUrls: string[] = [];
  context.on("request", (request) => requestUrls.push(request.url()));

  await page.goto("./?provider=mock&mockDelay=0", {
    waitUntil: "domcontentloaded",
  });
  expect(new URL(page.url()).origin).toBe(PUBLIC_ORIGIN);
  expect(new URL(page.url()).pathname).toBe("/10th/");
  await expect(
    page.getByRole("heading", { name: UI.inputHeading }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: UI.inputLabel })
    .fill("変わらない午後の中で、小さな違いを見つけたい");
  await page.getByRole("button", { name: UI.inputSubmit }).click();
  await expect(
    page.getByRole("heading", { name: UI.modelHeading }),
  ).toBeVisible();

  const openingStartedAt = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: UI.demoStart }).click();
  await expect(
    page.getByRole("heading", { name: UI.openingHeading }),
  ).toBeVisible();
  const opening = page.locator(".departure-opening .scene-text");
  await expect(opening).toBeVisible();
  const openingMs = await page.evaluate(
    (startedAt) => performance.now() - startedAt,
    openingStartedAt,
  );
  const openingText = (await opening.innerText()).trim();
  expect(openingMs).toBeLessThan(1_000);
  expect(openingText.length).toBeGreaterThanOrEqual(180);
  expect(openingText.length).toBeLessThanOrEqual(280);
  await expect(
    page.getByText(UI.departurePhrase, { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: UI.openPage }).click();
  await expectScene(page, 1, 1);
  await expect(page.getByText(UI.branchPhrase, { exact: true })).toBeVisible();
  await reachClosure(page, 1, ["stay", "move", "stay", "move"]);

  await page.getByRole("button", { name: UI.continueReading }).click();
  await expectScene(page, 2, 1);
  const continuedText = await page
    .locator("article.reading-view > .scene-text")
    .innerText();
  await expect
    .poll(() => persistedActiveSession(page))
    .toMatchObject({
      macroPartIndex: 2,
      sceneIndexInMacro: 1,
      status: "awaiting_branch",
    });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expectScene(page, 2, 1);
  await expect(page.locator("article.reading-view > .scene-text")).toHaveText(
    continuedText,
  );
  await expect(page.getByText(UI.branchPhrase, { exact: true })).toBeVisible();

  await reachClosure(page, 2, ["move", "stay", "move", "stay"]);
  await page.getByRole("button", { name: UI.endReading }).click();
  await expect(
    page.getByRole("heading", { name: UI.endingHeading }),
  ).toBeVisible();
  await expect(
    page.getByText(/^あなたが読んだ物語の題名は『.+』です$/u),
  ).toBeVisible();

  expect(requestUrls.filter((url) => WEBLLM_REQUEST.test(url))).toEqual([]);
});

test("root and existing CAETA pages remain byte-for-byte protected", async ({
  request,
}) => {
  const rootResponse = await getWithoutRedirect(request, `${PUBLIC_ORIGIN}/`);
  const rootHtml = await rootResponse.text();
  expect(rootHtml.length).toBeGreaterThan(10_000);
  expect(rootHtml).toContain(
    "<title>etudism.github.io 共同開発ガイド | etudism</title>",
  );
  expect(rootHtml).toContain("etudism.github.io 共同開発ガイド");
  expect(rootHtml).toContain(
    '<link rel="canonical" href="https://etudism.github.io/"',
  );
  const rootCss = rootHtml.match(
    /href="(\/assets\/css\/style\.css[^"]*)"/u,
  )?.[1];
  expect(rootCss).toBeDefined();
  if (!rootCss) throw new Error("Root stylesheet reference was not found.");
  const rootCssResponse = await request.get(`${PUBLIC_ORIGIN}${rootCss}`);
  expect(rootCssResponse.status()).toBe(200);
  expect((await rootCssResponse.body()).byteLength).toBeGreaterThan(0);

  const protectedCaetaPaths = [
    "CAETA/index.html",
    "CAETA/index_p.html",
    "CAETA/index_mobile_neumorphic_3d_pane_v94_mobile_perf_optimized.html",
    "CAETA/bunfree_tokyo42_booth_slots.json",
    "CAETA/caeta_ad.png",
  ] as const;
  for (const relativePath of protectedCaetaPaths) {
    const remoteUrl = `${PUBLIC_ORIGIN}/${relativePath}`;
    const remoteResponse = await getWithoutRedirect(request, remoteUrl);
    const [remoteBytes, localBytes] = await Promise.all([
      remoteResponse.body(),
      readFile(resolve(REPOSITORY_ROOT, relativePath)),
    ]);
    expect(remoteBytes.byteLength, relativePath).toBe(localBytes.byteLength);
    expect(sha256(remoteBytes), relativePath).toBe(sha256(localBytes));
  }

  const caetaResponse = await getWithoutRedirect(
    request,
    `${PUBLIC_ORIGIN}/CAETA/`,
  );
  const caetaHtml = await caetaResponse.text();
  expect(caetaHtml).toContain(
    "<title>CAETA | 文学フリマ東京42（非公式）3Dブース図</title>",
  );
  expect(caetaHtml).toContain('<div id="app">');
  expect(caetaHtml).toContain('aria-label="文フリブースマップ"');
  expect(caetaHtml).toContain('aria-label="ブース検索"');
});

export { expect };
