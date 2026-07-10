import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PwaStatus } from "../../src/pwa/PwaStatus";

const pwa = vi.hoisted(() => ({
  updateServiceWorker: vi.fn<(reloadPage?: boolean) => Promise<void>>(),
  setOfflineReady: vi.fn(),
  setNeedRefresh: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    offlineReady: [false, pwa.setOfflineReady],
    needRefresh: [true, pwa.setNeedRefresh],
    updateServiceWorker: pwa.updateServiceWorker,
  }),
}));

describe("PwaStatus update prompt", () => {
  beforeEach(() => {
    pwa.updateServiceWorker.mockReset();
    pwa.updateServiceWorker.mockResolvedValue();
    pwa.setOfflineReady.mockReset();
    pwa.setNeedRefresh.mockReset();
  });

  it("leaves an old service worker active until the reader confirms reload", async () => {
    const user = userEvent.setup();
    render(<PwaStatus />);

    expect(
      screen.getByText(
        "新しい版を利用できます。読書の区切りで更新してください。",
      ),
    ).toBeVisible();
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(pwa.updateServiceWorker).not.toHaveBeenCalled();
    expect(pwa.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("requests activation and reload only from the explicit update button", async () => {
    const user = userEvent.setup();
    render(<PwaStatus />);

    await user.click(screen.getByRole("button", { name: "今すぐ更新" }));
    expect(pwa.updateServiceWorker).toHaveBeenCalledOnce();
    expect(pwa.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
