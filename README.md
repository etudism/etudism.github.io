# etudism.github.io 共同開発ガイド

このドキュメントは、**`etudism/etudism.github.io` リポジトリを複数人で安全に開発していくための README** です。

初心者の人でも迷いにくいように、

- どういう手順で開発するか
- 開発時のルール
- うまく進めるコツ
- GitHub の画面のどこを押せばよいか
- ChatGPT や Codex をどう使うと安全か
- よく使うテンプレートをどう整備するとよいか

を、できるだけ具体的にまとめています。

---

# 0. まず最初に把握しておくこと

このリポジトリは、**GitHub Pages 用の公開リポジトリ**として使えます。現在、リポジトリは **`main` ブランチ**で運用されており、公開状態は **Public** です。

現在の `CAETA` は、以前のような単一の `app.js` と `styles.css` を中心にした構成ではなく、**ES Modules で機能ごとに分割された構成**に更新されています。

現在の CAETA では、少なくとも次の考え方で構成されています。

- `index.html` は画面骨組み
- `styles/main.css` は CSS 全体
- `scripts/data.js` は会場データ
- `scripts/runtime/parts/*.js` はブラウザが直接 import する実行用 ES module パーツ
- `scripts/source-parts/*.js` は編集しやすい元コード断片
- `scripts/runtime/startApp.js` が各 part module を順番に実行して起動する

また、`scripts/app.js` は `scripts/runtime/startApp.js` を呼び出す **起動入口** になっています。

つまり現在の CAETA は、**見た目・データ・起動・実行時分割・編集用断片**が分かれた、かなり保守しやすい構成です。  
README や作業手順を書くときは、**古い `CAETA/styles.css` や `CAETA/app.js` 前提で説明しない**ことが重要です。

---

# 1. 現在の CAETA の構成を初心者向けに理解する

まずは、現在の CAETA の構成をざっくり把握しましょう。

```txt
CAETA/
  index.html
  README.md
  styles/
    main.css
  scripts/
    app.js
    data.js
    runtime/
      createContext.js
      executePart.js
      startApp.js
      parts/
        00-prelude-and-helpers.js
        01-theme-and-scene-state.js
        02-textures-icons-and-labels.js
        03-hall-architecture.js
        04-layout-and-overlay.js
        05-routing-and-search.js
        06-category-and-selection-basics.js
        07-drawer-and-dragdrop.js
        08-url-state-and-persistence.js
        09-action-menu.js
        10-materials-and-info-panel.js
        11-selection-focus-and-events.js
        12-raycast-resize-and-main-loop.js
    source-parts/
      （人が編集しやすい元コード断片）
```

## 1-1. 各ファイル・各フォルダの役割

### `CAETA/index.html`
画面の土台になる HTML です。  
ただし、アプリ本体のロジックを大量に書く場所ではありません。  
**「何を読み込むか」を定義する入口のひとつ**と考えるとわかりやすいです。

### `CAETA/styles/main.css`
CAETA 全体の見た目を担当する CSS です。  
旧構成の `styles.css` ではなく、今は `styles/main.css` にまとまっています。

### `CAETA/scripts/data.js`
会場データや表示・計算に必要なデータを持つ場所です。  
レイアウトやブース情報の元になるデータは、まずここを疑うと整理しやすいです。

### `CAETA/scripts/app.js`
起動入口です。  
今は非常に薄く、`startApp()` を呼び出す役割だけに近いです。  
つまり、**「最初に始める係」**です。

### `CAETA/scripts/runtime/`
実行時の仕組みです。  
アプリを動かすための共通コンテキスト生成や、各 part の実行順制御などを担当します。

- `createContext.js` … 共有コンテキストを作る
- `executePart.js` … 各 part を実行する
- `startApp.js` … part module を順番に読み込み、アプリ全体を起動する

### `CAETA/scripts/runtime/parts/`
ブラウザが実際に読む、**機能ごとに分割された実行用 ES module** です。  
機能名がファイル名にかなり反映されているので、初心者でも比較的追いやすいです。

例:
- `03-hall-architecture.js` … ホール建築要素
- `05-routing-and-search.js` … ルート計算と検索
- `07-drawer-and-dragdrop.js` … ドロワーとドラッグ＆ドロップ
- `10-materials-and-info-panel.js` … マテリアル反映と情報パネル
- `12-raycast-resize-and-main-loop.js` … raycast、resize、起動、ループ

### `CAETA/scripts/source-parts/`
**人が編集しやすい元コード断片**です。  
共同開発では、まずこちらを読む・触る前提にしておくと安全です。

---

# 2. このリポジトリでのおすすめ開発フロー

結論から言うと、**「いきなり `main` を直接編集しない」**ことが最重要です。

おすすめは次の流れです。

1. `main` から **自分専用の branch（ブランチ）** を作る
2. そのブランチで編集する
3. ローカルで動作確認する
4. 変更内容を GitHub に送る（push / プッシュ）
5. **Pull Request（プルリクエスト）** を作る
6. 他の人が確認する
7. 問題なければ `main` に取り込む（merge / マージ）

この流れにすると、

- 誰が何を変えたか追いやすい
- 壊れたときに原因を特定しやすい
- レビューできる
- 公開中の `main` を不用意に壊しにくい

というメリットがあります。

---

# 3. GitHub の基本用語（初心者向け）

## Repository（リポジトリ）
コードやファイル一式の保管場所です。  
この場合は **`etudism/etudism.github.io`** がリポジトリです。

## Branch（ブランチ）
作業用の分岐です。`main` を本番の幹とすると、枝分かれした作業コピーがブランチです。

例:
- `main` … 本番用
- `feature/caeta-ui-update` … CAETA の UI 改善用
- `docs/readme-update` … README 更新用

## Commit（コミット）
「この変更をひとかたまりとして記録する」という保存単位です。  
単なる上書き保存ではなく、**変更履歴として残る保存**です。

## Push（プッシュ）
自分の PC 上の変更を GitHub 上のリポジトリへ送ることです。

## Pull Request（PR / プルリクエスト）
「この変更を `main` に取り込んでください」と提案する仕組みです。  
レビューや相談の場にもなります。

## Merge（マージ）
ブランチの変更を `main` に取り込むことです。

## Conflict（コンフリクト）
同じ箇所を別の人が同時に変更したときの衝突です。

## Clone（クローン）
GitHub 上のリポジトリを自分の PC に丸ごとコピーして持ってくることです。

## Fork（フォーク）
元のリポジトリを、自分のアカウント側に別コピーとして作ることです。  
**このリポジトリの共同開発では、まずは Fork より Branch 運用を優先**するのがおすすめです。

---

# 4. 役割分担の考え方

複数人開発では、最初に役割をざっくり分けておくと事故が減ります。

おすすめ例:

- **管理者（Maintainer）**
  - `main` にマージする
  - ルールを決める
  - 最終確認する
- **開発者（Contributor）**
  - 自分のブランチで作業する
  - Pull Request を出す
- **デザイナー / 企画 / 確認担当**
  - Issue を書く
  - 動作確認する
  - 文言や UI をチェックする

人数が少ない場合でも、**「作る人」と「main に入れる最終判断をする人」を意識的に分ける**だけでかなり安全になります。

---

# 5. 開発ルール（最低限これだけは守る）

## 5-1. `main` に直接コミットしない
**原則として `main` へ直接編集しない**でください。  
必ずブランチを切って作業します。

## 5-2. 1つのブランチでは 1つの目的だけ扱う
悪い例:
- UI 修正
- データ更新
- バグ修正
- README 修正

を全部ひとつのブランチでやる。

良い例:
- `feature/caeta-search-ui`
- `fix/caeta-route-bug`
- `docs/readme-update`

のように、**1ブランチ1目的**にする。

## 5-3. ブランチ名をわかりやすくする
おすすめ形式:

- `feature/機能名`
- `fix/不具合名`
- `docs/文書名`
- `refactor/整理内容`

例:

- `feature/caeta-map-filter`
- `fix/caeta-hover-bug`
- `docs/collaboration-readme`

## 5-4. コミットメッセージをわかりやすく書く
悪い例:
- `update`
- `fix`
- `aaa`

良い例:
- `CAETA: ドロワーUIを調整`
- `CAETA: ルート描画時の障害物判定を修正`
- `README: 最新の CAETA 構成を反映`

## 5-5. Pull Request には説明を書く
最低限、以下を書きます。

- 何を変えたか
- なぜ変えたか
- どこを見ればよいか
- 確認方法
- 未解決のことがあるか

## 5-6. いきなり大改修しない
大きな変更は次の順で進めます。

1. まず Issue で相談
2. 方針を決める
3. 小さく分けて実装
4. PR ごとに確認

---

# 6. 現在の CAETA ではどこを触ると安全か

現在の構成では、**「何を変えたいか」で触る場所を決める**のが大切です。

## 6-1. 見た目を変えたいとき
主に触る場所:

- `CAETA/styles/main.css`
- `CAETA/scripts/source-parts/02-textures-icons-and-labels.js`
- `CAETA/scripts/source-parts/10-materials-and-info-panel.js`

## 6-2. Three.js や空間表現を直したいとき
主に触る場所:

- `CAETA/scripts/source-parts/00-prelude-and-helpers.js`
- `CAETA/scripts/source-parts/03-hall-architecture.js`
- `CAETA/scripts/source-parts/04-layout-and-overlay.js`
- `CAETA/scripts/source-parts/12-raycast-resize-and-main-loop.js`

## 6-3. UI や操作感を直したいとき
主に触る場所:

- `CAETA/scripts/source-parts/07-drawer-and-dragdrop.js`
- `CAETA/scripts/source-parts/09-action-menu.js`
- `CAETA/scripts/source-parts/10-materials-and-info-panel.js`
- `CAETA/scripts/source-parts/11-selection-focus-and-events.js`

## 6-4. 検索やルート計算を直したいとき
主に触る場所:

- `CAETA/scripts/source-parts/05-routing-and-search.js`
- `CAETA/scripts/source-parts/06-category-and-selection-basics.js`

## 6-5. URL 共有や保存復元を直したいとき
主に触る場所:

- `CAETA/scripts/source-parts/08-url-state-and-persistence.js`

## 6-6. 起動順や構成そのものを変えたいとき
主に触る場所:

- `CAETA/scripts/app.js`
- `CAETA/scripts/runtime/createContext.js`
- `CAETA/scripts/runtime/executePart.js`
- `CAETA/scripts/runtime/startApp.js`

ここは土台に近いので、**初心者は最初から大きく触らない**ほうが安全です。

---

# 7. 開発のコツ

## 7-1. 変更範囲を小さくする
1回の PR が大きすぎると、レビューが大変になり、壊れても原因がわかりません。  
**「1つの PR で 1テーマ」**が基本です。

## 7-2. まず動く最小版を作る
最初から完成版を目指すより、

- まず表示だけ
- 次にクリックだけ
- 次に保存機能
- 最後に見た目調整

のように、小さく積み上げる方が成功率が高いです。

## 7-3. 実行用ファイルと編集用ファイルを混同しない
現在の CAETA では、

- `runtime/parts/` … 実行用
- `source-parts/` … 編集用

という考え方があります。  
チーム内でどちらを正本として扱うかを決めておくと事故が減ります。  
少なくとも初心者向けには、**まず `source-parts/` を読む**と説明しておくのが安全です。

## 7-4. 先に Issue を立てる
いきなり作業するより、先に Issue を作ると整理しやすいです。

例:
- 「CAETA: 検索 UI を改善したい」
- 「CAETA: ドロワー操作を見直したい」
- 「CAETA: ルート計算が重い原因を調べたい」

## 7-5. 完成前でも早めに共有する
途中でも Pull Request を出してかまいません。  
「Draft PR（下書き PR）」でもよいです。  
早めに見せるほど、方向違いを早く直せます。

---

# 8. 一番おすすめの運用ルール

初心者が混ざるチームなら、最初は次のルールが最も安全です。

## 基本方針
- 本番は `main`
- 作業は必ず自分の branch
- 完了したら Pull Request
- 少なくとも1人が確認してから merge

## 追加で決めておくとよいこと
- PR のタイトルの書き方
- コミットメッセージの書き方
- どのファイル群を主に触るか
- `source-parts` を編集基準にするか
- CSS 命名ルール

---

# 9. GitHub の Web 画面だけで作業する方法

これは**アプリを入れずにブラウザだけで作業する方法**です。  
小さな修正や README 修正には向いています。

## 9-1. リポジトリを開く
ブラウザで以下を開きます。

- `https://github.com/etudism/etudism.github.io`

このページでは、上の方に次のタブがあります。

- `Code`
- `Issues`
- `Pull requests`
- `Actions`
- `Projects`
- `Security`
- `Insights`

普段もっとも使うのは **`Code` / `Issues` / `Pull requests`** です。

## 9-2. ブランチを作る
1. リポジトリの **`Code` タブ** を開く
2. ファイル一覧の上あたりにある、現在のブランチ名（通常 `main`）が表示された **ブランチ切り替えドロップダウン** を押す
3. 新しいブランチ名を入力する
4. `Create branch: ブランチ名 from 'main'` のような項目が出たら選ぶ

## 9-3. ファイルを編集する
編集したいファイルを開きます。

例:
- `README.md`
- `CAETA/styles/main.css`
- `CAETA/scripts/source-parts/...`

ファイルを開くと、右上付近に **鉛筆アイコン（Edit this file）** が出ます。  
それを押すと編集画面に入れます。

画面幅が狭いと、編集ボタンが `...` メニューの中に入ることがあります。  
その場合はファイル画面右上の **`...`（More options）** を押してください。

## 9-4. 変更を保存する（コミットする）
編集後、画面の上または下のほうに **`Commit changes...`** ボタンがあります。

そこを押すと、

- Commit message
- Extended description

を入力する画面が出ます。

例:
- Commit message: `README: 最新の CAETA 構成を反映`
- Extended description: `styles/main.css と scripts/runtime 構成に合わせて説明を更新`

## 9-5. Pull Request を作る
ブランチにコミットしたあと、GitHub 画面上部に **`Compare & pull request`** の通知が出ることがあります。出たらそれを押すのが最短です。

出ない場合は、上部タブの **`Pull requests`** を開き、右上付近の **`New pull request`** を押します。

その後、

- base: `main`
- compare: 自分のブランチ

になっていることを確認します。

## 9-6. レビューして `main` に取り込む
レビュー担当者は Pull Request を開き、差分や説明を確認します。  
問題なければ **`Merge pull request`** を押します。

その後、必要なら **`Delete branch`** を押して作業ブランチを消します。

---

# 10. GitHub Desktop を使う方法

これは**初心者にかなりおすすめ**です。  
ブラウザだけよりミスが減りやすく、VS Code とも相性がよいです。

## 10-1. GitHub Desktop とは
GitHub の公式デスクトップアプリです。  
Git コマンドを打たなくても、

- clone
- branch 作成
- commit
- push
- pull request

が比較的わかりやすくできます。

## 10-2. 最初にやること
1. GitHub Desktop をインストールする
2. GitHub アカウントでサインインする
3. リポジトリをクローンする

## 10-3. リポジトリをクローンする手順
### GitHub のブラウザ側でやること
1. `https://github.com/etudism/etudism.github.io` を開く
2. `Code` タブを開く
3. ファイル一覧の上にある **緑色の `Code` ボタン** を押す
4. 表示されたメニューから **`Open with GitHub Desktop`** を選ぶ

### GitHub Desktop 側でやること
1. 保存先フォルダを選ぶ
2. `Clone` を押す

## 10-4. ブランチを作る
GitHub Desktop の上部バー付近に現在のブランチ名が表示されます。  
通常は `Current Branch` という表示があります。

1. **`Current Branch`** をクリック
2. **`New Branch`** を選ぶ
3. ブランチ名を入力
4. `Create Branch` を押す

## 10-5. VS Code で開く
GitHub Desktop 上部メニューや中央付近に **`Open in Visual Studio Code`** が出ることがあります。  
それを押すと VS Code で開けます。

## 10-6. 変更をコミットする
1. ファイルを編集する
2. GitHub Desktop に戻る
3. 左側に変更ファイル一覧が出る
4. 左下の **`Summary (required)`** にコミットタイトルを書く
5. 必要なら **`Description`** に説明を書く
6. **`Commit to branch名`** を押す

## 10-7. GitHub に送る（Push）
コミット後、上部に **`Push origin`** ボタンが出ます。  
それを押すと GitHub 側へ送信できます。

## 10-8. Pull Request を作る
Push 後、上部または中央に **`Create Pull Request`** ボタンが出ます。  
それを押すと GitHub 上の PR 作成画面に進めます。

---

# 11. VS Code を使う方法

これは**本格的にコードを書く人におすすめ**です。  
HTML / CSS / JavaScript を触るなら、いちばん作業しやすいことが多いです。

## 11-1. VS Code とは
Microsoft のコードエディタです。  
コード補完、検索、置換、拡張機能が強いです。

## 11-2. 最低限入れるとよいもの
- VS Code 本体
- GitHub Desktop（初心者なら併用推奨）
- 拡張機能 `Live Server` または類似のローカルサーバー拡張
- 拡張機能 `GitHub Pull Requests and Issues`
- 拡張機能 `Prettier`（コード整形）

## 11-3. リポジトリを開く
クローン済みフォルダを VS Code で開きます。

- メニュー `File` → `Open Folder...`
- クローンした `etudism.github.io` フォルダを選ぶ

## 11-4. どのファイルを開けばよいか
初心者は目的ごとに開く場所を分けるとわかりやすいです。

- README を直す → `README.md`
- 見た目を直す → `CAETA/styles/main.css`
- データを直す → `CAETA/scripts/data.js`
- 機能を直す → `CAETA/scripts/source-parts/...`
- 起動構造を直す → `CAETA/scripts/runtime/...`

## 11-5. ローカルで動作確認する
HTML をそのままダブルクリックで開くより、**ローカルサーバーで確認**した方が安全です。

### Live Server を使う例
1. `CAETA/index.html` を開く
2. VS Code 右下の **`Go Live`** を押す
3. ブラウザで表示確認する

JavaScript のモジュール構成では、ローカルサーバーでないと正しく動かないことがあります。

## 11-6. コミットする
1. 左側の **ソース管理アイコン** を押す
2. 変更ファイルを確認する
3. メッセージ入力欄にコミットメッセージを書く
4. **`Commit`** を押す

## 11-7. Push / Pull する
ソース管理画面や下部ステータスバーから同期できます。  
初心者は GitHub Desktop から Push しても大丈夫です。

---

# 12. ChatGPT を使って開発する方法

ChatGPT は、**コードを書かせる道具**というより、まずは**設計相談・分割・レビュー・説明補助の道具**として使うのがおすすめです。

## 12-1. ChatGPT に向いている作業
- README を書く
- バグ原因の仮説出し
- コードの分割案を出す
- CSS の整理案を出す
- 初心者向けの説明を書く
- 関数名やフォルダ構成を考える
- Pull Request 文面を作る
- コミットメッセージ案を出す

## 12-2. ChatGPT に投げるときのコツ
### 良い頼み方
- どのファイルを触るのかを書く
- 何が問題かを書く
- 期待する完成形を書く
- 可能なら、関連ファイルもまとめて見せる

例:

```txt
CAETA/scripts/source-parts/05-routing-and-search.js の検索ロジックを改善したいです。
関連しそうな 06-category-and-selection-basics.js も踏まえて、
どこをどう分けて直すと安全か提案してください。
```

### 悪い頼み方
- `直して`
- `いい感じにして`
- `動かない`

これだと、AI も人間も状況を把握しづらいです。

## 12-3. ChatGPT を使うときのルール
- **AI が出したコードをそのまま `main` に入れない**
- 必ず自分で動作確認する
- 差分を小さくして PR に分ける
- どこを AI が作ったかチームで把握しておく

## 12-4. ChatGPT のおすすめ使い方
### 使い方A: 仕様相談
「どう分割すべきか」「どういう設計が安全か」を相談する。

### 使い方B: たたき台生成
HTML / CSS / JS の下書きを作らせる。

### 使い方C: レビュー係
書いたコードを見せて、

- バグがないか
- 読みにくいか
- 無駄があるか

を確認させる。

### 使い方D: PR 文や README 生成
実装以外の文書整備にも向いています。

## 12-5. ChatGPT のツール機能で GitHub リポジトリを直接読ませて作業する方法

ChatGPT には、**GitHub リポジトリを直接読み込んで、構造を確認しながら相談・レビュー・修正提案を進める**使い方があります。

この方法を使うと、ファイル本文を毎回すべて貼らなくても、

- どのファイルが入口か
- どのファイルがどの役割か
- どこを直すべきか
- README と実装が食い違っていないか

を、ChatGPT 側で確認しながら話を進めやすくなります。

特に現在の CAETA のように、

- `styles/main.css`
- `scripts/app.js`
- `scripts/data.js`
- `scripts/runtime/...`
- `scripts/source-parts/...`

のような**複数層の構成**では有効です。

### 12-5-1. できること
- リポジトリ構造の要約
- どのファイルを触るべきかの整理
- README と実装の対応関係の確認
- 大きすぎる機能の分割案作成
- 特定ファイルのレビュー
- 修正方針の提案
- PR 用の説明文作成
- 初心者向けの作業手順の言語化

### 12-5-2. 最初にやらせるとよい依頼
いきなり「直して」ではなく、まず**読ませて要約させる**のがおすすめです。

例:

```txt
GitHub の etudism/etudism.github.io リポジトリを読んで、
最新の CAETA 構成を整理してください。
特に、
- index.html
- styles/main.css
- scripts/app.js
- scripts/runtime
- scripts/source-parts
の役割を初心者向けに説明してください。
```

### 12-5-3. 次にやらせるとよい依頼
例1: README 加筆

```txt
この最新構成を踏まえて、
README の CAETA 構成説明を更新してください。
古い app.js / styles.css 前提の説明は削ってください。
```

例2: 設計相談

```txt
CAETA/scripts/source-parts の責務分割を見直したいです。
検索、選択、UI 周りをどの単位で分けると安全か提案してください。
```

例3: レビュー

```txt
CAETA/scripts/runtime/startApp.js と scripts/app.js の関係を見て、
初心者が壊しやすい箇所を指摘してください。
```

### 12-5-4. 依頼するときに必ず書いたほうがよいこと
- どのフォルダが対象か
- どのファイルを中心に見てほしいか
- 何をしたいか
- 変更してよい範囲
- 変更してはいけない範囲
- 初心者向けか、実装者向けか

例:

```txt
対象は CAETA フォルダです。
主に styles/main.css と scripts/source-parts を見てください。
目的は、初心者にも保守しやすい構成にすることです。
見た目を大きく変えるのではなく、責務整理を優先してください。
説明は初心者向けにしてください。
```

### 12-5-5. ただし注意点
便利ですが、次の点には注意してください。

- ChatGPT が読める範囲と権限には限りがある
- 見落としや誤読が起きることはある
- 提案されたコードが必ずしも最適とは限らない
- AI の出力をそのまま本番へ入れない
- 必ず差分確認・動作確認をする
- `main` ではなく作業ブランチで検証する

---

# 13. Codex を使って開発する方法

> ここでいう Codex は、OpenAI のコーディング支援製品群を指します。

Codex は、**コードベースを読ませて、修正提案や実装を進める**のに向いています。ChatGPT よりも、より実装寄りの使い方がしやすい場面があります。

## 13-1. Codex の基本的な考え方
Codex は、選んだフォルダや Git リポジトリを対象に作業できます。  
そのため、**`etudism.github.io` をローカルにクローンしてから使う**流れが基本です。

## 13-2. Codex を使う前の準備
1. リポジトリを PC にクローンする
2. `main` ではなく作業ブランチに切り替える
3. そのフォルダを Codex の対象にする

## 13-3. Codex に向いている依頼
- `source-parts の責務を整理して`
- `このバグの原因を調べて`
- `styles/main.css を整理して`
- `README を更新して`
- `runtime/startApp.js の起動順を説明して`

## 13-4. Codex を使うときの注意
- 一気に大量変更させない
- 変更前後の差分を必ず確認する
- まず小タスク単位で依頼する
- `main` ではなく作業ブランチで使う
- 生成結果を自分で動かして確認する

---

# 14. GitHub 上で Issue を使ってタスク管理する方法

共同開発では、口頭だけで進めるとすぐ抜け漏れが出ます。  
**Issue をタスク票として使う**のがおすすめです。

## 14-1. Issue を作る場所
1. リポジトリ上部の **`Issues`** タブを開く
2. 右側または右上付近の **`New issue`** を押す

## 14-2. Issue に書く内容
例:

```md
## やりたいこと
CAETA の検索機能を改善したい

## 背景
現在の構成では検索ロジックと選択ロジックの責務が分かりにくい

## 作業案
- search 周りの責務整理
- UI 反映箇所の確認
- README への追記

## 完了条件
- 検索結果が正しく反映される
- UI が崩れない
- 説明が README に反映される
```

## 14-3. Issue の使い方のコツ
- 1 Issue = 1テーマ
- 実装前に Issue を立てる
- PR に Issue 番号を書く

例:
- `Closes #12`
- `Refs #8`

---

# 15. Pull Request の書き方

## 15-1. 良い PR の条件
- 何をしたかが一目でわかる
- 変更範囲が狭い
- 確認方法が書いてある
- スクリーンショットがある
- 未解決点が明記されている

## 15-2. PR テンプレート例

```md
## 概要
CAETA の README と構成説明を最新化しました。

## 背景
旧構成前提の説明が残っていたため、現在の ES Modules 構成に合わせて更新したい

## 変更内容
- styles/main.css 前提に修正
- scripts/runtime と source-parts の説明を追加
- ChatGPT で GitHub を直接読ませる方法を整理

## 確認方法
1. README.md を開く
2. CAETA/README.md の内容と矛盾がないか確認する
3. 古い app.js / styles.css 前提の説明が残っていないか確認する

## 影響範囲
- README.md

## 未解決
- 将来さらに構成が変わった場合は CAETA/README.md と一緒に更新が必要
```

---

# 16. このリポジトリでおすすめのフォルダ整理の考え方

今後 HTML やアプリが増えるなら、**1アプリ = 1フォルダ** の方針は引き続き有効です。

現在の CAETA のように、アプリごとの中でさらに

- HTML
- styles
- scripts
- runtime
- source-parts

のように役割分担するのは、かなりよい整理方法です。

## ルール案
- 1アプリ = 1フォルダ
- アプリごとに README を置く
- 見た目は `styles/`
- 起動入口は `scripts/app.js`
- 実行時の仕組みは `scripts/runtime/`
- 人が編集しやすい断片は `scripts/source-parts/`

---

# 17. チームで最初に決めておくとよいこと

## 必須
- `main` 直コミット禁止かどうか
- レビュー必須かどうか
- だれがマージ権限を持つか

## できれば決めたい
- ブランチ名ルール
- コミットメッセージルール
- PR テンプレート
- Issue テンプレート
- `source-parts` を編集基準にするか
- コード整形ルール
- CSS 命名ルール

---

# 18. 初心者チーム向けの現実的なおすすめ構成

迷ったら、最初はこの運用で十分です。

## ツール構成
- GitHub: リポジトリ管理、Issue、PR
- GitHub Desktop: clone / branch / commit / push
- VS Code: 編集
- ChatGPT: 相談、文書、レビュー
- Codex: 小さな実装支援

## 実際の流れ
1. GitHub Desktop で clone
2. 新しいブランチを作る
3. VS Code で編集
4. ブラウザで動作確認
5. GitHub Desktop で commit / push
6. GitHub で Pull Request を作る
7. レビュー後に merge

この流れが、初心者にも一番事故が少ないです。

---

# 19. 公開（GitHub Pages）について

GitHub Pages は、**特定の branch と folder を公開元にしてサイトを公開**できます。  
通常はリポジトリの **`Settings` → `Pages`** で設定します。

確認ポイント:
- どの branch を公開元にするか
- ルート `/` を公開するか
- 特定フォルダを公開するか

このリポジトリが GitHub Pages 用で運用される場合、`main` に入った変更が公開サイトに反映される前提になりやすいので、**`main` を壊さない運用**が特に重要です。

---

# 20. よくある失敗

## 20-1. `main` で直接作業してしまう
最も危険です。

## 20-2. 1つの PR が大きすぎる
レビュー不能になります。

## 20-3. 何を変えたか説明しない
後から誰も追えません。

## 20-4. AI が作ったコードを未確認で入れる
動かない、壊れる、設計が崩れる原因になります。

## 20-5. `runtime` と `source-parts` の違いを理解せずに触る
どこを正本にするのか曖昧だと、保守で混乱しやすくなります。

## 20-6. ブラウザ確認をしない
特に HTML / CSS / JavaScript は、保存しただけでは安心できません。  
必ずブラウザで見ます。

---

# 21. この README の運用方法

この README は一度書いて終わりではなく、**チームの実態に合わせて更新**してください。

特にこのリポジトリでは、**CAETA の構成変更が起きたら、ルートの README も一緒に更新する**のが大切です。

たとえば、今後以下を追加してよいです。

- PR テンプレート
- Issue テンプレート
- レビュー観点チェックリスト
- フォルダ構成一覧
- デプロイ手順
- 画面キャプチャ付き手順書

---

# 22. 最後に：このリポジトリでの推奨方針

このリポジトリを複数人で育てるなら、最初は次の方針が最適です。

## 推奨方針
- **編集は VS Code**
- **Git 操作は GitHub Desktop**
- **管理は GitHub の Issue / PR**
- **相談と整理は ChatGPT**
- **実装支援は Codex を小さく使う**

## 最重要ルール
- `main` に直接入れない
- 必ず branch を切る
- PR を作る
- 動作確認してから merge する

この4つを守るだけで、共同開発の事故はかなり減ります。

---

# 23. すぐ使える最小チェックリスト

## 作業前
- [ ] いま `main` ではなく自分の branch にいる
- [ ] 何をやるか Issue またはメモで明確
- [ ] どのファイルを触るか決めた

## 作業中
- [ ] 変更範囲が広がりすぎていない
- [ ] `source-parts` と `runtime` の役割を混同していない
- [ ] ブラウザで動作確認した

## コミット前
- [ ] コミットメッセージが具体的
- [ ] 不要なファイルが混ざっていない

## PR 前
- [ ] 何を変えたか説明を書いた
- [ ] どこを確認すればよいか書いた
- [ ] 影響範囲を書いた

## マージ前
- [ ] 少なくとも一度は見直した
- [ ] `main` を壊さないと確認した

---

# 24. あると便利なテンプレート集

共同開発では、毎回ゼロから文章を書くより、**テンプレートを用意して使い回す**方が安全です。  
特に初心者チームでは、

- 書き漏れを減らせる
- 何を書けばよいか迷いにくい
- レビューする側も見やすい
- AI に依頼するときの精度も上がる

というメリットがあります。

このリポジトリでは、最低限次のテンプレートがあると便利です。

- Pull Request テンプレート
- Issue テンプレート（バグ報告）
- Issue テンプレート（機能追加）
- Issue テンプレート（作業タスク）
- ChatGPT / Codex 依頼テンプレート
- コミットメッセージの書き方テンプレート

## 24-1. Pull Request テンプレート
保存場所の例:

```txt
.github/pull_request_template.md
```

内容例:

```md
## 概要
<!-- この PR で何をしたかを一言で書いてください -->

## 背景
<!-- なぜこの変更が必要だったのかを書いてください -->

## 変更内容
- 
- 
- 

## 確認方法
1. 
2. 
3. 

## 影響範囲
- 
- 

## 未解決・補足
<!-- 未対応のこと、あとで見たいことがあれば書いてください -->
```

## 24-2. Issue テンプレート
保存場所の例:

```txt
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
.github/ISSUE_TEMPLATE/task.md
```

### バグ報告テンプレート例

```md
---
name: Bug report
about: 不具合の報告
title: "[Bug] "
labels: bug
assignees: ''

---

## 何が起きたか
<!-- どんな不具合かを具体的に書いてください -->

## 期待していた動作
<!-- 本来どう動くはずだったかを書いてください -->

## 再現手順
1. 
2. 
3. 

## 発生場所
- ファイル:
- 画面:
- 機能:

## 補足
<!-- エラーメッセージ、スクリーンショット、動画などがあれば追加してください -->
```

### 機能追加テンプレート例

```md
---
name: Feature request
about: 機能追加や改善の提案
title: "[Feature] "
labels: enhancement
assignees: ''

---

## やりたいこと
<!-- 追加したい機能や改善内容を書いてください -->

## 背景
<!-- なぜ必要なのかを書いてください -->

## 想定する変更場所
- 
- 

## 完了条件
- 
- 

## 補足
<!-- 参考URLや関連Issueがあれば書いてください -->
```

### 作業タスクテンプレート例

```md
---
name: Task
about: 単純な作業タスク
title: "[Task] "
labels: task
assignees: ''

---

## 作業内容
<!-- やることを簡潔に書いてください -->

## 対象ファイル
- 
- 

## 完了条件
- 
- 

## 補足
<!-- 注意点があれば書いてください -->
```

## 24-3. ChatGPT / Codex 用の依頼テンプレート
チーム内メモや `docs/` 配下に置いておくと便利です。

保存場所の例:

```txt
docs/ai-prompt-templates.md
```

### 構造把握を依頼するとき

```txt
GitHub の etudism/etudism.github.io リポジトリを読んで、
対象フォルダの構造を初心者向けに整理してください。

対象:
- CAETA

特に知りたいこと:
- どのファイルが入口か
- どのファイルが見た目担当か
- どのファイルが機能担当か
- どこを触ると安全か
```

### バグ調査を依頼するとき

```txt
次の不具合の原因を調べてください。

症状:
- 

対象ファイル:
- 

期待すること:
- 原因候補を整理する
- まずどこを確認すべきか順番を出す
- できれば最小修正案を出す
```

### README 更新を依頼するとき

```txt
リポジトリの最新構成を踏まえて、README を更新してください。

条件:
- 初心者にもわかる説明にする
- 古い構成前提の説明は削る
- ファイルの役割を具体的に書く
- 共同開発で安全に使える内容にする
```

### 分割・設計相談を依頼するとき

```txt
次のファイルの責務が大きすぎるので、どう分割すると安全か提案してください。

対象:
- 

条件:
- 既存の挙動をできるだけ変えない
- 初心者でも追いやすい分割にする
- 変更箇所を小さくできる案を優先する
```

### PR 文面作成を依頼するとき

```txt
以下の変更内容をもとに、GitHub の Pull Request 文面を書いてください。

変更内容:
- 

含めたい項目:
- 概要
- 背景
- 変更内容
- 確認方法
- 影響範囲
- 未解決事項
```

## 24-4. コミットメッセージの簡易ルール
README の中にそのまま書いておいても構いません。

おすすめ形式:

```txt
対象: 変更内容
```

例:
- `CAETA: 検索結果リストのUIを調整`
- `CAETA: ドロワー操作時の不具合を修正`
- `README: 最新のCAETA構成を反映`
- `docs: AI依頼テンプレートを追加`

避けたい例:
- `update`
- `fix`
- `aaa`
- `いろいろ変更`

## 24-5. テンプレートを使うときのコツ
- 最初は細かすぎるテンプレートにしない
- チームが実際に使う項目だけ残す
- 使われない項目は減らす
- README とテンプレートの内容が矛盾しないようにする
- CAETA の構成変更があったら、関連テンプレートも見直す
