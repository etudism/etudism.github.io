import type { Page } from "@playwright/test";

import { expect } from "./fixtures";

export const UI = {
  inputHeading: "あなたが今退屈しているのは？",
  inputLabel: "いま感じている停滞や、変わらなさ",
  inputSubmit: "物語の入口へ",
  modelHeading: "物語を書く方法を選ぶ",
  demoStart: "デモで始める",
  departureHeading: "旅立ち",
  departurePhrase:
    "「じゃあ行ってみる？ 行ってみたら何か変わるかもしれないよ？」",
  openPage: "頁をひらく",
  branchPhrase: "「もうすこしここを見て回る？　他のところに行ってみる？」",
  stay: "もう少しここを見て回る",
  move: "他のところに行ってみる",
  closurePhrase: "この物語はここで終わることができます。終わりますか？",
  continueReading: "読書を続ける",
  endReading: "読書を終える",
  endingHeading: "終幕",
} as const;

export type BranchChoice = "stay" | "move";

export async function openApp(
  page: Page,
  options: { debug?: boolean; mockDelay?: number } = {},
): Promise<void> {
  const query = new URLSearchParams({
    provider: "mock",
    mockDelay: String(options.mockDelay ?? 0),
  });
  if (options.debug) query.set("debug", "1");

  await page.goto(`./?${query.toString()}`);
  await expect(page).toHaveURL(/\/10th\/\?/);
  await expect(
    page.getByRole("heading", { name: UI.inputHeading }),
  ).toBeVisible();
}

export async function createMockStory(
  page: Page,
  options: { debug?: boolean; readerInput?: string; mockDelay?: number } = {},
): Promise<void> {
  await openApp(page, options);
  await page
    .getByRole("textbox", { name: UI.inputLabel })
    .fill(options.readerInput ?? "変わらない午後の時間を持て余している");
  await page.getByRole("button", { name: UI.inputSubmit }).click();
  await expect(
    page.getByRole("heading", { name: UI.modelHeading }),
  ).toBeVisible();

  await page.getByRole("button", { name: UI.demoStart }).click();
  await expect(
    page.getByRole("heading", { name: UI.departureHeading }),
  ).toBeVisible();
  await expect(
    page.getByText(UI.departurePhrase, { exact: true }),
  ).toBeVisible();
}

export async function acknowledgeDeparture(page: Page): Promise<void> {
  await page.getByRole("button", { name: UI.openPage }).click();
  await expectScene(page, 1, 1);
  await expect(page.getByText(UI.branchPhrase, { exact: true })).toBeVisible();
}

export async function expectScene(
  page: Page,
  macroPart: number,
  scene: number,
): Promise<void> {
  await expect(
    page.getByText(`第${macroPart}景 · ${scene} / 5`, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("article.reading-view")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

export async function chooseBranch(
  page: Page,
  choice: BranchChoice,
  macroPart: number,
  expectedScene: number,
): Promise<void> {
  await page
    .getByRole("button", { name: choice === "stay" ? UI.stay : UI.move })
    .click();
  await expectScene(page, macroPart, expectedScene);
}

export async function reachClosure(
  page: Page,
  macroPart: number,
  choices: readonly [BranchChoice, BranchChoice, BranchChoice, BranchChoice],
): Promise<void> {
  for (const [index, choice] of choices.entries()) {
    await chooseBranch(page, choice, macroPart, index + 2);
  }
  await expect(page.getByText(UI.closurePhrase, { exact: true })).toBeVisible();
}

export async function continueToNextMacro(
  page: Page,
  expectedMacroPart: number,
): Promise<void> {
  await page.getByRole("button", { name: UI.continueReading }).click();
  await expectScene(page, expectedMacroPart, 1);
}

export async function endStory(page: Page): Promise<void> {
  await page.getByRole("button", { name: UI.endReading }).click();
  await expect(
    page.getByRole("heading", { name: UI.endingHeading }),
  ).toBeVisible();
  await expect(
    page.getByText(/^あなたが読んだ物語の題名は『.+』です$/u),
  ).toBeVisible();
}
