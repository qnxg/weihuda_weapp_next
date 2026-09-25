import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Semester } from "../api/types";
import { CountdownOverview } from "./CountdownOverview";

const semester: Semester = {
  xn: 2026,
  xq: "autumn",
  start: "2026-09-13",
  weeks: 16,
  from_zero: false,
};

describe("CountdownOverview", () => {
  it("shows holiday and semester countdowns in one section", () => {
    render(<CountdownOverview semester={semester} now={new Date(2026, 8, 23, 22, 30)} />);

    expect(screen.getByRole("heading", { name: "倒计时" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "假期倒计时" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", {
      name: "距离中秋节还有 2 天，9 月 25 日至 27 日，共 3 天",
    })).toHaveClass("countdown-item--warning");
    expect(screen.getByRole("article", {
      name: "距离2026 秋季学期结束还有 102 天，1 月 3 日结束，共 16 周",
    })).toHaveClass("countdown-item--info");
  });

  it("switches the holiday row to an active state", () => {
    render(<CountdownOverview semester={semester} now={new Date(2026, 8, 26, 12)} />);

    expect(screen.getByRole("article", {
      name: "中秋节假期进行中，剩余 2 天，9 月 25 日至 27 日，共 3 天",
    })).toHaveClass("countdown-item--success");
    expect(screen.getByText("含今天")).toBeInTheDocument();
  });

  it("moves the holiday row to the following holiday", () => {
    render(<CountdownOverview semester={semester} now={new Date(2026, 8, 28, 8)} />);

    expect(screen.getByRole("article", {
      name: "距离国庆节还有 3 天，10 月 1 日至 7 日，共 7 天",
    })).toBeInTheDocument();
  });

  it("keeps the semester countdown when no published holiday remains", () => {
    render(<CountdownOverview semester={semester} now={new Date(2026, 9, 8)} />);

    expect(screen.getByRole("article", {
      name: "暂无后续假期安排，等待新的放假安排",
    })).toBeInTheDocument();
    expect(screen.getByText("距离学期结束")).toBeInTheDocument();
  });

  it("counts down to a semester that has not started", () => {
    render(<CountdownOverview semester={semester} now={new Date(2026, 8, 10)} />);

    expect(screen.getByRole("article", {
      name: "距离2026 秋季学期开始还有 3 天，9 月 13 日开始，共 16 周",
    })).toHaveClass("countdown-item--info");
  });

  it("shows completed and invalid semester states", () => {
    const { rerender } = render(
      <CountdownOverview semester={semester} now={new Date(2027, 0, 3)} />,
    );
    expect(screen.getByRole("article", {
      name: "2026 秋季学期已于 1 月 3 日结束，共 16 周",
    })).toHaveClass("countdown-item--neutral");

    rerender(
      <CountdownOverview
        semester={{ ...semester, start: "invalid" }}
        now={new Date(2026, 8, 23)}
      />,
    );
    expect(screen.getByRole("article", {
      name: "2026 秋季学期日期待定",
    })).toHaveClass("countdown-item--neutral");
  });
});
