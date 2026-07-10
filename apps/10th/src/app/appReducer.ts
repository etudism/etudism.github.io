import type { AppScreen, AppState } from "./AppState";
import type { WebGpuCompatibility } from "./compatibility";
import type {
  ProviderProgress,
  SerializableError,
  StorySession,
} from "../narrative/types";

export type AppAction =
  | {
      type: "BOOT_RESOLVED";
      session: StorySession | null;
      storageWarning?: string;
    }
  | { type: "COMPATIBILITY_CHECKING" }
  | { type: "COMPATIBILITY_RESOLVED"; compatibility: WebGpuCompatibility }
  | { type: "SESSION_UPDATED"; session: StorySession; screen?: AppScreen }
  | { type: "SCREEN_CHANGED"; screen: AppScreen }
  | { type: "BUSY_CHANGED"; busy: boolean; screen?: AppScreen }
  | { type: "PROGRESS_UPDATED"; progress: ProviderProgress }
  | { type: "ERROR_RAISED"; error: SerializableError }
  | { type: "ERROR_CLEARED"; screen?: AppScreen }
  | { type: "SESSION_CLEARED" }
  | { type: "STORAGE_WARNING"; message: string | null };

export function deriveScreenFromSession(
  session: StorySession | null,
): AppScreen {
  if (!session) return "input";
  if (session.status === "ended" && session.ending) return "ending";
  if (session.status === "error" && session.lastError) return "error";
  if (session.providerKind === "webllm" && session.scenes.length > 0) {
    // Reloading a page must never restart a model download automatically.
    return "model_selection";
  }
  if (
    session.status === "draft" ||
    session.status === "loading_model" ||
    session.status === "generating_seed"
  ) {
    return "model_selection";
  }
  if (session.scenes.length > 0 && !session.departureAcknowledged)
    return "departure";
  return "reading";
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "BOOT_RESOLVED":
      return {
        ...state,
        screen: deriveScreenFromSession(action.session),
        session: action.session,
        error: action.session?.lastError ?? null,
        storageWarning: action.storageWarning ?? null,
        busy: false,
      };
    case "COMPATIBILITY_CHECKING":
      return { ...state, checkingCompatibility: true };
    case "COMPATIBILITY_RESOLVED":
      return {
        ...state,
        compatibility: action.compatibility,
        checkingCompatibility: false,
      };
    case "SESSION_UPDATED":
      return {
        ...state,
        session: action.session,
        error: action.session.lastError,
        screen: action.screen ?? state.screen,
      };
    case "SCREEN_CHANGED":
      return {
        ...state,
        previousScreen: state.screen,
        screen: action.screen,
      };
    case "BUSY_CHANGED":
      return {
        ...state,
        busy: action.busy,
        previousScreen: action.screen ? state.screen : state.previousScreen,
        screen: action.screen ?? state.screen,
      };
    case "PROGRESS_UPDATED":
      return { ...state, progress: action.progress };
    case "ERROR_RAISED":
      return {
        ...state,
        previousScreen: state.screen,
        screen: "error",
        busy: false,
        error: action.error,
        session: state.session
          ? { ...state.session, status: "error", lastError: action.error }
          : state.session,
      };
    case "ERROR_CLEARED":
      return {
        ...state,
        screen: action.screen ?? state.previousScreen,
        error: null,
        session: state.session ? { ...state.session, lastError: null } : null,
      };
    case "SESSION_CLEARED":
      return {
        ...state,
        screen: "input",
        previousScreen: "input",
        session: null,
        busy: false,
        progress: null,
        error: null,
      };
    case "STORAGE_WARNING":
      return { ...state, storageWarning: action.message };
  }
}
