import type { WebGpuCompatibility } from "../app/compatibility";

interface CompatibilityGateProps {
  compatibility: WebGpuCompatibility | null;
  checking: boolean;
  onRecheck: () => void;
}

export function CompatibilityGate({
  compatibility,
  checking,
  onRecheck,
}: CompatibilityGateProps) {
  if (checking || !compatibility) {
    return (
      <p className="compatibility-note" aria-live="polite">
        この端末でローカルAIを利用できるか確認しています…
      </p>
    );
  }

  if (compatibility.supported) {
    return (
      <p className="compatibility-note success" aria-live="polite">
        <span aria-hidden="true">●</span>{" "}
        WebGPUを利用できます。ローカルAIモデルを選択できます。
      </p>
    );
  }

  return (
    <aside
      className="compatibility-card"
      aria-labelledby="compatibility-heading"
    >
      <p className="eyebrow">DEMO AVAILABLE</p>
      <h2 id="compatibility-heading">
        ローカルAIを利用できない可能性があります
      </h2>
      <p>
        {compatibility.detail}
        デモモードでは、モデルをダウンロードせず物語の流れを試せます。
      </p>
      <div className="button-row">
        <button className="button secondary" type="button" onClick={onRecheck}>
          再確認
        </button>
        <a
          className="text-link"
          href="https://github.com/mlc-ai/web-llm#webgpu-support"
          target="_blank"
          rel="noreferrer"
        >
          対応環境の説明
        </a>
      </div>
    </aside>
  );
}
