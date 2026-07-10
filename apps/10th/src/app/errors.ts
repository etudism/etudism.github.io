import type { AppErrorCode, SerializableError } from "../narrative/types";

const ERROR_CODES = new Set<AppErrorCode>([
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

const USER_MESSAGES: Record<AppErrorCode, string> = {
  WEBGPU_UNAVAILABLE:
    "この環境ではローカルAIを利用できません。デモモードを選べます。",
  MODEL_NOT_FOUND: "選択したモデルを現在のWebLLM構成で確認できませんでした。",
  MODEL_DOWNLOAD_FAILED:
    "モデルデータを準備できませんでした。回線を確認して再試行してください。",
  MODEL_INIT_FAILED:
    "モデルを開始できませんでした。軽量モデルまたはデモを試せます。",
  GENERATION_INTERRUPTED:
    "生成を中断しました。直前の確定した頁から再開できます。",
  GENERATION_FAILED:
    "次の場面を生成できませんでした。同じ状態から再試行できます。",
  INVALID_MODEL_JSON:
    "生成結果の形を確認できませんでした。同じ場面を再試行できます。",
  STORAGE_FAILED: "端末への保存に失敗しました。この画面の物語は続けられます。",
  SESSION_CORRUPTED:
    "保存した物語を復元できませんでした。新しい物語を始められます。",
  UNKNOWN: "予期しない問題が起きました。同じ操作を再試行できます。",
};

function readErrorCode(
  error: unknown,
  fallbackCode: AppErrorCode,
): AppErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string" && ERROR_CODES.has(code as AppErrorCode)) {
      return code as AppErrorCode;
    }
  }
  return fallbackCode;
}

export function toSerializableError(
  error: unknown,
  fallbackCode: AppErrorCode,
  userMessage?: string,
): SerializableError {
  const code = readErrorCode(error, fallbackCode);
  return {
    code,
    userMessage: userMessage ?? USER_MESSAGES[code],
    technicalMessage:
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error),
    recoverable: code !== "SESSION_CORRUPTED" || fallbackCode !== "UNKNOWN",
    occurredAt: new Date().toISOString(),
  };
}
