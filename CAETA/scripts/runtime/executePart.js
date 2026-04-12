const runnerCache = new Map();

export function executePart(ctx, partName, partCode) {
  let runner = runnerCache.get(partName);
  if (!runner) {
    runner = new Function('ctx', `with (ctx) {\n${partCode}\n}`);
    runnerCache.set(partName, runner);
  }
  return runner(ctx);
}
