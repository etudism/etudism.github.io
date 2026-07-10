import { useLayoutEffect, useRef } from "react";
import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  CONTINUE_CHOICE_LABEL,
  END_CHOICE_LABEL,
  MOVE_CHOICE_LABEL,
  STAY_CHOICE_LABEL,
} from "../narrative/constants";
import type {
  ClosureChoice,
  ReaderChoice,
  StorySession,
} from "../narrative/types";

interface ReadingViewProps {
  session: StorySession;
  busy: boolean;
  runtimeStatus: "idle" | "loading" | "ready" | "error";
  runtimeError: string | null;
  streamingText: string;
  prefetchStatus: string;
  onBranch: (choice: ReaderChoice) => void;
  onClosure: (choice: ClosureChoice) => void;
  onInterrupt: () => void;
}

export function ReadingView({
  session,
  busy,
  runtimeStatus,
  runtimeError,
  streamingText,
  prefetchStatus,
  onBranch,
  onClosure,
  onInterrupt,
}: ReadingViewProps) {
  const scene = session.scenes.at(-1);
  const sceneHeadingRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (!scene) return;

    sceneHeadingRef.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [scene]);

  if (!scene) return null;
  const awaitingClosure = session.status === "awaiting_closure";
  const awaitingBranch = session.status === "awaiting_branch";

  return (
    <article
      className="reading-view"
      aria-busy={busy}
      aria-labelledby="scene-heading"
    >
      <header className="reading-header">
        <p className="eyebrow">STORY IN PROGRESS</p>
        <h1
          className="scene-position"
          id="scene-heading"
          ref={sceneHeadingRef}
          tabIndex={-1}
        >
          第{session.macroPartIndex}景 · {session.sceneIndexInMacro} / 5
        </h1>
      </header>
      <div className="scene-rule" aria-hidden="true">
        <span />
      </div>
      <div className="scene-text">{scene.text}</div>

      {runtimeStatus !== "ready" ? (
        <p className="runtime-note" role="status">
          {runtimeStatus === "loading"
            ? "端末内の物語AIを準備中です。選択すると、準備完了を待って続きを書きます。"
            : runtimeStatus === "error"
              ? `${runtimeError ?? "物語AIを準備できませんでした。"} 安全なローカル表現で続けます。`
              : "続きを書く方法を確認しています。"}
        </p>
      ) : null}

      {busy ? (
        <div className="generation-status">
          <span className="ink-pulse" aria-hidden="true" />
          <p aria-live="polite">
            選んだ先の一場面を書いています。前の頁はそのまま残ります。
          </p>
          {streamingText ? (
            <div className="streaming-draft" aria-label="生成中の次の場面">
              {streamingText}
              <span className="stream-cursor" aria-hidden="true" />
            </div>
          ) : null}
          <button className="button quiet" type="button" onClick={onInterrupt}>
            生成を中断
          </button>
        </div>
      ) : null}

      {!busy && awaitingBranch ? (
        <section className="choice-section" aria-labelledby="branch-question">
          <p className="fixed-phrase" id="branch-question">
            {BRANCH_KEY_PHRASE}
          </p>
          <div className="choice-grid">
            <button
              className="choice-button"
              type="button"
              onClick={() => onBranch("stay")}
            >
              <span aria-hidden="true">Ⅰ</span>
              {STAY_CHOICE_LABEL}
            </button>
            <button
              className="choice-button"
              type="button"
              onClick={() => onBranch("move")}
            >
              <span aria-hidden="true">Ⅱ</span>
              {MOVE_CHOICE_LABEL}
            </button>
          </div>
        </section>
      ) : null}

      {!busy && awaitingClosure ? (
        <section
          className="choice-section closure"
          aria-labelledby="closure-question"
        >
          <p className="fixed-phrase" id="closure-question">
            {CLOSURE_KEY_PHRASE}
          </p>
          <div className="choice-grid">
            <button
              className="choice-button"
              type="button"
              onClick={() => onClosure("continue")}
            >
              <span aria-hidden="true">↗</span>
              {CONTINUE_CHOICE_LABEL}
            </button>
            <button
              className="choice-button"
              type="button"
              onClick={() => onClosure("end")}
            >
              <span aria-hidden="true">○</span>
              {END_CHOICE_LABEL}
            </button>
          </div>
        </section>
      ) : null}

      {session.choices.length ? (
        <details className="choice-history">
          <summary>これまでの選択</summary>
          <ol>
            {session.choices.map((choice) => (
              <li key={choice.id}>
                {choice.choice === "stay"
                  ? STAY_CHOICE_LABEL
                  : choice.choice === "move"
                    ? MOVE_CHOICE_LABEL
                    : choice.choice === "continue"
                      ? CONTINUE_CHOICE_LABEL
                      : END_CHOICE_LABEL}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {prefetchStatus === "ready" ? (
        <span className="visually-hidden">次の選択肢を端末内で準備済み</span>
      ) : null}
    </article>
  );
}
