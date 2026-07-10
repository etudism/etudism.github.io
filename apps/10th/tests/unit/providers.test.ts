import { describe, expect, it, vi } from "vitest";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionRequest,
  MLCEngineConfig,
} from "@mlc-ai/web-llm";

import {
  DEBUG_MODEL_ID,
  LIGHT_MODEL_ID,
  STANDARD_MODEL_ID,
} from "../../src/narrative/constants";
import type {
  EndingRequest,
  NarrativeContext,
  ParseDiagnostic,
  SceneRequest,
} from "../../src/narrative/types";
import {
  generateFallbackEnding,
  generateFallbackScene,
  generateFallbackSeed,
} from "../../src/narrative/fallbackGenerator";
import { createFastSceneRequest } from "../../src/narrative/fastContext";
import { createProvisionalOpening } from "../../src/narrative/provisionalNarrative";
import { createScenePlan } from "../../src/narrative/scenePlanner";
import {
  acknowledgeDeparture,
  applyProvisionalOpening,
  createStorySession,
} from "../../src/narrative/storyEngine";
import {
  MockNarrativeProvider,
  MockNarrativeProviderError,
} from "../../src/providers/MockNarrativeProvider";
import {
  MODEL_CATALOG,
  assertRequiredModelsAvailable,
  isModelAvailable,
  verifyRequiredModelsInPrebuiltConfig,
} from "../../src/providers/modelCatalog";
import { ProviderManager } from "../../src/providers/ProviderManager";
import {
  WebLLMNarrativeProvider,
  type DedicatedWorkerHandle,
  type WebLLMCompletionEngine,
  type WebLLMEngineFactory,
} from "../../src/providers/WebLLMNarrativeProvider";

const baseContext: NarrativeContext = {
  themeTransform: {
    emotionalPattern: "同じ時間の反復",
    narrativeTension: "秩序と好奇心",
    allegoricalWorld: "日付札が配られる水路の町",
    centralSymbol: "銀色の切符",
    protagonistDistance: "third_person",
    literalTermsToAvoid: ["仕事"],
  },
  storyBible: {
    protagonist: {
      name: "ユノ",
      description: "小さな差を記録する旅人",
      desire: "変化の行方を確かめる",
      limitation: "合図を待ちすぎる",
    },
    companion: {
      name: "トワ",
      description: "道具の声を聞く案内役",
      speakingStyle: "短い問いを置く",
    },
    worldRule: "毎朝、同じ日付札が配られる",
    startingLocation: "日付札を配る水門前",
    portableMotif: "銀色の切符",
    toneGuide: ["静かな具体描写"],
    prohibitedPatterns: ["説教"],
  },
  macroPartIndex: 1,
  sceneIndexInMacro: 2,
  sceneFunction: "observation",
  currentLocationId: "日付札を配る水門前",
  depthIndex: 0,
  distanceIndex: 0,
  rollingSummary: "ユノは銀色の切符を拾った。",
  canonicalFacts: [],
  activeThreads: [],
  motifs: [],
  latestProtagonistChange: "ユノは小さな差を見逃さなくなった。",
  recentSceneSummaries: ["銀色の切符を拾った。"],
  previousSceneTail: "水門の向こうで戸が一度だけ開いた。",
  choice: "stay",
};

function sceneRequest(
  choice: NarrativeContext["choice"],
  overrides: Partial<NarrativeContext> = {},
): SceneRequest {
  return { context: { ...baseContext, ...overrides, choice } };
}

const endingRequest: EndingRequest = {
  context: {
    themeTransform: baseContext.themeTransform,
    storyBible: baseContext.storyBible,
    macroPartIndex: 2,
    totalSceneCount: 10,
    currentLocationId: "風を量る回廊",
    rollingSummary: "二つの場所で合図を見つけ、問いを閉じた。",
    canonicalFacts: [],
    activeThreads: [],
    motifs: [],
    latestProtagonistChange: "ユノは合図を待たずに歩き出せるようになった。",
    recentSceneSummaries: ["合図は一つの向きを示した。"],
    previousSceneTail: "帰る道と進む道の両方が見えていた。",
  },
};

function fastSceneRequest() {
  const readerInput = "同じ時間の中に小さな変化を探している";
  const id = "provider-fast-scene";
  const draft = createStorySession({ id, readerInput });
  const opening = createProvisionalOpening(readerInput, id);
  const session = acknowledgeDeparture(
    applyProvisionalOpening(draft, opening.seed, opening.plan),
  );
  const plan = createScenePlan(session, "stay");
  return createFastSceneRequest(session, plan, "fast");
}

async function initializedMock(
  options: ConstructorParameters<typeof MockNarrativeProvider>[0] = {},
): Promise<MockNarrativeProvider> {
  const provider = new MockNarrativeProvider(options);
  await provider.initialize({ modelId: "mock" });
  return provider;
}

function chatCompletion(content: string): ChatCompletion {
  return {
    id: "test-completion",
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        logprobs: null,
        message: { role: "assistant", content },
      },
    ],
    model: STANDARD_MODEL_ID,
    object: "chat.completion",
    created: 0,
  };
}

interface EngineHarness {
  readonly engine: WebLLMCompletionEngine;
  readonly requests: ChatCompletionRequest[];
  readonly events: string[];
  interruptCount: number;
}

function createEngineHarness(outputs: string[]): EngineHarness {
  const requests: ChatCompletionRequest[] = [];
  const events: string[] = [];
  const harness: EngineHarness = {
    requests,
    events,
    interruptCount: 0,
    engine: {
      chat: {
        completions: {
          async create(request): Promise<ChatCompletion> {
            requests.push(request);
            const output = outputs.shift();
            if (output === undefined) {
              throw new Error("No test completion was queued.");
            }
            return chatCompletion(output);
          },
        },
      },
      interruptGenerate(): void {
        harness.interruptCount += 1;
        events.push("interrupt");
      },
      async unload(): Promise<void> {
        events.push("unload");
      },
    },
  };
  return harness;
}

function providerHarness(
  outputs: string[],
  onDiagnostic?: (diagnostic: ParseDiagnostic) => void,
): {
  readonly provider: WebLLMNarrativeProvider;
  readonly engine: EngineHarness;
  readonly workerEvents: string[];
  readonly engineConfigs: MLCEngineConfig[];
  workerCreateCount: () => number;
} {
  const engine = createEngineHarness(outputs);
  const workerEvents: string[] = [];
  const engineConfigs: MLCEngineConfig[] = [];
  let workerCreateCount = 0;
  const worker: DedicatedWorkerHandle = {
    terminate(): void {
      workerEvents.push("terminate");
    },
  };
  const engineFactory: WebLLMEngineFactory = async (
    _worker,
    _modelId,
    config,
  ) => {
    engineConfigs.push(config);
    config.initProgressCallback?.({
      progress: 0.4,
      timeElapsed: 12,
      text: "モデルデータを読み込んでいます。",
    });
    return engine.engine;
  };
  const provider = new WebLLMNarrativeProvider({
    workerFactory: () => {
      workerCreateCount += 1;
      return worker;
    },
    engineFactory,
    onDiagnostic,
  });
  return {
    provider,
    engine,
    workerEvents,
    engineConfigs,
    workerCreateCount: () => workerCreateCount,
  };
}

describe("modelCatalog", () => {
  it("contains and verifies the three pinned Qwen3 models", async () => {
    expect(() => assertRequiredModelsAvailable()).not.toThrow();
    await expect(
      verifyRequiredModelsInPrebuiltConfig(),
    ).resolves.toBeUndefined();
    expect(MODEL_CATALOG.map((model) => model.id)).toEqual([
      LIGHT_MODEL_ID,
      STANDARD_MODEL_ID,
      DEBUG_MODEL_ID,
    ]);
    expect(isModelAvailable(STANDARD_MODEL_ID)).toBe(true);
    expect(isModelAvailable("not-a-real-model")).toBe(false);
  });

  it("marks only the 4B entry as debug-only", () => {
    expect(MODEL_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: STANDARD_MODEL_ID,
          kind: "standard",
          debugOnly: false,
          vramMb: 2_037,
          mode: "quality",
        }),
        expect.objectContaining({
          id: LIGHT_MODEL_ID,
          kind: "light",
          debugOnly: false,
          vramMb: 1_403,
          mode: "fast",
        }),
        expect.objectContaining({
          id: DEBUG_MODEL_ID,
          kind: "debug",
          debugOnly: true,
          vramMb: 3_432,
          mode: "debug",
        }),
      ]),
    );
  });
});

describe("MockNarrativeProvider", () => {
  it("returns the same seed result for the same seed and reader input", async () => {
    const first = await initializedMock({ seed: "repeatable" });
    const second = await initializedMock({ seed: "repeatable" });

    await expect(
      first.generateSeed({ readerInput: "変わり映えのない毎日" }),
    ).resolves.toEqual(
      await second.generateSeed({ readerInput: "変わり映えのない毎日" }),
    );
    const seed = await first.generateSeed({
      readerInput: "変わり映えのない毎日",
    });
    expect(seed.firstScene.text.length).toBeGreaterThanOrEqual(350);
    expect(seed.firstScene.text.length).toBeLessThanOrEqual(500);
  });

  it("makes stay deepen the location and move change it", async () => {
    const provider = await initializedMock({ seed: 42 });

    const stay = await provider.generateScene(sceneRequest("stay"));
    const move = await provider.generateScene(sceneRequest("move"));

    expect(stay.statePatch.currentLocation).toBe(baseContext.currentLocationId);
    expect(move.statePatch.currentLocation).not.toBe(
      baseContext.currentLocationId,
    );
    expect(stay.choiceReflection).toContain("滞在");
    expect(move.choiceReflection).toContain("移動");
    expect(stay.statePatch.protagonistChange).not.toBe(
      move.statePatch.protagonistChange,
    );
    expect(stay.text.length).toBeGreaterThanOrEqual(350);
    expect(stay.text.length).toBeLessThanOrEqual(500);
    expect(move.text.length).toBeGreaterThanOrEqual(350);
    expect(move.text.length).toBeLessThanOrEqual(500);
  });

  it("supports a second macro part and closes its fifth scene", async () => {
    const provider = await initializedMock();
    const continued = await provider.generateScene(
      sceneRequest("continue", {
        macroPartIndex: 2,
        sceneIndexInMacro: 1,
        sceneFunction: "arrival",
      }),
    );
    const closure = await provider.generateScene(
      sceneRequest("stay", {
        macroPartIndex: 2,
        sceneIndexInMacro: 5,
        sceneFunction: "local_closure",
      }),
    );

    expect(continued.statePatch.currentLocation).not.toBe(
      baseContext.currentLocationId,
    );
    expect(continued.choiceReflection).toContain("続行");
    expect(closure.text).toContain("第2章");
    expect(closure.text).toContain("新しい扉は開かず");
    expect(closure.statePatch.resolvedThreads).toHaveLength(1);
    expect(closure.statePatch.openedThreads).toEqual([]);
    expect(closure.text.length).toBeGreaterThanOrEqual(350);
    expect(closure.text.length).toBeLessThanOrEqual(500);
  });

  it("returns a valid deterministic epilogue and title", async () => {
    const provider = await initializedMock({ seed: "ending" });

    const first = await provider.generateEnding(endingRequest);
    const second = await provider.generateEnding(endingRequest);

    expect(second).toEqual(first);
    expect(first.title.length).toBeGreaterThanOrEqual(4);
    expect(first.title.length).toBeLessThanOrEqual(20);
    expect(first.closingMotifs).toContain("銀色の切符");
  });

  it("consumes injected errors and invalid responses only once", async () => {
    const provider = await initializedMock();
    const injected = new Error("one shot");
    provider.injectErrorOnce("seed", injected);

    await expect(
      provider.generateSeed({ readerInput: "繰り返す景色" }),
    ).rejects.toBe(injected);
    await expect(
      provider.generateSeed({ readerInput: "繰り返す景色" }),
    ).resolves.toBeDefined();

    provider.injectInvalidResponseOnce("scene");
    await expect(
      provider.generateScene(sceneRequest("stay")),
    ).rejects.toMatchObject({ code: "INVALID_MODEL_JSON" });
    await expect(
      provider.generateScene(sceneRequest("stay")),
    ).resolves.toBeDefined();
  });

  it("becomes uninitialized when reinitialization fails", async () => {
    const provider = await initializedMock();
    provider.injectErrorOnce("initialize");

    await expect(
      provider.initialize({ modelId: "another-mock" }),
    ).rejects.toMatchObject({ code: "MODEL_INIT_FAILED" });
    await expect(
      provider.generateSeed({ readerInput: "繰り返す景色" }),
    ).rejects.toMatchObject({ code: "MODEL_INIT_FAILED" });
  });

  it("interrupts a delayed generation and can generate again", async () => {
    vi.useFakeTimers();
    try {
      const provider = await initializedMock();
      provider.setDelay(100);
      const interruptedGeneration = provider.generateScene(
        sceneRequest("stay"),
      );
      const interruptedExpectation = expect(
        interruptedGeneration,
      ).rejects.toBeInstanceOf(MockNarrativeProviderError);

      await provider.interrupt();
      await interruptedExpectation;

      const recoveredGeneration = provider.generateScene(sceneRequest("move"));
      await vi.advanceTimersByTimeAsync(100);
      await expect(recoveredGeneration).resolves.toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ProviderManager", () => {
  it("reuses one initialized engine across scenes and new stories", async () => {
    const provider = new MockNarrativeProvider({ delayMs: 0 });
    const initialize = vi.spyOn(provider, "initialize");
    const dispose = vi.spyOn(provider, "dispose");
    const createProvider = vi.fn(async () => provider);
    const manager = new ProviderManager({ createProvider });
    const selection = { providerKind: "mock" as const, modelId: "mock-v1" };

    const first = await manager.ensureProvider(selection, {});
    const second = await manager.ensureProvider(selection, {});
    manager.resetForNewStory();
    const third = await manager.ensureProvider(selection, {});

    expect(first).toMatchObject({ provider, reused: false });
    expect(second).toMatchObject({ provider, reused: true });
    expect(third).toMatchObject({ provider, reused: true });
    expect(createProvider).toHaveBeenCalledOnce();
    expect(initialize).toHaveBeenCalledTimes(3);
    expect(dispose).not.toHaveBeenCalled();
    expect(manager.getState()).toMatchObject({
      kind: "mock",
      modelId: "mock-v1",
      initialized: true,
      reuseCount: 2,
    });

    await manager.release();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("reinitializes only when the selected model changes", async () => {
    const provider = new MockNarrativeProvider({ delayMs: 0 });
    const initialize = vi.spyOn(provider, "initialize");
    const manager = new ProviderManager({
      createProvider: async () => provider,
    });

    await manager.ensureProvider(
      { providerKind: "mock", modelId: "mock-v1" },
      {},
    );
    const changed = await manager.ensureProvider(
      { providerKind: "mock", modelId: "mock-v2" },
      {},
    );

    expect(changed.reused).toBe(false);
    expect(initialize).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ modelId: "mock-v2" }),
    );
    expect(manager.getState().modelId).toBe("mock-v2");
    await manager.release();
  });
});

describe("WebLLMNarrativeProvider", () => {
  it("does not create a worker or load a model before explicit initialize", async () => {
    const harness = providerHarness([
      JSON.stringify(generateFallbackSeed("入力")),
    ]);

    expect(harness.workerCreateCount()).toBe(0);
    await expect(
      harness.provider.generateSeed({ readerInput: "変わらない景色" }),
    ).rejects.toMatchObject({ code: "MODEL_INIT_FAILED" });
    expect(harness.workerCreateCount()).toBe(0);
    expect(harness.engineConfigs).toHaveLength(0);
  });

  it("creates the dedicated worker on initialize and relays load progress", async () => {
    const harness = providerHarness([]);
    const progress: Array<{ phase: string; progress: number; text: string }> =
      [];

    await harness.provider.initialize({
      modelId: STANDARD_MODEL_ID,
      onProgress: (report) => progress.push(report),
    });

    expect(harness.workerCreateCount()).toBe(1);
    expect(harness.engineConfigs).toHaveLength(1);
    expect(progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ phase: "loading", progress: 0 }),
        expect.objectContaining({
          phase: "loading",
          progress: 0.4,
          text: "モデルデータを読み込んでいます。",
        }),
        expect.objectContaining({ phase: "ready", progress: 1 }),
      ]),
    );
  });

  it("rejects an aborted model load promptly, cleans a late engine, and permits retry", async () => {
    const events: string[] = [];
    const lateEngine = createEngineHarness([]);
    const retryEngine = createEngineHarness([]);
    lateEngine.engine.unload = async (): Promise<void> => {
      events.push("late-unload");
    };
    let resolveLateEngine:
      ((engine: WebLLMCompletionEngine) => void) | undefined;
    const pendingEngine = new Promise<WebLLMCompletionEngine>((resolve) => {
      resolveLateEngine = resolve;
    });
    let engineFactoryCalls = 0;
    const engineFactory: WebLLMEngineFactory = () => {
      engineFactoryCalls += 1;
      return engineFactoryCalls === 1
        ? pendingEngine
        : Promise.resolve(retryEngine.engine);
    };
    let workerCount = 0;
    const provider = new WebLLMNarrativeProvider({
      workerFactory: () => {
        workerCount += 1;
        const workerNumber = workerCount;
        return {
          terminate(): void {
            events.push(`terminate-${workerNumber}`);
          },
        };
      },
      engineFactory,
    });
    const controller = new AbortController();
    const initialization = provider.initialize({
      modelId: STANDARD_MODEL_ID,
      signal: controller.signal,
    });
    await vi.waitFor(() => expect(engineFactoryCalls).toBe(1));

    controller.abort();
    await expect(initialization).rejects.toMatchObject({
      name: "AbortError",
      code: "MODEL_INIT_FAILED",
    });
    expect(events).toEqual(["terminate-1"]);

    await expect(
      provider.initialize({ modelId: STANDARD_MODEL_ID }),
    ).resolves.toBeUndefined();
    expect(engineFactoryCalls).toBe(2);

    resolveLateEngine?.(lateEngine.engine);
    await vi.waitFor(() => expect(events).toContain("late-unload"));
    expect(events.filter((event) => event === "terminate-1")).toHaveLength(1);
    await provider.dispose();
    expect(events.at(-1)).toBe("terminate-2");
  });

  it("rejects an unavailable model without creating a worker", async () => {
    const harness = providerHarness([]);

    await expect(
      harness.provider.initialize({ modelId: "not-a-real-model" }),
    ).rejects.toMatchObject({ code: "MODEL_NOT_FOUND" });
    expect(harness.workerCreateCount()).toBe(0);
  });

  it("uses a JSON Schema string and disables Qwen3 thinking", async () => {
    const expected = generateFallbackSeed("変わらない景色");
    const harness = providerHarness([JSON.stringify(expected)]);
    await harness.provider.initialize({ modelId: STANDARD_MODEL_ID });

    await expect(
      harness.provider.generateSeed({ readerInput: "変わらない景色" }),
    ).resolves.toEqual(expected);

    const request = harness.engine.requests.at(0);
    expect(request).toBeDefined();
    expect(request?.stream).toBe(false);
    expect(request?.model).toBe(STANDARD_MODEL_ID);
    expect(request?.extra_body).toEqual({ enable_thinking: false });
    expect(request?.response_format?.type).toBe("json_object");
    expect(typeof request?.response_format?.schema).toBe("string");
    expect(() =>
      JSON.parse(request?.response_format?.schema ?? ""),
    ).not.toThrow();
    expect(request?.messages.map((message) => message.role)).toEqual([
      "system",
      "user",
    ]);
  });

  it("streams scene text without JSON grammar and reports provider usage", async () => {
    const requests: ChatCompletionRequest[] = [];
    const chunks: ChatCompletionChunk[] = [
      {
        id: "chunk-1",
        choices: [
          {
            delta: { role: "assistant", content: "静かな水門で、" },
            finish_reason: null,
            index: 0,
            logprobs: null,
          },
        ],
        created: 0,
        model: LIGHT_MODEL_ID,
        object: "chat.completion.chunk",
      },
      {
        id: "chunk-2",
        choices: [
          {
            delta: { content: "印が淡く光った。" },
            finish_reason: "stop",
            index: 0,
            logprobs: null,
          },
        ],
        created: 0,
        model: LIGHT_MODEL_ID,
        object: "chat.completion.chunk",
        usage: {
          prompt_tokens: 120,
          completion_tokens: 32,
          total_tokens: 152,
          extra: {
            time_to_first_token_s: 0.125,
            e2e_latency_s: 0.8,
            prefill_tokens_per_s: 960,
            decode_tokens_per_s: 40,
            time_per_output_token_s: 0.025,
          },
        },
      },
    ];
    const engine: WebLLMCompletionEngine = {
      chat: {
        completions: {
          create(request) {
            requests.push(request);
            return Promise.resolve(
              (async function* () {
                for (const chunk of chunks) yield chunk;
              })(),
            );
          },
        },
      },
      interruptGenerate: () => undefined,
      unload: () => Promise.resolve(),
    };
    const provider = new WebLLMNarrativeProvider({
      workerFactory: () => ({ terminate: () => undefined }),
      engineFactory: async () => engine,
    });
    await provider.initialize({ modelId: LIGHT_MODEL_ID });
    const streamed: string[] = [];
    const metrics: unknown[] = [];

    const result = await provider.generateSceneText(fastSceneRequest(), {
      onChunk: (chunk) => streamed.push(chunk),
      onMetrics: (stats) => metrics.push(stats),
    });

    expect(result.text).toBe("静かな水門で、印が淡く光った。");
    expect(streamed).toEqual(["静かな水門で、", "印が淡く光った。"]);
    expect(metrics).toEqual([
      {
        promptTokens: 120,
        completionTokens: 32,
        timeToFirstTokenMs: 125,
        completionMs: 800,
        tokensPerSecond: 40,
      },
    ]);
    expect(requests[0]).toMatchObject({
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 384,
      extra_body: {
        enable_thinking: false,
        enable_latency_breakdown: true,
      },
    });
    expect(requests[0]?.response_format).toBeUndefined();
  });

  it("repairs invalid JSON exactly once and validates the repaired scene", async () => {
    const repairedScene = generateFallbackScene(baseContext);
    const diagnostics: ParseDiagnostic[] = [];
    const harness = providerHarness(
      ["not-json", JSON.stringify(repairedScene)],
      (diagnostic) => diagnostics.push(diagnostic),
    );
    await harness.provider.initialize({ modelId: LIGHT_MODEL_ID });

    await expect(
      harness.provider.generateScene(sceneRequest("stay")),
    ).resolves.toEqual(repairedScene);

    expect(harness.engine.requests).toHaveLength(2);
    expect(harness.engine.requests.at(1)?.temperature).toBe(0.1);
    expect(harness.engine.requests.at(1)?.extra_body).toEqual({
      enable_thinking: false,
    });
    expect(diagnostics.map((diagnostic) => diagnostic.stage)).toEqual([
      "initial_parse_failed",
      "repair_succeeded",
    ]);
  });

  it("uses deterministic fallback after one failed repair without a third call", async () => {
    const diagnostics: ParseDiagnostic[] = [];
    const harness = providerHarness(["{", "still-invalid"], (diagnostic) =>
      diagnostics.push(diagnostic),
    );
    await harness.provider.initialize({ modelId: STANDARD_MODEL_ID });

    await expect(
      harness.provider.generateEnding(endingRequest),
    ).resolves.toEqual(generateFallbackEnding(endingRequest.context));
    expect(harness.engine.requests).toHaveLength(2);
    expect(diagnostics.map((diagnostic) => diagnostic.stage)).toEqual([
      "initial_parse_failed",
      "repair_failed",
      "fallback_used",
    ]);
  });

  it("calls interruptGenerate and permits a later generation", async () => {
    let rejectPending: ((reason: Error) => void) | undefined;
    let callCount = 0;
    const engine = createEngineHarness([]);
    engine.engine.chat.completions.create = (
      request: ChatCompletionRequest,
    ): Promise<ChatCompletion> => {
      engine.requests.push(request);
      callCount += 1;
      if (callCount === 1) {
        return new Promise<ChatCompletion>((_resolve, reject) => {
          rejectPending = reject;
        });
      }
      return Promise.resolve(
        chatCompletion(JSON.stringify(generateFallbackScene(baseContext))),
      );
    };
    const worker: DedicatedWorkerHandle = { terminate: () => undefined };
    const provider = new WebLLMNarrativeProvider({
      workerFactory: () => worker,
      engineFactory: async () => engine.engine,
    });
    await provider.initialize({ modelId: STANDARD_MODEL_ID });

    const interrupted = provider.generateScene(sceneRequest("stay"));
    const interruptedExpectation = expect(interrupted).rejects.toMatchObject({
      code: "GENERATION_INTERRUPTED",
    });
    await Promise.resolve();
    await provider.interrupt();
    rejectPending?.(new Error("aborted by test engine"));
    await interruptedExpectation;
    expect(engine.interruptCount).toBe(1);

    await expect(provider.generateScene(sceneRequest("stay"))).resolves.toEqual(
      generateFallbackScene(baseContext),
    );
  });

  it("awaits unload before terminating its dedicated worker", async () => {
    const events: string[] = [];
    const engine = createEngineHarness([]);
    engine.engine.unload = async (): Promise<void> => {
      events.push("unload");
    };
    const provider = new WebLLMNarrativeProvider({
      workerFactory: () => ({
        terminate(): void {
          events.push("terminate");
        },
      }),
      engineFactory: async () => engine.engine,
    });
    await provider.initialize({ modelId: STANDARD_MODEL_ID });

    await provider.dispose();

    expect(events).toEqual(["unload", "terminate"]);
  });

  it("interrupts and rejects an active generation before disposal completes", async () => {
    const events: string[] = [];
    const progressPhases: string[] = [];
    let resolveCompletion: ((completion: ChatCompletion) => void) | undefined;
    const completionPromise = new Promise<ChatCompletion>((resolve) => {
      resolveCompletion = resolve;
    });
    const engine: WebLLMCompletionEngine = {
      chat: {
        completions: {
          create: () => completionPromise,
        },
      },
      interruptGenerate(): void {
        events.push("interrupt");
      },
      async unload(): Promise<void> {
        events.push("unload");
      },
    };
    const provider = new WebLLMNarrativeProvider({
      workerFactory: () => ({
        terminate(): void {
          events.push("terminate");
        },
      }),
      engineFactory: async () => engine,
    });
    await provider.initialize({
      modelId: STANDARD_MODEL_ID,
      onProgress: (progress) => progressPhases.push(progress.phase),
    });
    const generation = provider.generateScene(sceneRequest("stay"));
    const generationExpectation = expect(generation).rejects.toMatchObject({
      code: "GENERATION_INTERRUPTED",
    });
    await Promise.resolve();

    await provider.dispose();
    await generationExpectation;
    expect(events).toEqual(["interrupt", "unload", "terminate"]);
    expect(progressPhases.at(-1)).toBe("interrupted");
    const readyCountBeforeLateCompletion = progressPhases.filter(
      (phase) => phase === "ready",
    ).length;

    resolveCompletion?.(
      chatCompletion(JSON.stringify(generateFallbackScene(baseContext))),
    );
    await Promise.resolve();
    await Promise.resolve();
    expect(progressPhases.filter((phase) => phase === "ready")).toHaveLength(
      readyCountBeforeLateCompletion,
    );
    expect(progressPhases.at(-1)).toBe("interrupted");
  });
});
