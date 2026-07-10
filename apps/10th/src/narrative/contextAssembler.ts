import {
  MAX_ACTIVE_THREADS,
  MAX_CANONICAL_FACTS,
  MAX_MOTIFS,
  MAX_PREVIOUS_SCENE_TAIL_LENGTH,
  MAX_PROTAGONIST_CHANGE_LENGTH,
  MAX_RECENT_SCENE_SUMMARIES,
  MAX_ROLLING_SUMMARY_LENGTH,
  SCENE_FUNCTION_BY_INDEX,
  SCENES_PER_MACRO_PART,
} from "./constants";
import type {
  CanonicalFact,
  EndingContext,
  EndingRequest,
  MotifState,
  NarrativeContext,
  ReaderChoice,
  SceneFunction,
  SceneRequest,
  StoryBible,
  StorySession,
  StoryThread,
  ThemeTransform,
} from "./types";

export class NarrativeContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NarrativeContextError";
  }
}

function boundedTail(value: string, limit: number): string {
  return value.slice(-limit);
}

function redactReaderInput(value: string, readerInput: string): string {
  const literal = readerInput.trim();
  if (literal.length === 0) {
    return value;
  }
  return value.replaceAll(literal, "既知の象徴");
}

function redactThemeTransform(
  theme: ThemeTransform,
  readerInput: string,
): ThemeTransform {
  return {
    emotionalPattern: redactReaderInput(theme.emotionalPattern, readerInput),
    narrativeTension: redactReaderInput(theme.narrativeTension, readerInput),
    allegoricalWorld: redactReaderInput(theme.allegoricalWorld, readerInput),
    centralSymbol: redactReaderInput(theme.centralSymbol, readerInput),
    protagonistDistance: theme.protagonistDistance,
    literalTermsToAvoid: theme.literalTermsToAvoid.map((term) =>
      redactReaderInput(term, readerInput),
    ),
  };
}

function redactStoryBible(
  storyBible: StoryBible,
  readerInput: string,
): StoryBible {
  const redact = (value: string): string =>
    redactReaderInput(value, readerInput);
  return {
    protagonist: {
      name: redact(storyBible.protagonist.name),
      description: redact(storyBible.protagonist.description),
      desire: redact(storyBible.protagonist.desire),
      limitation: redact(storyBible.protagonist.limitation),
    },
    companion: {
      name: redact(storyBible.companion.name),
      description: redact(storyBible.companion.description),
      speakingStyle: redact(storyBible.companion.speakingStyle),
    },
    worldRule: redact(storyBible.worldRule),
    startingLocation: redact(storyBible.startingLocation),
    portableMotif: redact(storyBible.portableMotif),
    toneGuide: storyBible.toneGuide.map(redact),
    prohibitedPatterns: storyBible.prohibitedPatterns.map(redact),
  };
}

function redactFacts(
  facts: readonly CanonicalFact[],
  readerInput: string,
): CanonicalFact[] {
  return facts.map((fact) => ({
    ...fact,
    text: redactReaderInput(fact.text, readerInput),
  }));
}

function redactThreads(
  threads: readonly StoryThread[],
  readerInput: string,
): StoryThread[] {
  return threads.map((thread) => ({
    ...thread,
    description: redactReaderInput(thread.description, readerInput),
  }));
}

function redactMotifs(
  motifs: readonly MotifState[],
  readerInput: string,
): MotifState[] {
  return motifs.map((motif) => ({
    ...motif,
    name: redactReaderInput(motif.name, readerInput),
  }));
}

export function getSceneFunction(sceneIndexInMacro: number): SceneFunction {
  if (
    !Number.isInteger(sceneIndexInMacro) ||
    sceneIndexInMacro < 1 ||
    sceneIndexInMacro > SCENES_PER_MACRO_PART
  ) {
    throw new NarrativeContextError(
      `Scene index must be between 1 and ${SCENES_PER_MACRO_PART}.`,
    );
  }
  return SCENE_FUNCTION_BY_INDEX[
    sceneIndexInMacro as keyof typeof SCENE_FUNCTION_BY_INDEX
  ];
}

function assertNarrativeState(
  session: StorySession,
): asserts session is StorySession & {
  themeTransform: NonNullable<StorySession["themeTransform"]>;
  storyBible: NonNullable<StorySession["storyBible"]>;
} {
  if (!session.themeTransform || !session.storyBible) {
    throw new NarrativeContextError(
      "ThemeTransform and StoryBible are required to assemble context.",
    );
  }
}

function recentSceneSummaries(session: StorySession): string[] {
  return session.scenes
    .slice(-MAX_RECENT_SCENE_SUMMARIES)
    .map((scene) => redactReaderInput(scene.summary, session.readerInput));
}

function previousSceneTail(session: StorySession): string {
  const previousText = session.scenes.at(-1)?.text ?? "";
  return boundedTail(
    redactReaderInput(previousText, session.readerInput),
    MAX_PREVIOUS_SCENE_TAIL_LENGTH,
  );
}

function latestProtagonistChange(session: StorySession): string | null {
  if (session.latestProtagonistChange === null) {
    return null;
  }
  return boundedTail(
    redactReaderInput(session.latestProtagonistChange, session.readerInput),
    MAX_PROTAGONIST_CHANGE_LENGTH,
  );
}

function nextSceneIndex(session: StorySession): number {
  const nextIndex = session.sceneIndexInMacro + 1;
  if (nextIndex < 1 || nextIndex > SCENES_PER_MACRO_PART) {
    throw new NarrativeContextError(
      "The macro part must be continued or closed before another scene is generated.",
    );
  }
  return nextIndex;
}

/**
 * Builds the only scene context shape exposed to prompts/providers. The return
 * value cannot contain readerInput or unbounded scene history by construction.
 */
export function assembleSceneContext(
  session: StorySession,
  choice: ReaderChoice | "continue",
): NarrativeContext {
  assertNarrativeState(session);
  const sceneIndexInMacro = nextSceneIndex(session);

  return {
    themeTransform: redactThemeTransform(
      session.themeTransform,
      session.readerInput,
    ),
    storyBible: redactStoryBible(session.storyBible, session.readerInput),
    macroPartIndex: session.macroPartIndex,
    sceneIndexInMacro,
    sceneFunction: getSceneFunction(sceneIndexInMacro),
    currentLocationId:
      session.currentLocationId === null
        ? null
        : redactReaderInput(session.currentLocationId, session.readerInput),
    depthIndex: session.depthIndex,
    distanceIndex: session.distanceIndex,
    rollingSummary: boundedTail(
      redactReaderInput(session.rollingSummary, session.readerInput),
      MAX_ROLLING_SUMMARY_LENGTH,
    ),
    canonicalFacts: redactFacts(
      session.canonicalFacts.slice(-MAX_CANONICAL_FACTS),
      session.readerInput,
    ),
    activeThreads: redactThreads(
      session.activeThreads.slice(-MAX_ACTIVE_THREADS),
      session.readerInput,
    ),
    motifs: redactMotifs(
      session.motifs.slice(-MAX_MOTIFS),
      session.readerInput,
    ),
    latestProtagonistChange: latestProtagonistChange(session),
    recentSceneSummaries: recentSceneSummaries(session),
    previousSceneTail: previousSceneTail(session),
    choice,
  };
}

export function createSceneRequest(
  session: StorySession,
  choice: ReaderChoice | "continue",
): SceneRequest {
  return { context: assembleSceneContext(session, choice) };
}

export function assembleEndingContext(session: StorySession): EndingContext {
  assertNarrativeState(session);
  return {
    themeTransform: redactThemeTransform(
      session.themeTransform,
      session.readerInput,
    ),
    storyBible: redactStoryBible(session.storyBible, session.readerInput),
    macroPartIndex: session.macroPartIndex,
    totalSceneCount: session.totalSceneCount,
    currentLocationId:
      session.currentLocationId === null
        ? null
        : redactReaderInput(session.currentLocationId, session.readerInput),
    rollingSummary: boundedTail(
      redactReaderInput(session.rollingSummary, session.readerInput),
      MAX_ROLLING_SUMMARY_LENGTH,
    ),
    canonicalFacts: redactFacts(
      session.canonicalFacts.slice(-MAX_CANONICAL_FACTS),
      session.readerInput,
    ),
    activeThreads: redactThreads(
      session.activeThreads.slice(-MAX_ACTIVE_THREADS),
      session.readerInput,
    ),
    motifs: redactMotifs(
      session.motifs.slice(-MAX_MOTIFS),
      session.readerInput,
    ),
    latestProtagonistChange: latestProtagonistChange(session),
    recentSceneSummaries: recentSceneSummaries(session),
    previousSceneTail: previousSceneTail(session),
  };
}

export function createEndingRequest(session: StorySession): EndingRequest {
  return { context: assembleEndingContext(session) };
}
