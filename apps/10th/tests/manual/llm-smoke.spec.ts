import { expect, test } from "@playwright/test";

test("Qwen3 0.6B loads once and streams a planned scene", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("./?debug=1");
  await page
    .getByRole("textbox", { name: "いま感じている停滞や、変わらなさ" })
    .fill("仕事ばかりで変わり映えしない日常");
  await page.getByRole("button", { name: "物語の入口へ" }).click();

  const lightModelCard = page.locator("article.model-card").filter({
    has: page.getByRole("heading", { name: "高速（Qwen3 0.6B）" }),
  });
  await expect(
    lightModelCard.getByRole("button", { name: "この端末で始める" }),
  ).toBeEnabled();
  await lightModelCard
    .getByRole("button", { name: "この端末で始める" })
    .click();

  await expect(
    page.getByText(
      "「じゃあ行ってみる？ 行ってみたら何か変わるかもしれないよ？」",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "頁をひらく" }).click();

  const firstScene = page.locator(".scene-text");
  await expect(firstScene).toBeVisible();
  await expect(firstScene).not.toContainText("<think>");
  await expect(firstScene).not.toContainText("じゃあ行ってみる？");
  await expect(
    page.getByText("「もうすこしここを見て回る？　他のところに行ってみる？」", {
      exact: true,
    }),
  ).toHaveCount(1);

  await page.getByRole("button", { name: "もう少しここを見て回る" }).click();
  await expect(page.getByText("第1景 · 2 / 5", { exact: true })).toBeVisible();
  await expect(page.locator(".scene-text")).not.toContainText("<think>");
  await expect(page.locator(".scene-text")).not.toContainText("```json");
  expect(consoleErrors).toEqual([]);
});
