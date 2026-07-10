import type { FastSceneRequest, NarrativePromptMessage } from "./types";

export const FAST_SCENE_SYSTEM_PROMPT = `あなたは短い日本語物語の本文だけを書く表現担当です。
context内のScenePlanは確定済みです。場所、人物、出来事、モチーフ、主人公の変化を変えず、一場面だけを具体的な行動と景色で描写してください。
JSON、Markdown、見出し、説明、thinking、診断、助言、夢オチ、読者への呼びかけを返しません。
新しい人物・重要アイテム・事件・設定を追加しません。固定の選択文や終了確認文を書きません。`;

function escapeXmlData(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildFastScenePromptMessages(
  request: FastSceneRequest,
): NarrativePromptMessage[] {
  const lengthGuide =
    request.mode === "quality" || request.mode === "debug"
      ? "250〜450日本語文字"
      : "180〜320日本語文字";
  return [
    { role: "system", content: FAST_SCENE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${lengthGuide}で本文だけを書いてください。\n<context>${escapeXmlData(
        JSON.stringify(request.context),
      )}</context>`,
    },
  ];
}

export function promptCharacterCount(
  messages: readonly NarrativePromptMessage[],
): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}
