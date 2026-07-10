import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

export const DATABASE_NAME = "complete-reading-story-poc";
export const DATABASE_VERSION = 1;

export const STORE_NAMES = {
  sessions: "sessions",
  settings: "settings",
  debugLogs: "debug_logs",
} as const;

export const ACTIVE_SESSION_KEY = "active";

export type StoredSession = unknown;
export type StoredSetting = unknown;

export type DebugLogLevel = "debug" | "info" | "warn" | "error";

export interface DebugLogRecord {
  id?: number;
  timestamp: string;
  level: DebugLogLevel;
  message: string;
  details?: unknown;
}

interface CompleteReadingDatabase extends DBSchema {
  sessions: {
    key: string;
    value: StoredSession;
  };
  settings: {
    key: string;
    value: StoredSetting;
  };
  debug_logs: {
    key: number;
    value: DebugLogRecord;
    indexes: { "by-timestamp": string };
  };
}

export type PersistenceDatabase = IDBPDatabase<CompleteReadingDatabase>;

let databasePromise: Promise<PersistenceDatabase> | undefined;

function createStores(database: PersistenceDatabase): void {
  if (!database.objectStoreNames.contains(STORE_NAMES.sessions)) {
    database.createObjectStore(STORE_NAMES.sessions);
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.settings)) {
    database.createObjectStore(STORE_NAMES.settings);
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.debugLogs)) {
    const debugLogs = database.createObjectStore(STORE_NAMES.debugLogs, {
      keyPath: "id",
      autoIncrement: true,
    });
    debugLogs.createIndex("by-timestamp", "timestamp");
  }
}

/**
 * Opens the app database. A shared connection prevents every state transition
 * from creating a new IndexedDB connection.
 */
export function getDatabase(): Promise<PersistenceDatabase> {
  if (!databasePromise) {
    databasePromise = openDB<CompleteReadingDatabase>(
      DATABASE_NAME,
      DATABASE_VERSION,
      {
        upgrade(database) {
          createStores(database);
        },
        blocking() {
          // Let a newer tab upgrade or delete the database instead of keeping
          // it blocked by this tab's stale connection.
          void closeDatabase();
        },
        terminated() {
          databasePromise = undefined;
        },
      },
    ).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

export async function closeDatabase(): Promise<void> {
  const pendingDatabase = databasePromise;
  databasePromise = undefined;

  if (!pendingDatabase) {
    return;
  }

  try {
    const database = await pendingDatabase;
    database.close();
  } catch {
    // A failed open has no live connection to close. Callers deleting or
    // reopening the database can continue safely.
  }
}

export async function deletePersistenceDatabase(): Promise<void> {
  await closeDatabase();
  await deleteDB(DATABASE_NAME);
}

// Concise alias for the debug panel and tests.
export const deleteDatabase = deletePersistenceDatabase;
