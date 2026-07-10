import { expect, test } from "./fixtures";
import { UI, expectScene, openApp } from "./story-helpers";

const viewports = [
  { name: "320px", width: 320, height: 720 },
  { name: "390px", width: 390, height: 844 },
  { name: "768px", width: 768, height: 900 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

const colorSchemes = ["light", "dark"] as const;

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

for (const viewport of viewports) {
  for (const colorScheme of colorSchemes) {
    test(`${viewport.name} ${colorScheme} layout has no horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.emulateMedia({ colorScheme });
      await openApp(page);

      await expectNoHorizontalOverflow(page);
      const paperColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--paper")
          .trim(),
      );
      expect(paperColor).toBe(colorScheme === "light" ? "#f4efe4" : "#1e1d1a");

      await page
        .getByRole("textbox", { name: UI.inputLabel })
        .fill("画面幅が変わっても静かに読めることを確かめる");
      await page.getByRole("button", { name: UI.inputSubmit }).click();
      await expect(
        page.getByRole("heading", { name: UI.modelHeading }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      const demoButtonBox = await page
        .getByRole("button", { name: UI.demoStart })
        .boundingBox();
      expect(demoButtonBox).not.toBeNull();
      expect(demoButtonBox?.x ?? -1).toBeGreaterThanOrEqual(0);
      expect(
        (demoButtonBox?.x ?? 0) + (demoButtonBox?.width ?? 0),
      ).toBeLessThanOrEqual(viewport.width + 0.5);
    });
  }
}

test("keyboard focus is visible and primary flow controls activate from the keyboard", async ({
  page,
}) => {
  await openApp(page);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "本文へ移動" });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toHaveCSS("outline-style", "solid");
  await expect(skipLink).toHaveCSS("outline-width", "3px");

  await page.keyboard.press("Tab");
  const input = page.getByRole("textbox", { name: UI.inputLabel });
  await expect(input).toBeFocused();
  await page.keyboard.type("キーボードだけで物語を読み進められるか確かめる");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: UI.inputSubmit }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: UI.modelHeading }),
  ).toBeVisible();

  const demoButton = page.getByRole("button", { name: UI.demoStart });
  await demoButton.focus();
  await expect(demoButton).toBeFocused();
  await demoButton.press("Enter");
  const departureButton = page.getByRole("button", { name: UI.openPage });
  await expect(departureButton).toBeFocused();
  await departureButton.press("Enter");
  await expectScene(page, 1, 1);

  const stayButton = page.getByRole("button", { name: UI.stay });
  await stayButton.focus();
  await expect(stayButton).toHaveCSS("outline-width", "3px");
  await stayButton.press("Enter");
  await expectScene(page, 1, 2);
});

test("reduced-motion preference removes long UI transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page);

  const duration = await page
    .getByRole("button", { name: UI.inputSubmit })
    .evaluate((button) => getComputedStyle(button).transitionDuration);
  const firstDuration = duration.split(",")[0]?.trim() ?? "";
  const durationMs = firstDuration.endsWith("ms")
    ? Number.parseFloat(firstDuration)
    : Number.parseFloat(firstDuration) * 1_000;
  expect(durationMs).toBeLessThanOrEqual(0.02);
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
});
