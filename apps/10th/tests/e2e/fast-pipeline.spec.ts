import { expect, test } from "./fixtures";
import { UI, openApp } from "./story-helpers";

test("shows the provisional first scene while a slow provider is still preparing", async ({
  page,
}) => {
  await openApp(page, { mockDelay: 900 });
  await page
    .getByRole("textbox", { name: UI.inputLabel })
    .fill("決められた手順が続き、自分で選べる余白が少ない");
  await page.getByRole("button", { name: UI.inputSubmit }).click();

  const startedAt = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: UI.demoStart }).click();
  await expect(page.getByRole("heading", { name: "最初の場面" })).toBeVisible();
  const openingMs = await page.evaluate(
    (start) => performance.now() - start,
    startedAt,
  );
  expect(openingMs).toBeLessThan(1_000);
  await expect(page.locator(".departure-opening .scene-text")).toHaveText(
    /^.{180,280}$/u,
  );
  await expect(page.getByText(/物語AIを準備しています/u)).toBeVisible();

  await page.getByRole("button", { name: UI.openPage }).click();
  await expect(page.getByRole("button", { name: UI.stay })).toBeVisible();
  await page.getByRole("button", { name: UI.stay }).click();
  await expect(page.getByText("第1景 · 1 / 5", { exact: true })).toBeVisible();
  await expect(page.getByText("第1景 · 2 / 5", { exact: true })).toBeVisible({
    timeout: 5_000,
  });
});

test("uses a completed non-canonical Mock prefetch after selection", async ({
  page,
}) => {
  await openApp(page, { mockDelay: 0 });
  await page
    .getByRole("textbox", { name: UI.inputLabel })
    .fill("同じ午後の中でも小さな違いを確かめたい");
  await page.getByRole("button", { name: UI.inputSubmit }).click();
  await page.getByRole("button", { name: UI.demoStart }).click();
  await page.getByRole("button", { name: UI.openPage }).click();
  await expect(page.getByText("第1景 · 1 / 5", { exact: true })).toBeVisible();
  await expect(page.getByText("次の選択肢を端末内で準備済み")).toBeAttached();

  const startedAt = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: UI.move }).click();
  await expect(page.getByText("第1景 · 2 / 5", { exact: true })).toBeVisible();
  const elapsed = await page.evaluate(
    (start) => performance.now() - start,
    startedAt,
  );
  expect(elapsed).toBeLessThan(250);
});

test("benchmark mode exposes local metrics and a downloadable diagnostic", async ({
  page,
}) => {
  await page.goto("./?provider=mock&mockDelay=0&debug=1&benchmark=1");
  await expect(
    page.getByRole("heading", { name: UI.inputHeading }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: UI.inputLabel })
    .fill("変化の少ない日々から静かな物語を始めたい");
  await page.getByRole("button", { name: UI.inputSubmit }).click();
  await page.getByRole("button", { name: UI.demoStart }).click();

  const panel = page.locator("details.debug-panel");
  await expect(panel).toHaveAttribute("open", "");
  await expect(panel.getByText("v2", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("Generation metrics")).toContainText(
    '"buildSha"',
  );

  const downloadPromise = page.waitForEvent("download");
  await panel.getByRole("button", { name: "診断JSONを書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /complete-reading-story-.+\.json/u,
  );
});
