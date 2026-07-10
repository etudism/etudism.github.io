export interface QueryFlags {
  debug: boolean;
  benchmark: boolean;
  preferMock: boolean;
  mockDelayMs: number;
}

export function parseQueryFlags(search: string): QueryFlags {
  const parameters = new URLSearchParams(search);
  const delay = Number(parameters.get("mockDelay"));
  return {
    debug: parameters.get("debug") === "1",
    benchmark: parameters.get("benchmark") === "1",
    preferMock: parameters.get("provider") === "mock",
    mockDelayMs:
      Number.isFinite(delay) && delay >= 0 ? Math.min(delay, 5_000) : 80,
  };
}
