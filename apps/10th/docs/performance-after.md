# Performance result for pipeline v2

Measured on 2026-07-11 after the fast-generation implementation. The measured
working tree was based on `aad4e2a5e3bfa354a13da64cd56f2215eaddce47`; the
release `version.json` is rebuilt with the final source commit before publish.

## Environment and method

- Node.js `v22.13.1`, Playwright `1.61.1`, bundled Chromium `149.0.7827.55`
- Headless Chromium, viewport `390x844`, light color scheme
- Vite production preview at `http://127.0.0.1:4173/10th/`
- Mock provider with `?provider=mock&mockDelay=0`
- Seven isolated browser contexts; medians are reported
- Browser Performance API for interactive, opening, branch and resource data;
  Node monotonic clock across reload
- `npm run benchmark:mock`; machine-readable output is written to the ignored
  `test-results/benchmark/mock-performance.json`
- This is localhost Mock data. It is not a public-network or WebLLM benchmark.

## Before/after medians

| Measurement                            | v1 baseline | v2 result |          Difference |
| -------------------------------------- | ----------: | --------: | ------------------: |
| App navigation to interactive          |     62.3 ms |   67.4 ms |     +5.1 ms (+8.2%) |
| Demo selection to readable first scene |     71.0 ms |  199.8 ms | +128.8 ms (+181.4%) |
| Branch click to completed next scene   |     33.5 ms |   27.7 ms |    -5.8 ms (-17.3%) |
| Reload to restored scene               |     26.5 ms |  31.17 ms |   +4.67 ms (+17.6%) |
| First-scene length                     |   362 chars | 203 chars | -159 chars (-43.9%) |
| Initial requests                       |           4 |         4 |           unchanged |
| Initial transferred bytes              |   108,490 B | 120,652 B |  +12,162 B (+11.2%) |
| Initial encoded response bytes         |   107,290 B | 119,452 B |  +12,162 B (+11.3%) |
| Initial JavaScript bytes               |   103,353 B | 115,366 B |  +12,013 B (+11.6%) |
| Initial CSS bytes                      |     3,256 B |   3,405 B |      +149 B (+4.6%) |

The first scene remains below the explicit one-second gate in all seven runs,
but the controlled Mock median did **not** improve. The added immediate
provisional transform, persistence request, diagnostics, and larger v2 app
shell increased that local measurement. The benefit for the real model path is
that the first scene no longer waits for runtime import, model download,
initialization, or inference. Those WebGPU stages were not measurable here, so
the architectural removal of that wait is not presented as a measured speedup.

The branch result uses the completed, non-canonical Mock prefetch path. WebLLM
prefetch remains off until real-device memory, power, and foreground-priority
measurements justify enabling it.

## Prompt and output reduction

A deterministic first-branch session was passed through both prompt builders in
the same unit-test process:

| Prompt path                 |    Characters | Transparent token estimate (`ceil(chars/3)`) |
| --------------------------- | ------------: | -------------------------------------------: |
| v1 structured scene         |         2,756 |                                          919 |
| v2 planned plain-text scene |         1,235 |                                          412 |
| Reduction                   | 1,521 (55.2%) |                                  507 (55.2%) |

The token values are estimates, not tokenizer output. Actual prompt/completion
tokens remain `null` unless WebLLM returns usage. Scene output is bounded to
180–320 Japanese characters in fast mode and 250–450 in quality/debug mode;
the opening is bounded to 180–280.

## Raw v2 timing samples (ms)

| Run | Interactive | First scene | Prefetched branch | Reload restore | Opening chars |
| --: | ----------: | ----------: | ----------------: | -------------: | ------------: |
|   1 |       158.0 |       201.3 |              35.7 |          46.94 |           208 |
|   2 |        73.5 |       195.5 |              27.4 |          32.56 |           204 |
|   3 |        72.5 |       194.2 |              31.9 |          59.27 |           203 |
|   4 |        63.6 |       197.1 |              50.9 |          30.36 |           210 |
|   5 |        67.4 |       211.0 |              26.1 |          30.96 |           193 |
|   6 |        66.4 |       200.9 |              27.0 |          31.17 |           182 |
|   7 |        66.8 |       199.8 |              27.7 |          30.09 |           203 |

Every run had zero console errors, page errors, failed/error HTTP responses,
WebLLM runtime/model requests, and Dedicated WebLLM workers. The production
build reported a `365.02 kB` raw (`114.19 kB` gzip) initial application chunk.
The optional approximately 5.95 MB runtime library and 6.03 MB worker remained
lazy and absent from the initial and complete Mock flow.

## Not measured

Cold/warm model download, preparation, engine initialization, cache state,
TTFT, completion time, tokens per second, device memory, power use, and Japanese
quality were not measured. Chromium exposed no usable WebGPU adapter in the
controlled environment, so no Qwen or Gemma model was downloaded and no local
LLM performance claim is made.
