import type { WebGpuCompatibility } from "./compatibility";
import { BUILD_INFO, type BuildInfo } from "./buildInfo";

export type CacheStatus = "known-cached" | "known-not-cached" | "unknown";

export interface GenerationMetrics {
  buildSha: string;
  buildTime: string;
  provider: string;
  modelId: string;
  modelPreparationMs: number | null;
  engineInitMs: number | null;
  timeToFirstTokenMs: number | null;
  completionMs: number | null;
  outputCharacters: number | null;
  completionTokens: number | null;
  tokensPerSecond: number | null;
  promptCharacters: number | null;
  promptTokens: number | null;
  promptTokenEstimate: number | null;
  cacheStatus: CacheStatus;
  storagePersisted: boolean | null;
  fallbackUsed: boolean;
  errorCode: string | null;
}

export interface StorageDiagnostics {
  persisted: boolean | null;
  persistRequested: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export interface RuntimeDiagnostics {
  build: BuildInfo;
  compatibility: WebGpuCompatibility | null;
  hardwareConcurrency: number | null;
  deviceMemoryGiB: number | null;
  userAgent: string;
  serviceWorkerControlled: boolean;
  storage: StorageDiagnostics;
}

interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function estimatePromptTokens(promptCharacters: number): number {
  if (!Number.isFinite(promptCharacters) || promptCharacters <= 0) return 0;
  // A transparent estimate only; actual token counts remain null unless the
  // provider reports usage.
  return Math.ceil(promptCharacters / 3);
}

export function createGenerationMetrics(
  provider: string,
  modelId: string,
): GenerationMetrics {
  return {
    buildSha: BUILD_INFO.buildSha,
    buildTime: BUILD_INFO.buildTime,
    provider,
    modelId,
    modelPreparationMs: null,
    engineInitMs: null,
    timeToFirstTokenMs: null,
    completionMs: null,
    outputCharacters: null,
    completionTokens: null,
    tokensPerSecond: null,
    promptCharacters: null,
    promptTokens: null,
    promptTokenEstimate: null,
    cacheStatus: "unknown",
    storagePersisted: null,
    fallbackUsed: false,
    errorCode: null,
  };
}

export async function requestStoragePersistence(): Promise<StorageDiagnostics> {
  const storage = navigator.storage;
  if (!storage) {
    return {
      persisted: null,
      persistRequested: false,
      usageBytes: null,
      quotaBytes: null,
    };
  }

  let persisted: boolean | null;
  let persistRequested = false;
  try {
    const persistedBeforeRequest = storage.persisted();
    let persistenceRequest: Promise<boolean> | null = null;
    if (typeof storage.persist === "function") {
      persistRequested = true;
      // Invoke persist() before the first await so the browser can associate
      // the request with the model-selection click's user activation.
      persistenceRequest = storage.persist();
    }
    const alreadyPersisted = await persistedBeforeRequest;
    persisted =
      alreadyPersisted ||
      (persistenceRequest ? await persistenceRequest : false);
  } catch {
    persisted = null;
  }

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  try {
    const estimate = await storage.estimate();
    usageBytes = finiteNumber(estimate.usage);
    quotaBytes = finiteNumber(estimate.quota);
  } catch {
    // Storage estimates are optional diagnostics and must not block reading.
  }

  return { persisted, persistRequested, usageBytes, quotaBytes };
}

export function collectRuntimeDiagnostics(
  compatibility: WebGpuCompatibility | null,
  storage: StorageDiagnostics,
): RuntimeDiagnostics {
  const navigatorWithMemory = navigator as NavigatorWithDeviceMemory;
  return {
    build: BUILD_INFO,
    compatibility,
    hardwareConcurrency: finiteNumber(navigator.hardwareConcurrency),
    deviceMemoryGiB: finiteNumber(navigatorWithMemory.deviceMemory),
    userAgent: navigator.userAgent,
    serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
    storage,
  };
}
