export interface StreamingTextBufferOptions {
  intervalMs?: number;
  onFlush: (text: string) => void;
}

export class StreamingTextBuffer {
  private readonly intervalMs: number;
  private readonly onFlush: (text: string) => void;
  private text = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private cancelled = false;

  constructor(options: StreamingTextBufferOptions) {
    this.intervalMs = options.intervalMs ?? 45;
    this.onFlush = options.onFlush;
  }

  push(chunk: string): void {
    if (this.cancelled || chunk.length === 0) return;
    this.text += chunk;
    if (this.timer !== undefined) return;
    this.timer = setTimeout(() => this.flush(), this.intervalMs);
  }

  flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.cancelled) this.onFlush(this.text);
  }

  complete(): string {
    this.flush();
    return this.text;
  }

  cancel(): void {
    this.cancelled = true;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    this.text = "";
  }
}
