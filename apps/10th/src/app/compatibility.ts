export interface WebGpuCompatibility {
  secureContext: boolean;
  gpuExposed: boolean;
  adapterAvailable: boolean;
  supported: boolean;
  detail: string;
}

interface GpuAdapterSource {
  requestAdapter(): Promise<unknown | null>;
}

export async function checkWebGpuCompatibility(
  secureContext = window.isSecureContext,
  gpu = (navigator as Navigator & { gpu?: GpuAdapterSource }).gpu,
): Promise<WebGpuCompatibility> {
  if (!secureContext) {
    return {
      secureContext: false,
      gpuExposed: Boolean(gpu),
      adapterAvailable: false,
      supported: false,
      detail: "ローカルAIにはHTTPSまたはlocalhostの安全な接続が必要です。",
    };
  }

  if (!gpu) {
    return {
      secureContext: true,
      gpuExposed: false,
      adapterAvailable: false,
      supported: false,
      detail: "この環境ではWebGPUが公開されていません。",
    };
  }

  try {
    const adapter = await gpu.requestAdapter();
    return {
      secureContext: true,
      gpuExposed: true,
      adapterAvailable: Boolean(adapter),
      supported: Boolean(adapter),
      detail: adapter
        ? "WebGPUアダプターを確認しました。"
        : "WebGPUアダプターを利用できませんでした。",
    };
  } catch (error) {
    return {
      secureContext: true,
      gpuExposed: true,
      adapterAvailable: false,
      supported: false,
      detail: `WebGPUの確認に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`,
    };
  }
}
