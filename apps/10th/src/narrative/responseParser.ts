import { z } from "zod";

import {
  endingResultJsonSchema,
  endingResultSchema,
  sceneResultJsonSchema,
  sceneResultSchema,
  seedResultJsonSchema,
  seedResultSchema,
} from "./schemas";
import {
  generateFallbackEnding,
  generateFallbackScene,
  generateFallbackSeed,
} from "./fallbackGenerator";
import {
  sanitizeEndingResult,
  sanitizeSceneResult,
  sanitizeSeedResult,
} from "./outputSanitizer";
import type {
  EndingContext,
  EndingResult,
  JsonRepairFunction,
  JsonRepairRequest,
  NarrativeContext,
  ParseDiagnostic,
  SceneResult,
  SeedResult,
} from "./types";

export interface ModelResponseParserOptions<T> {
  kind: JsonRepairRequest["kind"];
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  repair: JsonRepairFunction;
  fallback: () => T;
  onDiagnostic?: (diagnostic: ParseDiagnostic) => void;
}

interface SharedParserOptions<T> {
  repair: JsonRepairFunction;
  fallback?: () => T;
  onDiagnostic?: (diagnostic: ParseDiagnostic) => void;
}

export interface SeedResponseParserOptions extends SharedParserOptions<SeedResult> {
  readerInput?: string;
}

export interface SceneResponseParserOptions extends SharedParserOptions<SceneResult> {
  context: NarrativeContext;
}

export interface EndingResponseParserOptions extends SharedParserOptions<EndingResult> {
  context: EndingContext;
}

class ModelResponseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelResponseValidationError";
  }
}

function describeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ")
      .slice(0, 2_000);
  }
  if (error instanceof Error) {
    return error.message.slice(0, 2_000);
  }
  return "Unknown model response validation error.";
}

function parseAndValidate<T>(rawOutput: string, schema: z.ZodType<T>): T {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOutput) as unknown;
  } catch (error: unknown) {
    throw new ModelResponseValidationError(
      `JSON.parse failed: ${describeError(error)}`,
    );
  }

  const result = schema.safeParse(parsedJson);
  if (!result.success) {
    throw new ModelResponseValidationError(
      `Zod validation failed: ${describeError(result.error)}`,
    );
  }
  return result.data;
}

function emitDiagnostic(
  callback: ((diagnostic: ParseDiagnostic) => void) | undefined,
  diagnostic: ParseDiagnostic,
): void {
  callback?.(diagnostic);
}

/**
 * Executes the normative failure path exactly once:
 * JSON.parse -> Zod -> one repair -> JSON.parse -> Zod -> fallback.
 */
export async function parseModelResponse<T>(
  rawOutput: string,
  options: ModelResponseParserOptions<T>,
): Promise<T> {
  let initialError: string;
  try {
    return parseAndValidate(rawOutput, options.schema);
  } catch (error: unknown) {
    initialError = describeError(error);
    emitDiagnostic(options.onDiagnostic, {
      kind: options.kind,
      stage: "initial_parse_failed",
      message: initialError,
    });
  }

  const repairRequest: JsonRepairRequest = {
    kind: options.kind,
    rawOutput,
    validationError: initialError,
    jsonSchema: options.jsonSchema,
  };

  try {
    const repairedOutput = await options.repair(repairRequest);
    const repaired = parseAndValidate(repairedOutput, options.schema);
    emitDiagnostic(options.onDiagnostic, {
      kind: options.kind,
      stage: "repair_succeeded",
      message: "The single JSON repair attempt produced a valid response.",
    });
    return repaired;
  } catch (error: unknown) {
    emitDiagnostic(options.onDiagnostic, {
      kind: options.kind,
      stage: "repair_failed",
      message: describeError(error),
    });
  }

  const fallback = options.schema.parse(options.fallback());
  emitDiagnostic(options.onDiagnostic, {
    kind: options.kind,
    stage: "fallback_used",
    message: "The deterministic fallback was used after one failed repair.",
  });
  return fallback;
}

export function parseSeedResponse(
  rawOutput: string,
  options: SeedResponseParserOptions,
): Promise<SeedResult> {
  return parseModelResponse(rawOutput, {
    kind: "seed",
    schema: seedResultSchema,
    jsonSchema: seedResultJsonSchema,
    repair: options.repair,
    fallback:
      options.fallback ??
      (() => generateFallbackSeed(options.readerInput ?? "")),
    onDiagnostic: options.onDiagnostic,
  }).then(sanitizeSeedResult);
}

export function parseSceneResponse(
  rawOutput: string,
  options: SceneResponseParserOptions,
): Promise<SceneResult> {
  return parseModelResponse(rawOutput, {
    kind: "scene",
    schema: sceneResultSchema,
    jsonSchema: sceneResultJsonSchema,
    repair: options.repair,
    fallback:
      options.fallback ?? (() => generateFallbackScene(options.context)),
    onDiagnostic: options.onDiagnostic,
  }).then(sanitizeSceneResult);
}

export function parseEndingResponse(
  rawOutput: string,
  options: EndingResponseParserOptions,
): Promise<EndingResult> {
  return parseModelResponse(rawOutput, {
    kind: "ending",
    schema: endingResultSchema,
    jsonSchema: endingResultJsonSchema,
    repair: options.repair,
    fallback:
      options.fallback ?? (() => generateFallbackEnding(options.context)),
    onDiagnostic: options.onDiagnostic,
  }).then(sanitizeEndingResult);
}
