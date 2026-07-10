import { describe, expect, it } from "vitest";

import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
} from "../../src/narrative/constants";
import { createSceneRequest } from "../../src/narrative/contextAssembler";
import {
  assembleFastSceneContext,
  createFastSceneRequest,
  fastScenePromptCharacters,
} from "../../src/narrative/fastContext";
import {
  buildFastScenePromptMessages,
  buildScenePromptMessages,
  promptCharacterCount,
} from "../../src/narrative/promptTemplates";
import {
  classifyReaderTheme,
  createProvisionalOpening,
} from "../../src/narrative/provisionalNarrative";
import {
  createScenePlan,
  renderOpeningScene,
  renderPlannedScene,
  sanitizePlainSceneText,
  stableNarrativeHash,
} from "../../src/narrative/scenePlanner";
import {
  acknowledgeDeparture,
  applyProvisionalOpening,
  chooseClosure,
  commitPlannedScene,
  createStorySession,
} from "../../src/narrative/storyEngine";
import type {
  ScenePlan,
  SceneRecord,
  StorySession,
} from "../../src/narrative/types";

const NOW = "2026-07-11T03:00:00.000Z";
const READER_INPUT = "毎日同じ仕事が繰り返され、景色が変わらない";
const PRIVATE_READER_INPUT = "非公開入力原文ZXCV-4729を絶対に再掲しない";
const FIXED_PHRASES = [
  DEPARTURE_KEY_PHRASE,
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
] as const;

function openedSession(
  id = "fast-pipeline-session",
  readerInput = READER_INPUT,
): StorySession {
  const draft = createStorySession({ id, readerInput, now: NOW });
  const provisional = createProvisionalOpening(readerInput, id);
  return acknowledgeDeparture(
    applyProvisionalOpening(draft, provisional.seed, provisional.plan, NOW),
    NOW,
  );
}

function recordWithText(
  base: SceneRecord,
  text: string,
  summary: string,
): SceneRecord {
  return { ...base, text, summary };
}

describe("provisional narrative", () => {
  it.each([
    ["毎日同じことを繰り返している", "repetition"],
    ["自由がないうえ、自分では選べない", "lack_of_agency"],
    ["忙しい仕事に追われて疲れた", "overload"],
    ["計画が停滞し、何も進まない", "stagnation"],
    ["会議と連絡ばかりで人付き合いに気を遣う", "social_fatigue"],
    ["ひとりで孤独を感じ、誰とも話せない", "loneliness"],
    ["何のためか分からず、やりがいも意味もない", "meaning_deficit"],
    ["先が見えず、不安で決めかねている", "uncertainty"],
    ["締切と制限があり、時間がない", "constraint"],
    ["窓辺で紫色の石を静かに眺めている", "other"],
  ] as const)("classifies %s as %s", (input, category) => {
    expect(classifyReaderTheme(input)).toBe(category);
  });

  it("does not treat a simply negated signal as the reader's theme", () => {
    expect(classifyReaderTheme("忙しいじゃないし、疲れてもいない")).toBe(
      "other",
    );
  });

  it("is deterministic for the same input hash and never copies the input", () => {
    const first = createProvisionalOpening(
      PRIVATE_READER_INPUT,
      "deterministic-session",
    );
    const second = createProvisionalOpening(
      PRIVATE_READER_INPUT,
      "deterministic-session",
    );
    const serialized = JSON.stringify(first);

    expect(second).toEqual(first);
    expect(serialized).not.toContain(PRIVATE_READER_INPUT);
    expect(first.seed.firstScene.text).not.toContain(PRIVATE_READER_INPUT);
  });
});

describe("opening scene variants", () => {
  it("reaches all twelve deterministic patterns within the required length", () => {
    const byPattern = new Map<number, string>();

    for (
      let ordinal = 0;
      ordinal < 5_000 && byPattern.size < 12;
      ordinal += 1
    ) {
      const opening = createProvisionalOpening(
        READER_INPUT,
        `opening-variant-${ordinal}`,
      );
      const pattern = stableNarrativeHash(`${opening.plan.id}:opening`) % 12;
      byPattern.set(pattern, renderOpeningScene(opening.plan));
    }

    expect([...byPattern.keys()].sort((left, right) => left - right)).toEqual(
      Array.from({ length: 12 }, (_, index) => index),
    );
    expect(new Set(byPattern.values())).toHaveLength(12);
    for (const text of byPattern.values()) {
      expect(text.length).toBeGreaterThanOrEqual(180);
      expect(text.length).toBeLessThanOrEqual(280);
      expect(text).not.toContain(READER_INPUT);
      for (const phrase of FIXED_PHRASES) expect(text).not.toContain(phrase);
    }
  });
});

describe("ScenePlanner", () => {
  it("keeps stay local, moves and resolves locally, and is deterministic", () => {
    const base = openedSession();
    const session: StorySession = {
      ...base,
      activeThreads: [
        {
          id: "thread-1",
          description: "水門から届く札の送り主",
          openedAtMacroPart: 1,
          updatedAt: NOW,
        },
      ],
    };

    const stay = createScenePlan(session, "stay");
    const move = createScenePlan(session, "move");

    expect(stay).toEqual(createScenePlan(session, "stay"));
    expect(move).toEqual(createScenePlan(session, "move"));
    expect(stay).toMatchObject({
      choice: "stay",
      sceneIndexInMacro: 2,
      sceneFunction: "observation",
      location: session.currentLocationId,
    });
    expect(stay.resolvedThread).toBeUndefined();
    expect(move.choice).toBe("move");
    expect(move.location).not.toBe(session.currentLocationId);
    expect(move.resolvedThread).toBe("水門から届く札の送り主");
  });

  it("does not open a fourth thread and makes scene five a local closure", () => {
    const base = openedSession();
    const threads = Array.from({ length: 3 }, (_, index) => ({
      id: `thread-${index}`,
      description: `未解決の糸-${index}`,
      openedAtMacroPart: 1,
      updatedAt: NOW,
    }));
    const discoverySession: StorySession = {
      ...base,
      sceneIndexInMacro: 2,
      totalSceneCount: 2,
      activeThreads: threads,
    };
    const discovery = createScenePlan(discoverySession, "stay");
    expect(discovery.sceneFunction).toBe("discovery");
    expect(discovery.openedThread).toBeUndefined();

    const closureSession: StorySession = {
      ...base,
      sceneIndexInMacro: 4,
      totalSceneCount: 4,
      activeThreads: threads,
    };
    const closure = createScenePlan(closureSession, "stay");
    expect(closure).toMatchObject({
      sceneIndexInMacro: 5,
      sceneFunction: "local_closure",
      resolvedThread: threads[0]?.description,
    });
    expect(closure.openedThread).toBeUndefined();
  });

  it("continues into a new macro with at most one thread and motif", () => {
    const base = openedSession();
    const closureSession: StorySession = {
      ...base,
      status: "awaiting_closure",
      sceneIndexInMacro: 5,
      totalSceneCount: 5,
      activeThreads: Array.from({ length: 3 }, (_, index) => ({
        id: `thread-${index}`,
        description: `継続する糸-${index}`,
        openedAtMacroPart: 1,
        updatedAt: NOW,
      })),
      motifs: Array.from({ length: 5 }, (_, index) => ({
        id: `motif-${index}`,
        name: `携帯モチーフ-${index}`,
        useCount: index + 1,
        lastUsedAt: NOW,
      })),
    };

    const planningSession = chooseClosure(closureSession, "continue", NOW);
    const continued = createScenePlan(planningSession, "continue");

    expect(planningSession.activeThreads.length).toBeLessThanOrEqual(1);
    expect(planningSession.motifs.length).toBeLessThanOrEqual(1);
    expect(continued).toEqual(createScenePlan(planningSession, "continue"));
    expect(continued).toMatchObject({
      macroPartIndex: 2,
      sceneIndexInMacro: 1,
      sceneFunction: "arrival",
      choice: "continue",
    });
  });

  it("keeps planned commits within the canonical thread and motif caps", () => {
    const base = openedSession();
    const session: StorySession = {
      ...base,
      sceneIndexInMacro: 2,
      totalSceneCount: 2,
      activeThreads: Array.from({ length: 2 }, (_, index) => ({
        id: `thread-${index}`,
        description: `未解決-${index}`,
        openedAtMacroPart: 1,
        updatedAt: NOW,
      })),
      motifs: Array.from({ length: 5 }, (_, index) => ({
        id: `motif-${index}`,
        name: `モチーフ-${index}`,
        useCount: 1,
        lastUsedAt: NOW,
      })),
    };
    const plan = createScenePlan(session, "stay");
    const committed = commitPlannedScene(
      session,
      plan,
      renderPlannedScene(plan, "demo"),
      "demo",
      NOW,
    );

    expect(committed.activeThreads).toHaveLength(3);
    expect(committed.motifs).toHaveLength(5);
  });
});

describe("fast scene context", () => {
  it("reduces a representative scene prompt against the v1 structured path", () => {
    const session = openedSession("prompt-comparison");
    const plan = createScenePlan(session, "stay");
    const fastCharacters = promptCharacterCount(
      buildFastScenePromptMessages(
        createFastSceneRequest(session, plan, "fast"),
      ),
    );
    const legacyCharacters = promptCharacterCount(
      buildScenePromptMessages(createSceneRequest(session, "stay")),
    );

    expect(fastCharacters).toBeLessThan(legacyCharacters);
  });

  it("enforces every cap, excludes raw input, and stays within a compact size", () => {
    const base = openedSession("private-fast-context", PRIVATE_READER_INPUT);
    const firstScene = base.scenes[0];
    if (!firstScene || !base.storyBible) throw new Error("missing seed");
    const safePlan = createScenePlan(base, "stay");
    const maxPlan: ScenePlan = {
      ...safePlan,
      id: "計".repeat(300),
      location: "場".repeat(300),
      characters: ["人".repeat(200), "者".repeat(200), "友".repeat(200)],
      event: "事".repeat(500),
      motif: "印".repeat(200),
      protagonistChange: "変".repeat(500),
      openedThread: "開".repeat(300),
      resolvedThread: "閉".repeat(300),
      tone: "調".repeat(300),
    };
    const session: StorySession = {
      ...base,
      storyBible: {
        ...base.storyBible,
        protagonist: {
          ...base.storyBible.protagonist,
          name: PRIVATE_READER_INPUT,
          description: `説明${PRIVATE_READER_INPUT}`,
        },
        companion: {
          ...base.storyBible.companion,
          description: `案内${PRIVATE_READER_INPUT}`,
        },
        worldRule: `規則${PRIVATE_READER_INPUT}`,
        portableMotif: PRIVATE_READER_INPUT,
      },
      rollingSummary: `${"要".repeat(900)}${PRIVATE_READER_INPUT}`,
      canonicalFacts: Array.from({ length: 12 }, (_, index) => ({
        id: `fact-${index}`,
        text:
          index === 11
            ? `事実${PRIVATE_READER_INPUT}`
            : `事実-${index}-${"実".repeat(280)}`,
        createdAt: NOW,
      })),
      activeThreads: Array.from({ length: 7 }, (_, index) => ({
        id: `thread-${index}`,
        description: `糸-${index}-${"糸".repeat(280)}`,
        openedAtMacroPart: 1,
        updatedAt: NOW,
      })),
      motifs: Array.from({ length: 9 }, (_, index) => ({
        id: `motif-${index}`,
        name: `印-${index}-${"印".repeat(280)}`,
        useCount: 1,
        lastUsedAt: NOW,
      })),
      scenes: [
        recordWithText(
          firstScene,
          `${"前".repeat(100)}${PRIVATE_READER_INPUT}${"尾".repeat(500)}`,
          `${"要".repeat(300)}${PRIVATE_READER_INPUT}`,
        ),
      ],
    };

    const context = assembleFastSceneContext(session, maxPlan);
    const request = createFastSceneRequest(session, maxPlan, "fast");
    const messages = buildFastScenePromptMessages(request);
    const serialized = JSON.stringify(request);

    expect(Object.hasOwn(context, "readerInput")).toBe(false);
    expect(serialized).not.toContain(PRIVATE_READER_INPUT);
    expect(context.facts).toHaveLength(8);
    expect(context.threads).toHaveLength(3);
    expect(context.motifs).toHaveLength(4);
    expect(context.previousSummary).toHaveLength(240);
    expect(context.previousTextTail).toHaveLength(400);
    expect(context.previousTextTail).toBe("尾".repeat(400));
    expect(context.rollingSummary.length).toBeLessThanOrEqual(800);
    expect(fastScenePromptCharacters(request)).toBeLessThanOrEqual(16_000);
    expect(promptCharacterCount(messages)).toBeLessThanOrEqual(17_000);
    expect(messages.map((message) => message.content).join("\n")).not.toContain(
      PRIVATE_READER_INPUT,
    );
  });
});

describe("planned scene commit boundary", () => {
  it("sanitizes streamed prose to each mode's bounded length", () => {
    const canonical = openedSession("stream-sanitize");
    const plan = createScenePlan(canonical, "stay");
    const unsafe = `<think>隠す推論${"思".repeat(100)}</think>\`\`\`json\n${"具体的な景色と行動。".repeat(
      80,
    )}\n\`\`\`${BRANCH_KEY_PHRASE}`;
    const fast = sanitizePlainSceneText(unsafe, plan, "fast");
    const quality = sanitizePlainSceneText(unsafe, plan, "quality");

    expect(fast.length).toBeGreaterThanOrEqual(180);
    expect(fast.length).toBeLessThanOrEqual(320);
    expect(quality.length).toBeGreaterThanOrEqual(250);
    expect(quality.length).toBeLessThanOrEqual(450);
    for (const text of [fast, quality]) {
      expect(text).not.toContain("隠す推論");
      expect(text).not.toContain("```json");
      expect(text).not.toContain(BRANCH_KEY_PHRASE);
    }
  });

  it("leaves canonical state untouched until completion and applies plan-only state", () => {
    const canonical = openedSession("atomic-commit");
    const before = JSON.stringify(canonical);
    const plan = createScenePlan(canonical, "stay");
    const partialText = "まだ完了していない断片";

    renderPlannedScene(plan, "fast");
    expect(JSON.stringify(canonical)).toBe(before);
    expect(canonical.scenes.at(-1)?.text).not.toContain(partialText);

    const untrustedCompletedText =
      `${"生成本文だけを表示する。".repeat(12)}` +
      ' {"currentLocation":"改ざん場所","openedThreads":["偽の糸"]}';
    const committed = commitPlannedScene(
      canonical,
      plan,
      untrustedCompletedText,
      "fast",
      NOW,
    );

    expect(JSON.stringify(canonical)).toBe(before);
    expect(committed.currentLocationId).toBe(plan.location);
    expect(committed.latestProtagonistChange).toBe(plan.protagonistChange);
    expect(committed.canonicalFacts.at(-1)?.text).toBe(
      `${plan.location}で${plan.event}`,
    );
    expect(committed.scenes.at(-1)?.plan).toEqual(plan);
    expect(committed.scenes.at(-1)?.text).toContain("改ざん場所");
    expect(
      committed.activeThreads.some((thread) => thread.description === "偽の糸"),
    ).toBe(false);
  });
});
