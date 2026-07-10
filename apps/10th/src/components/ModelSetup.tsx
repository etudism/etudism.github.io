import type { WebGpuCompatibility } from "../app/compatibility";
import type { GenerationMode, ProviderKind } from "../narrative/types";
import { MODEL_CATALOG } from "../providers/modelCatalog";
import { CompatibilityGate } from "./CompatibilityGate";

export interface ModelSelection {
  providerKind: ProviderKind;
  modelId: string;
  label: string;
  mode: GenerationMode;
}

interface ModelSetupProps {
  compatibility: WebGpuCompatibility | null;
  checkingCompatibility: boolean;
  debug: boolean;
  preferMock: boolean;
  busy: boolean;
  onRecheck: () => void;
  onSelect: (selection: ModelSelection) => void;
  onBack: () => void;
}

export function ModelSetup({
  compatibility,
  checkingCompatibility,
  debug,
  preferMock,
  busy,
  onRecheck,
  onSelect,
  onBack,
}: ModelSetupProps) {
  const webLlmEnabled = compatibility?.supported === true;
  const availableModels = MODEL_CATALOG.filter(
    (model) => debug || !model.debugOnly,
  );

  return (
    <section className="model-setup" aria-labelledby="model-heading">
      <p className="eyebrow">CHOOSE THE ENGINE</p>
      <h1 id="model-heading">物語を書く方法を選ぶ</h1>
      <p className="lead">
        ローカルAIは物語をこの端末の中で生成します。デモはモデルを使わず、同じ流れを短時間で試します。
      </p>

      <CompatibilityGate
        compatibility={compatibility}
        checking={checkingCompatibility}
        onRecheck={onRecheck}
      />

      <div className="model-grid">
        {availableModels.map((model) => (
          <article className="model-card" key={model.id}>
            <p className="model-kind">
              {model.kind === "standard"
                ? "QUALITY"
                : model.kind === "light"
                  ? "FAST"
                  : "DEBUG"}
            </p>
            <h2>{model.label}</h2>
            <p>{model.description}</p>
            <p className="model-meta">
              必要VRAM目安 約{model.vramMb.toLocaleString("ja-JP")} MB
            </p>
            <button
              className="button secondary full"
              type="button"
              disabled={busy || !webLlmEnabled}
              aria-describedby={`model-help-${model.kind}`}
              onClick={() =>
                onSelect({
                  providerKind: "webllm",
                  modelId: model.id,
                  label: model.label,
                  mode: model.mode,
                })
              }
            >
              この端末で始める
            </button>
            <span className="visually-hidden" id={`model-help-${model.kind}`}>
              {webLlmEnabled
                ? "選択するとモデルデータのダウンロードを開始します"
                : "WebGPUを確認できないため選択できません"}
            </span>
          </article>
        ))}

        <article
          className={`model-card demo-card${preferMock ? " preferred" : ""}`}
        >
          <p className="model-kind">
            {preferMock ? "DEMO · URL指定中" : "DEMO"}
          </p>
          <h2>デモ（モック生成）</h2>
          <p>
            モデルをダウンロードせず、決定論的な物語で分岐・終了・復元を試せます。
          </p>
          <p className="model-meta">WebGPU不要 · 通信なし</p>
          <button
            className="button secondary full"
            type="button"
            disabled={busy}
            onClick={() =>
              onSelect({
                providerKind: "mock",
                modelId: "mock-narrative-v1",
                label: "デモ（モック生成）",
                mode: "demo",
              })
            }
          >
            デモで始める
          </button>
        </article>
      </div>

      <aside className="download-disclosure">
        <h2>ローカルAIを選ぶ前に</h2>
        <p>
          初回だけ大容量のモデルデータをダウンロードします。データ量と準備時間は端末・ブラウザー・回線によって異なります。
          物語の入力と生成結果は、このアプリのサーバーには送信されません。
        </p>
        <p>
          アプリ本体は一度読み込めばオフライン起動できます。ローカル生成をオフラインで行えるのは、モデルの完全なダウンロードとキャッシュ後だけです。
        </p>
      </aside>

      <button
        className="button quiet"
        type="button"
        onClick={onBack}
        disabled={busy}
      >
        入力へ戻る
      </button>
    </section>
  );
}
