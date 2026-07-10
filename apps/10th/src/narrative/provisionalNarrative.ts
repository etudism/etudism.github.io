import {
  createOpeningScenePlan,
  renderOpeningScene,
  sceneResultFromPlan,
  stableNarrativeHash,
} from "./scenePlanner";
import type {
  ScenePlan,
  SeedResult,
  StoryBible,
  ThemeTransform,
} from "./types";

export type ReaderThemeCategory =
  | "repetition"
  | "lack_of_agency"
  | "overload"
  | "stagnation"
  | "social_fatigue"
  | "loneliness"
  | "meaning_deficit"
  | "uncertainty"
  | "constraint"
  | "other";

const CATEGORY_TERMS: Record<ReaderThemeCategory, readonly string[]> = {
  repetition: ["同じ", "毎日", "繰り返", "変わり映え", "ルーティン"],
  lack_of_agency: ["選べない", "決められ", "言われる", "従う", "自由がない"],
  overload: ["忙しい", "多すぎ", "疲れ", "余裕", "追われ"],
  stagnation: ["進まない", "停滞", "動かない", "足踏み", "変わらない"],
  social_fatigue: ["人付き合い", "会議", "連絡", "気を遣", "SNS"],
  loneliness: ["ひとり", "孤独", "誰も", "寂し", "話せない"],
  meaning_deficit: ["意味", "目的", "空しい", "何のため", "やりがい"],
  uncertainty: ["分からない", "不安", "迷う", "先が見え", "決めかね"],
  constraint: ["制限", "締切", "お金", "時間がない", "縛ら"],
  other: [],
};

const CATEGORY_WORLD: Record<
  ReaderThemeCategory,
  {
    emotionalPattern: string;
    tension: string;
    world: string;
    symbol: string;
    location: string;
  }
> = {
  repetition: {
    emotionalPattern: "同じ形の時間に小さな差を探す感覚",
    tension: "保たれた順序と、順序を一つ変える好奇心",
    world: "毎朝同じ日付札を配る水路の町",
    symbol: "時刻のない銀色の切符",
    location: "日付札を配る水門前",
  },
  lack_of_agency: {
    emotionalPattern: "自分の選択が見えにくくなる感覚",
    tension: "割り当てられた役目と、小さく選び直す動作",
    world: "道順を他人の札で決める橋の都市",
    symbol: "向きを変えられる白い標識",
    location: "行き先札を預ける橋詰め",
  },
  overload: {
    emotionalPattern: "多くの合図を同時に受け取る感覚",
    tension: "鳴り続ける通知と、一つだけ選ぶ静けさ",
    world: "風の便りをすべて瓶へ詰める高台の局",
    symbol: "音を一つだけ残す青い栓",
    location: "風便を仕分ける高台局",
  },
  stagnation: {
    emotionalPattern: "動かない景色の中で変化を待つ感覚",
    tension: "止まった装置と、別の尺度で測る試み",
    world: "針の進まない潮時計塔の島",
    symbol: "青い砂の小瓶",
    location: "潮時計塔の影にある渡し場",
  },
  social_fatigue: {
    emotionalPattern: "多くの声の間で自分の輪郭が薄くなる感覚",
    tension: "絶えない会話と、言葉を置かない共同作業",
    world: "挨拶を紙片で交換する夕暮れ市場",
    symbol: "まだ何も書かれていない小札",
    location: "挨拶札を乾かす夕暮れ市場",
  },
  loneliness: {
    emotionalPattern: "誰にも届かないと思う静けさ",
    tension: "閉じた部屋と、返事を求めない小さな合図",
    world: "水面下へ手紙を預ける郵便の町",
    symbol: "空のまま届く透明な封筒",
    location: "水面下の郵便室",
  },
  meaning_deficit: {
    emotionalPattern: "行為と意味のつながりが見えなくなる感覚",
    tension: "役目を失った道具と、新しい使い方の発見",
    world: "用途を忘れた道具を収める標本駅",
    symbol: "名前の消えた真鍮の鍵",
    location: "古い標本を灯す停車場",
  },
  uncertainty: {
    emotionalPattern: "複数の道が同じ濃さに見える感覚",
    tension: "確かな地図と、まだ描かれていない余白",
    world: "列車ごとに書架の並びが変わる地下図書駅",
    symbol: "余白だけが残った地図帳",
    location: "閉じた三番線の閲覧室",
  },
  constraint: {
    emotionalPattern: "狭い範囲で動き方を探す感覚",
    tension: "動かせない境界と、境界の中で変えられる順序",
    world: "一日に一枚だけ扉を開ける環状の庭",
    symbol: "折り目の位置を変えられる通行紙",
    location: "鐘の鳴らない庭の受付",
  },
  other: {
    emotionalPattern: "まだ名前のない停滞を観察する感覚",
    tension: "見慣れた景色と、手触りの違う小さな印",
    world: "物の影を毎晩並べ替える薄明かりの町",
    symbol: "片面だけ温かい陶器の印",
    location: "影を測る薄明かりの測量所",
  },
};

const PROTAGONIST_NAMES = ["ユノ", "ナギ", "スイ", "ミオ", "トキ"] as const;
const COMPANION_NAMES = ["トワ", "リツ", "ハク", "エン", "シロ"] as const;

// For these stems, a following negative expression is itself the theme signal
// (for example, "余裕がない" or "先が見えない"). Other nearby negatives
// mean that the matched word should not contribute to the provisional theme.
const NEGATION_COMPLETES_SIGNAL = new Set([
  "決められ",
  "余裕",
  "誰も",
  "意味",
  "目的",
  "やりがい",
  "先が見え",
  "お金",
]);

function normalizedInput(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/\s+/gu, "");
}

export function classifyReaderTheme(input: string): ReaderThemeCategory {
  const normalized = normalizedInput(input);
  let best: ReaderThemeCategory = "other";
  let bestScore = 0;

  for (const [category, terms] of Object.entries(CATEGORY_TERMS) as Array<
    [ReaderThemeCategory, readonly string[]]
  >) {
    let score = 0;
    for (const term of terms) {
      const normalizedTerm = term.toLocaleLowerCase("ja-JP");
      const index = normalized.indexOf(normalizedTerm);
      if (index < 0) continue;
      const suffix = normalized.slice(
        index + normalizedTerm.length,
        index + normalizedTerm.length + 9,
      );
      const isNegated =
        !normalizedTerm.includes("ない") &&
        !NEGATION_COMPLETES_SIGNAL.has(normalizedTerm) &&
        /(?:じゃない|ではない|くない|てない|てはいない|てもいない)/u.test(
          suffix,
        );
      score += isNegated ? 0 : 1;
    }
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return best;
}

export function createProvisionalNarrative(
  readerInput: string,
  sessionId: string,
): {
  category: ReaderThemeCategory;
  themeTransform: ThemeTransform;
  storyBible: StoryBible;
} {
  const category = classifyReaderTheme(readerInput);
  const config = CATEGORY_WORLD[category];
  const hash = stableNarrativeHash(
    `${sessionId}:${normalizedInput(readerInput)}`,
  );
  const protagonistName =
    PROTAGONIST_NAMES[hash % PROTAGONIST_NAMES.length] ?? "ユノ";
  const companionName =
    COMPANION_NAMES[(hash >>> 4) % COMPANION_NAMES.length] ?? "トワ";

  return {
    category,
    themeTransform: {
      emotionalPattern: config.emotionalPattern,
      narrativeTension: config.tension,
      allegoricalWorld: config.world,
      centralSymbol: config.symbol,
      protagonistDistance: "third_person",
      literalTermsToAvoid: ["診断", "助言", "現実の固有名詞"],
    },
    storyBible: {
      protagonist: {
        name: protagonistName,
        description: "小さな違いを見落とさず、結論を急がない旅人",
        desire: "自分で選んだ一つの動作を確かめること",
        limitation: "変化は大きな出来事だけに現れると思っている",
      },
      companion: {
        name: companionName,
        description: "答えを先回りせず、土地の手順だけを示す案内役",
        speakingStyle: "短く具体的で、問いを一つだけ残す",
      },
      worldRule: `${config.world}では、変化を言葉ではなく物の順序で記録する。`,
      startingLocation: config.location,
      portableMotif: config.symbol,
      toneGuide: ["静かな観察", "具体的な場所と物", "説教をしない"],
      prohibitedPatterns: ["夢オチ", "診断", "読者への助言", "急な大事件"],
    },
  };
}

export function createProvisionalSeed(
  readerInput: string,
  sessionId: string,
): SeedResult {
  const provisional = createProvisionalNarrative(readerInput, sessionId);
  const plan = createOpeningScenePlan(
    sessionId,
    provisional.themeTransform,
    provisional.storyBible,
  );
  return {
    themeTransform: provisional.themeTransform,
    storyBible: provisional.storyBible,
    firstScene: sceneResultFromPlan(plan, renderOpeningScene(plan)),
  };
}

export function createProvisionalOpening(
  readerInput: string,
  sessionId: string,
): {
  category: ReaderThemeCategory;
  plan: ScenePlan;
  seed: SeedResult;
} {
  const provisional = createProvisionalNarrative(readerInput, sessionId);
  const plan = createOpeningScenePlan(
    sessionId,
    provisional.themeTransform,
    provisional.storyBible,
  );
  return {
    category: provisional.category,
    plan,
    seed: {
      themeTransform: provisional.themeTransform,
      storyBible: provisional.storyBible,
      firstScene: sceneResultFromPlan(plan, renderOpeningScene(plan)),
    },
  };
}
