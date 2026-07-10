# Performance baseline before pipeline v2

Measured on 2026-07-11 before the fast-generation changes, at commit
`aad4e2a5e3bfa354a13da64cd56f2215eaddce47`.

## Environment and method

- Node.js `v22.13.1`, npm `10.9.2`, Playwright `1.61.1`
- Playwright headless Chromium, viewport `390x844`, light color scheme
- Vite production preview at `http://127.0.0.1:4173/10th/`
- Mock provider with `?provider=mock&mockDelay=0`
- Seven isolated browser contexts; values below are medians
- Timing uses the browser Performance API except reload restore, which uses the
  Playwright-side monotonic clock
- This is localhost Mock data. It is not a WebLLM or public-network benchmark.

## Baseline medians

| Measurement                                      |                  Median |
| ------------------------------------------------ | ----------------------: |
| App navigation start to input screen interactive |                 62.3 ms |
| Demo selection to first readable scene           |                 71.0 ms |
| Branch click to completed next scene             |                 33.5 ms |
| Reload start to restored scene                   |                 26.5 ms |
| First-scene length                               | 362 Japanese characters |
| Initial requests                                 |                       4 |
| Initial transferred bytes                        |           108,490 bytes |
| Initial encoded response bytes                   |           107,290 bytes |
| Initial JavaScript bytes                         |           103,353 bytes |
| Initial CSS bytes                                |             3,256 bytes |

All seven runs had zero console errors, page errors, and HTTP responses at or
above 400. Initial navigation and the complete Mock flow made zero WebLLM
runtime/worker/model requests.

## Initial production resources

| Resource                    | Encoded bytes |
| --------------------------- | ------------: |
| HTML                        |           681 |
| Main application JavaScript |       101,154 |
| CSS                         |         3,256 |
| Workbox window helper       |         2,199 |

The build reported a `329.83 kB` raw (`102.12 kB` gzip) main application
chunk. Optional WebLLM code was already lazy: the roughly `5.95 MB` runtime
library and `6.03 MB` worker bundle were not requested on the initial route or
in Mock mode.

## Raw timing samples (ms)

| Run | Interactive | First scene | Branch scene | Reload restore |
| --: | ----------: | ----------: | -----------: | -------------: |
|   1 |       187.2 |        81.5 |         44.9 |           31.1 |
|   2 |        61.1 |        68.5 |         33.5 |           24.6 |
|   3 |        60.2 |        69.6 |         33.5 |           26.5 |
|   4 |        58.6 |        70.1 |         32.0 |           26.8 |
|   5 |        78.9 |        71.4 |         40.3 |           26.3 |
|   6 |        62.3 |        71.0 |         48.3 |           31.5 |
|   7 |        64.2 |        74.9 |         32.5 |           24.2 |

## Not measured

Cold/warm model preparation, engine initialization, TTFT, completion time,
tokens per second, and model cache state were not measured. The controlled
Chromium environment did not provide a usable WebGPU adapter, so no model was
downloaded and no WebLLM result is claimed.
