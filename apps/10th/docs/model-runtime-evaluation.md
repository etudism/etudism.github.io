# Model and browser-runtime evaluation

調査日: 2026-07-11。公開一次資料と、lockfileで固定した
`@mlc-ai/web-llm@0.2.84` の実装・型定義を照合した。モデル本体はダウンロードせず、
この環境ではWebGPU推論を実測していない。

## 採用構成

| 用途         | model ID                 | cold logical payload | catalog VRAM | 実効context |
| ------------ | ------------------------ | -------------------: | -----------: | ----------: |
| 高速（既定） | `Qwen3-0.6B-q4f16_1-MLC` |        352,462,397 B |  1,403.34 MB |       4,096 |
| 品質優先     | `Qwen3-1.7B-q4f16_1-MLC` |        985,127,154 B |  2,036.66 MB |       4,096 |
| debug限定    | `Qwen3-4B-q4f16_1-MLC`   |      2,280,372,422 B |  3,431.59 MB |       4,096 |

`cold logical payload` は調査時点の公式snapshotにあるconfig、tokenizer、tensor
index/shards、対応WASMの非圧縮file size合計で、HTTP転送量や実測download量ではない。
0.6Bは1.7Bよりこの合計が64.2%小さく、catalog VRAM値が31.1%少ないため既定にした。
decode速度、TTFT、load時間の改善率は実機同条件比較がないため主張しない。

- WebLLM Qwen3 records:
  <https://github.com/mlc-ai/web-llm/blob/9e572d6ed95e248f29634996cd32cc8f3023d89d/src/config.ts#L1187-L1271>
- 0.6B artifact: <https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC>
- 1.7B artifact: <https://huggingface.co/mlc-ai/Qwen3-1.7B-q4f16_1-MLC>
- 4B artifact: <https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC>

scene本文だけをplain-text streamingへ移し、`stream_options.include_usage`、
`enable_thinking:false`、有限の`max_tokens`、`finish_reason`検査を使う。SeedとEndingの
構造化JSONは状態境界のため維持する。Dedicated Workerと同一engineはsessionをまたいで
再利用し、model変更時だけreload、app unmount時だけunload/terminateする。WebLLMの
artifact cacheへモデルを任せ、Workboxには重みを保存しない。

- WebLLM streaming: <https://github.com/mlc-ai/web-llm/blob/9e572d6ed95e248f29634996cd32cc8f3023d89d/README.md#L201-L229>
- WebLLM cache: <https://webllm.mlc.ai/docs/user/advanced_usage.html#using-indexeddb-cache>
- Qwen3 non-thinking guidance: <https://github.com/QwenLM/Qwen3/blob/main/docs/source/getting_started/quickstart.md>

## Gemma 4 E2B / LiteRT-LM.jsの判定

今回は不採用とし、providerやdependencyを追加しない。

満たした条件:

- Google公式のLiteRT-LM JavaScript/TypeScript Web APIがあり、WebGPU streamingと
  cancelが案内されている。
- 公式Gemma 4 E2B Web artifactはApache-2.0。
- `Origin: https://etudism.github.io` とRange requestによるheader調査では、最終CDNが
  HTTP 206、`Access-Control-Allow-Origin: *`、総size 2,008,432,640 Bを返し、
  GitHub Pagesから取得できる経路を確認した。
- dynamic importによる完全lazy loadは設計上可能。

不採用理由:

- E2B artifactは2,008,432,640 B（約1.871 GiB）で、高速既定Qwen 0.6Bのlogical
  payloadの約5.7倍。
- `@litert-lm/core@0.14.0` は調査時点でunpacked 103,223,091 B。導入後のVite chunkは
  未build・未計測。
- Web APIはEarly Previewで、任意JSON Schema、Dedicated Worker、永続cache、
  Safari/Firefox/mobileの検証matrixが本PoC要件を満たす形で確認できない。
- 公式M4 Max benchmarkは初期化・model loadを除くcache済み条件で、Qwenと同一端末・
  prompt・runtimeの比較ではない。
- この環境には利用可能なWebGPU adapterがなく、日本語sceneのcold/warm load、TTFT、
  completion、tokens/s、品質を実測できない。したがってQwen高速版より明確な利点を
  証明できない。

- Gemma 4 overview: <https://ai.google.dev/gemma/docs/core>
- Gemma 4 model card: <https://ai.google.dev/gemma/docs/core/model_card_4>
- LiteRT-LM Web API: <https://developers.google.com/edge/litert-lm/js>
- E2B Web artifact: <https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/tree/main>
- Apache-2.0 notice: <https://ai.google.dev/gemma/apache_2>

再評価条件は、stable Web API、revision pin、production bundle計測、対象browser実機、
同一端末・同一promptでQwen 0.6B/1.7Bを上回るcold/warm性能または十分な日本語品質、
cache/worker/structured-output要件、license noticeをすべて確認できること。

Chrome Prompt APIは初期app/model再配布を減らせる将来候補だが、browser管理modelで
Qwen/Gemmaを指定できず、mobile/cross-browser要件を満たさないため今回の既定経路には
しない。
