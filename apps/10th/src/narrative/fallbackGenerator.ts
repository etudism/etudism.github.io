import type {
  EndingContext,
  EndingResult,
  NarrativeContext,
  SceneResult,
  SeedResult,
  StatePatch,
} from "./types";

const FALLBACK_WORLDS = [
  {
    world: "潮の満ち引きで道順が変わる、古い水路の町",
    symbol: "時刻のない銀色の鍵",
    location: "水位標の並ぶ北の船着場",
    rule: "鐘が一度鳴るたび、町の橋は一つだけ別の岸へ架かる",
  },
  {
    world: "夜ごと棚の位置が変わる、山腹の図書迷宮",
    symbol: "余白だけが記された小さな地図",
    location: "風の音を分類する閲覧室",
    rule: "読み終えた頁を閉じると、まだ名のない通路が一つ現れる",
  },
  {
    world: "季節を載せた列車が循環する、境界の高原",
    symbol: "片面だけ温かい陶器の切符",
    location: "時計草に囲まれた無人駅",
    rule: "列車は待つ者の前では止まり、歩き出した者の背後でだけ動く",
  },
] as const;

function stableIndex(value: string, length: number): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return Math.abs(hash) % length;
}

export function generateFallbackSeed(readerInput = ""): SeedResult {
  const selected =
    FALLBACK_WORLDS[stableIndex(readerInput, FALLBACK_WORLDS.length)] ??
    FALLBACK_WORLDS[0];
  const statePatch: StatePatch = {
    newFacts: [selected.rule, "旅人は銀灰色の外套を着ている"],
    resolvedThreads: [],
    openedThreads: ["案内人が示した印の行き先"],
    motifsUsed: [selected.symbol],
    currentLocation: selected.location,
    protagonistChange: "旅人は、立ち止まって周囲の規則を観察することを選んだ",
  };

  return {
    themeTransform: {
      emotionalPattern: "同じ輪郭の時間の中で、微かな差異を探している",
      narrativeTension: "留まって見極めることと、未知の方向へ踏み出すことの間",
      allegoricalWorld: selected.world,
      centralSymbol: selected.symbol,
      protagonistDistance: "third_person",
      literalTermsToAvoid: [],
    },
    storyBible: {
      protagonist: {
        name: "ユウ",
        description: "遠い土地から来た、銀灰色の外套の旅人",
        desire: "まだ名前のない道の意味を確かめること",
        limitation: "急ぐと周囲の小さな変化を見落としてしまうこと",
      },
      companion: {
        name: "ネネ",
        description: "町の規則を半分だけ知る、小柄な案内人",
        speakingStyle: "短い問いを置き、答えを急がせない",
      },
      worldRule: selected.rule,
      startingLocation: selected.location,
      portableMotif: selected.symbol,
      toneGuide: ["静かな具体性", "余白のある結び", "穏やかな驚き"],
      prohibitedPatterns: ["説教", "夢オチ", "急な全面解決"],
    },
    firstScene: {
      text: `ユウが${selected.location}へ着いたとき、足元の石段には乾いた線と濡れた線が交互に残っていた。荷を置く場所を探していると、欄干の陰からネネが現れ、町では道そのものが時刻を持つのだと教えた。遠くで鐘が一度鳴り、さっきまで対岸へ伸びていた橋が、音もなく隣の水路へ向きを変えた。ユウは渡りかけた足を戻し、外套の内側で${selected.symbol}がわずかに温かくなるのを感じた。ネネは理由を説明せず、水位標の一つに刻まれた小さな印を指した。その印だけは、水が上下しても同じ高さに留まっていた。二人は石段へ腰を下ろし、次の鐘を待ちながら、行き交う人々がどの橋を選ばないのかを見つめた。`,
      summary: `ユウは${selected.location}へ到着し、ネネから「${selected.rule}」という規則を知った。${selected.symbol}が反応し、水位標には動かない印があった。`,
      choiceReflection: "最初の場面なので、世界の規則と観察すべき印を提示した",
      statePatch,
    },
  };
}

function fallbackLocation(context: NarrativeContext): string {
  const locations = ["風待ちの渡廊", "薄明の標本庭", "水鏡の停車場"] as const;
  return (
    locations[
      (context.macroPartIndex + context.distanceIndex) % locations.length
    ] ?? locations[0]
  );
}

function primaryMotif(context: NarrativeContext): string {
  return context.motifs.at(-1)?.name ?? context.storyBible.portableMotif;
}

export function generateFallbackScene(context: NarrativeContext): SceneResult {
  const protagonist = context.storyBible.protagonist.name;
  const companion = context.storyBible.companion.name;
  const motif = primaryMotif(context);
  const currentLocation =
    context.currentLocationId ?? context.storyBible.startingLocation;
  const isClosure = context.sceneFunction === "local_closure";

  if (context.choice === "stay") {
    return {
      text: isClosure
        ? `${protagonist}は${currentLocation}に残り、${motif}を窓辺の光へかざした。これまで見えなかった細い傷が一筋だけ浮かび、${companion}はそれが帰る方向ではなく、ここで見つけたものの印だと静かに告げた。二人は動かなくなった仕掛けを元の場所へ戻した。あたりには解決を祝う音も、新しい異変の気配もなかった。ただ、同じ景色を見直したことで、最初とは違う余白が生まれていた。${protagonist}はその余白を急いで埋めず、次に歩くときまで覚えておくことにした。`
        : `${protagonist}は${currentLocation}に留まり、通り過ぎかけた壁の継ぎ目へ指を当てた。${motif}が触れると、継ぎ目の奥から小さな反響が返った。${companion}は新しい名を与えず、以前に見た印との違いだけを指した。二人がしばらく待つと、反響は周囲の足音ではなく、この場所で止まった人の呼吸に応じていると分かった。${protagonist}は進む前に、目の前の規則をもう一度確かめることにした。見慣れた場所の内側に、まだ一枚だけ薄い層が残っていた。`,
      summary: `${protagonist}は${currentLocation}に留まり、${motif}を通して既存の規則の別の層を見つけた。`,
      choiceReflection: "stayを反映し、現在地と既存要素を維持して深掘りした",
      statePatch: {
        newFacts: [`${motif}は静かな反響に反応する`],
        resolvedThreads: isClosure
          ? context.activeThreads
              .slice(0, 2)
              .map((thread) => thread.description)
          : [],
        openedThreads: isClosure ? [] : ["壁の継ぎ目が残した反響の意味"],
        motifsUsed: [motif],
        currentLocation,
        protagonistChange: `${protagonist}は同じ場所を見直す時間を受け入れた`,
      },
    };
  }

  const nextLocation = fallbackLocation(context);
  const transitionText =
    context.choice === "continue"
      ? "前の出来事を閉じたまま、二人は朝の道を選んだ"
      : "二人は残っていた仕掛けを静かに元へ戻し、出口を選んだ";
  return {
    text: isClosure
      ? `${transitionText}。${protagonist}は${motif}を手の中で確かめ、${currentLocation}で交わした約束を一つだけ胸に残した。境目まで来ると、${companion}は振り返らずに扉を閉めた。閉じた扉はもう問いを投げず、その表面に淡い光を返すだけだった。二人は足を止め、遠ざかった場所の輪郭が穏やかにほどけるのを見届けた。新しい事件は起こらなかった。歩いた距離だけが、持ち出したものの重さを少し変えていた。`
      : `${transitionText}。${protagonist}は${currentLocation}から${motif}だけを持ち出し、${companion}と細い通路を抜けた。ほどなく空気の匂いが変わり、二人は${nextLocation}へ出た。そこでは人影を増やす代わりに、床へ落ちる光がゆっくり向きを変えていた。${protagonist}は前の場所で知った規則を試し、すぐには中央へ進まなかった。持ち出した${motif}は一度だけ応え、ここでも過去との細い連続が失われていないことを示した。`,
    summary: `${protagonist}は${currentLocation}を局所的に閉じ、${motif}を携えて${nextLocation}へ移った。`,
    choiceReflection: `${context.choice}を反映し、前の場所を閉じて既存モチーフを持ち出した`,
    statePatch: {
      newFacts: [`${motif}は場所を越えて反応を保つ`],
      resolvedThreads: context.activeThreads
        .slice(0, isClosure ? 2 : 1)
        .map((thread) => thread.description),
      openedThreads: isClosure ? [] : [`${nextLocation}で光の向きが変わる理由`],
      motifsUsed: [motif],
      currentLocation: nextLocation,
      protagonistChange: `${protagonist}は持ち出すものを一つに選んだ`,
    },
  };
}

export function generateFallbackEnding(context: EndingContext): EndingResult {
  const protagonist = context.storyBible.protagonist.name;
  const motif = context.motifs.at(-1)?.name ?? context.storyBible.portableMotif;
  const location =
    context.currentLocationId ?? context.storyBible.startingLocation;
  const titles = [
    "余白を渡る鍵",
    "橋の向こうの静けさ",
    "名のない道標",
  ] as const;
  const title = titles[context.totalSceneCount % titles.length] ?? titles[0];

  return {
    epilogue: `${location}の光が薄くなるころ、${protagonist}は${motif}を掌へ載せた。歩いてきた場所はもう問いを増やさず、遠い輪郭のまま静かにそこにあった。${protagonist}は最後に一度だけ振り返り、変わった意味を確かめると、そのまま明るい方角へ歩き出した。`,
    title,
    closingMotifs: [motif],
  };
}

export const createFallbackSeed = generateFallbackSeed;
export const createFallbackScene = generateFallbackScene;
export const createFallbackEnding = generateFallbackEnding;
