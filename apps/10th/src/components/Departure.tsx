import { DEPARTURE_KEY_PHRASE } from "../narrative/constants";
import type { ProviderProgress, StorySession } from "../narrative/types";

interface DepartureProps {
  session: StorySession;
  runtimeStatus: "idle" | "loading" | "ready" | "error";
  progress: ProviderProgress | null;
  runtimeError: string | null;
  onContinue: () => void;
}

export function Departure({
  session,
  runtimeStatus,
  progress,
  runtimeError,
  onContinue,
}: DepartureProps) {
  const firstScene = session.scenes[0];
  return (
    <section className="departure-panel" aria-labelledby="departure-heading">
      <p className="eyebrow">BEFORE THE FIRST STEP</p>
      <h1 id="departure-heading" className="visually-hidden">
        旅立ち
      </h1>
      {firstScene ? (
        <article
          className="departure-opening"
          aria-labelledby="opening-heading"
        >
          <h2 id="opening-heading">最初の場面</h2>
          <p className="scene-text">{firstScene.text}</p>
        </article>
      ) : null}
      <p className="runtime-note" role="status">
        {runtimeStatus === "loading"
          ? `最初の場面を読みながら、端末の中で物語AIを準備しています。${progress?.text ? ` ${progress.text}` : ""}`
          : runtimeStatus === "ready"
            ? "端末内の物語生成を続けられる準備ができました。"
            : runtimeStatus === "error"
              ? `${runtimeError ?? "モデルを準備できませんでした。"} 物語は安全なローカル表現で続けられます。`
              : "最初の場面は端末内で組み立てました。"}
      </p>
      <blockquote>{DEPARTURE_KEY_PHRASE}</blockquote>
      <button
        className="button primary"
        type="button"
        onClick={onContinue}
        autoFocus
      >
        頁をひらく
      </button>
    </section>
  );
}
