import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { initialAppState, type AppScreen } from "./app/AppState";
import { appReducer } from "./app/appReducer";
import { checkWebGpuCompatibility } from "./app/compatibility";
import { toSerializableError } from "./app/errors";
import {
  collectRuntimeDiagnostics,
  createGenerationMetrics,
  estimatePromptTokens,
  requestStoragePersistence,
  type GenerationMetrics,
  type RuntimeDiagnostics,
  type StorageDiagnostics,
} from "./app/metrics";
import { parseQueryFlags } from "./app/queryFlags";
import { BoredomInput } from "./components/BoredomInput";
import { DebugPanel } from "./components/DebugPanel";
import { Departure } from "./components/Departure";
import { EndingView } from "./components/EndingView";
import { ErrorPanel } from "./components/ErrorPanel";
import { ModelProgress } from "./components/ModelProgress";
import { ModelSetup, type ModelSelection } from "./components/ModelSetup";
import { ReadingView } from "./components/ReadingView";
import { PwaStatus } from "./pwa/PwaStatus";
import { createEndingRequest } from "./narrative/contextAssembler";
import { createFastSceneRequest } from "./narrative/fastContext";
import {
  buildFastScenePromptMessages,
  promptCharacterCount,
} from "./narrative/fastPromptTemplates";
import { generateFallbackEnding } from "./narrative/fallbackGenerator";
import {
  ScenePrefetchCache,
  scenePrefetchKey,
  shouldPrefetch,
} from "./narrative/prefetchCache";
import { createProvisionalOpening } from "./narrative/provisionalNarrative";
import { createScenePlan, renderPlannedScene } from "./narrative/scenePlanner";
import { StreamingTextBuffer } from "./narrative/streamingBuffer";
import {
  acknowledgeDeparture,
  applyEndingResult,
  applyProvisionalOpening,
  chooseClosure,
  commitPlannedScene,
  createStorySession,
  markStoryError,
  recoverStorySession,
  selectProvider,
} from "./narrative/storyEngine";
import type {
  AppErrorCode,
  ClosureChoice,
  GenerationMode,
  ReaderChoice,
  ScenePlan,
  StorySession,
} from "./narrative/types";
import {
  appendDebugLog,
  deleteActiveSession,
  loadActiveSession,
  saveActiveSession,
} from "./persistence/sessionRepository";
import { MockNarrativeProvider } from "./providers/MockNarrativeProvider";
import type { NarrativeProvider } from "./providers/NarrativeProvider";
import { MODEL_CATALOG } from "./providers/modelCatalog";
import { ProviderManager } from "./providers/ProviderManager";

type RetryOperation = () => void;

function modelLabel(modelId: string | null): string {
  if (modelId === "mock-narrative-v1") return "デモ（モック生成）";
  return (
    MODEL_CATALOG.find((model) => model.id === modelId)?.label ??
    modelId ??
    "物語モデル"
  );
}

function modeForModel(modelId: string | null): GenerationMode {
  if (modelId === "mock-narrative-v1") return "demo";
  return MODEL_CATALOG.find((model) => model.id === modelId)?.mode ?? "fast";
}

function isInjectedMockError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^Injected (?:invalid )?mock /u.test(error.message)
  );
}

function screenAfterStableSession(session: StorySession): AppScreen {
  if (!session.departureAcknowledged && session.scenes.length > 0)
    return "departure";
  if (session.status === "ended") return "ending";
  return "reading";
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const [selectedModelLabel, setSelectedModelLabel] = useState("物語モデル");
  const [generationDurationMs, setGenerationDurationMs] = useState<
    number | null
  >(null);
  const [runtimeStatus, setRuntimeStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [prefetchStatus, setPrefetchStatus] = useState("idle");
  const [latestMetrics, setLatestMetrics] = useState<GenerationMetrics | null>(
    null,
  );
  const [storageDiagnostics, setStorageDiagnostics] =
    useState<StorageDiagnostics>({
      persisted: null,
      persistRequested: false,
      usageBytes: null,
      quotaBytes: null,
    });
  const flags = useRef(parseQueryFlags(window.location.search)).current;
  const stateRef = useRef(state);
  const providerManagerRef = useRef<ProviderManager | null>(null);
  const providerReadyPromiseRef = useRef<Promise<NarrativeProvider> | null>(
    null,
  );
  const selectedModeRef = useRef<GenerationMode>("demo");
  const prefetchCacheRef = useRef(new ScenePrefetchCache());
  const streamBufferRef = useRef<StreamingTextBuffer | null>(null);
  const retryRef = useRef<RetryOperation | null>(null);
  const busyRef = useRef(false);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const operationEpochRef = useRef(0);
  const operationSnapshotRef = useRef<StorySession | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  stateRef.current = state;

  const recordLog = useCallback(
    (
      level: "debug" | "info" | "warn" | "error",
      message: string,
      details?: unknown,
    ) => {
      void appendDebugLog({ level, message, details }).catch(() => {
        // IndexedDB warnings are surfaced elsewhere; debug logging must not break reading.
      });
    },
    [],
  );

  const getProviderManager = useCallback((): ProviderManager => {
    if (!providerManagerRef.current) {
      providerManagerRef.current = new ProviderManager({
        mockDelayMs: flags.mockDelayMs,
        onDiagnostic: (diagnostic) => {
          recordLog(
            diagnostic.stage === "repair_succeeded" ? "info" : "warn",
            `model-json-${diagnostic.stage}`,
            diagnostic,
          );
        },
      });
    }
    return providerManagerRef.current;
  }, [flags.mockDelayMs, recordLog]);

  const saveSessionSafely = useCallback(
    async (session: StorySession) => {
      const queuedSave = saveQueueRef.current.then(async () => {
        try {
          await saveActiveSession(session);
          dispatch({ type: "STORAGE_WARNING", message: null });
        } catch (error) {
          const storageError = toSerializableError(error, "STORAGE_FAILED");
          dispatch({
            type: "STORAGE_WARNING",
            message: storageError.userMessage,
          });
          recordLog("error", "session-save-failed", storageError);
        }
      });
      saveQueueRef.current = queuedSave;
      await queuedSave;
    },
    [recordLog],
  );

  const commitSession = useCallback(
    async (session: StorySession, screen?: AppScreen) => {
      stateRef.current = {
        ...stateRef.current,
        session,
        screen: screen ?? stateRef.current.screen,
        error: session.lastError,
      };
      dispatch({ type: "SESSION_UPDATED", session, screen });
      await saveSessionSafely(session);
    },
    [saveSessionSafely],
  );

  const checkCompatibility = useCallback(async () => {
    dispatch({ type: "COMPATIBILITY_CHECKING" });
    const compatibility = await checkWebGpuCompatibility();
    dispatch({ type: "COMPATIBILITY_RESOLVED", compatibility });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      void checkCompatibility();
      try {
        const loaded = await loadActiveSession();
        if (cancelled) return;

        if (loaded.status === "ready") {
          const session = loaded.session;
          setSelectedModelLabel(modelLabel(session.modelId));
          selectedModeRef.current = modeForModel(session.modelId);
          // Restore the readable canonical page before reconnecting a runtime.
          // A prior model choice is persisted user intent, but a cold WebGPU
          // reload must never turn restoration into a full-screen wait.
          dispatch({ type: "BOOT_RESOLVED", session });

          const reconnectModelId =
            session.providerKind === "mock"
              ? (session.modelId ?? "mock-narrative-v1")
              : session.modelId;
          if (session.status !== "ended" && reconnectModelId) {
            setRuntimeStatus("loading");
            const reconnectController = new AbortController();
            abortControllerRef.current = reconnectController;
            const ready = getProviderManager()
              .ensureProvider(
                {
                  providerKind: session.providerKind,
                  modelId: reconnectModelId,
                },
                {
                  signal: reconnectController.signal,
                  onProgress: (progress) =>
                    dispatch({ type: "PROGRESS_UPDATED", progress }),
                },
              )
              .then(({ provider }) => {
                if (!cancelled) {
                  setRuntimeStatus("ready");
                  setRuntimeError(null);
                }
                return provider;
              })
              .catch((error: unknown) => {
                if (!cancelled) {
                  const serializable = toSerializableError(
                    error,
                    session.providerKind === "webllm"
                      ? "MODEL_INIT_FAILED"
                      : "GENERATION_FAILED",
                  );
                  setRuntimeStatus("error");
                  setRuntimeError(serializable.userMessage);
                  recordLog("error", "provider-reconnect-failed", serializable);
                }
                throw error;
              })
              .finally(() => {
                if (abortControllerRef.current === reconnectController) {
                  abortControllerRef.current = null;
                }
              });
            providerReadyPromiseRef.current = ready;
            void ready.catch(() => undefined);
          }
          return;
        }

        dispatch({ type: "BOOT_RESOLVED", session: null });
        if (loaded.error) {
          dispatch({ type: "ERROR_RAISED", error: loaded.error });
          recordLog("error", `session-${loaded.status}`, loaded.error);
        }
      } catch (error) {
        if (cancelled) return;
        const storageError = toSerializableError(error, "STORAGE_FAILED");
        dispatch({
          type: "BOOT_RESOLVED",
          session: null,
          storageWarning: storageError.userMessage,
        });
        recordLog("error", "session-load-failed", storageError);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [checkCompatibility, getProviderManager, recordLog]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      streamBufferRef.current?.cancel();
      void providerManagerRef.current?.release();
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [state.screen, state.session?.totalSceneCount]);

  useEffect(() => {
    const session = state.session;
    if (
      !session ||
      session.status !== "awaiting_branch" ||
      state.busy ||
      runtimeStatus !== "ready"
    ) {
      return;
    }
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (
      !shouldPrefetch({
        providerKind: session.providerKind,
        documentVisible: document.visibilityState === "visible",
        saveData: connection?.saveData === true,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        // WebLLM prefetch remains opt-in until it can be measured on a real
        // adapter. Mock prefetch validates the non-canonical cache path.
        webLlmOptIn: false,
      })
    ) {
      setPrefetchStatus("disabled");
      return;
    }

    const cache = prefetchCacheRef.current;
    const scope = cache.beginScope(session);
    let cancelled = false;
    setPrefetchStatus("planning");
    queueMicrotask(() => {
      for (const choice of ["stay", "move"] as const) {
        if (cancelled) return;
        const plan = createScenePlan(session, choice);
        cache.store(
          scope,
          scenePrefetchKey(session, choice),
          renderPlannedScene(plan, "demo"),
        );
      }
      if (!cancelled) setPrefetchStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [runtimeStatus, state.busy, state.session]);

  const raiseOperationError = useCallback(
    (
      error: unknown,
      fallbackCode: AppErrorCode,
      baseSession: StorySession | null,
      retry: RetryOperation | null,
    ) => {
      const serializable = toSerializableError(error, fallbackCode);
      retryRef.current = retry;
      if (baseSession) {
        const failed = markStoryError(baseSession, serializable);
        stateRef.current = {
          ...stateRef.current,
          session: failed,
          error: serializable,
          screen: "error",
          busy: false,
        };
        dispatch({ type: "SESSION_UPDATED", session: failed });
        void saveSessionSafely(failed);
      }
      dispatch({ type: "ERROR_RAISED", error: serializable });
      recordLog("error", serializable.code, serializable);
    },
    [recordLog, saveSessionSafely],
  );

  const runExclusive = useCallback(
    async (operation: (epoch: number) => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      const epoch = operationEpochRef.current + 1;
      operationEpochRef.current = epoch;
      dispatch({ type: "BUSY_CHANGED", busy: true });
      try {
        await operation(epoch);
      } finally {
        if (operationEpochRef.current === epoch) {
          busyRef.current = false;
          dispatch({ type: "BUSY_CHANGED", busy: false });
        }
      }
    },
    [],
  );

  const startModel = useCallback(
    (selection: ModelSelection) => {
      const currentSession = stateRef.current.session;
      if (!currentSession) return;
      const epoch = operationEpochRef.current + 1;
      operationEpochRef.current = epoch;
      operationSnapshotRef.current = null;
      abortControllerRef.current?.abort();
      prefetchCacheRef.current.clear();
      setPrefetchStatus("idle");
      setStreamingText("");
      setSelectedModelLabel(selection.label);
      selectedModeRef.current = selection.mode;
      setRuntimeStatus("loading");
      setRuntimeError(null);

      // This is deliberately started in the click task, before any model
      // import or IndexedDB write. The result is diagnostic, not a guarantee.
      const storagePromise = requestStoragePersistence();
      void storagePromise.then((diagnostics) => {
        if (operationEpochRef.current !== epoch) return;
        setStorageDiagnostics(diagnostics);
        setLatestMetrics((current) =>
          current
            ? { ...current, storagePersisted: diagnostics.persisted }
            : current,
        );
      });

      const recovered =
        currentSession.status === "error"
          ? recoverStorySession(currentSession)
          : currentSession;
      const isResume =
        recovered.scenes.length > 0 && recovered.themeTransform !== null;
      let visibleSession: StorySession;
      if (isResume) {
        visibleSession = {
          ...recovered,
          providerKind: selection.providerKind,
          modelId: selection.modelId,
          lastError: null,
          updatedAt: new Date().toISOString(),
        };
      } else {
        const selected = selectProvider(
          recovered,
          selection.providerKind,
          selection.modelId,
        );
        const opening = createProvisionalOpening(
          selected.readerInput,
          selected.id,
        );
        visibleSession = applyProvisionalOpening(
          selected,
          opening.seed,
          opening.plan,
        );
        recordLog("info", "provisional-opening-created", {
          category: opening.category,
          characters: opening.seed.firstScene.text.length,
          modelId: selection.modelId,
        });
      }
      void commitSession(
        visibleSession,
        isResume ? screenAfterStableSession(visibleSession) : "departure",
      );
      retryRef.current = null;

      const metrics = createGenerationMetrics(
        selection.providerKind,
        selection.modelId,
      );
      setLatestMetrics(metrics);
      const preparationStartedAt = performance.now();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const readyPromise = getProviderManager()
        .ensureProvider(
          {
            providerKind: selection.providerKind,
            modelId: selection.modelId,
          },
          {
            signal: controller.signal,
            onProgress: (progress) =>
              dispatch({ type: "PROGRESS_UPDATED", progress }),
          },
        )
        .then(({ provider, reused }) => {
          if (operationEpochRef.current === epoch) {
            const preparationMs = Math.round(
              performance.now() - preparationStartedAt,
            );
            setRuntimeStatus("ready");
            setRuntimeError(null);
            setLatestMetrics((current) =>
              current
                ? {
                    ...current,
                    modelPreparationMs: preparationMs,
                    engineInitMs: reused ? 0 : preparationMs,
                  }
                : current,
            );
            recordLog("info", "provider-ready", {
              provider: selection.providerKind,
              modelId: selection.modelId,
              preparationMs,
              reused,
            });
          }
          return provider;
        })
        .catch((error: unknown) => {
          if (operationEpochRef.current === epoch) {
            const serializable = toSerializableError(
              error,
              selection.providerKind === "webllm"
                ? "MODEL_INIT_FAILED"
                : "GENERATION_FAILED",
            );
            setRuntimeStatus("error");
            setRuntimeError(serializable.userMessage);
            setLatestMetrics((current) =>
              current ? { ...current, errorCode: serializable.code } : current,
            );
            recordLog("error", "provider-preparation-failed", serializable);
          }
          throw error;
        })
        .finally(() => {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        });
      providerReadyPromiseRef.current = readyPromise;
      void readyPromise.catch(() => undefined);
    },
    [commitSession, getProviderManager, recordLog],
  );

  const startSelectedScene = useCallback(
    (canonicalSession: StorySession, choice: ReaderChoice | "continue") => {
      let plan: ScenePlan;
      try {
        const planningSession =
          choice === "continue"
            ? chooseClosure(canonicalSession, "continue")
            : canonicalSession;
        plan = createScenePlan(planningSession, choice);
      } catch (error) {
        raiseOperationError(error, "GENERATION_FAILED", canonicalSession, null);
        return;
      }

      operationSnapshotRef.current = canonicalSession;
      void runExclusive(async (epoch) => {
        const mode = selectedModeRef.current;
        const request = createFastSceneRequest(canonicalSession, plan, mode);
        const promptCharacters = promptCharacterCount(
          buildFastScenePromptMessages(request),
        );
        const sceneMetrics: GenerationMetrics = {
          ...createGenerationMetrics(
            canonicalSession.providerKind,
            canonicalSession.modelId ?? "unknown",
          ),
          promptCharacters,
          promptTokenEstimate: estimatePromptTokens(promptCharacters),
          storagePersisted: storageDiagnostics.persisted,
        };
        setLatestMetrics((current) => ({
          ...sceneMetrics,
          modelPreparationMs:
            current?.modelId === sceneMetrics.modelId
              ? current.modelPreparationMs
              : null,
          engineInitMs:
            current?.modelId === sceneMetrics.modelId
              ? current.engineInitMs
              : null,
          cacheStatus:
            current?.modelId === sceneMetrics.modelId
              ? current.cacheStatus
              : "unknown",
        }));
        setStreamingText("");
        const buffer = new StreamingTextBuffer({
          intervalMs: 45,
          onFlush: (text) => {
            if (operationEpochRef.current === epoch) setStreamingText(text);
          },
        });
        streamBufferRef.current = buffer;
        const startedAt = performance.now();
        try {
          let text =
            choice === "continue"
              ? undefined
              : prefetchCacheRef.current.consume(canonicalSession, choice);
          let fallbackUsed = false;
          let generationSource = text ? "prefetch" : "foreground";

          if (!text) {
            let provider: NarrativeProvider | null = null;
            try {
              provider = providerReadyPromiseRef.current
                ? await providerReadyPromiseRef.current
                : getProviderManager().getCurrentProvider();
            } catch {
              provider = null;
            }

            if (provider) {
              try {
                const result = await provider.generateSceneText(request, {
                  onChunk: (chunk) => buffer.push(chunk),
                  onMetrics: (stats) => {
                    setLatestMetrics((current) =>
                      current ? { ...current, ...stats } : current,
                    );
                  },
                });
                text = result.text;
              } catch (error) {
                if (isInjectedMockError(error)) throw error;
                fallbackUsed = true;
                generationSource = "fallback";
                recordLog("warn", "plain-scene-fallback", {
                  planId: plan.id,
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            } else {
              fallbackUsed = true;
              generationSource = "fallback";
            }
          }

          if (!text) text = renderPlannedScene(plan, mode);
          if (operationEpochRef.current !== epoch) return;
          buffer.complete();
          const nextSession = commitPlannedScene(
            canonicalSession,
            plan,
            text,
            mode,
          );
          const completionMs = Math.round(performance.now() - startedAt);
          setGenerationDurationMs(completionMs);
          setLatestMetrics((current) =>
            current
              ? {
                  ...current,
                  completionMs: current.completionMs ?? completionMs,
                  outputCharacters: text.length,
                  fallbackUsed,
                }
              : current,
          );
          await commitSession(nextSession, "reading");
          operationSnapshotRef.current = null;
          retryRef.current = null;
          prefetchCacheRef.current.clear();
          setPrefetchStatus("idle");
          recordLog("info", "scene-generated", {
            macroPartIndex: nextSession.macroPartIndex,
            sceneIndexInMacro: nextSession.sceneIndexInMacro,
            choice,
            planId: plan.id,
            generationSource,
            completionMs,
          });
        } catch (error) {
          if (operationEpochRef.current !== epoch) return;
          buffer.cancel();
          raiseOperationError(
            error,
            "GENERATION_FAILED",
            canonicalSession,
            () => startSelectedScene(canonicalSession, choice),
          );
        } finally {
          if (streamBufferRef.current === buffer) {
            streamBufferRef.current = null;
          }
          if (operationEpochRef.current === epoch) setStreamingText("");
        }
      });
    },
    [
      commitSession,
      getProviderManager,
      raiseOperationError,
      recordLog,
      runExclusive,
      storageDiagnostics.persisted,
    ],
  );

  const handleBranch = useCallback(
    (choice: ReaderChoice) => {
      const session = stateRef.current.session;
      if (!session || busyRef.current) return;
      startSelectedScene(session, choice);
    },
    [startSelectedScene],
  );

  const startEnding = useCallback(
    (selectedSession: StorySession, rollbackSession: StorySession) => {
      operationSnapshotRef.current = rollbackSession;
      void runExclusive(async (epoch) => {
        try {
          await commitSession(selectedSession, "ending_generating");
          const startedAt = performance.now();
          const request = createEndingRequest(selectedSession);
          let ending;
          let fallbackUsed = false;
          try {
            const provider = providerReadyPromiseRef.current
              ? await providerReadyPromiseRef.current
              : getProviderManager().getCurrentProvider();
            if (!provider)
              throw new Error("Narrative provider is unavailable.");
            ending = await provider.generateEnding(request);
          } catch (error) {
            if (isInjectedMockError(error)) throw error;
            fallbackUsed = true;
            ending = generateFallbackEnding(request.context);
            recordLog("warn", "ending-fallback", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
          if (operationEpochRef.current !== epoch) return;
          const ended = applyEndingResult(selectedSession, ending);
          const completionMs = Math.round(performance.now() - startedAt);
          setGenerationDurationMs(completionMs);
          setLatestMetrics((current) =>
            current
              ? {
                  ...current,
                  completionMs,
                  outputCharacters: ending.epilogue.length,
                  fallbackUsed,
                }
              : current,
          );
          await commitSession(ended, "ending");
          operationSnapshotRef.current = null;
          retryRef.current = null;
          recordLog("info", "ending-generated", { title: ending.title });
        } catch (error) {
          if (operationEpochRef.current !== epoch) return;
          raiseOperationError(error, "GENERATION_FAILED", selectedSession, () =>
            startEnding(selectedSession, rollbackSession),
          );
        }
      });
    },
    [
      commitSession,
      getProviderManager,
      raiseOperationError,
      recordLog,
      runExclusive,
    ],
  );

  const handleClosure = useCallback(
    (choice: ClosureChoice) => {
      const session = stateRef.current.session;
      if (!session || busyRef.current) return;
      try {
        const selected = chooseClosure(session, choice);
        if (choice === "continue") {
          startSelectedScene(session, "continue");
        } else {
          startEnding(selected, session);
        }
      } catch (error) {
        raiseOperationError(error, "GENERATION_FAILED", session, null);
      }
    },
    [raiseOperationError, startEnding, startSelectedScene],
  );

  const interruptCurrentOperation = useCallback(() => {
    const snapshot = operationSnapshotRef.current;
    operationEpochRef.current += 1;
    busyRef.current = false;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    streamBufferRef.current?.cancel();
    streamBufferRef.current = null;
    setStreamingText("");
    const provider = getProviderManager().getCurrentProvider();
    void provider?.interrupt();
    dispatch({ type: "BUSY_CHANGED", busy: false });
    retryRef.current = null;

    if (snapshot) {
      const screen =
        snapshot.scenes.length === 0
          ? "model_selection"
          : screenAfterStableSession(snapshot);
      void commitSession(snapshot, screen);
      operationSnapshotRef.current = null;
      recordLog("info", "generation-interrupted", {
        restoredStatus: snapshot.status,
      });
    }
  }, [commitSession, getProviderManager, recordLog]);

  const handleNewStory = useCallback(() => {
    operationEpochRef.current += 1;
    busyRef.current = false;
    abortControllerRef.current?.abort();
    streamBufferRef.current?.cancel();
    streamBufferRef.current = null;
    void getProviderManager().getCurrentProvider()?.interrupt();
    getProviderManager().resetForNewStory();
    providerReadyPromiseRef.current = null;
    prefetchCacheRef.current.clear();
    setStreamingText("");
    setPrefetchStatus("idle");
    retryRef.current = null;
    operationSnapshotRef.current = null;
    void saveQueueRef.current
      .then(() => deleteActiveSession())
      .catch((error: unknown) => {
        dispatch({
          type: "STORAGE_WARNING",
          message: toSerializableError(error, "STORAGE_FAILED").userMessage,
        });
      })
      .finally(() => dispatch({ type: "SESSION_CLEARED" }));
  }, [getProviderManager]);

  const handleReaderInput = useCallback(
    (readerInput: string) => {
      const session = createStorySession({
        id: crypto.randomUUID(),
        readerInput,
        providerKind: "mock",
      });
      void commitSession(session, "model_selection");
    },
    [commitSession],
  );

  const handleDeparture = useCallback(() => {
    const session = stateRef.current.session;
    if (!session) return;
    try {
      const acknowledged = acknowledgeDeparture(session);
      void commitSession(acknowledged, "reading");
    } catch (error) {
      raiseOperationError(error, "UNKNOWN", session, null);
    }
  }, [commitSession, raiseOperationError]);

  const handleRetry = useCallback(() => {
    const retry = retryRef.current;
    if (retry) retry();
  }, []);

  const handleErrorBack = useCallback(() => {
    const snapshot = operationSnapshotRef.current;
    retryRef.current = null;
    operationSnapshotRef.current = null;
    if (snapshot) {
      const screen =
        snapshot.scenes.length === 0
          ? "model_selection"
          : screenAfterStableSession(snapshot);
      void commitSession(snapshot, screen);
      return;
    }
    handleNewStory();
  }, [commitSession, handleNewStory]);

  const currentProvider =
    providerManagerRef.current?.getCurrentProvider() ?? null;
  const mockProvider =
    currentProvider instanceof MockNarrativeProvider ? currentProvider : null;
  const runtimeDiagnostics: RuntimeDiagnostics = collectRuntimeDiagnostics(
    state.compatibility,
    storageDiagnostics,
  );

  let content: React.ReactNode;
  switch (state.screen) {
    case "boot":
      content = (
        <section className="center-panel" aria-live="polite">
          <p className="eyebrow">RESTORING THE PAGE</p>
          <h1>前に読んでいた頁を探しています</h1>
        </section>
      );
      break;
    case "input":
      content = (
        <BoredomInput
          initialValue={state.session?.readerInput}
          disabled={state.busy}
          onSubmit={handleReaderInput}
        />
      );
      break;
    case "model_selection":
      content = (
        <ModelSetup
          compatibility={state.compatibility}
          checkingCompatibility={state.checkingCompatibility}
          debug={flags.debug}
          preferMock={flags.preferMock}
          busy={state.busy}
          onRecheck={() => void checkCompatibility()}
          onSelect={startModel}
          onBack={() => dispatch({ type: "SCREEN_CHANGED", screen: "input" })}
        />
      );
      break;
    case "model_loading":
      content = (
        <ModelProgress
          modelLabel={selectedModelLabel}
          progress={state.progress}
          generating={false}
          compatibilityLabel={
            state.session?.providerKind === "mock"
              ? "WebGPU不要のデモモード"
              : (state.compatibility?.detail ?? "WebGPUを確認中")
          }
          onCancel={interruptCurrentOperation}
        />
      );
      break;
    case "seed_generating":
      content = (
        <ModelProgress
          modelLabel={selectedModelLabel}
          progress={state.progress}
          generating
          compatibilityLabel={
            state.session?.providerKind === "mock"
              ? "WebGPU不要のデモモード"
              : (state.compatibility?.detail ?? "WebGPUを確認中")
          }
          onCancel={interruptCurrentOperation}
        />
      );
      break;
    case "departure":
      content = state.session ? (
        <Departure
          session={state.session}
          runtimeStatus={runtimeStatus}
          progress={state.progress}
          runtimeError={runtimeError}
          onContinue={handleDeparture}
        />
      ) : null;
      break;
    case "reading":
      content = state.session ? (
        <ReadingView
          session={state.session}
          busy={state.busy}
          runtimeStatus={runtimeStatus}
          runtimeError={runtimeError}
          streamingText={streamingText}
          prefetchStatus={prefetchStatus}
          onBranch={handleBranch}
          onClosure={handleClosure}
          onInterrupt={interruptCurrentOperation}
        />
      ) : null;
      break;
    case "ending_generating":
      content = (
        <section className="center-panel" aria-live="polite" aria-busy="true">
          <p className="eyebrow">CLOSING THE BOOK</p>
          <h1>ここまでの景色から、終幕を整えています</h1>
          <p className="lead">
            新しい事件は足さず、通ってきた道の余韻だけを結びます。
          </p>
          <button
            className="button quiet"
            type="button"
            onClick={interruptCurrentOperation}
          >
            生成を中断
          </button>
        </section>
      );
      break;
    case "ending":
      content = state.session ? (
        <EndingView session={state.session} onNewStory={handleNewStory} />
      ) : null;
      break;
    case "error":
      content = state.error ? (
        <ErrorPanel
          error={state.error}
          debug={flags.debug}
          onRetry={retryRef.current ? handleRetry : undefined}
          onBack={handleErrorBack}
          backLabel={
            state.error.code.startsWith("MODEL_") ||
            state.error.code === "WEBGPU_UNAVAILABLE"
              ? "別の方法を選ぶ"
              : state.session
                ? "直前の頁へ戻る"
                : "新しい物語を始める"
          }
        />
      ) : null;
      break;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        本文へ移動
      </a>
      <header className="site-header">
        <div className="wordmark">
          <span aria-hidden="true" className="wordmark-symbol">
            十
          </span>
          <span>終われる物語</span>
        </div>
        <div className="header-actions">
          <span className="privacy-mark">端末内で生成</span>
          {state.session ? (
            <button
              className="button quiet"
              type="button"
              onClick={handleNewStory}
            >
              新しい物語
            </button>
          ) : null}
        </div>
      </header>

      <main className="page" id="main-content">
        {state.storageWarning ? (
          <p className="storage-warning" role="status">
            {state.storageWarning}
          </p>
        ) : null}
        {content}
      </main>

      <div>
        {flags.debug || flags.benchmark ? (
          <DebugPanel
            screen={state.screen}
            session={state.session}
            progress={state.progress}
            generationDurationMs={generationDurationMs}
            metrics={latestMetrics}
            runtimeDiagnostics={runtimeDiagnostics}
            runtimeStatus={runtimeStatus}
            prefetchStatus={prefetchStatus}
            benchmark={flags.benchmark}
            onClearSession={handleNewStory}
            onInjectError={
              mockProvider
                ? () => {
                    prefetchCacheRef.current.clear();
                    setPrefetchStatus("idle");
                    mockProvider.injectErrorOnce("scene");
                  }
                : undefined
            }
            onInjectInvalid={
              mockProvider
                ? () => {
                    prefetchCacheRef.current.clear();
                    setPrefetchStatus("idle");
                    mockProvider.injectInvalidResponseOnce("scene");
                  }
                : undefined
            }
          />
        ) : null}
        <PwaStatus />
        <footer className="site-footer">
          <div className="footer-grid">
            <span>
              Proof of Concept · 無料 · APIキー・バックエンド・アクセス解析なし
            </span>
            <span>相談・診断サービスではありません</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
