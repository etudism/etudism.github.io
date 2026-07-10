import { formatTitleKeyPhrase } from "../narrative/constants";
import type { StorySession } from "../narrative/types";

interface EndingViewProps {
  session: StorySession;
  onNewStory: () => void;
}

export function EndingView({ session, onNewStory }: EndingViewProps) {
  if (!session.ending) return null;
  return (
    <article className="ending-view" aria-labelledby="ending-heading">
      <p className="eyebrow">THE LAST PAGE</p>
      <h1 id="ending-heading">終幕</h1>
      <div className="scene-text epilogue">{session.ending.epilogue}</div>
      <div className="title-reveal">
        <span className="ornament" aria-hidden="true">
          ◇
        </span>
        <p>{formatTitleKeyPhrase(session.ending.title)}</p>
        <span className="ornament" aria-hidden="true">
          ◇
        </span>
      </div>
      <button className="button secondary" type="button" onClick={onNewStory}>
        新しい物語を始める
      </button>
    </article>
  );
}
