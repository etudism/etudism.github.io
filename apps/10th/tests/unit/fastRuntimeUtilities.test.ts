import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createGenerationMetrics,
  estimatePromptTokens,
} from "../../src/app/metrics";
import {
  ScenePrefetchCache,
  scenePrefetchKey,
  shouldPrefetch,
} from "../../src/narrative/prefetchCache";
import { createProvisionalOpening } from "../../src/narrative/provisionalNarrative";
import {
  createScenePlan,
  renderPlannedScene,
} from "../../src/narrative/scenePlanner";
import { StreamingTextBuffer } from "../../src/narrative/streamingBuffer";
import {
  acknowledgeDeparture,
  applyProvisionalOpening,
  createStorySession,
} from "../../src/narrative/storyEngine";
import type { StorySession } from "../../src/narrative/types";

const NOW = "2026-07-11T03:00:00.000Z";

function openedSession(id: string): StorySession {
  const readerInput = "同じ一日が続き、少し景色を変えたい";
  const draft = createStorySession({ id, readerInput, now: NOW });
  const opening = createProvisionalOpening(readerInput, id);
  return acknowledgeDeparture(
    applyProvisionalOpening(draft, opening.seed, opening.plan, NOW),
    NOW,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("StreamingTextBuffer", () => {
  it("coalesces chunks into one timed flush", () => {
    vi.useFakeTimers();
    const onFlush = vi.fn<(text: string) => void>();
    const buffer = new StreamingTextBuffer({ intervalMs: 45, onFlush });

    buffer.push("最初の");
    buffer.push("断片");
    vi.advanceTimersByTime(44);
    expect(onFlush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenLastCalledWith("最初の断片");
  });

  it("flushes completion immediately and suppresses cancelled content", () => {
    vi.useFakeTimers();
    const completedFlush = vi.fn<(text: string) => void>();
    const completed = new StreamingTextBuffer({
      intervalMs: 45,
      onFlush: completedFlush,
    });
    completed.push("完成した本文");

    expect(completed.complete()).toBe("完成した本文");
    expect(completedFlush).toHaveBeenCalledOnce();
    expect(completedFlush).toHaveBeenCalledWith("完成した本文");

    const cancelledFlush = vi.fn<(text: string) => void>();
    const cancelled = new StreamingTextBuffer({
      intervalMs: 45,
      onFlush: cancelledFlush,
    });
    cancelled.push("保存してはいけない断片");
    cancelled.cancel();
    vi.runAllTimers();

    expect(cancelled.complete()).toBe("");
    expect(cancelledFlush).not.toHaveBeenCalled();
  });
});

describe("scene prefetch", () => {
  it("uses the explicit visibility, data-saver, and WebLLM opt-in policy", () => {
    const common = {
      documentVisible: true,
      saveData: false,
      hardwareConcurrency: 8,
      webLlmOptIn: false,
    };

    expect(shouldPrefetch({ ...common, providerKind: "mock" })).toBe(true);
    expect(
      shouldPrefetch({
        ...common,
        providerKind: "mock",
        documentVisible: false,
      }),
    ).toBe(false);
    expect(
      shouldPrefetch({ ...common, providerKind: "mock", saveData: true }),
    ).toBe(false);
    expect(shouldPrefetch({ ...common, providerKind: "webllm" })).toBe(false);
    expect(
      shouldPrefetch({
        ...common,
        providerKind: "webllm",
        webLlmOptIn: true,
        hardwareConcurrency: 4,
      }),
    ).toBe(false);
    expect(
      shouldPrefetch({
        ...common,
        providerKind: "webllm",
        webLlmOptIn: true,
      }),
    ).toBe(true);
  });

  it("keeps speculative text non-canonical and consumes it only once", () => {
    const session = openedSession("prefetch-noncanonical");
    const before = JSON.stringify(session);
    const plan = createScenePlan(session, "stay");
    const speculativeText = renderPlannedScene(plan, "demo");
    const cache = new ScenePrefetchCache();
    const scope = cache.beginScope(session);
    const key = scenePrefetchKey(session, "stay");

    expect(cache.store(scope, key, speculativeText)).toBe(true);
    expect(JSON.stringify(session)).toBe(before);
    expect(session.scenes.some((scene) => scene.text === speculativeText)).toBe(
      false,
    );
    expect(cache.consume(session, "stay")).toBe(speculativeText);
    expect(cache.consume(session, "stay")).toBeUndefined();
    expect(JSON.stringify(session)).toBe(before);
  });

  it("discards stale scopes and rejects late writes from them", () => {
    const first = openedSession("prefetch-stale");
    const next: StorySession = {
      ...first,
      sceneIndexInMacro: first.sceneIndexInMacro + 1,
      totalSceneCount: first.totalSceneCount + 1,
    };
    const cache = new ScenePrefetchCache();
    const staleScope = cache.beginScope(first);
    const staleKey = scenePrefetchKey(first, "move");
    expect(cache.store(staleScope, staleKey, "古い先読み")).toBe(true);

    const currentScope = cache.beginScope(next);
    const currentKey = scenePrefetchKey(next, "move");
    expect(currentScope).not.toBe(staleScope);
    expect(cache.consume(first, "move")).toBeUndefined();
    expect(cache.store(staleScope, staleKey, "遅れて届いた古い先読み")).toBe(
      false,
    );
    expect(cache.store(currentScope, currentKey, "新しい先読み")).toBe(true);
    expect(cache.consume(next, "move")).toBe("新しい先読み");
  });
});

describe("generation metrics", () => {
  it("reports embedded build metadata and keeps estimates separate from usage", () => {
    const metrics = createGenerationMetrics("webllm", "model-under-test");
    const promptCharacters = 901;
    const estimated = estimatePromptTokens(promptCharacters);
    const measuredLater = {
      ...metrics,
      promptCharacters,
      promptTokenEstimate: estimated,
      promptTokens: 257,
    };

    expect(metrics.buildSha.length).toBeGreaterThan(0);
    expect(metrics.buildTime.length).toBeGreaterThan(0);
    expect(metrics.promptTokens).toBeNull();
    expect(metrics.promptTokenEstimate).toBeNull();
    expect(estimated).toBe(301);
    expect(measuredLater.promptTokenEstimate).toBe(301);
    expect(measuredLater.promptTokens).toBe(257);
    expect(measuredLater.promptTokens).not.toBe(
      measuredLater.promptTokenEstimate,
    );
  });

  it("makes the estimate boundary explicit for empty and fractional inputs", () => {
    expect(estimatePromptTokens(0)).toBe(0);
    expect(estimatePromptTokens(Number.NaN)).toBe(0);
    expect(estimatePromptTokens(1)).toBe(1);
    expect(estimatePromptTokens(4)).toBe(2);
  });
});
