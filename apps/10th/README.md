# 読書を完了するための物語 — PWA PoC

`https://etudism.github.io/10th/` 向けの、終わる場所を読者が選べる連作物語PWAです。物語生成はブラウザー内のローカルLLMで行い、APIキー、アプリケーションサーバー、外部LLM API、アクセス解析を使いません。WebGPUがない端末でも決定論的なデモで全フローを試せます。

このPoCは相談・診断サービスではありません。商用品質の文学性、全ブラウザー対応、クラウド同期、高度な安全評価は対象外です。

## 配置

```text
etudism.github.io/
├── apps/10th/  # Vite + React + TypeScriptの開発ソース（この場所）
└── 10th/       # GitHub Pagesへ含めるproduction build
```

Viteの`base`、PWA scope、manifestの`start_url`はすべて`/10th/`です。`apps/10th/`からのbuildは`../../10th`へ出力します。ルートサイト、`CAETA/`、既存Pages設定は変更しません。

## アーキテクチャ

- React UIは入力、互換性確認、モデル準備、旅立ち、読書、分岐、終了確認、終幕を画面状態として管理します。
- `src/narrative/`が5場面単位の状態機械、決定論的`ScenePlanner`、即時provisional transform、bounded context、plain-text streaming、決定論的fallbackを管理します。
- `NarrativeProvider`の実装は`MockNarrativeProvider`と`WebLLMNarrativeProvider`です。UIと永続化はWebLLM APIを直接参照しません。
- WebLLMは`CreateWebWorkerMLCEngine`とDedicated Web Workerを使います。モデルの準備ボタンを押すまでruntime import・Worker作成・モデル取得を開始せず、同じengineを場面間と新しい物語で再利用します。
- モデル準備と並行してJavaScriptだけで180〜280文字の第一場面を即時表示します。場面の選択と状態差分は`ScenePlan`へ確定し、生成が完了するまでcanonical stateやIndexedDBへ反映しません。
- 場面promptへ渡すのはcompact StoryBible、最大8 facts、3 threads、4 motifs、前大パート要約、rolling summary、直前本文末尾400文字です。初期変換後のscene/ending promptへ`readerInput`原文や全履歴を渡しません。
- scene本文だけは短いplain-text promptでstreamingし、状態更新はclient側で決定論的に行います。Seed互換経路とEndingは構造化JSON、Zod検証、repair 1回を維持します。
- 先読みcacheはcanonical stateと分離し、visibilityとData Saverを確認します。Mockでは両分岐のstale/priority経路を自動検証しますが、WebLLMの並列・先読みは対象WebGPUでの電力・memory・操作待ち時間を実測できていないため既定offです。
- IndexedDB `complete-reading-story-poc` version 1に`sessions`、`settings`、`debug_logs`を作り、進行中セッションを復元します。未知versionや破損データはクラッシュさせず、JSON exportまたは新規開始へ誘導します。
- 固定キーフレーズは生成本文に保存せず、React側で表示します。モデル出力に混入した場合もsanitizerで重複を防ぎます。

## 動作要件

- Node.js `>=22.13.0`（実装・検証時: `v22.13.1`）
- npm `10.9.2`
- ローカルLLM: secure context（HTTPSまたはlocalhost）、WebGPU、対応GPU/driver、十分なメモリー
- デモ: WebGPU不要

採用した主要versionはlockfileで完全に固定しています。

| package           |  version |
| ----------------- | -------: |
| `@mlc-ai/web-llm` | `0.2.84` |
| React / React DOM | `19.2.7` |
| Vite              |  `8.1.4` |
| `vite-plugin-pwa` |  `1.3.0` |
| TypeScript        |  `5.9.3` |
| Zod               |  `4.4.3` |
| Vitest            | `4.1.10` |
| Playwright        | `1.61.1` |

TypeScript 7は、採用時点の`typescript-eslint 8.63.0`のpeer範囲`<6.1.0`外だったため採用していません。

## Installと開発

```bash
cd apps/10th
npm ci
npm run dev -- --host 127.0.0.1
```

Viteが示すoriginの`/10th/`を開きます。モックを明示するURLは次です。

```text
http://127.0.0.1:5173/10th/?provider=mock
```

## テスト

自動テストはモデルをダウンロードせず、モックだけで完了します。

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify:dist
npm run test:e2e
npm run benchmark:mock
npm audit
npm audit --omit=dev
```

`test:e2e`はproduction buildを作り、Vite previewの実際の`/10th/`パスへPlaywright Chromiumでアクセスします。即時第一場面、slow provider、先読み、分岐、continue、end、reload/reconnect、error retry、WebGPUなし、responsive、dark preference、keyboard、service worker、offline app shellを検査します。`benchmark:mock`はmobile viewportの独立contextを7回使い、中央値とraw sampleをJSONへ出します。

計測条件と前後値は[`docs/performance-baseline.md`](docs/performance-baseline.md)と[`docs/performance-after.md`](docs/performance-after.md)に固定しています。Mockの一部指標や初期bundleは悪化も含めてそのまま記録し、WebGPU未実測値を高速化成功として扱いません。

公開後は次を実行します。これは公開URLへだけアクセスし、buildやserver起動を行いません。

```bash
npm run test:e2e:public
```

## Production buildとpreview

```bash
cd apps/10th
npm ci
npm run build
npm run verify:dist
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

開くURL:

```text
http://127.0.0.1:4173/10th/
```

source mapは公開成果物へ出さない方針（`build.sourcemap: false`）です。`verify:dist`はHTML、manifest、service worker、icons、`/10th/` asset path、秘密値らしき文字列、モデル重み、許可範囲外のGit変更を検査します。

## GitHub Pagesへの反映

既存のPages sourceやworkflowは変更せず、確認済みの`apps/10th/**`と`10th/**`だけを既存運用に従ってcommitします。`version.json`にはsource build SHA、build時刻、app version、既定model、pipeline versionを含めます。

```bash
cd apps/10th
npm ci
npm run build
npm run verify:dist
cd ../..
git diff --check
git add apps/10th 10th
git commit
```

公開releaseではfeature branchをpushしてPRを作り、required checksと差分を確認してから`main`へmergeします。root、`CAETA/`、その他の既存ページを変更しません。

## モデル

| 表示     | model ID                 | VRAM目安 | 用途                |
| -------- | ------------------------ | -------: | ------------------- |
| 高速     | `Qwen3-0.6B-q4f16_1-MLC` | 約1403MB | 既定、短いscene     |
| 品質優先 | `Qwen3-1.7B-q4f16_1-MLC` | 約2037MB | 長めのscene         |
| debug    | `Qwen3-4B-q4f16_1-MLC`   | 約3432MB | `?debug=1`だけ      |
| デモ     | `mock-narrative-v1`      |     不要 | 自動テスト、PoC評価 |

3つのQwen3 IDがpin済みWebLLMの`prebuiltAppConfig.model_list`に存在することをunit testと初期化時に確認します。Qwen3では全リクエストに`extra_body: { enable_thinking: false }`を渡します。sceneはplain text streaming、Endingなど状態境界だけはWebLLM 0.2.84のJSON Schema response formatを使います。

Gemma 4 E2B / LiteRT-LM.jsは、公式Web runtimeとGitHub PagesからのRange/CORS取得経路までは確認しました。しかし約2.01GBのartifact、Early Preview API、0.6B Qwenの約5.7倍のlogical payload、対象端末WebGPUでの比較実測なしという条件から不採用です。providerやdependencyは追加していません。根拠と再評価条件は[`docs/model-runtime-evaluation.md`](docs/model-runtime-evaluation.md)に記録しています。

WebLLMとMLC配布Qwen3モデルはApache-2.0ライセンスです。再配布・公開時は各配布元の最新licenseとnoticeも確認してください。

- [WebLLM 0.2.84](https://www.npmjs.com/package/@mlc-ai/web-llm/v/0.2.84)
- [WebLLM Qwen3 example](https://github.com/mlc-ai/web-llm/tree/main/examples/qwen3)
- [WebLLM JSON Schema example](https://github.com/mlc-ai/web-llm/tree/main/examples/json-schema)
- [Qwen3 0.6B MLC](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC)
- [Qwen3 1.7B MLC](https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC)
- [Qwen3 4B MLC](https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC)

このリポジトリ自体には既存のLICENSEファイルがありません。依存・モデルのライセンスとは別に、アプリ固有コードの公開条件はリポジトリ管理者が決定してください。

## 初回ダウンロード、cache、offline

- 初回アクセスにはネットワークが必要です。
- app shellは一度読み込めばservice workerからoffline起動できます。
- 約6MBずつの任意WebLLM runtime/workerは通常app shellのprecacheから分離し、ユーザーがローカルAIを選択した時だけ同一originの専用runtime cacheへ保存します。
- 巨大なモデル重みはWorkbox precache/runtime cacheへ含めず、WebLLM自身のcacheへ任せます。
- ローカル生成をofflineで行えるのは、runtimeと選択モデルが完全にダウンロード・cacheされた後だけです。
- browser storageを消去した後は再ダウンロードが必要です。
- service worker更新は自動reloadせず、読者が「今すぐ更新」を選んだ時だけ適用します。`version.json`は古いworkerへ固定されないようprecache対象外です。

## Debug mode

```text
/10th/?provider=mock&debug=1
```

Debug panelではApp state、session JSON、model/provider、章・場面、rolling summary、facts/threads/motifs、最新StatePatch、build SHA、pipeline、storage、prompt文字数とtoken推定、providerが返したtoken/TTFT/completion値を確認できます。推定tokenは実測usageと別fieldです。JSON exportには読者入力や本文が含まれるため、共有・保存先に注意してください。

モックでは次のsceneにerrorまたは不正応答相当を1回だけ注入できます。4Bモデルもdebug時だけ表示します。

## セッションとcacheの削除

- 通常UIの「新しい物語」またはdebug panelの「セッションを削除」でactive sessionを削除できます。
- 全IndexedDBを消す場合はDevToolsのApplication / Storageで`complete-reading-story-poc`を削除します。
- モデルcacheを消す場合は同画面のCache Storage / site dataを削除します。次回はモデルの再ダウンロードが必要です。

## PWA icon

外部素材は使っていません。抽象的な本と道の図形をNode標準libraryだけでPNG化します。

```bash
npm run icons
```

## ローカルLLM smoke test

これは自動test suiteには含まれません。無料公開モデル`Qwen3-0.6B-q4f16_1-MLC`を実際にダウンロードするため、十分な空き容量・回線・WebGPUがある端末だけで実行します。

```bash
npm run build
npm run smoke:llm
```

model load、SeedResult、SceneResult、Zod parse、日本語本文、thinkingタグ不在、固定文の非重複を確認します。WebGPUがない環境では実行済みと報告しないでください。

## Privacyとsecurity

- reader inputと生成結果は端末内にだけ保存し、通常のテキストnodeとして描画します。
- API key、analytics、backend endpoint、remote logging、`eval`、`dangerouslySetInnerHTML`を使いません。
- reader inputは`<reader_input>`内の引用データとして隔離し、内部の命令・JSON指定に従わないsystem promptを使います。
- scene本文はplain textとしてsanitizeし、完成後に対応する`ScenePlan`と原子的に状態へ反映します。構造化出力はJSON parseとZod検証を通します。生stack traceは通常画面に出しません。
- model weightはGitへ含めません。
- 小型ローカルモデルにcloud service相当の安全filterは期待できません。一般公開前に別途安全評価が必要です。

## 既知の制約

- 1.7B/0.6Bは端末要件と速度を優先するため、文学的品質、長期整合性、日本語の反復に限界があります。
- 初回model downloadは大きく、端末、browser、driver、回線に強く依存します。
- WebGPU未対応、VRAM不足、device lossではローカルAIを開始できない場合があります。デモは利用できます。
- Safari、Firefox、mobile実機、すべてのGPUは未検証です。
- 長く続けるほど要約による情報損失が増えます。PoCでは5場面単位の局所閉鎖とcontext上限で緩和します。
- cache容量はbrowserのeviction対象です。

## Troubleshooting

- `/assets/...`が404になる: `/10th/`で開いているか確認し、`npm run build && npm run verify:dist`を再実行します。
- model buttonが無効: HTTPS/localhost、`navigator.gpu`、GPU adapterを確認するか、デモを選びます。
- model準備に失敗: 空き容量・回線を確認し、軽量モデルへ切り替えます。`--force`で依存を更新しません。
- 古い画面が残る: 表示された更新buttonを押すか、DevToolsでservice worker/cacheを確認します。読書中の自動reloadはありません。
- session復元に失敗: debug JSONを書き出してから新しい物語を開始します。

## 実装時に確認した一次情報

- [Vite public base path](https://vite.dev/guide/build#public-base-path)
- [vite-plugin-pwa prompt update](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html)
- [vite-plugin-pwa React integration](https://vite-pwa-org.netlify.app/frameworks/react)
- [Playwright webServer](https://playwright.dev/docs/test-webserver)
- [Playwright service workers](https://playwright.dev/docs/service-workers)
