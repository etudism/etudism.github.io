import { MockNarrativeProvider } from "./MockNarrativeProvider";
import type { NarrativeProvider } from "./NarrativeProvider";
import type {
  ParseDiagnostic,
  ProviderInitOptions,
  ProviderKind,
} from "../narrative/types";

export interface ProviderSelectionKey {
  providerKind: ProviderKind;
  modelId: string;
}

export interface ProviderManagerOptions {
  mockSeed?: string | number;
  mockDelayMs?: number;
  onDiagnostic?: (diagnostic: ParseDiagnostic) => void;
  createProvider?: (kind: ProviderKind) => Promise<NarrativeProvider>;
}

export interface ProviderManagerState {
  kind: ProviderKind | null;
  modelId: string | null;
  initialized: boolean;
  reuseCount: number;
}

/** Keeps one model engine alive across routes and new stories. */
export class ProviderManager {
  private readonly options: ProviderManagerOptions;
  private provider: NarrativeProvider | null = null;
  private kind: ProviderKind | null = null;
  private modelId: string | null = null;
  private initialized = false;
  private reuseCount = 0;

  constructor(options: ProviderManagerOptions = {}) {
    this.options = options;
  }

  getCurrentProvider(): NarrativeProvider | null {
    return this.provider;
  }

  getState(): ProviderManagerState {
    return {
      kind: this.kind,
      modelId: this.modelId,
      initialized: this.initialized,
      reuseCount: this.reuseCount,
    };
  }

  async ensureProvider(
    selection: ProviderSelectionKey,
    initOptions: Omit<ProviderInitOptions, "modelId">,
  ): Promise<{ provider: NarrativeProvider; reused: boolean }> {
    const canReuse =
      this.provider !== null &&
      this.kind === selection.providerKind &&
      this.modelId === selection.modelId &&
      this.initialized;
    if (canReuse) {
      this.reuseCount += 1;
      await this.provider?.initialize({
        ...initOptions,
        modelId: selection.modelId,
      });
      return { provider: this.provider as NarrativeProvider, reused: true };
    }

    if (this.provider === null || this.kind !== selection.providerKind) {
      await this.provider?.dispose();
      this.provider = await this.createProvider(selection.providerKind);
      this.kind = selection.providerKind;
      this.modelId = null;
      this.initialized = false;
    }

    try {
      await this.provider.initialize({
        ...initOptions,
        modelId: selection.modelId,
      });
      this.modelId = selection.modelId;
      this.initialized = true;
      return { provider: this.provider, reused: false };
    } catch (error) {
      this.initialized = false;
      throw error;
    }
  }

  resetForNewStory(): void {
    // The provider and loaded model intentionally remain alive. Story prompts
    // are self-contained, so WebLLM resets incompatible KV state internally.
  }

  async release(): Promise<void> {
    const provider = this.provider;
    this.provider = null;
    this.kind = null;
    this.modelId = null;
    this.initialized = false;
    if (provider) await provider.dispose();
  }

  private async createProvider(kind: ProviderKind): Promise<NarrativeProvider> {
    if (this.options.createProvider) return this.options.createProvider(kind);
    if (kind === "mock") {
      return new MockNarrativeProvider({
        seed: this.options.mockSeed ?? "10th-poc",
        delayMs: this.options.mockDelayMs,
      });
    }
    const { WebLLMNarrativeProvider } =
      await import("./WebLLMNarrativeProvider");
    return new WebLLMNarrativeProvider({
      onDiagnostic: this.options.onDiagnostic,
    });
  }
}
