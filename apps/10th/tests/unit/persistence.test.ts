import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { StorySession } from "../../src/narrative/types";
import {
  ACTIVE_SESSION_KEY,
  DATABASE_NAME,
  DATABASE_VERSION,
  STORE_NAMES,
  deletePersistenceDatabase,
  getDatabase,
} from "../../src/persistence/db";
import {
  appendDebugLog,
  deleteActiveSession,
  exportAllData,
  exportAllDataAsJson,
  getAllSettings,
  getDebugLogs,
  getSetting,
  loadActiveSession,
  saveActiveSession,
  setSetting,
} from "../../src/persistence/sessionRepository";

const NOW = "2026-07-10T03:00:00.000Z";

function makeSession(overrides: Partial<StorySession> = {}): StorySession {
  return {
    id: "session-1",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    status: "draft",
    providerKind: "mock",
    modelId: null,
    departureAcknowledged: false,
    readerInput: "長い午後を持て余している",
    themeTransform: null,
    storyBible: null,
    macroPartIndex: 1,
    sceneIndexInMacro: 0,
    totalSceneCount: 0,
    currentLocationId: null,
    depthIndex: 0,
    distanceIndex: 0,
    scenes: [],
    choices: [],
    canonicalFacts: [],
    activeThreads: [],
    motifs: [],
    latestProtagonistChange: null,
    rollingSummary: "",
    ending: null,
    lastError: null,
    ...overrides,
  };
}

describe("IndexedDB persistence", () => {
  beforeEach(async () => {
    await deletePersistenceDatabase();
  });

  afterEach(async () => {
    await deletePersistenceDatabase();
  });

  it("opens version 1 with the required stores", async () => {
    const database = await getDatabase();

    expect(database.name).toBe(DATABASE_NAME);
    expect(database.version).toBe(DATABASE_VERSION);
    expect(Array.from(database.objectStoreNames)).toEqual([
      STORE_NAMES.debugLogs,
      STORE_NAMES.sessions,
      STORE_NAMES.settings,
    ]);
  });

  it("roundtrips the active StorySession", async () => {
    const session = makeSession();

    await saveActiveSession(session);
    const result = await loadActiveSession();

    expect(result).toEqual({
      status: "ready",
      session,
      rawSession: session,
      error: null,
      recoveryAction: "none",
    });
  });

  it("hydrates a legacy version-1 session without changing its version", async () => {
    const legacySession = {
      ...makeSession(),
    } as Record<string, unknown>;
    delete legacySession.latestProtagonistChange;
    const database = await getDatabase();
    await database.put(STORE_NAMES.sessions, legacySession, ACTIVE_SESSION_KEY);

    const result = await loadActiveSession();

    expect(result).toMatchObject({
      status: "ready",
      session: {
        version: 1,
        latestProtagonistChange: null,
      },
    });
  });

  it("returns a recoverable result for an unknown session version", async () => {
    const futureSession = makeSession({ version: 42 });
    await saveActiveSession(futureSession);

    const result = await loadActiveSession();

    expect(result).toMatchObject({
      status: "unsupported-version",
      session: null,
      rawSession: futureSession,
      recoveryAction: "export-or-new",
      foundVersion: 42,
      supportedVersion: 1,
      error: {
        code: "SESSION_CORRUPTED",
        recoverable: true,
      },
    });
  });

  it("returns a recoverable result and keeps corrupt data exportable", async () => {
    const corruptSession = { id: "broken", version: 1, scenes: "not-an-array" };
    const database = await getDatabase();
    await database.put(
      STORE_NAMES.sessions,
      corruptSession,
      ACTIVE_SESSION_KEY,
    );

    const result = await loadActiveSession();
    const exported = await exportAllData();

    expect(result).toMatchObject({
      status: "corrupt",
      session: null,
      rawSession: corruptSession,
      recoveryAction: "export-or-new",
      error: {
        code: "SESSION_CORRUPTED",
        recoverable: true,
      },
    });
    if (result.status === "corrupt") {
      expect(result.validationIssues.length).toBeGreaterThan(0);
    }
    expect(exported.activeSession).toEqual(corruptSession);
  });

  it("stores settings and timestamp-ordered debug logs", async () => {
    await setSetting("selected-model", "model-a");
    await setSetting("reader", { reducedMotion: true });
    await appendDebugLog({
      timestamp: "2026-07-10T03:00:02.000Z",
      level: "warn",
      message: "second",
    });
    await appendDebugLog({
      timestamp: "2026-07-10T03:00:01.000Z",
      message: "first",
      details: { attempt: 1 },
    });

    expect(await getSetting<string>("selected-model")).toBe("model-a");
    expect(await getAllSettings()).toEqual({
      reader: { reducedMotion: true },
      "selected-model": "model-a",
    });
    expect((await getDebugLogs()).map((log) => log.message)).toEqual([
      "first",
      "second",
    ]);
    expect((await getDebugLogs(1)).map((log) => log.message)).toEqual([
      "second",
    ]);
  });

  it("returns plain export data, JSON, and supports active-session deletion", async () => {
    const session = makeSession();
    await saveActiveSession(session);
    await setSetting("provider", "mock");
    await appendDebugLog({ timestamp: NOW, message: "saved" });

    const exported = await exportAllData();
    const json = JSON.parse(await exportAllDataAsJson()) as Record<
      string,
      unknown
    >;

    expect(exported).toMatchObject({
      databaseName: DATABASE_NAME,
      databaseVersion: 1,
      sessionVersion: 1,
      activeSession: session,
      sessions: { active: session },
      settings: { provider: "mock" },
      debugLogs: [{ timestamp: NOW, level: "info", message: "saved" }],
    });
    expect(json.activeSession).toEqual(session);

    await deleteActiveSession();
    await expect(loadActiveSession()).resolves.toEqual({
      status: "empty",
      session: null,
      rawSession: null,
      error: null,
      recoveryAction: "none",
    });
  });

  it("closes and deletes the complete database", async () => {
    await saveActiveSession(makeSession());
    await setSetting("provider", "mock");
    await appendDebugLog({ message: "before delete" });

    await deletePersistenceDatabase();

    await expect(loadActiveSession()).resolves.toMatchObject({
      status: "empty",
      session: null,
    });
    await expect(getAllSettings()).resolves.toEqual({});
    await expect(getDebugLogs()).resolves.toEqual([]);
  });
});
