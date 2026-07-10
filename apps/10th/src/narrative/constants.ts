export const DEPARTURE_KEY_PHRASE =
  "「じゃあ行ってみる？ 行ってみたら何か変わるかもしれないよ？」";

export const BRANCH_KEY_PHRASE =
  "「もうすこしここを見て回る？　他のところに行ってみる？」";

export const CLOSURE_KEY_PHRASE =
  "この物語はここで終わることができます。終わりますか？";

export const STAY_CHOICE_LABEL = "もう少しここを見て回る";
export const MOVE_CHOICE_LABEL = "他のところに行ってみる";
export const CONTINUE_CHOICE_LABEL = "読書を続ける";
export const END_CHOICE_LABEL = "読書を終える";

export const TITLE_KEY_PHRASE_TEMPLATE =
  "あなたが読んだ物語の題名は『{title}』です";

export function formatTitleKeyPhrase(title: string): string {
  return TITLE_KEY_PHRASE_TEMPLATE.replace("{title}", title);
}

export const STORY_SESSION_VERSION = 1;
export const SCENES_PER_MACRO_PART = 5;

export const STANDARD_MODEL_ID = "Qwen3-1.7B-q4f16_1-MLC";
export const LIGHT_MODEL_ID = "Qwen3-0.6B-q4f16_1-MLC";
export const DEBUG_MODEL_ID = "Qwen3-4B-q4f16_1-MLC";
export const FAST_MODEL_ID = LIGHT_MODEL_ID;
export const QUALITY_MODEL_ID = STANDARD_MODEL_ID;
export const DEFAULT_MODEL_ID = FAST_MODEL_ID;

export const MAX_READER_INPUT_LENGTH = 300;
export const MIN_READER_INPUT_LENGTH = 5;
export const MAX_CANONICAL_FACTS = 10;
export const MAX_ACTIVE_THREADS = 3;
export const MAX_CROSS_MACRO_THREADS = 1;
export const MAX_MOTIFS = 5;
export const MAX_RECENT_SCENE_SUMMARIES = 2;
export const MAX_PREVIOUS_SCENE_TAIL_LENGTH = 900;
export const MAX_ROLLING_SUMMARY_LENGTH = 1_200;
export const MAX_PROTAGONIST_CHANGE_LENGTH = 500;

export const MAX_NEW_FACTS_PER_PATCH = 3;
export const MAX_RESOLVED_THREADS_PER_PATCH = 2;
export const MAX_OPENED_THREADS_PER_PATCH = 2;
export const MAX_MOTIFS_PER_PATCH = 3;

export const MIN_ENDING_TITLE_LENGTH = 4;
export const MAX_ENDING_TITLE_LENGTH = 20;

export const SCENE_FUNCTION_BY_INDEX = {
  1: "arrival",
  2: "observation",
  3: "discovery",
  4: "reinterpretation",
  5: "local_closure",
} as const;

export const SCENE_FUNCTION_GUIDE = {
  arrival: "到着・世界の規則を知る",
  observation: "観察・関係を作る",
  discovery: "異常または隠れた規則を発見する",
  reinterpretation: "試み・交換・再解釈",
  local_closure: "局所的な解放・別れ・余韻",
} as const;

export const GENERATION_SETTINGS = {
  seed: { temperature: 0.7, topP: 0.9, maxTokens: 900 },
  scene: { temperature: 0.82, topP: 0.92, maxTokens: 850 },
  fastScene: { temperature: 0.76, topP: 0.9, maxTokens: 384 },
  qualityScene: { temperature: 0.8, topP: 0.92, maxTokens: 560 },
  ending: { temperature: 0.72, topP: 0.9, maxTokens: 420 },
  repair: { temperature: 0.1, topP: 0.8, maxTokens: 850 },
} as const;
