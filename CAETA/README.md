# CAETA ES Modules 細分化版 v4

この版は、元の単一 HTML を基準に、**機能ごとに細かく分割した ES Modules 構成**へ整理したものです。

## 方針

- 元の動作を壊しやすい `new Function(...with(ctx){...})` 型の疑似分割は使わない
- 共有状態が多い部分は `00-app.js` を composition root として残す
- そのうえで、保守しやすい単位から **実際に runtime import される module** に切り出す
- 分割後に構文・参照・ import パスが壊れていないことを機械的に確認する
- 検証用の stub 依存を別ファイルとして持ち、**本番構成を変えずに** runtime 検証できるようにする

## 構成

### ルート
- `index.html` : DOM 本体
- `styles/10-main.css` : スタイル全体
- `scripts/10-data.js` : 巨大な `DATA`
- `scripts/00-app.js` : アプリ全体の composition root


> 補足:
> - `README.md` / `index.html` / `eslint.config.mjs` は、GitHub やツールの慣例ファイル名として意味があるため **あえて無改名** にしています。
> - それ以外の主要ファイルには、フォルダごとに番号順プレフィックスを付けています。

### 依存
- `scripts/lib/10-deps.js` : 本番用。`three` / `OrbitControls` を CDN から読み込む

### core
- `scripts/core/10-errors.js`
  - グローバルエラー表示の登録
- `scripts/core/20-dom.js`
  - DOM 参照の一括取得

### utils
- `scripts/utils/10-id.js`
  - `normalizeBoothId`
  - `escapeHtml`
  - `normalizeSearchText`
- `scripts/utils/20-groups.js`
  - 選択 ID の正規化
  - group key 解決
  - group 単位の tier 集約

### features
- `scripts/features/10-search-utils.js`
  - 検索インデックス文字列
  - 検索スコア計算
- `scripts/features/20-search-ui.js`
  - 検索結果 UI の描画
  - 検索更新 / クリア
- `scripts/features/30-meta-utils.js`
  - 情報パネルのメタ文字列生成
- `scripts/features/40-selection-core.js`
  - 選択 tier 判定
  - 選択サマリー更新
  - 選択解除補助
- `scripts/features/50-category-utils.js`
  - カテゴリ正規化
  - カテゴリ色計算
  - 凡例エントリ生成
- `scripts/features/60-category-layer.js`
  - カテゴリ凡例 UI
  - カテゴリレイヤー表示切替
  - カテゴリ用 material 生成
- `scripts/features/70-drawer.js`
  - ドロワー一覧描画
  - ドラッグ & ドロップ並び替え
  - ドロワー開閉
- `scripts/features/80-url-state.js`
  - URL 状態の純粋関数
- `scripts/features/90-persistence.js`
  - localStorage 保存 / 復元
  - URL 共有状態反映
  - camera 状態復元
- `scripts/features/100-action-menu.js`
  - 3D action icon の生成 / レイアウト
  - action menu の open / close
  - action icon raycast
  - 選択コミット

### visuals
- `scripts/visuals/10-textures-and-labels.js`
  - テキストテクスチャ
  - スプライト
  - 床文字
  - ポータル三角形
  - コンクリートテクスチャ
- `scripts/visuals/20-hall-architecture.js`
  - 会場外装・柱・梁・シャッター・番号塔など
- `scripts/visuals/30-layout-and-overlay.js`
  - ホール座標変換
  - ホール床面生成
  - 特設矩形生成
  - 外枠マーカー
  - overlay 描画補助

### tests
- `tests/10-deps-stub.js`
  - 検証専用の Three.js / OrbitControls stub
- `tests/20-verify-runtime.py`
  - Playwright を使って headless Chromium で起動し、pageerror / console error / `#errorBox` を検査する
- `tests/30-verify-runtime-result.json`
  - 直近の検証結果サンプル
- `tests/40-verify-runtime.png`
  - 検証時に保存したスクリーンショット

## `00-app.js` に残しているもの

- Scene / Camera / Renderer / Controls の初期化
- ページ全体のオーケストレーション
- ブース mesh の生成
- material 更新の最終合成
- info panel 更新
- pointer / raycast / animation loop

これは shared state が多く、ここをさらに一気に分割すると壊れやすいため、今回は **責務の境界が比較的明快な部分を先に外出し**しています。

## 既知の修正点

前回版までで見つかった以下を修正済みです。

- `00-app.js` の `removeBoothIdFromSelections` 重複宣言
- `rebuildRoutes` 未定義参照
- `updateHallArchitectureVisibility` の呼び出し引数不整合

## 検証

### 静的検証

確認済み:

- `node --check` による **全 JS module の構文確認**
- 全 local import パスの解決確認
- `core/dom.js` が参照する `id` と `index.html` の DOM ID 整合性確認

### runtime 検証

この環境では外部 DNS 制約のため、本番用 `10-deps.js` が読む CDN (`esm.sh`) には到達できません。
そのため、**本番コードはそのままに**、検証時のみ `tests/10-deps-stub.js` を差し込む方式で Playwright 実行確認を行っています。

確認済み:

- headless Chromium 起動
- `index.html` のロード
- `scripts/00-app.js` を含むローカル module 群の読み込み
- `pageerror` が 0 件
- `#errorBox` が空文字であること
- 検証スクリーンショット保存

検証コマンド:

```bash
python3 tests/20-verify-runtime.py
```

### 検証結果の読み方

- `ok: true` なら、少なくともこの offline stub 実行では **アプリ本体の JS 例外は出ていません**。
- 本番 CDN への疎通そのものは、この環境では確認不能です。
- したがって、この版は
  - 分割後のローカルコード整合性
  - 実行時フロー上の主要な JS 例外の不在
  までは確認済みです。
