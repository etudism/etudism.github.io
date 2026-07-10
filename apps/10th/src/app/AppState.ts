import type { WebGpuCompatibility } from "./compatibility";
import type {
  ProviderProgress,
  SerializableError,
  StorySession,
} from "../narrative/types";

export type AppScreen =
  | "boot"
  | "input"
  | "model_selection"
  | "model_loading"
  | "seed_generating"
  | "departure"
  | "reading"
  | "ending_generating"
  | "ending"
  | "error";

export interface AppState {
  screen: AppScreen;
  previousScreen: AppScreen;
  session: StorySession | null;
  compatibility: WebGpuCompatibility | null;
  checkingCompatibility: boolean;
  busy: boolean;
  progress: ProviderProgress | null;
  error: SerializableError | null;
  storageWarning: string | null;
}

export const initialAppState: AppState = {
  screen: "boot",
  previousScreen: "input",
  session: null,
  compatibility: null,
  checkingCompatibility: true,
  busy: false,
  progress: null,
  error: null,
  storageWarning: null,
};
