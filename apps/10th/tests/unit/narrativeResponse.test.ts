import { describe, expect, it, vi } from "vitest";

import {
  generateFallbackEnding,
  generateFallbackScene,
  generateFallbackSeed,
} from "../../src/narrative/fallbackGenerator";
import {
  BRANCH_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
} from "../../src/narrative/constants";
import {
  GenerationGate,
  GenerationInProgressError,
  GenerationInterruptedError,
} from "../../src/narrative/generationGate";
import {
  parseEndingResponse,
  parseSceneResponse,
  parseSeedResponse,
} from "../../src/narrative/responseParser";
import type {
  EndingContext,
  NarrativeContext,
  ParseDiagnostic,
} from "../../src/narrative/types";

const seed = generateFallbackSeed("応答パーサー用の入力");

const sceneContext: NarrativeContext = {
  themeTransform: seed.themeTransform,
  storyBible: seed.storyBible,
  macroPartIndex: 1,
  sceneIndexInMacro: 2,
  sceneFunction: "observation",
  currentLocationId: seed.firstScene.statePatch.currentLocation,
  depthIndex: 1,
  distanceIndex: 0,
  rollingSummary: seed.firstScene.summary,
  canonicalFacts: [],
  activeThreads: [],
  motifs: [],
  latestProtagonistChange: seed.firstScene.statePatch.protagonistChange,
  recentSceneSummaries: [seed.firstScene.summary],
  previousSceneTail: seed.firstScene.text,
  choice: "stay",
};

const endingContext: EndingContext = {
  themeTransform: seed.themeTransform,
  storyBible: seed.storyBible,
  macroPartIndex: 1,
  totalSceneCount: 5,
  currentLocationId: seed.firstScene.statePatch.currentLocation,
  rollingSummary: seed.firstScene.summary,
  canonicalFacts: [],
  activeThreads: [],
  motifs: [],
  latestProtagonistChange: seed.firstScene.statePatch.protagonistChange,
  recentSceneSummaries: [seed.firstScene.summary],
  previousSceneTail: seed.firstScene.text,
};

describe("responseParser", () => {
  it("returns a valid initial JSON response without invoking repair", async () => {
    const result = generateFallbackScene(sceneContext);
    const repair = vi.fn(async () => "should not be used");

    await expect(
      parseSceneResponse(JSON.stringify(result), {
        context: sceneContext,
        repair,
      }),
    ).resolves.toEqual(result);
    expect(repair).not.toHaveBeenCalled();
  });

  it("strips application-owned phrases even when a model ignores the prompt", async () => {
    const result = generateFallbackScene(sceneContext);
    const contaminated = {
      ...result,
      text: `${DEPARTURE_KEY_PHRASE}\n${result.text}\n${BRANCH_KEY_PHRASE}`,
    };

    const parsed = await parseSceneResponse(JSON.stringify(contaminated), {
      context: sceneContext,
      repair: async () => {
        throw new Error("valid JSON must not need repair");
      },
    });

    expect(parsed.text).toBe(result.text);
    expect(parsed.text).not.toContain(DEPARTURE_KEY_PHRASE);
    expect(parsed.text).not.toContain(BRANCH_KEY_PHRASE);
  });

  it("runs exactly one repair after JSON.parse or Zod failure", async () => {
    const repaired = generateFallbackSeed("修復後");
    const diagnostics: ParseDiagnostic[] = [];
    const repair = vi.fn(async (request) => {
      expect(request.kind).toBe("seed");
      expect(request.validationError).toContain("JSON.parse failed");
      expect(request.jsonSchema).toMatchObject({ type: "object" });
      return JSON.stringify(repaired);
    });

    await expect(
      parseSeedResponse("not-json", {
        readerInput: "修復前",
        repair,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      }),
    ).resolves.toEqual(repaired);
    expect(repair).toHaveBeenCalledTimes(1);
    expect(diagnostics.map((diagnostic) => diagnostic.stage)).toEqual([
      "initial_parse_failed",
      "repair_succeeded",
    ]);
  });

  it("uses a deterministic playable fallback after the one repair fails", async () => {
    const diagnostics: ParseDiagnostic[] = [];
    const repair = vi.fn(async () => '{"still":"invalid"}');
    const expectedFallback = generateFallbackEnding(endingContext);

    await expect(
      parseEndingResponse("```json\n{}\n```", {
        context: endingContext,
        repair,
        onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      }),
    ).resolves.toEqual(expectedFallback);
    expect(repair).toHaveBeenCalledTimes(1);
    expect(diagnostics.map((diagnostic) => diagnostic.stage)).toEqual([
      "initial_parse_failed",
      "repair_failed",
      "fallback_used",
    ]);
    expect(expectedFallback.epilogue.length).toBeGreaterThan(0);
    expect(expectedFallback.title.length).toBeGreaterThanOrEqual(4);
  });

  it("also falls back when the repair call itself rejects", async () => {
    const fallback = generateFallbackScene(sceneContext);
    const repair = vi.fn(async () => {
      throw new Error("repair model unavailable");
    });

    await expect(
      parseSceneResponse("{", {
        context: sceneContext,
        repair,
        fallback: () => fallback,
      }),
    ).resolves.toEqual(fallback);
    expect(repair).toHaveBeenCalledTimes(1);
  });
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve(value: T): void {
      if (!resolvePromise) {
        throw new Error("Deferred promise was not initialized.");
      }
      resolvePromise(value);
    },
  };
}

describe("GenerationGate", () => {
  it("prevents double generation, interrupts safely, and becomes reusable", async () => {
    const gate = new GenerationGate();
    const pending = deferred<string>();
    const first = gate.run(async () => pending.promise);

    expect(gate.isGenerating).toBe(true);
    await expect(gate.run(async () => "second")).rejects.toBeInstanceOf(
      GenerationInProgressError,
    );

    expect(gate.interrupt()).toBe(true);
    pending.resolve("ignored after abort");
    await expect(first).rejects.toBeInstanceOf(GenerationInterruptedError);
    expect(gate.isGenerating).toBe(false);
    await expect(gate.run(async () => "recovered")).resolves.toBe("recovered");
  });
});
