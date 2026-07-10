import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BoredomInput } from "../../src/components/BoredomInput";

describe("BoredomInput", () => {
  it("rejects blank and short input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BoredomInput onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("いま感じている停滞や、変わらなさ"),
      "   ",
    );
    await user.click(screen.getByRole("button", { name: "物語の入口へ" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText("空白を除いて5文字以上入力してください。"),
    ).toBeVisible();
  });

  it("trims and submits a valid input", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<BoredomInput onSubmit={onSubmit} />);

    await user.type(
      screen.getByLabelText("いま感じている停滞や、変わらなさ"),
      "  毎日が同じことの繰り返しに感じる  ",
    );
    await user.click(screen.getByRole("button", { name: "物語の入口へ" }));

    expect(onSubmit).toHaveBeenCalledWith("毎日が同じことの繰り返しに感じる");
  });
});
