import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders an accessible semantic progress bar with an explicit tone", () => {
    render(<ProgressBar value={0.63} tone="primary" label="流量占比 63%" />);

    const progress = screen.getByRole("progressbar", { name: "流量占比 63%" });
    expect(progress).toHaveValue(0.63);
    expect(progress).toHaveClass("progress-bar", "progress-bar--primary");
  });

  it.each([
    [-0.2, 0],
    [1.2, 1],
    [Number.NaN, 0],
  ])("clamps %s to %s", (value, expected) => {
    render(<ProgressBar value={value} tone="success" label="使用进度" />);

    expect(screen.getByRole("progressbar", { name: "使用进度" })).toHaveValue(expected);
  });
});
