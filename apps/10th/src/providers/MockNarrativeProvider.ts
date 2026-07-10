import type { NarrativeProvider } from "./NarrativeProvider";
import { renderPlannedScene } from "../narrative/scenePlanner";
import type {
  AppErrorCode,
  EndingRequest,
  EndingResult,
  FastSceneRequest,
  FastSceneResult,
  ProviderInitOptions,
  ProviderProgress,
  SceneRequest,
  SceneResult,
  SceneStreamingOptions,
  SeedRequest,
  SeedResult,
  StatePatch,
} from "../narrative/types";

export type MockNarrativeOperation = "initialize" | "seed" | "scene" | "ending";

export type MockGenerationOperation = Exclude<
  MockNarrativeOperation,
  "initialize"
>;

export interface MockNarrativeProviderOptions {
  readonly seed?: string | number;
  readonly delayMs?: number;
}

export class MockNarrativeProviderError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "MockNarrativeProviderError";
    this.code = code;
  }
}

interface ErrorInjection {
  readonly operation: MockNarrativeOperation;
  readonly error: Error;
}

interface InvalidInjection {
  readonly operation: MockGenerationOperation;
}

interface PendingDelay {
  readonly timer: ReturnType<typeof setTimeout>;
  readonly reject: (reason: Error) => void;
}

const SEED_WORLDS = [
  {
    emotionalPattern: "同じ形の時間が静かに積み重なる感覚",
    narrativeTension: "保たれた秩序と、そこから一歩外れる好奇心の拮抗",
    allegoricalWorld: "毎朝、昨日と同じ日付の札が配られる水路の町",
    centralSymbol: "時刻のない銀色の切符",
    protagonistName: "ユノ",
    companionName: "トワ",
    startingLocation: "日付札を配る水門前",
    portableMotif: "銀色の切符",
  },
  {
    emotionalPattern: "見慣れた景色の奥に別の手触りを探す感覚",
    narrativeTension: "動かない書架と、遠くへ続く頁の風の対立",
    allegoricalWorld: "列車が来るたび書架の並びが変わる地下図書駅",
    centralSymbol: "余白だけが残った地図帳",
    protagonistName: "ナギ",
    companionName: "リツ",
    startingLocation: "閉じた三番線の閲覧室",
    portableMotif: "余白の地図帳",
  },
  {
    emotionalPattern: "小さな反復の中で変化の兆しを待つ感覚",
    narrativeTension: "規則正しい潮時計と、時刻を外れて満ちる波の緊張",
    allegoricalWorld: "家々の屋根に潮の高さを刻む時計塔の島",
    centralSymbol: "青い砂の小瓶",
    protagonistName: "スイ",
    companionName: "ハク",
    startingLocation: "潮時計塔の影にある渡し場",
    portableMotif: "青い砂の小瓶",
  },
] as const;

const DESTINATIONS = [
  "風を量る回廊",
  "古い標本を灯す停車場",
  "水面下の郵便室",
  "鐘の鳴らない庭",
  "紙片を舟にする市場",
  "薄明かりの測量所",
] as const;

const ENDINGS = [
  {
    title: "風待ち標本室",
    image: "棚の奥で、持ち歩いた印が朝の光を細く返した",
  },
  {
    title: "余白を渡る灯",
    image: "閉じた地図の余白に、通ってきた道だけが淡く残った",
  },
  {
    title: "潮時計の向こう",
    image: "青い砂は静まり、窓の外では名もない潮が満ちていた",
  },
] as const;

function stableHash(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function itemAt<T>(items: readonly T[], hash: number): T {
  const item = items[hash % items.length];
  if (item === undefined) {
    throw new Error("Mock narrative fixture must not be empty.");
  }
  return item;
}

function abortError(): Error {
  const error = new Error("Mock provider initialization was aborted.");
  error.name = "AbortError";
  return error;
}

/** Deterministic provider used by unit, component, and end-to-end tests. */
export class MockNarrativeProvider implements NarrativeProvider {
  readonly kind = "mock" as const;

  private readonly deterministicSeed: string;
  private delayMs: number;
  private initialized = false;
  private modelId: string | undefined;
  private onProgress: ((progress: ProviderProgress) => void) | undefined;
  private nextError: ErrorInjection | undefined;
  private nextInvalid: InvalidInjection | undefined;
  private pendingGenerationDelay: PendingDelay | undefined;

  constructor(options: MockNarrativeProviderOptions = {}) {
    this.deterministicSeed = String(options.seed ?? "10th-poc");
    this.delayMs = this.validDelay(options.delayMs ?? 0);
  }

  setDelay(delayMs: number): void {
    this.delayMs = this.validDelay(delayMs);
  }

  injectErrorOnce(
    operation: MockNarrativeOperation,
    error: Error = new MockNarrativeProviderError(
      operation === "initialize" ? "MODEL_INIT_FAILED" : "GENERATION_FAILED",
      `Injected mock ${operation} error.`,
    ),
  ): void {
    this.nextError = { operation, error };
  }

  injectInvalidResponseOnce(operation: MockGenerationOperation): void {
    this.nextInvalid = { operation };
  }

  async initialize(options: ProviderInitOptions): Promise<void> {
    this.initialized = false;
    this.onProgress = options.onProgress;
    this.modelId = options.modelId;
    this.emitProgress(
      "loading",
      0,
      "デモ用の物語を準備しています。",
      options.modelId,
    );

    try {
      await this.waitForInitialization(options.signal);
      this.consumeInjectedError("initialize");

      this.initialized = true;
      this.emitProgress(
        "ready",
        1,
        "デモの準備ができました。",
        options.modelId,
      );
    } catch (error: unknown) {
      this.modelId = undefined;
      throw error;
    }
  }

  async generateSeed(input: SeedRequest): Promise<SeedResult> {
    this.assertInitialized();
    this.emitProgress("generating", 0, "物語の入口を組み立てています。");
    await this.waitForGeneration();
    this.consumeInjections("seed");

    const hash = stableHash(
      `${this.deterministicSeed}|seed|${input.readerInput}`,
    );
    const world = itemAt(SEED_WORLDS, hash);
    const result: SeedResult = {
      themeTransform: {
        emotionalPattern: world.emotionalPattern,
        narrativeTension: world.narrativeTension,
        allegoricalWorld: world.allegoricalWorld,
        centralSymbol: world.centralSymbol,
        protagonistDistance: "third_person",
        literalTermsToAvoid: ["退屈", "日常", "仕事"],
      },
      storyBible: {
        protagonist: {
          name: world.protagonistName,
          description: "小さな違いを記録する旅人",
          desire: "まだ名前のない変化の行方を確かめること",
          limitation: "確かな合図が来るまで足を止めてしまうこと",
        },
        companion: {
          name: world.companionName,
          description: "道具の声を聞き分ける案内役",
          speakingStyle: "短い問いを置き、答えを急がせない",
        },
        worldRule: world.allegoricalWorld,
        startingLocation: world.startingLocation,
        portableMotif: world.portableMotif,
        toneGuide: ["静かな具体描写", "行動で変化を示す", "余白を残す"],
        prohibitedPatterns: ["説教", "心理診断", "夢オチ", "固定フレーズ"],
      },
      firstScene: {
        text: `${world.startingLocation}で、${world.protagonistName}は${world.centralSymbol}を拾った。朝なのか夕方なのか判然としない光が水面を横切り、足元の石には同じ幅の影が幾重にも重なっていた。${world.companionName}は遠くの戸が一度だけ開いたことを指さしたが、理由を先に説明しようとはしなかった。二人が欄干のそばで待っていると、町を巡る音は決まった間隔で戻ってくるのに、戸の向こうから返る響きだけが少しずつ短くなった。${world.protagonistName}が拾ったものを掌で裏返すと、古い傷の一本がその響きに合わせて淡く光った。${world.companionName}は傷と対岸を交互に見て、今すぐ渡る道だけが道ではないと短く言った。二人は人の流れから半歩離れ、開いた戸が再び閉じるまでを見届けた。やがて音が消えた方角には、さっきまでなかった細い明るさが残った。${world.protagonistName}はそれを偶然と決めず、持ち物を外套の内へしまって、最初の一歩を選べる場所まで歩いた。`,
        summary: `${world.protagonistName}は${world.startingLocation}で${world.centralSymbol}を得て、${world.companionName}と変化の兆しを見つけた。`,
        choiceReflection: "まだ選択前。物語の入口と持ち運ぶ印を示した。",
        statePatch: {
          newFacts: [
            `${world.protagonistName}は${world.centralSymbol}を持っている`,
          ],
          resolvedThreads: [],
          openedThreads: ["一度だけ開いた戸の行方"],
          motifsUsed: [world.portableMotif],
          currentLocation: world.startingLocation,
          protagonistChange: "見慣れた規則の小さなずれに気づいた",
        },
      },
    };

    this.emitProgress("ready", 1, "物語の入口ができました。");
    return result;
  }

  async generateScene(input: SceneRequest): Promise<SceneResult> {
    this.assertInitialized();
    this.emitProgress("generating", 0, "次の場面を組み立てています。");
    await this.waitForGeneration();
    this.consumeInjections("scene");

    const { context } = input;
    const sceneIndex = Math.max(1, Math.min(5, context.sceneIndexInMacro));
    const hash = stableHash(
      `${this.deterministicSeed}|scene|${JSON.stringify(context)}`,
    );
    const location =
      context.currentLocationId ?? context.storyBible.startingLocation;
    const destination = itemAt(
      DESTINATIONS,
      hash + context.macroPartIndex + sceneIndex,
    );
    const isMoveChoice = context.choice === "move";
    const leavesLocation = isMoveChoice || context.choice === "continue";
    const isClosure = sceneIndex === 5;
    const currentLocation = leavesLocation ? destination : location;
    const statePatch = this.buildStatePatch(
      context.macroPartIndex,
      sceneIndex,
      context.storyBible.portableMotif,
      currentLocation,
      leavesLocation,
      isClosure,
    );

    const action = leavesLocation
      ? `${location}の戸を静かに閉じ、${context.storyBible.portableMotif}を携えて${destination}へ渡った。出口までの道で、主人公は一度だけ足を止め、前の場所に残した仕掛けが元の位置へ戻ったことを確かめた。案内役は振り返らず、持ち出すものが一つなら記憶の形を崩さずに済むと告げた。境目を越えると、床の材質と空気の温度がゆっくり変わった。主人公は新しい景色を急いで名づけず、持ってきた印を光へ向けた。その表面には前の場所で得た細い傷が残り、ここでも同じ向きを指していた。二人は中央へ直進せず、まず入口の端を歩いて、古い規則がどこまで届くかを確かめた`
      : `${location}に残り、壁の継ぎ目に隠れていた古い目盛りを見つけた。主人公が埃を払うと、目盛りは高さではなく、ここを通った音の長さを記録しているように見えた。案内役は新しい道具を持ち出さず、以前から携えていた${context.storyBible.portableMotif}を継ぎ目へそっと近づけた。すると遠い足音と水の揺れが別々の間隔で返り、見慣れた壁の内側に薄い空間があることが分かった。主人公は壁を壊そうとせず、一つずつ響きを聞き分けた。やがて、最初に見落とした印だけが周囲と逆の順序で並んでいると気づいた。二人は同じ場所に立ったまま、景色の意味が少しずつ組み替わるのを待った`;
    const closure = isClosure
      ? "散らばっていた合図はやがて一つの向きを示し、ここまで追ってきた問いは静かに置き直された。主人公は動かなくなった仕掛けを元の位置へ戻し、案内役と並んで変化の終わりを見届けた。新しい扉は開かず、新しい危機の音も近づかなかった。ただ、通ってきた場所の輪郭が穏やかにつながり、帰る道と進む道の両方が同じ明るさで見えていた。主人公は結論を急がず、その眺めを覚えておくためにしばらく立ち止まった。"
      : "案内役は答えを告げず、見つかった順序を指で一度なぞった。主人公は次に確かめるべき小さな印だけを記録し、ほかの謎を増やさなかった。周囲の音が元の速さへ戻るころ、二人には同じ場所をもう少し見る道と、印を携えて離れる道がどちらも残されていた。";

    const result: SceneResult = {
      text: `第${context.macroPartIndex}章の${sceneIndex}つ目の場面。主人公は${action}。${closure}`,
      summary: `第${context.macroPartIndex}章${sceneIndex}場面で、主人公は${
        leavesLocation ? `${destination}へ移動した` : `${location}を深く調べた`
      }${isClosure ? "。局所的な問いは閉じた" : ""}。`,
      choiceReflection: isMoveChoice
        ? "移動の選択を受け、前の場所を局所的に閉じてモチーフを持ち出した。"
        : context.choice === "stay"
          ? "滞在の選択を受け、同じ場所の既存要素を深掘りした。"
          : "続行の選択を受け、前章のモチーフを保って新しい章を始めた。",
      statePatch,
    };

    this.emitProgress("ready", 1, "次の場面ができました。");
    return result;
  }

  async generateSceneText(
    input: FastSceneRequest,
    options: SceneStreamingOptions = {},
  ): Promise<FastSceneResult> {
    this.assertInitialized();
    this.emitProgress("generating", 0, "次の場面を書いています。");
    const startedAt = performance.now();
    await this.waitForGeneration();
    this.consumeInjections("scene");

    const text = renderPlannedScene(input.plan, input.mode);
    const chunkSize = 18;
    let firstChunkAt: number | null = null;
    for (let index = 0; index < text.length; index += chunkSize) {
      const chunk = text.slice(index, index + chunkSize);
      if (firstChunkAt === null) firstChunkAt = performance.now();
      options.onChunk?.(chunk);
    }
    const completedAt = performance.now();
    options.onMetrics?.({
      promptTokens: null,
      completionTokens: null,
      timeToFirstTokenMs:
        firstChunkAt === null ? null : Math.round(firstChunkAt - startedAt),
      completionMs: Math.round(completedAt - startedAt),
      tokensPerSecond: null,
    });
    this.emitProgress("ready", 1, "次の場面ができました。");
    return { text };
  }

  async generateEnding(input: EndingRequest): Promise<EndingResult> {
    this.assertInitialized();
    this.emitProgress("generating", 0, "終幕を整えています。");
    await this.waitForGeneration();
    this.consumeInjections("ending");

    const { context } = input;
    const hash = stableHash(
      `${this.deterministicSeed}|ending|${JSON.stringify(context)}`,
    );
    const ending = itemAt(ENDINGS, hash);
    const portableMotif = context.storyBible.portableMotif;
    const result: EndingResult = {
      epilogue: `${ending.image}。主人公は${portableMotif}を元の場所へ戻さず、窓辺にそっと置いた。道はそこで途切れたのではなく、振り返れる形になって静まった。`,
      title: ending.title,
      closingMotifs: [portableMotif],
    };

    this.emitProgress("ready", 1, "終幕ができました。");
    return result;
  }

  async interrupt(): Promise<void> {
    const pendingDelay = this.pendingGenerationDelay;
    if (pendingDelay !== undefined) {
      clearTimeout(pendingDelay.timer);
      this.pendingGenerationDelay = undefined;
      pendingDelay.reject(
        new MockNarrativeProviderError(
          "GENERATION_INTERRUPTED",
          "Mock generation was interrupted.",
        ),
      );
    }
    this.emitProgress("interrupted", 0, "生成を中断しました。");
  }

  async dispose(): Promise<void> {
    await this.interrupt();
    this.initialized = false;
    this.modelId = undefined;
    this.onProgress = undefined;
  }

  private validDelay(delayMs: number): number {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new RangeError("Mock delay must be a finite non-negative number.");
    }
    return delayMs;
  }

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new MockNarrativeProviderError(
        "MODEL_INIT_FAILED",
        "MockNarrativeProvider must be initialized before generation.",
      );
    }
  }

  private emitProgress(
    phase: ProviderProgress["phase"],
    progress: number,
    text: string,
    modelId = this.modelId,
  ): void {
    this.onProgress?.({ phase, progress, text, modelId });
  }

  private async waitForInitialization(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted === true) {
      throw abortError();
    }
    if (this.delayMs === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, this.delayMs);
      const onAbort = (): void => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(abortError());
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private async waitForGeneration(): Promise<void> {
    if (this.pendingGenerationDelay !== undefined) {
      throw new MockNarrativeProviderError(
        "GENERATION_FAILED",
        "A mock generation is already in progress.",
      );
    }
    if (this.delayMs === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingGenerationDelay = undefined;
        resolve();
      }, this.delayMs);
      this.pendingGenerationDelay = { timer, reject };
    });
  }

  private consumeInjectedError(operation: MockNarrativeOperation): void {
    if (this.nextError?.operation !== operation) {
      return;
    }

    const { error } = this.nextError;
    this.nextError = undefined;
    throw error;
  }

  private consumeInjections(operation: MockGenerationOperation): void {
    this.consumeInjectedError(operation);
    if (this.nextInvalid?.operation !== operation) {
      return;
    }

    this.nextInvalid = undefined;
    throw new MockNarrativeProviderError(
      "INVALID_MODEL_JSON",
      `Injected invalid mock ${operation} response.`,
    );
  }

  private buildStatePatch(
    macroPartIndex: number,
    sceneIndex: number,
    motif: string,
    currentLocation: string,
    leavesLocation: boolean,
    isClosure: boolean,
  ): StatePatch {
    if (isClosure) {
      return {
        newFacts: [`第${macroPartIndex}章の印は一つの向きを示した`],
        resolvedThreads: [`第${macroPartIndex}章で追っていた合図`],
        openedThreads: [],
        motifsUsed: [motif],
        currentLocation,
        protagonistChange: "答えを急がず、ここまでの道を選び直せるようになった",
      };
    }

    return {
      newFacts: [
        leavesLocation
          ? `${currentLocation}へ前の場所の印が持ち込まれた`
          : `${currentLocation}の古い目盛りが読めるようになった`,
      ],
      resolvedThreads: leavesLocation ? ["前の場所で追っていた小さな合図"] : [],
      openedThreads: [`第${macroPartIndex}章${sceneIndex}場面の小さな問い`],
      motifsUsed: [motif],
      currentLocation,
      protagonistChange: leavesLocation
        ? "手がかりを携えて場所を離れる決心をした"
        : "同じ場所の違いを以前より細かく見分けた",
    };
  }
}
