import {
  MAX_ACTIVE_THREADS,
  MAX_CANONICAL_FACTS,
  MAX_CROSS_MACRO_THREADS,
  MAX_MOTIFS,
  MAX_PROTAGONIST_CHANGE_LENGTH,
  MAX_READER_INPUT_LENGTH,
  MAX_ROLLING_SUMMARY_LENGTH,
  MIN_READER_INPUT_LENGTH,
  SCENES_PER_MACRO_PART,
  STORY_SESSION_VERSION,
} from "./constants";
import {
  sanitizeEndingResult,
  sanitizeSceneResult,
  sanitizeSeedResult,
} from "./outputSanitizer";
import {
  endingResultSchema,
  sceneResultSchema,
  seedResultSchema,
} from "./schemas";
import { sanitizePlainSceneText, sceneResultFromPlan } from "./scenePlanner";
import type {
  CanonicalFact,
  ChoiceRecord,
  ClosureChoice,
  EndingResult,
  GenerationMode,
  MotifState,
  ProviderKind,
  ReaderChoice,
  SceneLeadChoice,
  ScenePlan,
  SceneRecord,
  SceneResult,
  SeedResult,
  SerializableError,
  StatePatch,
  StorySession,
  StorySessionStatus,
  StoryThread,
} from "./types";

export type StoryDecision = "branch" | "closure" | "none";

export interface CreateStorySessionOptions {
  id: string;
  readerInput: string;
  providerKind?: ProviderKind;
  modelId?: string | null;
  now?: string;
}

export class StoryTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoryTransitionError";
  }
}

function currentTimestamp(now?: string): string {
  return now ?? new Date().toISOString();
}

function requireStatus(
  session: StorySession,
  allowed: readonly StorySessionStatus[],
  action: string,
): void {
  if (!allowed.includes(session.status)) {
    throw new StoryTransitionError(
      `${action} cannot run while the session is ${session.status}.`,
    );
  }
}

export function normalizeReaderInput(readerInput: string): string {
  return readerInput.trim();
}

export function validateReaderInput(readerInput: string): string {
  const normalized = normalizeReaderInput(readerInput);
  if (normalized.length < MIN_READER_INPUT_LENGTH) {
    throw new StoryTransitionError(
      `Reader input must contain at least ${MIN_READER_INPUT_LENGTH} characters.`,
    );
  }
  if (normalized.length > MAX_READER_INPUT_LENGTH) {
    throw new StoryTransitionError(
      `Reader input must contain at most ${MAX_READER_INPUT_LENGTH} characters.`,
    );
  }
  return normalized;
}

export function createStorySession(
  options: CreateStorySessionOptions,
): StorySession {
  const now = currentTimestamp(options.now);
  const readerInput = validateReaderInput(options.readerInput);

  return {
    id: options.id,
    version: STORY_SESSION_VERSION,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    providerKind: options.providerKind ?? "mock",
    modelId: options.modelId ?? null,
    readerInput,
    themeTransform: null,
    storyBible: null,
    departureAcknowledged: false,
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
  };
}

export const createInitialStorySession = createStorySession;

export function selectProvider(
  session: StorySession,
  providerKind: ProviderKind,
  modelId: string | null,
  now?: string,
): StorySession {
  requireStatus(session, ["draft", "error"], "selectProvider");
  return {
    ...session,
    providerKind,
    modelId,
    status: "loading_model",
    lastError: null,
    updatedAt: currentTimestamp(now),
  };
}

export const selectModel = selectProvider;

export function beginSeedGeneration(
  session: StorySession,
  now?: string,
): StorySession {
  requireStatus(
    session,
    ["draft", "loading_model", "error"],
    "beginSeedGeneration",
  );
  return {
    ...session,
    status: "generating_seed",
    lastError: null,
    updatedAt: currentTimestamp(now),
  };
}

function recordId(
  session: StorySession,
  kind: "scene" | "choice" | "fact" | "thread" | "motif",
  ordinal: number,
): string {
  return `${session.id}:${kind}:${ordinal}`;
}

function distinctNonEmpty(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

export function updateRollingSummary(
  currentSummary: string,
  nextSceneSummary: string,
): string {
  const combined = [currentSummary.trim(), nextSceneSummary.trim()]
    .filter((value) => value.length > 0)
    .join("\n");
  return combined.slice(-MAX_ROLLING_SUMMARY_LENGTH);
}

function applyFacts(
  session: StorySession,
  patch: StatePatch,
  now: string,
): CanonicalFact[] {
  const existingByText = new Set(
    session.canonicalFacts.map((fact) => fact.text),
  );
  const additions = distinctNonEmpty(patch.newFacts)
    .filter((text) => !existingByText.has(text))
    .map((text, index): CanonicalFact => ({
      id: recordId(session, "fact", session.canonicalFacts.length + index + 1),
      text,
      createdAt: now,
    }));
  return [...session.canonicalFacts, ...additions].slice(-MAX_CANONICAL_FACTS);
}

function applyThreads(
  session: StorySession,
  patch: StatePatch,
  now: string,
): StoryThread[] {
  const resolved = new Set(distinctNonEmpty(patch.resolvedThreads));
  const remaining = session.activeThreads.filter(
    (thread) => !resolved.has(thread.description),
  );
  const existing = new Set(remaining.map((thread) => thread.description));
  const additions = distinctNonEmpty(patch.openedThreads)
    .filter((description) => !existing.has(description))
    .map((description, index): StoryThread => ({
      id: recordId(session, "thread", session.totalSceneCount * 2 + index + 1),
      description,
      openedAtMacroPart: session.macroPartIndex,
      updatedAt: now,
    }));
  return [...remaining, ...additions].slice(-MAX_ACTIVE_THREADS);
}

function applyMotifs(
  session: StorySession,
  patch: StatePatch,
  now: string,
): MotifState[] {
  const motifs = session.motifs.map((motif) => ({ ...motif }));
  for (const name of distinctNonEmpty(patch.motifsUsed)) {
    const existing = motifs.find((motif) => motif.name === name);
    if (existing) {
      existing.useCount += 1;
      existing.lastUsedAt = now;
    } else {
      motifs.push({
        id: recordId(session, "motif", motifs.length + 1),
        name,
        useCount: 1,
        lastUsedAt: now,
      });
    }
  }
  return motifs.slice(-MAX_MOTIFS);
}

function applyStatePatch(
  session: StorySession,
  result: SceneResult,
  now: string,
): Pick<
  StorySession,
  | "canonicalFacts"
  | "activeThreads"
  | "motifs"
  | "currentLocationId"
  | "latestProtagonistChange"
  | "rollingSummary"
> {
  return {
    canonicalFacts: applyFacts(session, result.statePatch, now),
    activeThreads: applyThreads(session, result.statePatch, now),
    motifs: applyMotifs(session, result.statePatch, now),
    currentLocationId: result.statePatch.currentLocation,
    latestProtagonistChange: result.statePatch.protagonistChange,
    rollingSummary: updateRollingSummary(
      session.rollingSummary,
      result.summary,
    ),
  };
}

interface RankedMotif {
  motif: MotifState;
  storedIndex: number;
  macroUseCount: number;
  firstMacroUseIndex: number;
}

/**
 * Selects exactly one available motif for the next macro. The stable ranking is
 * current-macro use count, first appearance in that macro, then stored order.
 */
function selectPrimaryMotifForContinuation(
  session: StorySession,
): MotifState[] {
  if (session.motifs.length === 0) {
    return [];
  }

  const macroUses = new Map<string, { count: number; firstUseIndex: number }>();
  let useIndex = 0;
  for (const scene of session.scenes) {
    if (scene.macroPartIndex !== session.macroPartIndex) {
      continue;
    }
    for (const name of distinctNonEmpty(scene.statePatch.motifsUsed)) {
      const current = macroUses.get(name);
      if (current) {
        current.count += 1;
      } else {
        macroUses.set(name, { count: 1, firstUseIndex: useIndex });
      }
      useIndex += 1;
    }
  }

  const ranked = session.motifs.map((motif, storedIndex): RankedMotif => {
    const macroUse = macroUses.get(motif.name);
    return {
      motif,
      storedIndex,
      macroUseCount: macroUse?.count ?? 0,
      firstMacroUseIndex: macroUse?.firstUseIndex ?? Number.POSITIVE_INFINITY,
    };
  });
  const selected = ranked.reduce((best, candidate) => {
    if (candidate.macroUseCount !== best.macroUseCount) {
      return candidate.macroUseCount > best.macroUseCount ? candidate : best;
    }
    if (candidate.firstMacroUseIndex !== best.firstMacroUseIndex) {
      return candidate.firstMacroUseIndex < best.firstMacroUseIndex
        ? candidate
        : best;
    }
    return candidate.storedIndex < best.storedIndex ? candidate : best;
  });

  return [{ ...selected.motif }];
}

function compactContinuityValue(
  value: string,
  readerInput: string,
  limit: number,
): string {
  const redacted = readerInput.trim().length
    ? value.replaceAll(readerInput.trim(), "既知の象徴")
    : value;
  return redacted.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function compressMacroContinuitySummary(
  session: StorySession,
  retainedMotifs: readonly MotifState[],
  retainedThreads: readonly StoryThread[],
): string {
  const compact = (value: string, limit: number): string =>
    compactContinuityValue(value, session.readerInput, limit);
  const facts = session.canonicalFacts
    .slice(-3)
    .map((fact) => compact(fact.text, 140))
    .filter((fact) => fact.length > 0);
  const location = session.currentLocationId
    ? compact(session.currentLocationId, 140)
    : "なし";
  const motif = retainedMotifs[0]?.name
    ? compact(retainedMotifs[0].name, 140)
    : "なし";
  const protagonistChange = session.latestProtagonistChange
    ? compact(
        session.latestProtagonistChange,
        MAX_PROTAGONIST_CHANGE_LENGTH,
      ).slice(0, 240)
    : "なし";
  const thread = retainedThreads[0]?.description
    ? compact(retainedThreads[0].description, 140)
    : "なし";

  return [
    "前大パートの継続要約。",
    `確定事実: ${facts.length > 0 ? facts.join(" / ") : "なし"}。`,
    `主要モチーフ: ${motif}。`,
    `主人公の変化: ${protagonistChange}。`,
    `未解決の糸: ${thread}。`,
    `場所: ${location}。`,
  ]
    .join("\n")
    .slice(0, MAX_ROLLING_SUMMARY_LENGTH);
}

function makeSceneRecord(
  session: StorySession,
  result: SceneResult,
  choice: SceneLeadChoice,
  sceneIndexInMacro: number,
  now: string,
): SceneRecord {
  return {
    id: recordId(session, "scene", session.totalSceneCount + 1),
    macroPartIndex: session.macroPartIndex,
    sceneIndexInMacro,
    choiceThatLedHere: choice,
    ...result,
    createdAt: now,
  };
}

export function applySeedResult(
  session: StorySession,
  untrustedResult: SeedResult,
  now?: string,
): StorySession {
  requireStatus(
    session,
    ["generating_seed", "draft", "loading_model"],
    "applySeedResult",
  );
  const result = seedResultSchema.parse(
    sanitizeSeedResult(seedResultSchema.parse(untrustedResult)),
  );
  const timestamp = currentTimestamp(now);
  const firstScene = makeSceneRecord(
    session,
    result.firstScene,
    "start",
    1,
    timestamp,
  );
  const patched = applyStatePatch(session, result.firstScene, timestamp);

  return {
    ...session,
    ...patched,
    status: "reading",
    themeTransform: result.themeTransform,
    storyBible: result.storyBible,
    departureAcknowledged: false,
    macroPartIndex: 1,
    sceneIndexInMacro: 1,
    totalSceneCount: 1,
    scenes: [firstScene],
    choices: [],
    ending: null,
    lastError: null,
    updatedAt: timestamp,
  };
}

export function applyProvisionalOpening(
  session: StorySession,
  seed: SeedResult,
  plan: ScenePlan,
  now?: string,
): StorySession {
  if (plan.choice !== "start" || plan.sceneIndexInMacro !== 1) {
    throw new StoryTransitionError("The provisional opening plan is invalid.");
  }
  const opened = applySeedResult(session, seed, now);
  const firstScene = opened.scenes[0];
  if (!firstScene) {
    throw new StoryTransitionError("The provisional opening has no scene.");
  }
  return {
    ...opened,
    scenes: [{ ...firstScene, plan }],
  };
}

export function acknowledgeDeparture(
  session: StorySession,
  now?: string,
): StorySession {
  requireStatus(session, ["reading"], "acknowledgeDeparture");
  if (
    !session.themeTransform ||
    !session.storyBible ||
    session.scenes.length === 0
  ) {
    throw new StoryTransitionError(
      "The departure cannot be acknowledged before a seed exists.",
    );
  }
  return {
    ...session,
    departureAcknowledged: true,
    status: "awaiting_branch",
    updatedAt: currentTimestamp(now),
  };
}

function makeChoiceRecord(
  session: StorySession,
  choice: ReaderChoice | ClosureChoice,
  now: string,
): ChoiceRecord {
  return {
    id: recordId(session, "choice", session.choices.length + 1),
    macroPartIndex: session.macroPartIndex,
    sceneIndexInMacro: session.sceneIndexInMacro,
    choice,
    createdAt: now,
  };
}

export function chooseBranch(
  session: StorySession,
  choice: ReaderChoice,
  now?: string,
): StorySession {
  requireStatus(session, ["awaiting_branch"], "chooseBranch");
  if (
    session.sceneIndexInMacro < 1 ||
    session.sceneIndexInMacro >= SCENES_PER_MACRO_PART
  ) {
    throw new StoryTransitionError(
      "A branch choice is only valid after scenes one through four.",
    );
  }

  const timestamp = currentTimestamp(now);
  return {
    ...session,
    status: "reading",
    depthIndex: choice === "stay" ? session.depthIndex + 1 : 0,
    distanceIndex:
      choice === "move" ? session.distanceIndex + 1 : session.distanceIndex,
    choices: [...session.choices, makeChoiceRecord(session, choice, timestamp)],
    lastError: null,
    updatedAt: timestamp,
  };
}

function expectedPendingChoice(
  session: StorySession,
): ReaderChoice | "continue" | null {
  const latestChoice = session.choices.at(-1)?.choice;
  if (
    latestChoice === "stay" ||
    latestChoice === "move" ||
    latestChoice === "continue"
  ) {
    return latestChoice;
  }
  return null;
}

export function applySceneResult(
  session: StorySession,
  untrustedResult: SceneResult,
  choice?: ReaderChoice | "continue",
  now?: string,
): StorySession {
  requireStatus(session, ["reading"], "applySceneResult");
  if (!session.departureAcknowledged) {
    throw new StoryTransitionError(
      "A generated scene cannot be appended before departure is acknowledged.",
    );
  }

  const pendingChoice = expectedPendingChoice(session);
  const leadingChoice = choice ?? pendingChoice;
  if (!leadingChoice || pendingChoice !== leadingChoice) {
    throw new StoryTransitionError(
      "The generated scene does not match the pending reader choice.",
    );
  }

  const nextSceneIndex = session.sceneIndexInMacro + 1;
  if (nextSceneIndex < 1 || nextSceneIndex > SCENES_PER_MACRO_PART) {
    throw new StoryTransitionError(
      "The current macro part is already complete.",
    );
  }

  const result = sceneResultSchema.parse(
    sanitizeSceneResult(sceneResultSchema.parse(untrustedResult)),
  );
  const timestamp = currentTimestamp(now);
  const scene = makeSceneRecord(
    session,
    result,
    leadingChoice,
    nextSceneIndex,
    timestamp,
  );
  const patched = applyStatePatch(session, result, timestamp);

  return {
    ...session,
    ...patched,
    status:
      nextSceneIndex === SCENES_PER_MACRO_PART
        ? "awaiting_closure"
        : "awaiting_branch",
    sceneIndexInMacro: nextSceneIndex,
    totalSceneCount: session.totalSceneCount + 1,
    scenes: [...session.scenes, scene],
    lastError: null,
    updatedAt: timestamp,
  };
}

export function advanceWithScene(
  session: StorySession,
  choice: ReaderChoice,
  result: SceneResult,
  now?: string,
): StorySession {
  const selected = chooseBranch(session, choice, now);
  return applySceneResult(selected, result, choice, now);
}

function validatePendingPlan(
  session: StorySession,
  plan: ScenePlan,
  choice: ReaderChoice | "continue",
): void {
  const expectedMacro =
    choice === "continue" ? session.macroPartIndex + 1 : session.macroPartIndex;
  const expectedScene =
    choice === "continue" ? 1 : session.sceneIndexInMacro + 1;
  if (
    plan.choice !== choice ||
    plan.macroPartIndex !== expectedMacro ||
    plan.sceneIndexInMacro !== expectedScene
  ) {
    throw new StoryTransitionError(
      "The completed text does not match the pending ScenePlan.",
    );
  }
}

/**
 * Atomically applies a completed plain-text scene. Until this function runs,
 * neither the choice nor the plan affects canonical or persisted story state.
 */
export function commitPlannedScene(
  session: StorySession,
  plan: ScenePlan,
  completedText: string,
  mode: GenerationMode,
  now?: string,
): StorySession {
  if (plan.choice === "start") {
    throw new StoryTransitionError(
      "Opening plans use applyProvisionalOpening.",
    );
  }
  const choice = plan.choice;
  validatePendingPlan(session, plan, choice);
  const selected =
    choice === "continue"
      ? chooseClosure(session, "continue", now)
      : chooseBranch(session, choice, now);
  const safeText = sanitizePlainSceneText(completedText, plan, mode);
  const applied = applySceneResult(
    selected,
    sceneResultFromPlan(plan, safeText),
    choice,
    now,
  );
  const finalScene = applied.scenes.at(-1);
  if (!finalScene) {
    throw new StoryTransitionError("The planned scene was not appended.");
  }
  return {
    ...applied,
    scenes: [...applied.scenes.slice(0, -1), { ...finalScene, plan }],
  };
}

export function chooseClosure(
  session: StorySession,
  choice: ClosureChoice,
  now?: string,
): StorySession {
  requireStatus(session, ["awaiting_closure"], "chooseClosure");
  if (session.sceneIndexInMacro !== SCENES_PER_MACRO_PART) {
    throw new StoryTransitionError(
      "A closure choice is only valid after the fifth scene.",
    );
  }

  const timestamp = currentTimestamp(now);
  const choices = [
    ...session.choices,
    makeChoiceRecord(session, choice, timestamp),
  ];
  if (choice === "end") {
    return {
      ...session,
      status: "generating_ending",
      choices,
      lastError: null,
      updatedAt: timestamp,
    };
  }

  const activeThreads = session.activeThreads.slice(-MAX_CROSS_MACRO_THREADS);
  const motifs = selectPrimaryMotifForContinuation(session);

  return {
    ...session,
    status: "reading",
    macroPartIndex: session.macroPartIndex + 1,
    sceneIndexInMacro: 0,
    depthIndex: 0,
    distanceIndex: session.distanceIndex + 1,
    activeThreads,
    motifs,
    rollingSummary: compressMacroContinuitySummary(
      session,
      motifs,
      activeThreads,
    ),
    choices,
    lastError: null,
    updatedAt: timestamp,
  };
}

export const selectClosureChoice = chooseClosure;

export function applyEndingResult(
  session: StorySession,
  untrustedResult: EndingResult,
  now?: string,
): StorySession {
  requireStatus(session, ["generating_ending"], "applyEndingResult");
  const ending = endingResultSchema.parse(
    sanitizeEndingResult(endingResultSchema.parse(untrustedResult)),
  );
  return {
    ...session,
    status: "ended",
    ending,
    lastError: null,
    updatedAt: currentTimestamp(now),
  };
}

export function getStoryDecision(session: StorySession): StoryDecision {
  if (session.status === "awaiting_branch") {
    return "branch";
  }
  if (session.status === "awaiting_closure") {
    return "closure";
  }
  return "none";
}

export function markStoryError(
  session: StorySession,
  error: SerializableError,
): StorySession {
  return {
    ...session,
    status: "error",
    lastError: error,
    updatedAt: error.occurredAt,
  };
}

export function recoverStorySession(
  session: StorySession,
  now?: string,
): StorySession {
  requireStatus(session, ["error"], "recoverStorySession");

  let status: StorySessionStatus;
  if (!session.themeTransform || !session.storyBible) {
    status = session.modelId === null ? "draft" : "generating_seed";
  } else if (session.ending) {
    status = "ended";
  } else if (session.choices.at(-1)?.choice === "end") {
    status = "generating_ending";
  } else if (!session.departureAcknowledged) {
    status = "reading";
  } else if (session.sceneIndexInMacro === SCENES_PER_MACRO_PART) {
    status = "awaiting_closure";
  } else if (
    session.choices.at(-1)?.sceneIndexInMacro === session.sceneIndexInMacro
  ) {
    status = "reading";
  } else {
    status = "awaiting_branch";
  }

  return {
    ...session,
    status,
    lastError: null,
    updatedAt: currentTimestamp(now),
  };
}
