import {
  CreateWebWorkerMLCEngine,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatCompletionMessageParam,
  type ChatCompletionRequest,
  type InitProgressReport,
  type MLCEngineConfig,
} from "@mlc-ai/web-llm";

import type { NarrativeProvider } from "./NarrativeProvider";
import {
  assertRequiredModelsAvailable,
  isModelAvailable,
  verifyRequiredModelsInPrebuiltConfig,
} from "./modelCatalog";
import { GENERATION_SETTINGS } from "../narrative/constants";
import {
  buildEndingPromptMessages,
  buildFastScenePromptMessages,
  buildJsonRepairPromptMessages,
  buildScenePromptMessages,
  buildSeedPromptMessages,
} from "../narrative/promptTemplates";
import {
  parseEndingResponse,
  parseSceneResponse,
  parseSeedResponse,
} from "../narrative/responseParser";
import {
  endingResultJsonSchema,
  sceneResultJsonSchema,
  seedResultJsonSchema,
} from "../narrative/schemas";
import type {
  AppErrorCode,
  EndingRequest,
  EndingResult,
  FastSceneRequest,
  FastSceneResult,
  JsonRepairRequest,
  NarrativePromptMessage,
  ParseDiagnostic,
  ProviderInitOptions,
  ProviderProgress,
  SceneRequest,
  SceneResult,
  SceneStreamingOptions,
  SeedRequest,
  SeedResult,
} from "../narrative/types";

export interface DedicatedWorkerHandle {
  terminate(): void;
}

export interface WebLLMCompletionEngine {
  readonly chat: {
    readonly completions: {
      create(
        request: ChatCompletionRequest,
      ): Promise<ChatCompletion | AsyncIterable<ChatCompletionChunk>>;
    };
  };
  interruptGenerate(): void;
  unload(): Promise<void>;
}

export type DedicatedWorkerFactory = () => DedicatedWorkerHandle;

export type WebLLMEngineFactory = (
  worker: DedicatedWorkerHandle,
  modelId: string,
  engineConfig: MLCEngineConfig,
) => Promise<WebLLMCompletionEngine>;

export interface WebLLMNarrativeProviderOptions {
  readonly workerFactory?: DedicatedWorkerFactory;
  readonly engineFactory?: WebLLMEngineFactory;
  readonly onDiagnostic?: (diagnostic: ParseDiagnostic) => void;
}

interface GenerationSettings {
  readonly temperature: number;
  readonly topP: number;
  readonly maxTokens: number;
}

export class WebLLMNarrativeProviderError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "WebLLMNarrativeProviderError";
    this.code = code;
  }
}

function createDedicatedWorker(): DedicatedWorkerHandle {
  return new Worker(new URL("./webllm.worker.ts", import.meta.url), {
    type: "module",
    name: "10th-webllm-engine",
  });
}

const createEngine: WebLLMEngineFactory = async (
  worker,
  modelId,
  engineConfig,
) => CreateWebWorkerMLCEngine(worker, modelId, engineConfig);

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }
  return Math.max(0, Math.min(1, progress));
}

function signalIsAborted(signal?: AbortSignal): boolean {
  return signal?.aborted ?? false;
}

function toChatMessage(
  message: NarrativePromptMessage,
): ChatCompletionMessageParam {
  if (message.role === "system") {
    return { role: "system", content: message.content };
  }
  return { role: "user", content: message.content };
}

function abortInitializationError(): WebLLMNarrativeProviderError {
  const error = new WebLLMNarrativeProviderError(
    "MODEL_INIT_FAILED",
    "WebLLM model initialization was aborted.",
  );
  error.name = "AbortError";
  return error;
}

/**
 * Browser-local provider backed by WebLLM in a Dedicated Worker. Constructing
 * this class does not create a worker or start a model download; only an
 * explicit initialize() call does so.
 */
export class WebLLMNarrativeProvider implements NarrativeProvider {
  readonly kind = "webllm" as const;

  private readonly workerFactory: DedicatedWorkerFactory;
  private readonly engineFactory: WebLLMEngineFactory;
  private readonly onDiagnostic:
    ((diagnostic: ParseDiagnostic) => void) | undefined;
  private worker: DedicatedWorkerHandle | undefined;
  private engine: WebLLMCompletionEngine | undefined;
  private modelId: string | undefined;
  private onProgress: ((progress: ProviderProgress) => void) | undefined;
  private initializing = false;
  private nextGenerationId = 0;
  private activeGenerationId: number | undefined;
  private rejectActiveGeneration: ((error: Error) => void) | undefined;
  private generationInterrupted = false;

  constructor(options: WebLLMNarrativeProviderOptions = {}) {
    this.workerFactory = options.workerFactory ?? createDedicatedWorker;
    this.engineFactory = options.engineFactory ?? createEngine;
    this.onDiagnostic = options.onDiagnostic;
  }

  async initialize(options: ProviderInitOptions): Promise<void> {
    if (this.initializing) {
      throw new WebLLMNarrativeProviderError(
        "MODEL_INIT_FAILED",
        "WebLLM model initialization is already in progress.",
      );
    }
    if (signalIsAborted(options.signal)) {
      throw abortInitializationError();
    }

    this.initializing = true;
    try {
      assertRequiredModelsAvailable();
      if (!isModelAvailable(options.modelId)) {
        throw new WebLLMNarrativeProviderError(
          "MODEL_NOT_FOUND",
          `The selected model is not present in the app model catalog: ${options.modelId}`,
        );
      }
      try {
        await verifyRequiredModelsInPrebuiltConfig();
      } catch (error: unknown) {
        throw new WebLLMNarrativeProviderError(
          "MODEL_NOT_FOUND",
          "A required model is not present in WebLLM prebuiltAppConfig.",
          { cause: error },
        );
      }
      if (signalIsAborted(options.signal)) {
        throw abortInitializationError();
      }

      if (this.engine !== undefined && this.modelId === options.modelId) {
        this.onProgress = options.onProgress;
        this.emitProgress("ready", 1, "モデルの準備ができています。");
        this.initializing = false;
        return;
      }

      if (this.engine !== undefined || this.worker !== undefined) {
        await this.dispose();
      }
    } catch (error: unknown) {
      this.initializing = false;
      throw error;
    }

    let worker: DedicatedWorkerHandle | undefined;
    let terminated = false;
    let aborted = false;
    let rejectAbort: ((error: Error) => void) | undefined;
    const abortPromise = new Promise<never>((_resolve, reject) => {
      rejectAbort = reject;
    });
    const terminateWorker = (): void => {
      if (worker !== undefined && !terminated) {
        worker.terminate();
        terminated = true;
      }
    };
    const onAbort = (): void => {
      aborted = true;
      terminateWorker();
      rejectAbort?.(abortInitializationError());
    };

    try {
      this.onProgress = options.onProgress;
      this.modelId = options.modelId;
      this.emitProgress(
        "loading",
        0,
        "ローカルモデルの準備を開始します。",
        options.modelId,
      );
      worker = this.workerFactory();
      this.worker = worker;
      options.signal?.addEventListener("abort", onAbort, { once: true });

      const enginePromise = this.engineFactory(worker, options.modelId, {
        initProgressCallback: (report: InitProgressReport) => {
          if (aborted) {
            return;
          }
          this.emitProgress(
            "loading",
            clampProgress(report.progress),
            report.text,
            options.modelId,
          );
        },
      });
      const guardedEnginePromise = enginePromise.then(async (engine) => {
        if (!aborted && !signalIsAborted(options.signal)) {
          return engine;
        }
        try {
          await engine.unload();
        } finally {
          terminateWorker();
        }
        throw abortInitializationError();
      });
      const engine =
        options.signal === undefined
          ? await guardedEnginePromise
          : await Promise.race([guardedEnginePromise, abortPromise]);

      if (signalIsAborted(options.signal)) {
        await engine.unload();
        terminateWorker();
        throw abortInitializationError();
      }

      this.engine = engine;
      this.worker = worker;
      this.emitProgress(
        "ready",
        1,
        "ローカルモデルの準備ができました。",
        options.modelId,
      );
    } catch (error: unknown) {
      terminateWorker();
      this.engine = undefined;
      this.worker = undefined;
      this.modelId = undefined;
      if (error instanceof WebLLMNarrativeProviderError) {
        throw error;
      }
      throw new WebLLMNarrativeProviderError(
        "MODEL_INIT_FAILED",
        "WebLLM could not initialize the selected local model.",
        { cause: error },
      );
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
      this.initializing = false;
    }
  }

  generateSeed(input: SeedRequest): Promise<SeedResult> {
    return this.runGeneration(
      "物語の入口を生成しています。",
      async (generationId) => {
        const rawOutput = await this.createCompletion(
          buildSeedPromptMessages(input),
          seedResultJsonSchema,
          GENERATION_SETTINGS.seed,
          generationId,
        );
        return parseSeedResponse(rawOutput, {
          readerInput: input.readerInput,
          repair: (request) => this.repairResponse(request, generationId),
          onDiagnostic: this.onDiagnostic,
        });
      },
    );
  }

  generateScene(input: SceneRequest): Promise<SceneResult> {
    return this.runGeneration(
      "次の場面を生成しています。",
      async (generationId) => {
        const rawOutput = await this.createCompletion(
          buildScenePromptMessages(input),
          sceneResultJsonSchema,
          GENERATION_SETTINGS.scene,
          generationId,
        );
        return parseSceneResponse(rawOutput, {
          context: input.context,
          repair: (request) => this.repairResponse(request, generationId),
          onDiagnostic: this.onDiagnostic,
        });
      },
    );
  }

  generateSceneText(
    input: FastSceneRequest,
    options: SceneStreamingOptions = {},
  ): Promise<FastSceneResult> {
    return this.runGeneration(
      "次の場面を書いています。",
      async (generationId) => {
        const text = await this.createStreamingCompletion(
          buildFastScenePromptMessages(input),
          input.mode === "fast" || input.mode === "demo"
            ? GENERATION_SETTINGS.fastScene
            : GENERATION_SETTINGS.qualityScene,
          generationId,
          options,
        );
        return { text };
      },
    );
  }

  generateEnding(input: EndingRequest): Promise<EndingResult> {
    return this.runGeneration(
      "終幕と題名を生成しています。",
      async (generationId) => {
        const rawOutput = await this.createCompletion(
          buildEndingPromptMessages(input),
          endingResultJsonSchema,
          GENERATION_SETTINGS.ending,
          generationId,
        );
        return parseEndingResponse(rawOutput, {
          context: input.context,
          repair: (request) => this.repairResponse(request, generationId),
          onDiagnostic: this.onDiagnostic,
        });
      },
    );
  }

  async interrupt(): Promise<void> {
    if (this.engine === undefined || this.activeGenerationId === undefined) {
      return;
    }

    this.generationInterrupted = true;
    const error = new WebLLMNarrativeProviderError(
      "GENERATION_INTERRUPTED",
      "WebLLM generation was interrupted.",
    );
    this.rejectActiveGeneration?.(error);
    this.emitProgress("interrupted", 0, "生成を中断しました。");
    this.engine.interruptGenerate();
  }

  async dispose(): Promise<void> {
    const engine = this.engine;
    const worker = this.worker;

    try {
      if (engine !== undefined && this.activeGenerationId !== undefined) {
        await this.interrupt();
      }
    } finally {
      this.engine = undefined;
      this.worker = undefined;
      this.modelId = undefined;
      this.onProgress = undefined;
      this.activeGenerationId = undefined;
      this.rejectActiveGeneration = undefined;
      this.generationInterrupted = false;

      try {
        if (engine !== undefined) {
          await engine.unload();
        }
      } finally {
        worker?.terminate();
      }
    }
  }

  private emitProgress(
    phase: ProviderProgress["phase"],
    progress: number,
    text: string,
    modelId = this.modelId,
  ): void {
    this.onProgress?.({ phase, progress, text, modelId });
  }

  private requireEngine(): WebLLMCompletionEngine {
    if (this.engine === undefined) {
      throw new WebLLMNarrativeProviderError(
        "MODEL_INIT_FAILED",
        "WebLLMNarrativeProvider must be initialized by the user before generation.",
      );
    }
    return this.engine;
  }

  private async createCompletion(
    messages: readonly NarrativePromptMessage[],
    jsonSchema: Record<string, unknown>,
    settings: GenerationSettings,
    generationId: number,
  ): Promise<string> {
    this.assertGenerationActive(generationId);
    const engine = this.requireEngine();
    const completion = await engine.chat.completions.create({
      messages: messages.map(toChatMessage),
      stream: false,
      model: this.modelId,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      response_format: {
        type: "json_object",
        schema: JSON.stringify(jsonSchema),
      },
      extra_body: {
        enable_thinking: false,
      },
    });

    if (Symbol.asyncIterator in completion) {
      throw new WebLLMNarrativeProviderError(
        "GENERATION_FAILED",
        "WebLLM returned a stream for a non-streaming request.",
      );
    }

    this.assertGenerationActive(generationId);

    return completion.choices.at(0)?.message.content ?? "";
  }

  private repairResponse(
    request: JsonRepairRequest,
    generationId: number,
  ): Promise<string> {
    return this.createCompletion(
      buildJsonRepairPromptMessages(request),
      request.jsonSchema,
      GENERATION_SETTINGS.repair,
      generationId,
    );
  }

  private async createStreamingCompletion(
    messages: readonly NarrativePromptMessage[],
    settings: GenerationSettings,
    generationId: number,
    options: SceneStreamingOptions,
  ): Promise<string> {
    this.assertGenerationActive(generationId);
    const engine = this.requireEngine();
    const startedAt = performance.now();
    let firstChunkAt: number | null = null;
    let output = "";
    let finishReason: string | null = null;
    let finalUsage: ChatCompletionChunk["usage"];
    const chunks = await engine.chat.completions.create({
      messages: messages.map(toChatMessage),
      stream: true,
      stream_options: { include_usage: true },
      model: this.modelId,
      temperature: settings.temperature,
      top_p: settings.topP,
      max_tokens: settings.maxTokens,
      extra_body: {
        enable_thinking: false,
        enable_latency_breakdown: true,
      },
    });

    if (!(Symbol.asyncIterator in chunks)) {
      throw new WebLLMNarrativeProviderError(
        "GENERATION_FAILED",
        "WebLLM did not return a stream for a streaming request.",
      );
    }

    for await (const chunk of chunks) {
      this.assertGenerationActive(generationId);
      const choice = chunk.choices.at(0);
      const delta = choice?.delta.content ?? "";
      if (delta.length > 0) {
        if (firstChunkAt === null) firstChunkAt = performance.now();
        output += delta;
        options.onChunk?.(delta);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      if (chunk.usage) finalUsage = chunk.usage;
    }
    this.assertGenerationActive(generationId);

    if (finishReason === "abort" || finishReason === "length") {
      throw new WebLLMNarrativeProviderError(
        finishReason === "abort"
          ? "GENERATION_INTERRUPTED"
          : "GENERATION_FAILED",
        `WebLLM streaming stopped with finish_reason=${finishReason}.`,
      );
    }

    const completedAt = performance.now();
    const usageExtra = finalUsage?.extra;
    options.onMetrics?.({
      promptTokens: finalUsage?.prompt_tokens ?? null,
      completionTokens: finalUsage?.completion_tokens ?? null,
      timeToFirstTokenMs:
        usageExtra?.time_to_first_token_s === undefined
          ? firstChunkAt === null
            ? null
            : Math.round(firstChunkAt - startedAt)
          : Math.round(usageExtra.time_to_first_token_s * 1_000),
      completionMs:
        usageExtra?.e2e_latency_s === undefined
          ? Math.round(completedAt - startedAt)
          : Math.round(usageExtra.e2e_latency_s * 1_000),
      tokensPerSecond: usageExtra?.decode_tokens_per_s ?? null,
    });
    return output;
  }

  private assertGenerationActive(generationId: number): void {
    if (
      this.activeGenerationId !== generationId ||
      this.generationInterrupted
    ) {
      throw new WebLLMNarrativeProviderError(
        "GENERATION_INTERRUPTED",
        "WebLLM generation was interrupted.",
      );
    }
  }

  private async runGeneration<T>(
    progressText: string,
    generate: (generationId: number) => Promise<T>,
  ): Promise<T> {
    this.requireEngine();
    if (this.activeGenerationId !== undefined) {
      throw new WebLLMNarrativeProviderError(
        "GENERATION_FAILED",
        "A WebLLM generation is already in progress.",
      );
    }

    const generationId = this.nextGenerationId + 1;
    this.nextGenerationId = generationId;
    this.activeGenerationId = generationId;
    this.generationInterrupted = false;
    this.emitProgress("generating", 0, progressText);
    const cancellationPromise = new Promise<never>((_resolve, reject) => {
      this.rejectActiveGeneration = reject;
    });
    const generationPromise = Promise.resolve().then(() =>
      generate(generationId),
    );

    try {
      const result = await Promise.race([
        generationPromise,
        cancellationPromise,
      ]);
      this.assertGenerationActive(generationId);
      this.emitProgress("ready", 1, "生成が完了しました。");
      return result;
    } catch (error: unknown) {
      if (
        this.generationInterrupted ||
        this.activeGenerationId !== generationId
      ) {
        throw new WebLLMNarrativeProviderError(
          "GENERATION_INTERRUPTED",
          "WebLLM generation was interrupted.",
          { cause: error },
        );
      }
      if (error instanceof WebLLMNarrativeProviderError) {
        throw error;
      }
      throw new WebLLMNarrativeProviderError(
        "GENERATION_FAILED",
        "WebLLM could not generate the requested narrative output.",
        { cause: error },
      );
    } finally {
      if (this.activeGenerationId === generationId) {
        this.activeGenerationId = undefined;
        this.rejectActiveGeneration = undefined;
        this.generationInterrupted = false;
      }
    }
  }
}
