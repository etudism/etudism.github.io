import type { ProviderProgress } from "../narrative/types";

interface ModelProgressProps {
  modelLabel: string;
  progress: ProviderProgress | null;
  generating: boolean;
  compatibilityLabel: string;
  onCancel: () => void;
}

export function ModelProgress({
  modelLabel,
  progress,
  generating,
  compatibilityLabel,
  onCancel,
}: ModelProgressProps) {
  const value = Math.max(0, Math.min(1, progress?.progress ?? 0));
  return (
    <section
      className="center-panel"
      aria-labelledby="progress-heading"
      aria-busy="true"
    >
      <p className="eyebrow">PREPARING LOCALLY</p>
      <h1 id="progress-heading">
        {generating ? "最初の頁を書いています" : "モデルを準備しています"}
      </h1>
      <p className="lead">{modelLabel}</p>
      <p className="model-meta">{compatibilityLabel}</p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        <span style={{ width: `${value * 100}%` }} />
      </div>
      <p className="progress-copy" aria-live="polite">
        {progress?.text ??
          (generating ? "象徴の世界へ変換しています…" : "準備を始めています…")}
      </p>
      <button className="button quiet" type="button" onClick={onCancel}>
        中断して戻る
      </button>
    </section>
  );
}
