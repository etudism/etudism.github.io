import type {
  FastSceneContext,
  FastSceneRequest,
  GenerationMode,
  ScenePlan,
  StorySession,
} from "./types";

const MAX_FAST_FACTS = 8;
const MAX_FAST_THREADS = 3;
const MAX_FAST_MOTIFS = 4;
const MAX_FAST_ROLLING_SUMMARY = 800;
const MAX_FAST_PREVIOUS_SUMMARY = 240;
const MAX_FAST_PREVIOUS_TAIL = 400;

function redact(value: string, readerInput: string): string {
  const literal = readerInput.trim();
  return (literal ? value.replaceAll(literal, "既知の象徴") : value).trim();
}

function tail(value: string, maximum: number): string {
  return value.slice(-maximum);
}

export function assembleFastSceneContext(
  session: StorySession,
  plan: ScenePlan,
): FastSceneContext {
  if (!session.storyBible) {
    throw new Error("StoryBible is required for a fast scene context.");
  }
  const previous = session.scenes.at(-1);
  const readerInput = session.readerInput;
  return {
    storyBible: {
      protagonist: `${redact(session.storyBible.protagonist.name, readerInput)}: ${redact(session.storyBible.protagonist.description, readerInput)}`,
      companion: `${redact(session.storyBible.companion.name, readerInput)}: ${redact(session.storyBible.companion.description, readerInput)}`,
      worldRule: redact(session.storyBible.worldRule, readerInput),
      portableMotif: redact(session.storyBible.portableMotif, readerInput),
      tone: session.storyBible.toneGuide
        .slice(0, 3)
        .map((value) => redact(value, readerInput)),
    },
    plan,
    rollingSummary: tail(
      redact(session.rollingSummary, readerInput),
      MAX_FAST_ROLLING_SUMMARY,
    ),
    facts: session.canonicalFacts
      .slice(-MAX_FAST_FACTS)
      .map((fact) => redact(fact.text, readerInput)),
    threads: session.activeThreads
      .slice(-MAX_FAST_THREADS)
      .map((thread) => redact(thread.description, readerInput)),
    motifs: session.motifs
      .slice(-MAX_FAST_MOTIFS)
      .map((motif) => redact(motif.name, readerInput)),
    previousSummary: tail(
      redact(previous?.summary ?? "", readerInput),
      MAX_FAST_PREVIOUS_SUMMARY,
    ),
    previousTextTail: tail(
      redact(previous?.text ?? "", readerInput),
      MAX_FAST_PREVIOUS_TAIL,
    ),
  };
}

export function createFastSceneRequest(
  session: StorySession,
  plan: ScenePlan,
  mode: GenerationMode,
): FastSceneRequest {
  return { context: assembleFastSceneContext(session, plan), plan, mode };
}

export function fastScenePromptCharacters(request: FastSceneRequest): number {
  return JSON.stringify(request.context).length;
}
