import { useState } from "react";
import type { AppScreen } from "../app/AppState";
import type { GenerationMetrics, RuntimeDiagnostics } from "../app/metrics";
import type { ProviderProgress, StorySession } from "../narrative/types";
import { exportAllDataAsJson } from "../persistence/sessionRepository";

interface DebugPanelProps {
  screen: AppScreen;
  session: StorySession | null;
  progress: ProviderProgress | null;
  generationDurationMs: number | null;
  metrics: GenerationMetrics | null;
  runtimeDiagnostics: RuntimeDiagnostics;
  runtimeStatus: string;
  prefetchStatus: string;
  benchmark: boolean;
  onClearSession: () => void;
  onInjectError?: () => void;
  onInjectInvalid?: () => void;
}

async function buildDiagnosticJson(
  metrics: GenerationMetrics | null,
  runtimeDiagnostics: RuntimeDiagnostics,
  runtimeStatus: string,
  prefetchStatus: string,
): Promise<string> {
  const persistence = JSON.parse(await exportAllDataAsJson()) as unknown;
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      metrics,
      runtimeDiagnostics,
      runtimeStatus,
      prefetchStatus,
      persistence,
    },
    null,
    2,
  );
}

async function downloadDebugJson(json: string) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `complete-reading-story-${new Date().toISOString().replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DebugPanel({
  screen,
  session,
  progress,
  generationDurationMs,
  metrics,
  runtimeDiagnostics,
  runtimeStatus,
  prefetchStatus,
  benchmark,
  onClearSession,
  onInjectError,
  onInjectInvalid,
}: DebugPanelProps) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const latestPatch = session?.scenes.at(-1)?.statePatch ?? null;

  return (
    <details className="debug-panel" open={benchmark || undefined}>
      <summary>Debug panel</summary>
      <p className="debug-warning">
        入力内容や生成本文が含まれます。JSONを書き出した後の取り扱いに注意してください。
      </p>
      <dl className="debug-grid">
        <div>
          <dt>App state</dt>
          <dd>{screen}</dd>
        </div>
        <div>
          <dt>Provider</dt>
          <dd>{session?.providerKind ?? "—"}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{session?.modelId ?? "—"}</dd>
        </div>
        <div>
          <dt>Macro</dt>
          <dd>{session?.macroPartIndex ?? "—"}</dd>
        </div>
        <div>
          <dt>Scene</dt>
          <dd>{session?.sceneIndexInMacro ?? "—"}</dd>
        </div>
        <div>
          <dt>Total scenes</dt>
          <dd>{session?.totalSceneCount ?? "—"}</dd>
        </div>
        <div>
          <dt>Generation</dt>
          <dd>
            {generationDurationMs === null ? "—" : `${generationDurationMs} ms`}
          </dd>
        </div>
        <div>
          <dt>Token usage</dt>
          <dd>
            {metrics?.completionTokens === null || !metrics
              ? "未取得"
              : `${metrics.promptTokens ?? "?"} + ${metrics.completionTokens}`}
          </dd>
        </div>
        <div>
          <dt>Build SHA</dt>
          <dd>{runtimeDiagnostics.build.buildSha}</dd>
        </div>
        <div>
          <dt>Pipeline</dt>
          <dd>{runtimeDiagnostics.build.performancePipeline}</dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>{runtimeStatus}</dd>
        </div>
        <div>
          <dt>Prefetch</dt>
          <dd>{prefetchStatus}</dd>
        </div>
        <div>
          <dt>Prompt</dt>
          <dd>
            {metrics?.promptCharacters ?? "—"} chars / estimate{" "}
            {metrics?.promptTokenEstimate ?? "—"} tokens
          </dd>
        </div>
        <div>
          <dt>TTFT</dt>
          <dd>{metrics?.timeToFirstTokenMs ?? "—"} ms</dd>
        </div>
        <div>
          <dt>Storage persisted</dt>
          <dd>
            {runtimeDiagnostics.storage.persisted === null
              ? "unknown"
              : String(runtimeDiagnostics.storage.persisted)}
          </dd>
        </div>
      </dl>

      <h3>Generation metrics</h3>
      <pre aria-label="Generation metrics">
        {JSON.stringify(metrics, null, 2)}
      </pre>
      <h3>Runtime diagnostics</h3>
      <pre aria-label="Runtime diagnostics">
        {JSON.stringify(runtimeDiagnostics, null, 2)}
      </pre>

      {progress ? (
        <pre aria-label="WebLLM progress">
          {JSON.stringify(progress, null, 2)}
        </pre>
      ) : null}
      {session ? (
        <>
          <h3>Rolling summary</h3>
          <pre>{session.rollingSummary}</pre>
          <h3>Canonical facts / Threads / Motifs</h3>
          <pre>
            {JSON.stringify(
              {
                canonicalFacts: session.canonicalFacts,
                activeThreads: session.activeThreads,
                motifs: session.motifs,
              },
              null,
              2,
            )}
          </pre>
          <h3>Latest StatePatch</h3>
          <pre>{JSON.stringify(latestPatch, null, 2)}</pre>
          <h3>StorySession JSON</h3>
          <pre>{JSON.stringify(session, null, 2)}</pre>
        </>
      ) : null}

      <div className="button-row debug-actions">
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setExportError(null);
            void buildDiagnosticJson(
              metrics,
              runtimeDiagnostics,
              runtimeStatus,
              prefetchStatus,
            )
              .then(downloadDebugJson)
              .catch((error: unknown) => {
                setExportError(
                  error instanceof Error ? error.message : String(error),
                );
              });
          }}
        >
          診断JSONを書き出す
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setCopyStatus(null);
            setExportError(null);
            void buildDiagnosticJson(
              metrics,
              runtimeDiagnostics,
              runtimeStatus,
              prefetchStatus,
            )
              .then((json) => navigator.clipboard.writeText(json))
              .then(() => setCopyStatus("診断JSONをコピーしました。"))
              .catch((error: unknown) =>
                setExportError(
                  error instanceof Error ? error.message : String(error),
                ),
              );
          }}
        >
          診断JSONをコピー
        </button>
        {onInjectError ? (
          <button
            className="button secondary"
            type="button"
            onClick={onInjectError}
          >
            次の生成をエラーにする
          </button>
        ) : null}
        {onInjectInvalid ? (
          <button
            className="button secondary"
            type="button"
            onClick={onInjectInvalid}
          >
            次の応答を不正にする
          </button>
        ) : null}
        <button className="button quiet" type="button" onClick={onClearSession}>
          セッションを削除
        </button>
      </div>
      {exportError ? (
        <p className="field-error" role="alert">
          {exportError}
        </p>
      ) : null}
      {copyStatus ? <p role="status">{copyStatus}</p> : null}
    </details>
  );
}
