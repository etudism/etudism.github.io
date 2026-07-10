import type { SCENE_FUNCTION_BY_INDEX } from "./constants";

export type ReaderChoice = "stay" | "move";
export type ClosureChoice = "continue" | "end";
export type SceneLeadChoice = ReaderChoice | "start" | "continue";
export type ProviderKind = "webllm" | "mock";
export type GenerationMode = "fast" | "quality" | "debug" | "demo";

export type SceneFunction =
  (typeof SCENE_FUNCTION_BY_INDEX)[keyof typeof SCENE_FUNCTION_BY_INDEX];

export type StorySessionStatus =
  | "draft"
  | "loading_model"
  | "generating_seed"
  | "reading"
  | "awaiting_branch"
  | "awaiting_closure"
  | "generating_ending"
  | "ended"
  | "error";

export type AppErrorCode =
  | "WEBGPU_UNAVAILABLE"
  | "MODEL_NOT_FOUND"
  | "MODEL_DOWNLOAD_FAILED"
  | "MODEL_INIT_FAILED"
  | "GENERATION_INTERRUPTED"
  | "GENERATION_FAILED"
  | "INVALID_MODEL_JSON"
  | "STORAGE_FAILED"
  | "SESSION_CORRUPTED"
  | "UNKNOWN";

export interface SerializableError {
  code: AppErrorCode;
  userMessage: string;
  technicalMessage?: string;
  recoverable: boolean;
  occurredAt: string;
}

export interface ThemeTransform {
  emotionalPattern: string;
  narrativeTension: string;
  allegoricalWorld: string;
  centralSymbol: string;
  protagonistDistance: "first_person" | "third_person";
  literalTermsToAvoid: string[];
}

export interface StoryBible {
  protagonist: {
    name: string;
    description: string;
    desire: string;
    limitation: string;
  };
  companion: {
    name: string;
    description: string;
    speakingStyle: string;
  };
  worldRule: string;
  startingLocation: string;
  portableMotif: string;
  toneGuide: string[];
  prohibitedPatterns: string[];
}

export interface StatePatch {
  newFacts: string[];
  resolvedThreads: string[];
  openedThreads: string[];
  motifsUsed: string[];
  currentLocation: string;
  protagonistChange: string;
}

export interface ScenePlan {
  id: string;
  macroPartIndex: number;
  sceneIndexInMacro: number;
  sceneFunction: SceneFunction;
  choice: SceneLeadChoice;
  location: string;
  characters: string[];
  event: string;
  motif: string;
  protagonistChange: string;
  openedThread?: string;
  resolvedThread?: string;
  tone: string;
}

export interface ScenePayload {
  text: string;
  summary: string;
  choiceReflection: string;
  statePatch: StatePatch;
}

export interface SeedResult {
  themeTransform: ThemeTransform;
  storyBible: StoryBible;
  firstScene: ScenePayload;
}

export type SceneResult = ScenePayload;

export interface EndingResult {
  epilogue: string;
  title: string;
  closingMotifs: string[];
}

export interface SceneRecord extends ScenePayload {
  id: string;
  macroPartIndex: number;
  sceneIndexInMacro: number;
  choiceThatLedHere: SceneLeadChoice;
  plan?: ScenePlan;
  createdAt: string;
}

export interface ChoiceRecord {
  id: string;
  macroPartIndex: number;
  sceneIndexInMacro: number;
  choice: ReaderChoice | ClosureChoice;
  createdAt: string;
}

export interface CanonicalFact {
  id: string;
  text: string;
  createdAt: string;
}

export interface StoryThread {
  id: string;
  description: string;
  openedAtMacroPart: number;
  updatedAt: string;
}

export interface MotifState {
  id: string;
  name: string;
  useCount: number;
  lastUsedAt: string;
}

export interface StorySession {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: StorySessionStatus;
  providerKind: ProviderKind;
  modelId: string | null;

  readerInput: string;
  themeTransform: ThemeTransform | null;
  storyBible: StoryBible | null;
  departureAcknowledged: boolean;

  macroPartIndex: number;
  sceneIndexInMacro: number;
  totalSceneCount: number;

  currentLocationId: string | null;
  depthIndex: number;
  distanceIndex: number;

  scenes: SceneRecord[];
  choices: ChoiceRecord[];

  canonicalFacts: CanonicalFact[];
  activeThreads: StoryThread[];
  motifs: MotifState[];
  latestProtagonistChange: string | null;
  rollingSummary: string;

  ending: EndingResult | null;
  lastError: SerializableError | null;
}

export interface ProviderProgress {
  phase: "loading" | "ready" | "generating" | "interrupted";
  progress: number;
  text: string;
  modelId?: string;
}

export interface ProviderInitOptions {
  modelId: string;
  onProgress?: (progress: ProviderProgress) => void;
  signal?: AbortSignal;
}

export interface SeedRequest {
  readerInput: string;
}

/**
 * Deliberately excludes readerInput and full scene bodies. This is the only
 * context shape accepted by scene prompts and providers.
 */
export interface NarrativeContext {
  themeTransform: ThemeTransform;
  storyBible: StoryBible;
  macroPartIndex: number;
  sceneIndexInMacro: number;
  sceneFunction: SceneFunction;
  currentLocationId: string | null;
  depthIndex: number;
  distanceIndex: number;
  rollingSummary: string;
  canonicalFacts: CanonicalFact[];
  activeThreads: StoryThread[];
  motifs: MotifState[];
  latestProtagonistChange: string | null;
  recentSceneSummaries: string[];
  previousSceneTail: string;
  choice: ReaderChoice | "continue";
}

export interface SceneRequest {
  context: NarrativeContext;
}

export interface CompactStoryBible {
  protagonist: string;
  companion: string;
  worldRule: string;
  portableMotif: string;
  tone: string[];
}

export interface FastSceneContext {
  storyBible: CompactStoryBible;
  plan: ScenePlan;
  rollingSummary: string;
  facts: string[];
  threads: string[];
  motifs: string[];
  previousSummary: string;
  previousTextTail: string;
}

export interface FastSceneRequest {
  context: FastSceneContext;
  plan: ScenePlan;
  mode: GenerationMode;
}

export interface FastSceneResult {
  text: string;
}

export interface ProviderGenerationStats {
  promptTokens: number | null;
  completionTokens: number | null;
  timeToFirstTokenMs: number | null;
  completionMs: number | null;
  tokensPerSecond: number | null;
}

export interface SceneStreamingOptions {
  onChunk?: (chunk: string) => void;
  onMetrics?: (stats: ProviderGenerationStats) => void;
}

/** Bounded ending context; it also intentionally has no readerInput field. */
export interface EndingContext {
  themeTransform: ThemeTransform;
  storyBible: StoryBible;
  macroPartIndex: number;
  totalSceneCount: number;
  currentLocationId: string | null;
  rollingSummary: string;
  canonicalFacts: CanonicalFact[];
  activeThreads: StoryThread[];
  motifs: MotifState[];
  latestProtagonistChange: string | null;
  recentSceneSummaries: string[];
  previousSceneTail: string;
}

export interface EndingRequest {
  context: EndingContext;
}

export interface NarrativePromptMessage {
  role: "system" | "user";
  content: string;
}

export interface JsonRepairRequest {
  kind: "seed" | "scene" | "ending";
  rawOutput: string;
  validationError: string;
  jsonSchema: Record<string, unknown>;
}

export type JsonRepairFunction = (
  request: JsonRepairRequest,
) => Promise<string>;

export type ParseDiagnosticStage =
  | "initial_parse_failed"
  | "repair_succeeded"
  | "repair_failed"
  | "fallback_used";

export interface ParseDiagnostic {
  kind: JsonRepairRequest["kind"];
  stage: ParseDiagnosticStage;
  message: string;
}
