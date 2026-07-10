import type { SerializableError } from "../narrative/types";

interface ErrorPanelProps {
  error: SerializableError;
  debug: boolean;
  onRetry?: () => void;
  onBack: () => void;
  backLabel?: string;
}

export function ErrorPanel({
  error,
  debug,
  onRetry,
  onBack,
  backLabel = "戻る",
}: ErrorPanelProps) {
  return (
    <section
      className="error-panel"
      role="alert"
      aria-labelledby="error-heading"
    >
      <p className="eyebrow">A PAUSE, NOT AN END</p>
      <h1 id="error-heading">ここで少し立ち止まりました</h1>
      <p className="lead">{error.userMessage}</p>
      {debug && error.technicalMessage ? (
        <pre>{error.technicalMessage}</pre>
      ) : null}
      <div className="button-row">
        {error.recoverable && onRetry ? (
          <button className="button primary" type="button" onClick={onRetry}>
            もう一度試す
          </button>
        ) : null}
        <button className="button secondary" type="button" onClick={onBack}>
          {backLabel}
        </button>
      </div>
    </section>
  );
}
