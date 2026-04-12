# CAETA ES Modules 完全分割版

このZIPは、元の単一HTMLを **実行時にも分割された ES Modules 構成** に整理した版です。

## 構成の考え方

- `index.html` は画面骨組みだけです。
- `styles/main.css` はCSS全体です。
- `scripts/data.js` は巨大な `DATA` です。
- `scripts/runtime/parts/*.js` は、ブラウザが直接 import する **機能別の ES module パーツ**です。
- `scripts/source-parts/*.js` は、編集しやすい元コード断片です。
- `scripts/runtime/startApp.js` が part module を順番に実行して起動します。

## 起動フロー

1. `index.html` が `scripts/app.js` を読み込みます。
2. `scripts/app.js` が `scripts/runtime/startApp.js` を呼びます。
3. `startApp.js` が `scripts/runtime/parts/*.js` を import します。
4. 各 part module が同じ共有コンテキスト上で順番に実行され、元アプリを構築します。

## ファイルの役割

### ルート
- `index.html` : DOM本体
- `styles/main.css` : スタイル全体
- `scripts/data.js` : 会場データ
- `scripts/app.js` : 起動入口

### runtime
- `scripts/runtime/createContext.js` : Three.js, OrbitControls, DATA, browser globals を共有コンテキストに入れる
- `scripts/runtime/executePart.js` : 各 part を共有コンテキスト上で実行するランナー
- `scripts/runtime/startApp.js` : part module を順番に実行する起動本体

### 実行用 ES module パーツ
- `scripts/runtime/parts/00-prelude-and-helpers.js`
  - DOM参照、基本ユーティリティ、scene / renderer / camera / controls 初期化
- `scripts/runtime/parts/01-theme-and-scene-state.js`
  - テーマ切替、基本マテリアル、レイアウト基礎状態
- `scripts/runtime/parts/02-textures-icons-and-labels.js`
  - テキストテクスチャ、アイコン、床ラベル
- `scripts/runtime/parts/03-hall-architecture.js`
  - ホール建築要素
- `scripts/runtime/parts/04-layout-and-overlay.js`
  - 配置、座標変換、オーバーレイラベル
- `scripts/runtime/parts/05-routing-and-search.js`
  - ルート計算と検索ロジック前半
- `scripts/runtime/parts/06-category-and-selection-basics.js`
  - カテゴリ色分け、選択状態の基本処理
- `scripts/runtime/parts/07-drawer-and-dragdrop.js`
  - ドロワー、ドラッグ＆ドロップ
- `scripts/runtime/parts/08-url-state-and-persistence.js`
  - URL共有状態、保存復元
- `scripts/runtime/parts/09-action-menu.js`
  - ブースアクションメニュー
- `scripts/runtime/parts/10-materials-and-info-panel.js`
  - マテリアル反映、情報パネル、カメラフォーカス
- `scripts/runtime/parts/11-selection-focus-and-events.js`
  - 選択操作、イベント配線
- `scripts/runtime/parts/12-raycast-resize-and-main-loop.js`
  - raycast, resize, 起動処理, animation loop

### 編集用ソース断片
- `scripts/source-parts/*.js`
  - 人が触る用の元コード断片です。
  - 実装の責務分担やPR分割にはこちらを見るのがいちばんわかりやすいです。

## 誰がどこを触ると安全か

### デザイナー
- `styles/main.css`
- `scripts/source-parts/02-textures-icons-and-labels.js`
- `scripts/source-parts/10-materials-and-info-panel.js`

### Three.js / 空間担当
- `scripts/source-parts/00-prelude-and-helpers.js`
- `scripts/source-parts/03-hall-architecture.js`
- `scripts/source-parts/04-layout-and-overlay.js`
- `scripts/source-parts/12-raycast-resize-and-main-loop.js`

### UI担当
- `scripts/source-parts/07-drawer-and-dragdrop.js`
- `scripts/source-parts/09-action-menu.js`
- `scripts/source-parts/10-materials-and-info-panel.js`
- `scripts/source-parts/11-selection-focus-and-events.js`

### 状態共有 / URL / 保存担当
- `scripts/source-parts/08-url-state-and-persistence.js`

### 検索 / ルーティング担当
- `scripts/source-parts/05-routing-and-search.js`
- `scripts/source-parts/06-category-and-selection-basics.js`

## 検証メモ

この環境では `three` と `OrbitControls` を外部CDN (`esm.sh`) から読むため、**ネットワーク制限の影響で headless browser 上の完全描画までは実行できませんでした**。
ただし、以下は確認しています。

- 13個の runtime part module がすべて生成されている
- 13個の partCode がすべて `Function(...)` で **構文コンパイル可能**
- ローカル import パスに欠損がない
- `index.html` / `styles/main.css` / `scripts/app.js` / `scripts/runtime/startApp.js` / `scripts/data.js` の参照関係が成立している

したがって、**インターネット接続のある通常のブラウザ / GitHub Pages 環境**では、そのまま実行できる構成です。
