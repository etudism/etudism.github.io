import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App";
import {
  BRANCH_KEY_PHRASE,
  CLOSURE_KEY_PHRASE,
  DEPARTURE_KEY_PHRASE,
} from "../../src/narrative/constants";
import { deletePersistenceDatabase } from "../../src/persistence/db";

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [false, vi.fn()],
    needRefresh: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

async function startMockStory() {
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole("heading", { name: "あなたが今退屈しているのは？" });
  await user.type(
    screen.getByLabelText("いま感じている停滞や、変わらなさ"),
    "仕事ばかりで変わり映えしない日常",
  );
  await user.click(screen.getByRole("button", { name: "物語の入口へ" }));
  expect(await screen.findByText("DEMO · URL指定中")).toBeVisible();
  await user.click(await screen.findByRole("button", { name: "デモで始める" }));
  expect(await screen.findByText(DEPARTURE_KEY_PHRASE)).toBeVisible();
  await user.click(screen.getByRole("button", { name: "頁をひらく" }));
  expect(
    await screen.findByText(
      (_content, element) => element?.textContent === BRANCH_KEY_PHRASE,
    ),
  ).toBeVisible();
  return { user, unmount: view.unmount };
}

describe("App mock flow", () => {
  beforeEach(async () => {
    window.history.replaceState({}, "", "/10th/?provider=mock&mockDelay=0");
    await deletePersistenceDatabase();
  });

  afterEach(async () => {
    await deletePersistenceDatabase();
  });

  it("completes five scenes and ends with an app-formatted title", async () => {
    const { user } = await startMockStory();
    const choices = [
      "もう少しここを見て回る",
      "もう少しここを見て回る",
      "他のところに行ってみる",
      "もう少しここを見て回る",
    ];

    for (const choice of choices) {
      await user.click(await screen.findByRole("button", { name: choice }));
      await waitFor(() =>
        expect(
          screen.queryByText(
            "次の場面を生成できませんでした。同じ状態から再試行できます。",
          ),
        ).not.toBeInTheDocument(),
      );
    }

    expect(await screen.findByText(CLOSURE_KEY_PHRASE)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "読書を終える" }));
    expect(await screen.findByRole("heading", { name: "終幕" })).toBeVisible();
    expect(
      screen.getByText(/^あなたが読んだ物語の題名は『.+』です$/u),
    ).toBeVisible();
  });

  it("restores an active mock session after remount", async () => {
    const { user, unmount } = await startMockStory();
    await user.click(
      screen.getByRole("button", { name: "もう少しここを見て回る" }),
    );
    await screen.findByText(
      (_content, element) => element?.textContent === BRANCH_KEY_PHRASE,
    );

    const firstRender = screen.getByText("第1景 · 2 / 5");
    expect(firstRender).toBeVisible();

    unmount();
    render(<App />);
    expect(await screen.findByText("第1景 · 2 / 5")).toBeVisible();
  });
});
