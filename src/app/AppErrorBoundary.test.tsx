import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function BrokenPage(): never {
  throw new Error("Chunk load failed");
}

afterEach(() => vi.restoreAllMocks());

describe("AppErrorBoundary", () => {
  it("renders a recoverable page when a lazy route crashes", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenPage />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Chunk load failed");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });
});
