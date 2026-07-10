import { describe, expect, it } from "vitest";

import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
  TITLE_KEY_PHRASE_TEMPLATE,
  formatTitleKeyPhrase,
} from "../../src/narrative/constants";
import {
  assembleSceneContext,
  getSceneFunction,
} from "../../src/narrative/contextAssembler";
import {
  generateFallbackEnding,
  generateFallbackScene,
  generateFallbackSeed,
} from "../../src/narrative/fallbackGenerator";
import {
  statePatchSchema,
  storySessionSchema,
} from "../../src/narrative/schemas";
import {
  acknowledgeDeparture,
  applyEndingResult,
  applySceneResult,
  applySeedResult,
  beginSeedGeneration,
  chooseBranch,
  chooseClosure,
  createStorySession,
  getStoryDecision,
  validateReaderInput,
} from "../../src/narrative/storyEngine";
import type {
  ReaderChoice,
  SceneResult,
  StorySession,
} from "../../src/narrative/types";

const NOW = "2026-07-10T03:00:00.000Z";

function seededSession(): StorySession {
  const draft = createStorySession({
    id: "narrative-test",
    readerInput: "変わり映えのない長い午後",
    providerKind: "mock",
    now: NOW,
  });
  const generating = beginSeedGeneration(draft, NOW);
  return applySeedResult(
    generating,
    generateFallbackSeed(generating.readerInput),
    NOW,
  );
}

function advance(session: StorySession, choice: ReaderChoice): StorySession {
  const selected = chooseBranch(session, choice, NOW);
  const context = assembleSceneContext(selected, choice);
  return applySceneResult(
    selected,
    generateFallbackScene(context),
    choice,
    NOW,
  );
}

describe("narrative constants", () => {
  it("keeps every application-owned phrase byte-for-byte exact", () => {
    expect(DEPARTURE_KEY_PHRASE).toBe(
      "「じゃあ行ってみる？ 行ってみたら何か変わるかもしれないよ？」",
    );
    expect(BRANCH_KEY_PHRASE).toBe(
      "「もうすこしここを見て回る？　他のところに行ってみる？」",
    );
    expect(CLOSURE_KEY_PHRASE).toBe(
      "この物語はここで終わることができます。終わりますか？",
    );
    expect(TITLE_KEY_PHRASE_TEMPLATE).toBe(
      "あなたが読んだ物語の題名は『{title}』です",
    );
    expect(formatTitleKeyPhrase("余白を渡る鍵")).toBe(
      "あなたが読んだ物語の題名は『余白を渡る鍵』です",
    );
    expect(BRANCH_KEY_PHRASE).toContain("？　他");
  });
});

describe("storyEngine", () => {
  it("creates a strict version-1 draft and trims validated input", () => {
    const session = createStorySession({
      id: "session-1",
      readerInput: "  長い午後を持て余している  ",
      now: NOW,
    });

    expect(session).toMatchObject({
      version: 1,
      status: "draft",
      readerInput: "長い午後を持て余している",
      macroPartIndex: 1,
      sceneIndexInMacro: 0,
      totalSceneCount: 0,
      departureAcknowledged: false,
      latestProtagonistChange: null,
    });
    expect(storySessionSchema.safeParse(session).success).toBe(true);
    expect(() => validateReaderInput("   ")).toThrow();
    expect(() => validateReaderInput("あ".repeat(301))).toThrow();
  });

  it("derives the latest change when hydrating an older version-1 session", () => {
    const session = seededSession();
    const legacySession = { ...session } as Record<string, unknown>;
    delete legacySession.latestProtagonistChange;

    const restored = storySessionSchema.parse(legacySession);

    expect(restored.version).toBe(1);
    expect(restored.latestProtagonistChange).toBe(
      session.scenes.at(-1)?.statePatch.protagonistChange,
    );
  });

  it("shows departure once, branches after scenes 1-4, then closes scene 5", () => {
    let session = seededSession();
    expect(session.status).toBe("reading");
    expect(session.departureAcknowledged).toBe(false);
    expect(session.sceneIndexInMacro).toBe(1);
    expect(session.latestProtagonistChange).toBe(
      session.scenes[0]?.statePatch.protagonistChange,
    );

    session = acknowledgeDeparture(session, NOW);
    expect(session.departureAcknowledged).toBe(true);
    expect(getStoryDecision(session)).toBe("branch");

    const choices: ReaderChoice[] = ["stay", "stay", "move", "stay"];
    for (const [index, choice] of choices.entries()) {
      session = advance(session, choice);
      expect(session.latestProtagonistChange).toBe(
        session.scenes.at(-1)?.statePatch.protagonistChange,
      );
      expect(session.sceneIndexInMacro).toBe(index + 2);
      expect(getStoryDecision(session)).toBe(
        index === choices.length - 1 ? "closure" : "branch",
      );
    }

    expect(session.totalSceneCount).toBe(5);
    expect(session.status).toBe("awaiting_closure");
    expect(session.scenes.at(-1)?.statePatch.openedThreads).toEqual([]);
  });

  it("makes stay deepen and move increase distance and reset local depth", () => {
    const start = acknowledgeDeparture(seededSession(), NOW);
    const stayed = chooseBranch(start, "stay", NOW);
    expect(stayed.depthIndex).toBe(start.depthIndex + 1);
    expect(stayed.distanceIndex).toBe(start.distanceIndex);

    const stayedScene = applySceneResult(
      stayed,
      generateFallbackScene(assembleSceneContext(stayed, "stay")),
      "stay",
      NOW,
    );
    const moved = chooseBranch(stayedScene, "move", NOW);
    expect(moved.depthIndex).toBe(0);
    expect(moved.distanceIndex).toBe(stayedScene.distanceIndex + 1);
  });

  it("continues with one stable motif and a compact factual continuity summary", () => {
    let session = acknowledgeDeparture(seededSession(), NOW);
    for (const choice of ["stay", "stay", "stay", "stay"] as const) {
      session = advance(session, choice);
    }

    session = {
      ...session,
      currentLocationId: `${session.readerInput}の水路`,
      canonicalFacts: [
        {
          id: "fact-older",
          text: "水門は朝だけ開く",
          createdAt: NOW,
        },
        {
          id: "fact-latest",
          text: `${session.readerInput}から持ち出した切符は光る`,
          createdAt: NOW,
        },
      ],
      activeThreads: [
        {
          id: "thread-first",
          description: "先に開いた糸",
          openedAtMacroPart: 1,
          updatedAt: NOW,
        },
        {
          id: "thread-last",
          description: `${session.readerInput}に結びつく後の糸`,
          openedAtMacroPart: 1,
          updatedAt: NOW,
        },
      ],
      motifs: [
        {
          id: "motif-first",
          name: "先の鍵",
          useCount: 2,
          lastUsedAt: NOW,
        },
        {
          id: "motif-later",
          name: "後の羽根",
          useCount: 99,
          lastUsedAt: NOW,
        },
      ],
      latestProtagonistChange: `${session.readerInput}を待たずに選べるようになった`,
      rollingSummary: `破棄される旧要約 ${session.readerInput}`,
      scenes: session.scenes.map((scene, index) => ({
        ...scene,
        statePatch: {
          ...scene.statePatch,
          motifsUsed: index < 2 ? ["先の鍵"] : index < 4 ? ["後の羽根"] : [],
        },
      })),
    };

    const continued = chooseClosure(session, "continue", NOW);
    expect(continued).toMatchObject({
      status: "reading",
      macroPartIndex: 2,
      sceneIndexInMacro: 0,
    });
    expect(continued.activeThreads.map((thread) => thread.id)).toEqual([
      "thread-last",
    ]);
    expect(continued.motifs.map((motif) => motif.name)).toEqual(["先の鍵"]);
    expect(continued.rollingSummary).toBe(
      chooseClosure(session, "continue", NOW).rollingSummary,
    );
    expect(continued.rollingSummary.length).toBeLessThanOrEqual(1_200);
    expect(continued.rollingSummary).toContain("確定事実:");
    expect(continued.rollingSummary).toContain("先の鍵");
    expect(continued.rollingSummary).toContain("主人公の変化:");
    expect(continued.rollingSummary).toContain("後の糸");
    expect(continued.rollingSummary).toContain("場所:");
    expect(continued.rollingSummary).toContain("既知の象徴");
    expect(continued.rollingSummary).not.toContain(session.readerInput);
    expect(continued.rollingSummary).not.toContain("破棄される旧要約");

    const context = assembleSceneContext(continued, "continue");
    expect(context).toMatchObject({
      macroPartIndex: 2,
      sceneIndexInMacro: 1,
      sceneFunction: "arrival",
      choice: "continue",
      latestProtagonistChange: "既知の象徴を待たずに選べるようになった",
    });
    const firstOfNextMacro = applySceneResult(
      continued,
      generateFallbackScene(context),
      "continue",
      NOW,
    );
    expect(firstOfNextMacro.sceneIndexInMacro).toBe(1);
    expect(firstOfNextMacro.scenes.at(-1)?.choiceThatLedHere).toBe("continue");
  });

  it("ends only at a macro closure and stores a validated title", () => {
    let session = acknowledgeDeparture(seededSession(), NOW);
    for (const choice of ["stay", "move", "stay", "move"] as const) {
      session = advance(session, choice);
    }

    session = chooseClosure(session, "end", NOW);
    expect(session.status).toBe("generating_ending");
    const endingContext = {
      themeTransform: session.themeTransform!,
      storyBible: session.storyBible!,
      macroPartIndex: session.macroPartIndex,
      totalSceneCount: session.totalSceneCount,
      currentLocationId: session.currentLocationId,
      rollingSummary: session.rollingSummary,
      canonicalFacts: session.canonicalFacts,
      activeThreads: session.activeThreads,
      motifs: session.motifs,
      latestProtagonistChange: session.latestProtagonistChange,
      recentSceneSummaries: session.scenes
        .slice(-2)
        .map((scene) => scene.summary),
      previousSceneTail: session.scenes.at(-1)?.text.slice(-900) ?? "",
    };
    session = applyEndingResult(
      session,
      generateFallbackEnding(endingContext),
      NOW,
    );
    expect(session.status).toBe("ended");
    expect(session.ending?.title.length).toBeGreaterThanOrEqual(4);
    expect(session.ending?.title).not.toMatch(/[『』「」"']/u);
  });

  it("caps active threads at three even across repeated patches", () => {
    let session = acknowledgeDeparture(seededSession(), NOW);
    const resultFor = (ordinal: number): SceneResult => ({
      text: `場面${ordinal}では、既存の場所を静かに調べた。`,
      summary: `場面${ordinal}の要約`,
      choiceReflection: "滞在を反映した",
      statePatch: {
        newFacts: [],
        resolvedThreads: [],
        openedThreads: [`糸-${ordinal}-a`, `糸-${ordinal}-b`],
        motifsUsed: [],
        currentLocation: "同じ場所",
        protagonistChange: "観察を続けた",
      },
    });

    for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
      const selected = chooseBranch(session, "stay", NOW);
      session = applySceneResult(selected, resultFor(ordinal), "stay", NOW);
    }
    expect(session.activeThreads).toHaveLength(3);
    expect(session.activeThreads.map((thread) => thread.description)).toEqual([
      "糸-2-b",
      "糸-3-a",
      "糸-3-b",
    ]);
  });

  it("maps all five scene functions and rejects oversized patches", () => {
    expect([1, 2, 3, 4, 5].map(getSceneFunction)).toEqual([
      "arrival",
      "observation",
      "discovery",
      "reinterpretation",
      "local_closure",
    ]);
    expect(() => getSceneFunction(6)).toThrow();
    expect(
      statePatchSchema.safeParse({
        newFacts: ["1", "2", "3", "4"],
        resolvedThreads: [],
        openedThreads: [],
        motifsUsed: [],
        currentLocation: "場所",
        protagonistChange: "変化",
      }).success,
    ).toBe(false);
  });
});
