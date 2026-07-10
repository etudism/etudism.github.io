/// <reference types="node" />

import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance as nodePerformance } from "node:perf_hooks";

const BASE_URL = "http://127.0.0.1:4173/10th/";
const RUN_COUNT = 7;
const VIEWPORT = { width: 390, height: 844 } as const;
const REPORT_PATH = resolve(
  process.cwd(),
  "test-results/benchmark/mock-performance.json",
);

const UI = {
  inputHeading: "あなたが今退屈しているのは？",
  inputLabel: "いま感じている停滞や、変わらなさ",
  inputSubmit: "物語の入口へ",
  modelHeading: "物語を書く方法を選ぶ",
  demoStart: "デモで始める",
  openPage: "頁をひらく",
  stay: "もう少しここを見て回る",
  prefetched: "次の選択肢を端末内で準備済み",
} as const;

const WEBLLM_RESOURCE =
  /(?:WebLLMNarrativeProvider|webllm(?:\.worker)?|@?mlc-ai|qwen|gemma|huggingface\.co|\.wasm(?:$|\?)|tokenizer|ndarray-cache)/iu;

interface BuildMetadata {
  buildSha: string;
  buildTime: string;
  appVersion: string;
  defaultModel: string;
  performancePipeline: string;
}

interface ResourceMetric {
  name: string;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

interface ResourceSummary {
  requestCount: number;
  transferredBytes: number;
  encodedBodyBytes: number;
  decodedBodyBytes: number;
  javascriptBytes: number;
  cssBytes: number;
  entries: ResourceMetric[];
}

interface BenchmarkRun {
  run: number;
  interactiveMs: number;
  firstSceneMs: number;
  prefetchedBranchMs: number;
  reloadRestoreMs: number;
  openingCharacters: number;
  initial: ResourceSummary;
  initialWebLlmRequestCount: number;
  totalWebLlmRequestCount: number;
  initialWebLlmUrls: string[];
  totalWebLlmUrls: string[];
  observedRequestCount: number;
  diagnostics: string[];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("Cannot calculate an empty median.");
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];
  if (value === undefined) throw new Error("Median index was unavailable.");
  return round(value);
}

function uniqueWebLlmUrls(urls: readonly string[]): string[] {
  return [...new Set(urls.filter((url) => WEBLLM_RESOURCE.test(url)))].sort();
}

function isAssetType(name: string, extension: "js" | "css"): boolean {
  try {
    return new URL(name).pathname.endsWith(`.${extension}`);
  } catch {
    return name.split("?")[0]?.endsWith(`.${extension}`) ?? false;
  }
}

async function resourceSummary(page: Page): Promise<ResourceSummary> {
  const entries = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    return [...(navigation ? [navigation] : []), ...resources].map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
    }));
  });

  return {
    requestCount: entries.length,
    transferredBytes: sum(entries.map((entry) => entry.transferSize)),
    encodedBodyBytes: sum(entries.map((entry) => entry.encodedBodySize)),
    decodedBodyBytes: sum(entries.map((entry) => entry.decodedBodySize)),
    javascriptBytes: sum(
      entries
        .filter((entry) => isAssetType(entry.name, "js"))
        .map((entry) => entry.encodedBodySize),
    ),
    cssBytes: sum(
      entries
        .filter((entry) => isAssetType(entry.name, "css"))
        .map((entry) => entry.encodedBodySize),
    ),
    entries,
  };
}

async function expectRestoredScene(page: Page): Promise<void> {
  await expect(page.getByText("第1景 · 2 / 5", { exact: true })).toBeVisible();
  await expect(page.locator("article.reading-view")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByRole("button", { name: UI.stay })).toBeVisible();
}

test("records seven isolated Mock production-preview performance runs", async ({
  browser,
}, testInfo) => {
  const runs: BenchmarkRun[] = [];
  let build: BuildMetadata | null = null;

  for (let run = 1; run <= RUN_COUNT; run += 1) {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      viewport: VIEWPORT,
      locale: "ja-JP",
      colorScheme: "light",
      serviceWorkers: "allow",
    });
    const requestUrls: string[] = [];
    const workerUrls: string[] = [];
    const diagnostics: string[] = [];
    context.on("request", (request) => requestUrls.push(request.url()));
    context.on("response", (response) => {
      if (response.status() >= 400) {
        diagnostics.push(`HTTP ${response.status()} ${response.url()}`);
      }
    });
    context.on("requestfailed", (request) => {
      diagnostics.push(
        `requestfailed ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`,
      );
    });

    try {
      const page = await context.newPage();
      page.on("worker", (worker) => workerUrls.push(worker.url()));
      page.on("console", (message) => {
        if (message.type() === "error") {
          diagnostics.push(`console.error: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => {
        diagnostics.push(`pageerror: ${error.message}`);
      });

      await page.goto("./?provider=mock&mockDelay=0", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.getByRole("heading", { name: UI.inputHeading }),
      ).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: UI.inputLabel }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", { name: UI.inputSubmit }),
      ).toBeEnabled();

      const interactiveMs = round(await page.evaluate(() => performance.now()));
      const initial = await resourceSummary(page);
      const initialWebLlmUrls = uniqueWebLlmUrls([
        ...requestUrls,
        ...workerUrls,
        ...initial.entries.map((entry) => entry.name),
      ]);

      await page
        .getByRole("textbox", { name: UI.inputLabel })
        .fill("同じ午後の中でも小さな違いを確かめたい");
      await page.getByRole("button", { name: UI.inputSubmit }).click();
      await expect(
        page.getByRole("heading", { name: UI.modelHeading }),
      ).toBeVisible();

      const demoButton = page.getByRole("button", { name: UI.demoStart });
      await demoButton.click({ trial: true });
      const firstSceneStartedAt = await page.evaluate(() => performance.now());
      await demoButton.click();
      const opening = page.locator(".departure-opening .scene-text");
      await expect(opening).toBeVisible();
      await expect(opening).not.toBeEmpty();
      const firstSceneMs = round(
        await page.evaluate(
          (startedAt) => performance.now() - startedAt,
          firstSceneStartedAt,
        ),
      );
      const openingCharacters = (await opening.innerText()).length;

      await page.getByRole("button", { name: UI.openPage }).click();
      await expect(
        page.getByText("第1景 · 1 / 5", { exact: true }),
      ).toBeVisible();
      await expect(page.locator("article.reading-view")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(
        page.getByText(UI.prefetched, { exact: true }),
      ).toBeAttached();

      const stayButton = page.getByRole("button", { name: UI.stay });
      await stayButton.click({ trial: true });
      const branchStartedAt = await page.evaluate(() => performance.now());
      await stayButton.click();
      await expectRestoredScene(page);
      const prefetchedBranchMs = round(
        await page.evaluate(
          (startedAt) => performance.now() - startedAt,
          branchStartedAt,
        ),
      );

      const reloadStartedAt = nodePerformance.now();
      await page.reload({ waitUntil: "domcontentloaded" });
      await expectRestoredScene(page);
      const reloadRestoreMs = round(nodePerformance.now() - reloadStartedAt);

      const currentBuild = await page.evaluate(async () => {
        const response = await fetch(`./version.json?benchmark=${Date.now()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`version.json returned ${response.status}`);
        }
        return (await response.json()) as BuildMetadata;
      });
      build ??= currentBuild;
      expect(currentBuild).toEqual(build);

      const totalWebLlmUrls = uniqueWebLlmUrls([...requestUrls, ...workerUrls]);
      runs.push({
        run,
        interactiveMs,
        firstSceneMs,
        prefetchedBranchMs,
        reloadRestoreMs,
        openingCharacters,
        initial,
        initialWebLlmRequestCount: initialWebLlmUrls.length,
        totalWebLlmRequestCount: totalWebLlmUrls.length,
        initialWebLlmUrls,
        totalWebLlmUrls,
        observedRequestCount: requestUrls.length,
        diagnostics,
      });
    } finally {
      await context.close();
    }
  }

  const medians = {
    interactiveMs: median(runs.map((run) => run.interactiveMs)),
    firstSceneMs: median(runs.map((run) => run.firstSceneMs)),
    prefetchedBranchMs: median(runs.map((run) => run.prefetchedBranchMs)),
    reloadRestoreMs: median(runs.map((run) => run.reloadRestoreMs)),
    initialRequests: median(runs.map((run) => run.initial.requestCount)),
    initialTransferredBytes: median(
      runs.map((run) => run.initial.transferredBytes),
    ),
    initialEncodedBodyBytes: median(
      runs.map((run) => run.initial.encodedBodyBytes),
    ),
    initialJavaScriptBytes: median(
      runs.map((run) => run.initial.javascriptBytes),
    ),
    initialCssBytes: median(runs.map((run) => run.initial.cssBytes)),
  };
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    build,
    environment: {
      runs: RUN_COUNT,
      isolatedContexts: true,
      viewport: VIEWPORT,
      browser: `chromium ${browser.version()}`,
      node: process.version,
      url: `${BASE_URL}?provider=mock&mockDelay=0`,
    },
    guards: {
      initialWebLlmRequestCount: sum(
        runs.map((run) => run.initialWebLlmRequestCount),
      ),
      totalWebLlmRequestCount: sum(
        runs.map((run) => run.totalWebLlmRequestCount),
      ),
    },
    medians,
    runs,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, json, "utf8");
  await testInfo.attach("mock-performance.json", {
    body: Buffer.from(json),
    contentType: "application/json",
  });

  expect(runs).toHaveLength(RUN_COUNT);
  for (const run of runs) {
    expect(run.openingCharacters).toBeGreaterThanOrEqual(180);
    expect(run.openingCharacters).toBeLessThanOrEqual(280);
    expect(run.initial.requestCount).toBeGreaterThan(0);
    expect(run.initial.encodedBodyBytes).toBeGreaterThan(0);
    expect(run.initial.javascriptBytes).toBeGreaterThan(0);
    expect(run.initial.cssBytes).toBeGreaterThan(0);
    expect(run.initialWebLlmUrls).toEqual([]);
    expect(run.totalWebLlmUrls).toEqual([]);
    expect(run.diagnostics).toEqual([]);
  }
  expect(report.guards).toEqual({
    initialWebLlmRequestCount: 0,
    totalWebLlmRequestCount: 0,
  });
  expect(medians.firstSceneMs).toBeLessThan(1_000);
  expect(medians.prefetchedBranchMs).toBeLessThan(250);
});
