import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

const DEFAULT_MODEL = "Qwen3-0.6B-q4f16_1-MLC";
const APP_VERSION = "0.2.0";
const PERFORMANCE_PIPELINE = "v2";

function readBuildSha(): string {
  if (process.env.VITE_BUILD_SHA) return process.env.VITE_BUILD_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

const buildMetadata = {
  buildSha: readBuildSha(),
  buildTime: process.env.VITE_BUILD_TIME ?? new Date().toISOString(),
  appVersion: APP_VERSION,
  defaultModel: DEFAULT_MODEL,
  performancePipeline: PERFORMANCE_PIPELINE,
};

export default defineConfig({
  base: "/10th/",
  define: {
    __BUILD_SHA__: JSON.stringify(buildMetadata.buildSha),
    __BUILD_TIME__: JSON.stringify(buildMetadata.buildTime),
    __APP_VERSION__: JSON.stringify(buildMetadata.appVersion),
    __DEFAULT_MODEL__: JSON.stringify(buildMetadata.defaultModel),
    __PERFORMANCE_PIPELINE__: JSON.stringify(buildMetadata.performancePipeline),
  },
  plugins: [
    react(),
    {
      name: "10th-build-metadata",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: `${JSON.stringify(buildMetadata, null, 2)}\n`,
        });
      },
    },
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      scope: "/10th/",
      includeAssets: ["icon-192.png", "icon-512.png", "icon-maskable-512.png"],
      manifest: {
        id: "/10th/",
        name: "読書を完了するための物語",
        short_name: "終われる物語",
        description: "ブラウザーの中で生成し、終わる場所を選べる物語",
        lang: "ja",
        start_url: "/10th/",
        scope: "/10th/",
        display: "standalone",
        background_color: "#f4efe4",
        theme_color: "#292722",
        icons: [
          {
            src: "/10th/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/10th/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/10th/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        globIgnores: [
          "**/*.{bin,gguf,safetensors,params}",
          "**/assets/WebLLMNarrativeProvider-*.js",
          "**/assets/webllm.worker-*.js",
          "**/assets/lib-*.js",
        ],
        runtimeCaching: [
          {
            urlPattern:
              /\/10th\/assets\/(?:WebLLMNarrativeProvider|webllm\.worker|lib)-.*\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "10th-webllm-runtime-v1",
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    outDir: "../../10th",
    emptyOutDir: true,
    sourcemap: false,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/component/**/*.test.tsx"],
    clearMocks: true,
  },
});
