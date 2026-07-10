import { execFileSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = resolve(scriptDirectory, "..");
const repositoryRoot = resolve(appDirectory, "../..");
const distDirectory = resolve(repositoryRoot, "10th");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

async function readRequired(relativePath) {
  const path = resolve(distDirectory, relativePath);
  const contents = await readFile(path);
  invariant(contents.byteLength > 0, `${relativePath} is empty`);
  return contents;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
}

const html = (await readRequired("index.html")).toString("utf8");
const manifest = JSON.parse(
  (await readRequired("manifest.webmanifest")).toString("utf8"),
);
const serviceWorker = (await readRequired("sw.js")).toString("utf8");
const version = JSON.parse(
  (await readRequired("version.json")).toString("utf8"),
);

await Promise.all([
  readRequired("icon-192.png"),
  readRequired("icon-512.png"),
  readRequired("icon-maskable-512.png"),
]);

invariant(
  html.includes("/10th/assets/"),
  "index.html does not use /10th/assets/",
);
invariant(
  html.includes("/10th/manifest.webmanifest"),
  "manifest link is not rooted at /10th/",
);
invariant(
  !/(?:src|href)=["']\/assets\//u.test(html),
  "root /assets/ URL found in index.html",
);
invariant(
  manifest.start_url === "/10th/",
  "manifest start_url must equal /10th/",
);
invariant(manifest.scope === "/10th/", "manifest scope must equal /10th/");
invariant(
  /^(?:[0-9a-f]{40}|unknown)$/u.test(version.buildSha),
  "version.json buildSha must be a full git SHA or unknown",
);
invariant(
  Number.isFinite(Date.parse(version.buildTime)),
  "version.json buildTime must be ISO-compatible",
);
invariant(version.appVersion === "0.2.0", "unexpected app version");
invariant(
  version.defaultModel === "Qwen3-0.6B-q4f16_1-MLC",
  "fast Qwen3 0.6B must be the default model",
);
invariant(
  version.performancePipeline === "v2",
  "performance pipeline must equal v2",
);
invariant(
  serviceWorker.includes('url:"index.html"') &&
    serviceWorker.includes('createHandlerBoundToURL("index.html")'),
  "service worker does not precache the scope-relative app shell",
);
const precachedUrls = [...serviceWorker.matchAll(/\{url:"([^"]+)"/gu)].map(
  (match) => match[1],
);
invariant(
  !precachedUrls.includes("version.json"),
  "version.json must remain network-readable instead of being pinned by an old service worker",
);
invariant(
  !precachedUrls.some((url) =>
    /(?:WebLLMNarrativeProvider|webllm\.worker|lib)-.*\.js$/u.test(url),
  ),
  "optional WebLLM runtime was added to app-shell precache",
);
invariant(
  serviceWorker.includes('cacheName:"10th-webllm-runtime-v1"'),
  "optional WebLLM runtime does not have an on-demand cache",
);

const files = await walk(distDirectory);
const initialScriptMatch = html.match(
  /src="(\/10th\/assets\/index-[^"]+\.js)"/u,
);
invariant(initialScriptMatch, "initial application script was not found");
const initialScriptPath = resolve(
  repositoryRoot,
  initialScriptMatch[1].replace(/^\//u, ""),
);
invariant(
  (await stat(initialScriptPath)).size < 500 * 1024,
  "initial application JavaScript exceeds the 500KB raw safety budget",
);
const forbiddenSourceExtensions = new Set([".ts", ".tsx", ".map"]);
const modelExtensions = new Set([".bin", ".gguf", ".params", ".safetensors"]);
for (const path of files) {
  const extension = extname(path);
  invariant(
    !forbiddenSourceExtensions.has(extension),
    `source/debug artifact copied to dist: ${path}`,
  );
  invariant(
    !modelExtensions.has(extension),
    `model weight copied to dist: ${path}`,
  );
  const size = (await stat(path)).size;
  const optionalInferenceRuntime =
    /\/(?:WebLLMNarrativeProvider|webllm\.worker|lib)-[^/]+\.js$/u.test(path);
  invariant(
    size < 5 * 1024 * 1024 ||
      (optionalInferenceRuntime && size < 8 * 1024 * 1024),
    `unexpected file larger than the audited limit: ${path}`,
  );
}

const combinedText = (
  await Promise.all(
    files
      .filter((path) =>
        [".html", ".js", ".css", ".json", ".webmanifest"].includes(
          extname(path),
        ),
      )
      .map((path) => readFile(path, "utf8")),
  )
).join("\n");
const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bAIza[0-9A-Za-z_-]{30,}\b/u,
  /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/u,
];
for (const pattern of secretPatterns) {
  invariant(
    !pattern.test(combinedText),
    `possible API credential found: ${pattern}`,
  );
}
invariant(
  !combinedText.includes("/Users/yukimarui"),
  "local absolute path leaked into production output",
);

const status = execFileSync("git", ["status", "--porcelain=v1", "-uall"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
const outsideScope = status
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").at(-1))
  .filter(
    (path) =>
      path && !path.startsWith("apps/10th/") && !path.startsWith("10th/"),
  );
invariant(
  outsideScope.length === 0,
  `changes outside allowed scope: ${outsideScope.join(", ")}`,
);
invariant(
  await stat(resolve(repositoryRoot, "CAETA")).then((item) =>
    item.isDirectory(),
  ),
  "protected CAETA directory is missing",
);
invariant(
  await stat(resolve(repositoryRoot, "README.md")).then((item) =>
    item.isFile(),
  ),
  "protected root README.md is missing",
);

console.log(`Verified ${files.length} production files under 10th/.`);
console.log(
  "Base path, version, manifest, service worker, bundle budget, secrets, and repository scope are valid.",
);
