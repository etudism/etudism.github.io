import { expect, test } from "./fixtures";
import {
  UI,
  acknowledgeDeparture,
  chooseBranch,
  continueToNextMacro,
  createMockStory,
  endStory,
  expectScene,
  openApp,
  reachClosure,
} from "./story-helpers";

test.describe("mock story flows", () => {
  test("scenario A: branch sequence reaches closure, ending, and title", async ({
    page,
  }) => {
    await createMockStory(page);
    await acknowledgeDeparture(page);
    await reachClosure(page, 1, ["stay", "stay", "move", "stay"]);
    await endStory(page);
  });

  test("scenario B: continue, reload the second macro, restore, and end", async ({
    page,
  }) => {
    await createMockStory(page);
    await acknowledgeDeparture(page);
    await reachClosure(page, 1, ["stay", "move", "stay", "move"]);
    await continueToNextMacro(page, 2);

    await page.reload();
    await expectScene(page, 2, 1);
    await expect(
      page.getByText(UI.branchPhrase, { exact: true }),
    ).toBeVisible();

    await reachClosure(page, 2, ["move", "stay", "move", "stay"]);
    await endStory(page);
  });

  test("scenario C: injected generation error retries from the same scene", async ({
    page,
  }) => {
    await createMockStory(page, { debug: true });
    await acknowledgeDeparture(page);

    await page.getByText("Debug panel", { exact: true }).click();
    await page.getByRole("button", { name: "次の生成をエラーにする" }).click();
    await page.getByRole("button", { name: UI.stay }).click();

    const errorPanel = page.getByRole("alert");
    await expect(
      errorPanel.getByRole("heading", { name: "ここで少し立ち止まりました" }),
    ).toBeVisible();
    await expect(
      errorPanel.getByText(/Injected mock scene error/u),
    ).toBeVisible();
    await page.getByRole("button", { name: "もう一度試す" }).click();

    await expectScene(page, 1, 2);
    await expect(
      page.getByRole("heading", { name: "ここで少し立ち止まりました" }),
    ).toHaveCount(0);
  });

  test("scenario D: without WebGPU the demo remains available through the full flow", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "isSecureContext", {
        configurable: true,
        value: true,
      });
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: undefined,
      });
    });

    await openApp(page);
    await page
      .getByRole("textbox", { name: UI.inputLabel })
      .fill("WebGPUがなくても最後まで読めるか確かめたい");
    await page.getByRole("button", { name: UI.inputSubmit }).click();
    await expect(
      page.getByRole("heading", { name: UI.modelHeading }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "ローカルAIを利用できない可能性があります",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("この環境ではWebGPUが公開されていません。", {
        exact: false,
      }),
    ).toBeVisible();

    const localModelButtons = page.getByRole("button", {
      name: "この端末で始める",
    });
    await expect(localModelButtons).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      await expect(localModelButtons.nth(index)).toBeDisabled();
    }

    await page.getByRole("button", { name: UI.demoStart }).click();
    await expect(
      page.getByRole("heading", { name: UI.departureHeading }),
    ).toBeVisible();
    await acknowledgeDeparture(page);
    await chooseBranch(page, "stay", 1, 2);
    await chooseBranch(page, "move", 1, 3);
    await chooseBranch(page, "stay", 1, 4);
    await chooseBranch(page, "move", 1, 5);
    await expect(
      page.getByText(UI.closurePhrase, { exact: true }),
    ).toBeVisible();
    await endStory(page);
  });
});
