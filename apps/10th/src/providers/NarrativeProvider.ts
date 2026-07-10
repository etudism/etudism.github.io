import type {
  EndingRequest,
  EndingResult,
  FastSceneRequest,
  FastSceneResult,
  ProviderInitOptions,
  SceneRequest,
  SceneResult,
  SceneStreamingOptions,
  SeedRequest,
  SeedResult,
} from "../narrative/types";

/** Boundary between the story application and a concrete text generator. */
export interface NarrativeProvider {
  readonly kind: "webllm" | "mock";

  initialize(options: ProviderInitOptions): Promise<void>;
  generateSeed(input: SeedRequest): Promise<SeedResult>;
  generateScene(input: SceneRequest): Promise<SceneResult>;
  generateSceneText(
    input: FastSceneRequest,
    options?: SceneStreamingOptions,
  ): Promise<FastSceneResult>;
  generateEnding(input: EndingRequest): Promise<EndingResult>;
  interrupt(): Promise<void>;
  dispose(): Promise<void>;
}
