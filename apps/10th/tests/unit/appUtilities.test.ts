import { describe, expect, it } from "vitest";
import { checkWebGpuCompatibility } from "../../src/app/compatibility";
import { parseQueryFlags } from "../../src/app/queryFlags";

describe("checkWebGpuCompatibility", () => {
  it("keeps mock mode available when WebGPU is absent", async () => {
    const result = await checkWebGpuCompatibility(true, undefined);
    expect(result).toMatchObject({
      supported: false,
      secureContext: true,
      gpuExposed: false,
    });
  });

  it("checks for an actual adapter instead of user-agent sniffing", async () => {
    const result = await checkWebGpuCompatibility(true, {
      requestAdapter: async () => ({ name: "test-adapter" }),
    });
    expect(result).toMatchObject({ supported: true, adapterAvailable: true });
  });
});

describe("parseQueryFlags", () => {
  it("enables debug and clamps mock delay", () => {
    expect(
      parseQueryFlags("?debug=1&benchmark=1&provider=mock&mockDelay=99999"),
    ).toEqual({
      debug: true,
      benchmark: true,
      preferMock: true,
      mockDelayMs: 5_000,
    });
  });
});
