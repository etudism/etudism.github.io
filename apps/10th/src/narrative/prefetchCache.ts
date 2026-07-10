import type { ReaderChoice, StorySession } from "./types";

export interface PrefetchDecisionInput {
  providerKind: StorySession["providerKind"];
  documentVisible: boolean;
  saveData: boolean;
  hardwareConcurrency: number | null;
  webLlmOptIn: boolean;
}

export function shouldPrefetch(input: PrefetchDecisionInput): boolean {
  if (!input.documentVisible || input.saveData) return false;
  if (input.providerKind === "mock") return true;
  return input.webLlmOptIn && (input.hardwareConcurrency ?? 0) >= 8;
}

export function scenePrefetchScope(session: StorySession): string {
  return `${session.id}:${session.macroPartIndex}:${session.sceneIndexInMacro}:${session.totalSceneCount}`;
}

export function scenePrefetchKey(
  session: StorySession,
  choice: ReaderChoice,
): string {
  return `${scenePrefetchScope(session)}:${choice}`;
}

export class ScenePrefetchCache {
  private activeScope = "";
  private values = new Map<string, string>();

  beginScope(session: StorySession): string {
    const scope = scenePrefetchScope(session);
    if (scope !== this.activeScope) {
      this.activeScope = scope;
      this.values.clear();
    }
    return scope;
  }

  store(scope: string, key: string, text: string): boolean {
    if (scope !== this.activeScope) return false;
    this.values.set(key, text);
    return true;
  }

  consume(session: StorySession, choice: ReaderChoice): string | undefined {
    const key = scenePrefetchKey(session, choice);
    const value = this.values.get(key);
    if (value !== undefined) this.values.delete(key);
    return value;
  }

  clear(): void {
    this.activeScope = "";
    this.values.clear();
  }
}
