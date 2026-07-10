import { z } from "zod";

import {
  MAX_ACTIVE_THREADS,
  MAX_CANONICAL_FACTS,
  MAX_ENDING_TITLE_LENGTH,
  MAX_MOTIFS,
  MAX_MOTIFS_PER_PATCH,
  MAX_NEW_FACTS_PER_PATCH,
  MAX_OPENED_THREADS_PER_PATCH,
  MAX_PROTAGONIST_CHANGE_LENGTH,
  MAX_READER_INPUT_LENGTH,
  MAX_RESOLVED_THREADS_PER_PATCH,
  MAX_ROLLING_SUMMARY_LENGTH,
  MIN_ENDING_TITLE_LENGTH,
  SCENES_PER_MACRO_PART,
  STORY_SESSION_VERSION,
} from "./constants";
import type {
  CanonicalFact,
  ChoiceRecord,
  EndingResult,
  MotifState,
  SceneRecord,
  ScenePlan,
  SceneResult,
  SeedResult,
  SerializableError,
  StatePatch,
  StoryBible,
  StorySession,
  StoryThread,
  ThemeTransform,
} from "./types";

const requiredText = z.string().trim().min(1);
const boundedListItem = requiredText.max(300);
const timestampSchema = z.iso.datetime();

export const readerChoiceSchema = z.enum(["stay", "move"]);
export const closureChoiceSchema = z.enum(["continue", "end"]);
export const sceneLeadChoiceSchema = z.enum([
  "stay",
  "move",
  "start",
  "continue",
]);
export const providerKindSchema = z.enum(["webllm", "mock"]);

export const storySessionStatusSchema = z.enum([
  "draft",
  "loading_model",
  "generating_seed",
  "reading",
  "awaiting_branch",
  "awaiting_closure",
  "generating_ending",
  "ended",
  "error",
]);

export const appErrorCodeSchema = z.enum([
  "WEBGPU_UNAVAILABLE",
  "MODEL_NOT_FOUND",
  "MODEL_DOWNLOAD_FAILED",
  "MODEL_INIT_FAILED",
  "GENERATION_INTERRUPTED",
  "GENERATION_FAILED",
  "INVALID_MODEL_JSON",
  "STORAGE_FAILED",
  "SESSION_CORRUPTED",
  "UNKNOWN",
]);

export const serializableErrorSchema: z.ZodType<SerializableError> =
  z.strictObject({
    code: appErrorCodeSchema,
    userMessage: requiredText.max(500),
    technicalMessage: z.string().max(4_000).optional(),
    recoverable: z.boolean(),
    occurredAt: timestampSchema,
  });

export const themeTransformSchema: z.ZodType<ThemeTransform> = z.strictObject({
  emotionalPattern: requiredText.max(600),
  narrativeTension: requiredText.max(600),
  allegoricalWorld: requiredText.max(800),
  centralSymbol: requiredText.max(300),
  protagonistDistance: z.enum(["first_person", "third_person"]),
  literalTermsToAvoid: z.array(boundedListItem).max(12),
});

const protagonistSchema = z.strictObject({
  name: requiredText.max(100),
  description: requiredText.max(600),
  desire: requiredText.max(400),
  limitation: requiredText.max(400),
});

const companionSchema = z.strictObject({
  name: requiredText.max(100),
  description: requiredText.max(600),
  speakingStyle: requiredText.max(300),
});

export const storyBibleSchema: z.ZodType<StoryBible> = z.strictObject({
  protagonist: protagonistSchema,
  companion: companionSchema,
  worldRule: requiredText.max(800),
  startingLocation: requiredText.max(300),
  portableMotif: requiredText.max(200),
  toneGuide: z.array(boundedListItem).max(8),
  prohibitedPatterns: z.array(boundedListItem).max(12),
});

export const statePatchSchema: z.ZodType<StatePatch> = z.strictObject({
  newFacts: z.array(boundedListItem).max(MAX_NEW_FACTS_PER_PATCH),
  resolvedThreads: z.array(boundedListItem).max(MAX_RESOLVED_THREADS_PER_PATCH),
  openedThreads: z.array(boundedListItem).max(MAX_OPENED_THREADS_PER_PATCH),
  motifsUsed: z.array(boundedListItem).max(MAX_MOTIFS_PER_PATCH),
  currentLocation: requiredText.max(300),
  protagonistChange: requiredText.max(MAX_PROTAGONIST_CHANGE_LENGTH),
});

export const scenePlanSchema: z.ZodType<ScenePlan> = z.strictObject({
  id: requiredText.max(300),
  macroPartIndex: z.number().int().positive(),
  sceneIndexInMacro: z.number().int().min(1).max(SCENES_PER_MACRO_PART),
  sceneFunction: z.enum([
    "arrival",
    "observation",
    "discovery",
    "reinterpretation",
    "local_closure",
  ]),
  choice: sceneLeadChoiceSchema,
  location: requiredText.max(300),
  characters: z.array(requiredText.max(200)).max(3),
  event: requiredText.max(500),
  motif: requiredText.max(200),
  protagonistChange: requiredText.max(MAX_PROTAGONIST_CHANGE_LENGTH),
  openedThread: requiredText.max(300).optional(),
  resolvedThread: requiredText.max(300).optional(),
  tone: requiredText.max(300),
});

const scenePayloadSchema = z.strictObject({
  text: requiredText.max(8_000),
  summary: requiredText.max(MAX_ROLLING_SUMMARY_LENGTH),
  choiceReflection: requiredText.max(600),
  statePatch: statePatchSchema,
});

export const sceneResultSchema: z.ZodType<SceneResult> = scenePayloadSchema;

export const seedResultSchema: z.ZodType<SeedResult> = z.strictObject({
  themeTransform: themeTransformSchema,
  storyBible: storyBibleSchema,
  firstScene: scenePayloadSchema,
});

const forbiddenTitlePunctuation = /[『』「」“”‘’"']/u;

export const endingResultSchema: z.ZodType<EndingResult> = z.strictObject({
  epilogue: requiredText.max(4_000),
  title: requiredText
    .min(MIN_ENDING_TITLE_LENGTH)
    .max(MAX_ENDING_TITLE_LENGTH)
    .refine((title) => !forbiddenTitlePunctuation.test(title), {
      message: "題名に括弧や引用符を含めることはできません。",
    }),
  closingMotifs: z.array(boundedListItem).min(1).max(2),
});

export const canonicalFactSchema: z.ZodType<CanonicalFact> = z.strictObject({
  id: requiredText.max(200),
  text: boundedListItem,
  createdAt: timestampSchema,
});

export const storyThreadSchema: z.ZodType<StoryThread> = z.strictObject({
  id: requiredText.max(200),
  description: boundedListItem,
  openedAtMacroPart: z.number().int().positive(),
  updatedAt: timestampSchema,
});

export const motifStateSchema: z.ZodType<MotifState> = z.strictObject({
  id: requiredText.max(200),
  name: boundedListItem,
  useCount: z.number().int().positive(),
  lastUsedAt: timestampSchema,
});

export const choiceRecordSchema: z.ZodType<ChoiceRecord> = z.strictObject({
  id: requiredText.max(200),
  macroPartIndex: z.number().int().positive(),
  sceneIndexInMacro: z.number().int().min(0).max(SCENES_PER_MACRO_PART),
  choice: z.enum(["stay", "move", "continue", "end"]),
  createdAt: timestampSchema,
});

export const sceneRecordSchema: z.ZodType<SceneRecord> = z.strictObject({
  id: requiredText.max(200),
  macroPartIndex: z.number().int().positive(),
  sceneIndexInMacro: z.number().int().min(1).max(SCENES_PER_MACRO_PART),
  choiceThatLedHere: sceneLeadChoiceSchema,
  plan: scenePlanSchema.optional(),
  text: scenePayloadSchema.shape.text,
  summary: scenePayloadSchema.shape.summary,
  choiceReflection: scenePayloadSchema.shape.choiceReflection,
  statePatch: statePatchSchema,
  createdAt: timestampSchema,
});

const storySessionObjectSchema: z.ZodType<StorySession> = z.strictObject({
  id: requiredText.max(200),
  version: z.literal(STORY_SESSION_VERSION),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  status: storySessionStatusSchema,
  providerKind: providerKindSchema,
  modelId: z.string().trim().min(1).max(300).nullable(),
  readerInput: z.string().trim().max(MAX_READER_INPUT_LENGTH),
  themeTransform: themeTransformSchema.nullable(),
  storyBible: storyBibleSchema.nullable(),
  departureAcknowledged: z.boolean(),
  macroPartIndex: z.number().int().positive(),
  sceneIndexInMacro: z.number().int().min(0).max(SCENES_PER_MACRO_PART),
  totalSceneCount: z.number().int().nonnegative(),
  currentLocationId: z.string().trim().min(1).max(300).nullable(),
  depthIndex: z.number().int().nonnegative(),
  distanceIndex: z.number().int().nonnegative(),
  scenes: z.array(sceneRecordSchema),
  choices: z.array(choiceRecordSchema),
  canonicalFacts: z.array(canonicalFactSchema).max(MAX_CANONICAL_FACTS),
  activeThreads: z.array(storyThreadSchema).max(MAX_ACTIVE_THREADS),
  motifs: z.array(motifStateSchema).max(MAX_MOTIFS),
  latestProtagonistChange: requiredText
    .max(MAX_PROTAGONIST_CHANGE_LENGTH)
    .nullable(),
  rollingSummary: z.string().max(MAX_ROLLING_SUMMARY_LENGTH),
  ending: endingResultSchema.nullable(),
  lastError: serializableErrorSchema.nullable(),
});

function hydrateLegacyLatestProtagonistChange(value: unknown): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.hasOwn(value, "latestProtagonistChange")
  ) {
    return value;
  }

  const session = value as Record<string, unknown>;
  const scenes = Array.isArray(session.scenes) ? session.scenes : [];
  let latestProtagonistChange: string | null = null;

  for (let index = scenes.length - 1; index >= 0; index -= 1) {
    const scene = scenes[index];
    if (typeof scene !== "object" || scene === null || Array.isArray(scene)) {
      continue;
    }
    const statePatch = (scene as Record<string, unknown>).statePatch;
    if (
      typeof statePatch !== "object" ||
      statePatch === null ||
      Array.isArray(statePatch)
    ) {
      continue;
    }
    const candidate = (statePatch as Record<string, unknown>).protagonistChange;
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      latestProtagonistChange = candidate.trim();
      break;
    }
  }

  return { ...session, latestProtagonistChange };
}

/**
 * Version 1 sessions written before latestProtagonistChange existed remain
 * loadable. Their last validated StatePatch supplies the missing projection.
 */
export const storySessionSchema: z.ZodType<StorySession> = z.preprocess(
  hydrateLegacyLatestProtagonistChange,
  storySessionObjectSchema,
);

function asNamedJsonSchema(
  schema: z.ZodType,
  title: string,
): Record<string, unknown> {
  return {
    ...z.toJSONSchema(schema, { target: "draft-7" }),
    title,
  };
}

export const seedResultJsonSchema = asNamedJsonSchema(
  seedResultSchema,
  "SeedResult",
);
export const sceneResultJsonSchema = asNamedJsonSchema(
  sceneResultSchema,
  "SceneResult",
);
export const endingResultJsonSchema = asNamedJsonSchema(
  endingResultSchema,
  "EndingResult",
);

// Compatibility aliases for provider code that conventionally uses PascalCase.
export const SeedResultSchema = seedResultSchema;
export const SceneResultSchema = sceneResultSchema;
export const EndingResultSchema = endingResultSchema;
export const StorySessionSchema = storySessionSchema;
