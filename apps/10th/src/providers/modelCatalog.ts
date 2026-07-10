import {
  DEBUG_MODEL_ID,
  LIGHT_MODEL_ID,
  STANDARD_MODEL_ID,
} from "../narrative/constants";
import type { GenerationMode } from "../narrative/types";

export type ModelCatalogKind = "light" | "standard" | "debug";

export interface ModelCatalogEntry {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly vramMb: number;
  readonly kind: ModelCatalogKind;
  readonly debugOnly: boolean;
  readonly mode: GenerationMode;
}

const REQUIRED_MODEL_CATALOG = [
  {
    id: LIGHT_MODEL_ID,
    label: "高速（Qwen3 0.6B）",
    description: "待ち時間を抑え、短めの場面を端末内で生成します。",
    vramMb: 1_403,
    kind: "light",
    debugOnly: false,
    mode: "fast",
  },
  {
    id: STANDARD_MODEL_ID,
    label: "品質優先（Qwen3 1.7B）",
    description: "初回準備と生成負荷は大きめですが、長めの場面を生成します。",
    vramMb: 2_037,
    kind: "standard",
    debugOnly: false,
    mode: "quality",
  },
  {
    id: DEBUG_MODEL_ID,
    label: "高品質モデル（Qwen3 4B）",
    description: "高性能端末での品質比較に使うデバッグ専用モデルです。",
    vramMb: 3_432,
    kind: "debug",
    debugOnly: true,
    mode: "debug",
  },
] as const satisfies readonly ModelCatalogEntry[];

export function isModelAvailable(modelId: string): boolean {
  return REQUIRED_MODEL_CATALOG.some((model) => model.id === modelId);
}

/**
 * Validates the static app catalog without loading the WebLLM runtime. This is
 * safe to use while rendering the model picker.
 */
export function assertRequiredModelsAvailable(): void {
  const requiredModelIds = [
    LIGHT_MODEL_ID,
    STANDARD_MODEL_ID,
    DEBUG_MODEL_ID,
  ] as const;
  const missingModelIds = requiredModelIds.filter(
    (modelId) => !isModelAvailable(modelId),
  );

  if (missingModelIds.length > 0) {
    throw new Error(
      `The app model catalog is missing required models: ${missingModelIds.join(
        ", ",
      )}`,
    );
  }
}

/**
 * Checks the pinned package only after the user elects to initialize WebLLM.
 * The dynamic import keeps the multi-megabyte runtime out of the app shell.
 * This reads package metadata and does not download model weights.
 */
export async function verifyRequiredModelsInPrebuiltConfig(): Promise<void> {
  const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
  const prebuiltModelIds = new Set(
    prebuiltAppConfig.model_list.map((model) => model.model_id),
  );
  const missingModelIds = REQUIRED_MODEL_CATALOG.filter(
    (model) => !prebuiltModelIds.has(model.id),
  ).map((model) => model.id);

  if (missingModelIds.length > 0) {
    throw new Error(
      `@mlc-ai/web-llm prebuiltAppConfig is missing required models: ${missingModelIds.join(
        ", ",
      )}`,
    );
  }
}

export const MODEL_CATALOG: readonly ModelCatalogEntry[] =
  REQUIRED_MODEL_CATALOG;
