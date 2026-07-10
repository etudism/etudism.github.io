import { STORY_SESSION_VERSION } from "../narrative/constants";
import { storySessionSchema } from "../narrative/schemas";
import type { SerializableError, StorySession } from "../narrative/types";
import {
  ACTIVE_SESSION_KEY,
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_NAMES,
  getDatabase,
  type DebugLogLevel,
  type DebugLogRecord,
} from "./db";

export const CURRENT_SESSION_VERSION = STORY_SESSION_VERSION;

interface SessionLoadResultBase {
  session: StorySession | null;
  rawSession: unknown | null;
  error: SerializableError | null;
  recoveryAction: "none" | "export-or-new";
}

export interface ReadySessionLoadResult extends SessionLoadResultBase {
  status: "ready";
  session: StorySession;
  rawSession: StorySession;
  error: null;
  recoveryAction: "none";
}

export interface EmptySessionLoadResult extends SessionLoadResultBase {
  status: "empty";
  session: null;
  rawSession: null;
  error: null;
  recoveryAction: "none";
}

export interface UnsupportedVersionSessionLoadResult extends SessionLoadResultBase {
  status: "unsupported-version";
  session: null;
  rawSession: unknown;
  error: SerializableError;
  recoveryAction: "export-or-new";
  foundVersion: number;
  supportedVersion: typeof CURRENT_SESSION_VERSION;
}

export interface CorruptSessionLoadResult extends SessionLoadResultBase {
  status: "corrupt";
  session: null;
  rawSession: unknown;
  error: SerializableError;
  recoveryAction: "export-or-new";
  validationIssues: string[];
}

export type ActiveSessionLoadResult =
  | ReadySessionLoadResult
  | EmptySessionLoadResult
  | UnsupportedVersionSessionLoadResult
  | CorruptSessionLoadResult;

export interface DebugLogInput {
  timestamp?: string;
  level?: DebugLogLevel;
  message: string;
  details?: unknown;
}

export interface PersistenceExport {
  databaseName: typeof DATABASE_NAME;
  databaseVersion: typeof DATABASE_VERSION;
  sessionVersion: typeof CURRENT_SESSION_VERSION;
  exportedAt: string;
  activeSession: unknown | null;
  sessions: Record<string, unknown>;
  settings: Record<string, unknown>;
  debugLogs: DebugLogRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVersion(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  return typeof value.version === "number" ? value.version : null;
}

function recoveryError(
  userMessage: string,
  technicalMessage: string,
): SerializableError {
  return {
    code: "SESSION_CORRUPTED",
    userMessage,
    technicalMessage,
    recoverable: true,
    occurredAt: new Date().toISOString(),
  };
}

function validationIssueMessages(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export async function saveActiveSession(session: StorySession): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAMES.sessions, session, ACTIVE_SESSION_KEY);
}

/**
 * Loads and validates the active session without throwing for user-data
 * incompatibility. The raw value remains available for JSON export in every
 * recovery case.
 */
export async function loadActiveSession(): Promise<ActiveSessionLoadResult> {
  const database = await getDatabase();
  const rawSession = await database.get(
    STORE_NAMES.sessions,
    ACTIVE_SESSION_KEY,
  );

  if (rawSession === undefined) {
    return {
      status: "empty",
      session: null,
      rawSession: null,
      error: null,
      recoveryAction: "none",
    };
  }

  const foundVersion = readVersion(rawSession);
  if (foundVersion !== null && foundVersion !== CURRENT_SESSION_VERSION) {
    return {
      status: "unsupported-version",
      session: null,
      rawSession,
      error: recoveryError(
        "このセッションは別のバージョンで保存されています。JSONを書き出すか、新しい物語を始めてください。",
        `Unsupported StorySession version ${foundVersion}; this build supports ${CURRENT_SESSION_VERSION}.`,
      ),
      recoveryAction: "export-or-new",
      foundVersion,
      supportedVersion: CURRENT_SESSION_VERSION,
    };
  }

  try {
    const validation = storySessionSchema.safeParse(rawSession);
    if (validation.success) {
      return {
        status: "ready",
        session: validation.data,
        rawSession: validation.data,
        error: null,
        recoveryAction: "none",
      };
    }

    const issues = validationIssueMessages(validation.error);
    return {
      status: "corrupt",
      session: null,
      rawSession,
      error: recoveryError(
        "保存したセッションを復元できませんでした。JSONを書き出すか、新しい物語を始めてください。",
        `StorySession validation failed: ${issues.join("; ")}`,
      ),
      recoveryAction: "export-or-new",
      validationIssues: issues,
    };
  } catch (error: unknown) {
    const technicalMessage =
      error instanceof Error ? error.message : String(error);
    return {
      status: "corrupt",
      session: null,
      rawSession,
      error: recoveryError(
        "保存したセッションを復元できませんでした。JSONを書き出すか、新しい物語を始めてください。",
        `StorySession validation threw unexpectedly: ${technicalMessage}`,
      ),
      recoveryAction: "export-or-new",
      validationIssues: [technicalMessage],
    };
  }
}

export async function getRawActiveSession(): Promise<unknown | null> {
  const database = await getDatabase();
  const value = await database.get(STORE_NAMES.sessions, ACTIVE_SESSION_KEY);
  return value === undefined ? null : value;
}

export async function deleteActiveSession(): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAMES.sessions, ACTIVE_SESSION_KEY);
}

export const clearActiveSession = deleteActiveSession;

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const database = await getDatabase();
  await database.put(STORE_NAMES.settings, value, key);
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const database = await getDatabase();
  return (await database.get(STORE_NAMES.settings, key)) as T | undefined;
}

export async function deleteSetting(key: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(STORE_NAMES.settings, key);
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const database = await getDatabase();
  const transaction = database.transaction(STORE_NAMES.settings, "readonly");
  const [keys, values] = await Promise.all([
    transaction.store.getAllKeys(),
    transaction.store.getAll(),
  ]);
  await transaction.done;

  return Object.fromEntries(keys.map((key, index) => [key, values[index]]));
}

export async function clearSettings(): Promise<void> {
  const database = await getDatabase();
  await database.clear(STORE_NAMES.settings);
}

export async function appendDebugLog(input: DebugLogInput): Promise<number> {
  const database = await getDatabase();
  const record: DebugLogRecord = {
    timestamp: input.timestamp ?? new Date().toISOString(),
    level: input.level ?? "info",
    message: input.message,
    ...(input.details === undefined ? {} : { details: input.details }),
  };
  return database.add(STORE_NAMES.debugLogs, record);
}

export async function getDebugLogs(limit?: number): Promise<DebugLogRecord[]> {
  const database = await getDatabase();
  const logs = await database.getAllFromIndex(
    STORE_NAMES.debugLogs,
    "by-timestamp",
  );

  if (limit === undefined) {
    return logs;
  }

  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new RangeError("Debug log limit must be a non-negative integer.");
  }

  return limit === 0 ? [] : logs.slice(-limit);
}

export async function clearDebugLogs(): Promise<void> {
  const database = await getDatabase();
  await database.clear(STORE_NAMES.debugLogs);
}

export async function exportAllData(): Promise<PersistenceExport> {
  const database = await getDatabase();
  const transaction = database.transaction(
    [STORE_NAMES.sessions, STORE_NAMES.settings, STORE_NAMES.debugLogs],
    "readonly",
  );
  const sessionsStore = transaction.objectStore(STORE_NAMES.sessions);
  const settingsStore = transaction.objectStore(STORE_NAMES.settings);
  const debugLogsStore = transaction.objectStore(STORE_NAMES.debugLogs);

  const [sessionKeys, sessionValues, settingKeys, settingValues, debugLogs] =
    await Promise.all([
      sessionsStore.getAllKeys(),
      sessionsStore.getAll(),
      settingsStore.getAllKeys(),
      settingsStore.getAll(),
      debugLogsStore.index("by-timestamp").getAll(),
    ]);
  await transaction.done;

  const sessions = Object.fromEntries(
    sessionKeys.map((key, index) => [key, sessionValues[index]]),
  );
  const settings = Object.fromEntries(
    settingKeys.map((key, index) => [key, settingValues[index]]),
  );

  return {
    databaseName: DATABASE_NAME,
    databaseVersion: DATABASE_VERSION,
    sessionVersion: CURRENT_SESSION_VERSION,
    exportedAt: new Date().toISOString(),
    activeSession: sessions[ACTIVE_SESSION_KEY] ?? null,
    sessions,
    settings,
    debugLogs,
  };
}

export async function exportAllDataAsJson(space = 2): Promise<string> {
  return JSON.stringify(await exportAllData(), null, space);
}

export async function clearAllData(): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(
    [STORE_NAMES.sessions, STORE_NAMES.settings, STORE_NAMES.debugLogs],
    "readwrite",
  );
  await Promise.all([
    transaction.objectStore(STORE_NAMES.sessions).clear(),
    transaction.objectStore(STORE_NAMES.settings).clear(),
    transaction.objectStore(STORE_NAMES.debugLogs).clear(),
  ]);
  await transaction.done;
}

// Naming aliases keep call sites concise without creating a second data path.
export const saveSession = saveActiveSession;
export const removeSession = deleteActiveSession;
export const addDebugLog = appendDebugLog;
export const listDebugLogs = getDebugLogs;
export const getExportData = exportAllData;
