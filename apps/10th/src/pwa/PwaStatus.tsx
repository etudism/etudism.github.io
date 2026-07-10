import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  return (
    <aside
      className="pwa-notice"
      aria-live="polite"
      aria-label="アプリの更新情報"
    >
      <p>
        {needRefresh
          ? "新しい版を利用できます。読書の区切りで更新してください。"
          : "アプリ本体をオフラインでも開けるようになりました。モデル生成には事前の完全なダウンロードが必要です。"}
      </p>
      <div className="button-row compact">
        {needRefresh ? (
          <button
            className="button secondary"
            type="button"
            onClick={() => void updateServiceWorker(true)}
          >
            今すぐ更新
          </button>
        ) : null}
        <button
          className="button quiet"
          type="button"
          onClick={() => {
            setOfflineReady(false);
            setNeedRefresh(false);
          }}
        >
          閉じる
        </button>
      </div>
    </aside>
  );
}
