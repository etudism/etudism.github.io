export class GenerationInProgressError extends Error {
  constructor() {
    super("A narrative generation is already in progress.");
    this.name = "GenerationInProgressError";
  }
}

export class GenerationInterruptedError extends Error {
  constructor() {
    super("Narrative generation was interrupted.");
    this.name = "GenerationInterruptedError";
  }
}

interface ActiveGeneration {
  id: number;
  controller: AbortController;
}

/** Prevents double-clicks from starting concurrent model generations. */
export class GenerationGate {
  private active: ActiveGeneration | null = null;
  private nextId = 1;

  get isGenerating(): boolean {
    return this.active !== null;
  }

  get activeGenerationId(): number | null {
    return this.active?.id ?? null;
  }

  async run<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    externalSignal?: AbortSignal,
  ): Promise<T> {
    if (this.active) {
      throw new GenerationInProgressError();
    }

    const generation: ActiveGeneration = {
      id: this.nextId,
      controller: new AbortController(),
    };
    this.nextId += 1;
    this.active = generation;

    const forwardAbort = (): void => generation.controller.abort();
    if (externalSignal?.aborted) {
      forwardAbort();
    } else {
      externalSignal?.addEventListener("abort", forwardAbort, { once: true });
    }

    try {
      const result = await operation(generation.controller.signal);
      if (generation.controller.signal.aborted) {
        throw new GenerationInterruptedError();
      }
      return result;
    } finally {
      externalSignal?.removeEventListener("abort", forwardAbort);
      if (this.active?.id === generation.id) {
        this.active = null;
      }
    }
  }

  interrupt(): boolean {
    if (!this.active) {
      return false;
    }
    this.active.controller.abort();
    return true;
  }
}

export function createGenerationGate(): GenerationGate {
  return new GenerationGate();
}
