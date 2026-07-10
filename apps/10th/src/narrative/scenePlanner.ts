import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
  SCENES_PER_MACRO_PART,
} from "./constants";
import { getSceneFunction } from "./contextAssembler";
import type {
  GenerationMode,
  ReaderChoice,
  SceneLeadChoice,
  ScenePlan,
  SceneResult,
  StoryBible,
  StorySession,
  ThemeTransform,
} from "./types";

const LOCATIONS = [
  "風を量る回廊",
  "古い標本を灯す停車場",
  "水面下の郵便室",
  "鐘の鳴らない庭",
  "紙片を舟にする市場",
  "薄明かりの測量所",
  "屋根裏の潮見台",
  "余白を綴じる工房",
] as const;

const TONES = [
  "静かな観察と具体的な手触り",
  "抑えた驚きと短い対話",
  "余韻を残す明晰な描写",
  "一つの出来事へ集中する穏やかな緊張",
] as const;

const CHANGES = [
  "答えを急がず、目の前の違いを確かめられるようになった",
  "誰かに決められる前に、小さな選択を言葉にできるようになった",
  "同じ景色にも順序の変化があると気づいた",
  "持ち運べるものと置いていくものを自分で選べるようになった",
  "遠くへ行くことと深く見ることを別々に考えられるようになった",
] as const;

const EVENT_BY_FUNCTION = {
  arrival: [
    "入口の係が町の規則を一つだけ実演した",
    "閉じた扉の脇で、道具の正しい使い方が示された",
  ],
  observation: [
    "見慣れた印の並びに、音の長さを示す違いが見つかった",
    "案内役の手順を追ううち、物の置かれる順序に意味が現れた",
  ],
  discovery: [
    "規則から外れた小さな印が、隠れた通路の位置を示した",
    "誰も数えなかった間隔から、もう一つの決まりが読み取れた",
  ],
  reinterpretation: [
    "持っていた印を別の向きに置くと、同じ仕組みが違う役目を果たした",
    "案内役と一つの道具を交換し、古い規則を安全に試し直した",
  ],
  local_closure: [
    "ここで生じた問いに小さな答えが与えられ、次の道だけが残った",
    "使い終えた道具を元の場所へ戻し、景色が静かな形へ落ち着いた",
  ],
} as const;

const OPENING_PATTERNS = [
  (p: ScenePlan) =>
    `${p.location}では、朝ごとに同じ順番で道具が並べられていた。主人公は${p.motif}を掌に置き、案内役と列の端に立った。${p.event}。`,
  (p: ScenePlan) =>
    `薄い光が${p.location}の床を横切っていた。主人公が${p.motif}を取り出すと、案内役は声を落とし、ここで守るべき順序を指で示した。${p.event}。`,
  (p: ScenePlan) =>
    `${p.location}に着いた主人公は、壁際の目盛りが時刻ではなく音を測っていると知った。隣では案内役が${p.motif}の置き場所を空けている。${p.event}。`,
  (p: ScenePlan) =>
    `扉を越えた先の${p.location}には、名前より先に役目を渡す習慣があった。主人公は${p.motif}を見せ、案内役と最初の手続きを見守った。${p.event}。`,
  (p: ScenePlan) =>
    `${p.location}の天井から、一定の間を置いて水滴の音がした。主人公が足を止めると、案内役は${p.motif}を合図に使い、町の決まりを一つだけ見せた。${p.event}。`,
  (p: ScenePlan) =>
    `主人公と案内役が${p.location}へ入ると、人々は話す代わりに道具の向きを揃えた。主人公も${p.motif}を同じ向きへ置き、変化を待った。${p.event}。`,
  (p: ScenePlan) =>
    `${p.location}では、通った者の足音が細い紙片に記録されていた。主人公の前で案内役が一枚を開き、${p.motif}と照らし合わせた。${p.event}。`,
  (p: ScenePlan) =>
    `風の止まった${p.location}で、主人公は古い台の上に${p.motif}を見つけた。案内役は触れずに待ち、周囲の人々も一つの動作を繰り返した。${p.event}。`,
  (p: ScenePlan) =>
    `${p.location}の入口には、今日使うものだけを置く細い棚があった。主人公が${p.motif}を載せると、案内役が棚の奥の小さな仕掛けを動かした。${p.event}。`,
  (p: ScenePlan) =>
    `まだ誰も呼び名を口にしないまま、主人公は案内役と${p.location}を進んだ。手元の${p.motif}だけが歩みに合わせて淡く光る。${p.event}。`,
  (p: ScenePlan) =>
    `${p.location}には、昨日と同じ景色を確かめてから一日を始める規則があった。主人公は案内役の隣で${p.motif}を掲げ、最初の確認に加わった。${p.event}。`,
  (p: ScenePlan) =>
    `主人公が${p.location}へ踏み込むと、遠くの鐘より先に小さな器具が震えた。案内役は${p.motif}をその脇へ置き、主人公にも変化を見るよう促した。${p.event}。`,
] as const;

const CONTINUATION_PATTERNS = [
  (p: ScenePlan) =>
    `${p.location}で主人公は${p.motif}を確かめた。${p.event}。案内役は答えを言わず、主人公が自分で順序を見直すのを待った。`,
  (p: ScenePlan) =>
    `主人公と案内役は${p.location}の端に立った。${p.event}。${p.motif}は前の場面と違う角度から光を返し、主人公はその差を記憶した。`,
  (p: ScenePlan) =>
    `${p.event}。主人公は${p.location}に残る音を一つずつ聞き、${p.motif}を動かす前と後で何が変わったかを案内役へ伝えた。`,
  (p: ScenePlan) =>
    `${p.location}では急ぐ者ほど印を見落とした。主人公は足を止め、${p.motif}を手がかりにした。${p.event}。二人は次の動作だけを決めた。`,
  (p: ScenePlan) =>
    `案内役が${p.location}の古い台を拭うと、隠れていた目盛りが現れた。${p.event}。主人公は${p.motif}を元の場所へ戻し、残った違いを見つめた。`,
] as const;

export function stableNarrativeHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function itemAt<T>(items: readonly T[], hash: number): T {
  const item = items[hash % items.length];
  if (item === undefined) throw new Error("Narrative planning data is empty.");
  return item;
}

function withoutFixedPhrases(text: string): string {
  return [DEPARTURE_KEY_PHRASE, BRANCH_KEY_PHRASE, CLOSURE_KEY_PHRASE]
    .reduce((value, phrase) => value.replaceAll(phrase, ""), text)
    .replace(/\s+/gu, " ")
    .trim();
}

function fitText(
  text: string,
  minimum: number,
  maximum: number,
  plan: ScenePlan,
): string {
  const additions = [
    `周囲では細い音が一度だけ返り、主人公は${plan.protagonistChange}。`,
    `案内役は先を急がず、${plan.motif}のそばに残った小さな跡を示した。`,
    `主人公は見つけた順序を短く記し、次に確かめるものを一つだけ残した。`,
  ];
  let result = withoutFixedPhrases(text);
  let index = 0;
  while (result.length < minimum) {
    result += additions[index % additions.length];
    index += 1;
  }
  if (result.length <= maximum) return result;
  const clipped = result.slice(0, maximum - 1);
  const sentenceEnd = Math.max(
    clipped.lastIndexOf("。"),
    clipped.lastIndexOf("！"),
  );
  return `${sentenceEnd >= minimum ? clipped.slice(0, sentenceEnd) : clipped}。`;
}

function planId(
  sessionId: string,
  macroPartIndex: number,
  sceneIndexInMacro: number,
  choice: SceneLeadChoice,
): string {
  return `${sessionId}:plan:${macroPartIndex}:${sceneIndexInMacro}:${choice}`;
}

export function createOpeningScenePlan(
  sessionId: string,
  theme: ThemeTransform,
  bible: StoryBible,
): ScenePlan {
  const hash = stableNarrativeHash(`${sessionId}:${theme.centralSymbol}`);
  return {
    id: planId(sessionId, 1, 1, "start"),
    macroPartIndex: 1,
    sceneIndexInMacro: 1,
    sceneFunction: "arrival",
    choice: "start",
    location: bible.startingLocation,
    characters: [bible.protagonist.name, bible.companion.name],
    event: itemAt(EVENT_BY_FUNCTION.arrival, hash),
    motif: bible.portableMotif,
    protagonistChange: itemAt(CHANGES, hash >>> 3),
    tone: itemAt(TONES, hash >>> 5),
  };
}

export function createScenePlan(
  session: StorySession,
  choice: ReaderChoice | "continue",
): ScenePlan {
  if (!session.themeTransform || !session.storyBible) {
    throw new Error("ThemeTransform and StoryBible are required for planning.");
  }
  const sceneIndexInMacro = session.sceneIndexInMacro + 1;
  if (sceneIndexInMacro < 1 || sceneIndexInMacro > SCENES_PER_MACRO_PART) {
    throw new Error("Cannot plan beyond the current five-scene macro.");
  }
  const sceneFunction = getSceneFunction(sceneIndexInMacro);
  const hash = stableNarrativeHash(
    `${session.id}:${session.macroPartIndex}:${sceneIndexInMacro}:${choice}:${session.distanceIndex}:${session.depthIndex}`,
  );
  const location =
    choice === "stay" && session.currentLocationId
      ? session.currentLocationId
      : itemAt(LOCATIONS, hash);
  const motif = session.motifs.at(-1)?.name ?? session.storyBible.portableMotif;
  const activeThread = session.activeThreads.at(0)?.description;
  const openedThread =
    sceneFunction === "discovery" &&
    session.activeThreads.length < 3 &&
    choice !== "continue"
      ? `${location}で見つかった印の送り先`
      : undefined;
  const resolvedThread =
    sceneFunction === "local_closure" || choice === "move"
      ? activeThread
      : undefined;

  return {
    id: planId(session.id, session.macroPartIndex, sceneIndexInMacro, choice),
    macroPartIndex: session.macroPartIndex,
    sceneIndexInMacro,
    sceneFunction,
    choice,
    location,
    characters: [
      session.storyBible.protagonist.name,
      session.storyBible.companion.name,
    ],
    event: itemAt(EVENT_BY_FUNCTION[sceneFunction], hash >>> 2),
    motif,
    protagonistChange: itemAt(CHANGES, hash >>> 4),
    ...(openedThread ? { openedThread } : {}),
    ...(resolvedThread ? { resolvedThread } : {}),
    tone: session.storyBible.toneGuide.at(0) ?? itemAt(TONES, hash >>> 6),
  };
}

export function renderOpeningScene(plan: ScenePlan): string {
  const template = itemAt(
    OPENING_PATTERNS,
    stableNarrativeHash(`${plan.id}:opening`),
  );
  return fitText(template(plan), 180, 280, plan);
}

export function renderPlannedScene(
  plan: ScenePlan,
  mode: GenerationMode,
): string {
  const template = itemAt(
    CONTINUATION_PATTERNS,
    stableNarrativeHash(`${plan.id}:${mode}`),
  );
  const [minimum, maximum] =
    mode === "quality" || mode === "debug" ? [250, 450] : [180, 320];
  return fitText(template(plan), minimum, maximum, plan);
}

export function sanitizePlainSceneText(
  rawText: string,
  plan: ScenePlan,
  mode: GenerationMode,
): string {
  const withoutThinking = rawText
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/giu, "")
    .replace(/```(?:json|text|markdown)?/giu, "")
    .replace(/<[^>]+>/gu, "")
    .trim();
  const fallback = renderPlannedScene(plan, mode);
  if (withoutThinking.length < 80) return fallback;
  const [minimum, maximum] =
    mode === "quality" || mode === "debug" ? [250, 450] : [180, 320];
  return fitText(withoutThinking, minimum, maximum, plan);
}

export function sceneResultFromPlan(
  plan: ScenePlan,
  text: string,
): SceneResult {
  return {
    text,
    summary: `${plan.location}で${plan.event}。主人公は${plan.protagonistChange}。`,
    choiceReflection:
      plan.choice === "stay"
        ? "留まって既存の規則を深く見た"
        : plan.choice === "move"
          ? "局所を閉じて別の場所へ移った"
          : plan.choice === "continue"
            ? "前の大パートの変化を携えて続行した"
            : "象徴世界へ到着した",
    statePatch: {
      newFacts: [`${plan.location}で${plan.event}`],
      resolvedThreads: plan.resolvedThread ? [plan.resolvedThread] : [],
      openedThreads: plan.openedThread ? [plan.openedThread] : [],
      motifsUsed: [plan.motif],
      currentLocation: plan.location,
      protagonistChange: plan.protagonistChange,
    },
  };
}
