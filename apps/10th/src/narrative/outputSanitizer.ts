import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
} from "./constants";
import type { EndingResult, SceneResult, SeedResult } from "./types";

const TITLE_REVEAL_PATTERN =
  /あなたが読んだ物語の題名は『[^』\r\n]{0,100}』です/gu;

/**
 * A model can ignore its prompt. Remove application-owned phrases before any
 * generated prose reaches state, so UI insertion can never duplicate them.
 */
export function stripApplicationOwnedPhrases(text: string): string {
  let sanitized = text;
  for (const phrase of [
    DEPARTURE_KEY_PHRASE,
    BRANCH_KEY_PHRASE,
    CLOSURE_KEY_PHRASE,
  ]) {
    sanitized = sanitized.replaceAll(phrase, "");
  }
  return sanitized
    .replace(TITLE_REVEAL_PATTERN, "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

export function sanitizeSceneResult(result: SceneResult): SceneResult {
  const text = stripApplicationOwnedPhrases(result.text);
  return {
    ...result,
    text: text || "場面には静かな余韻だけが残った。",
  };
}

export function sanitizeSeedResult(result: SeedResult): SeedResult {
  return {
    ...result,
    firstScene: sanitizeSceneResult(result.firstScene),
  };
}

export function sanitizeEndingResult(result: EndingResult): EndingResult {
  const epilogue = stripApplicationOwnedPhrases(result.epilogue);
  return {
    ...result,
    epilogue: epilogue || "旅人は持ち歩いた印を確かめ、静かに歩き出した。",
  };
}
