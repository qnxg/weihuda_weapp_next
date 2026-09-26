import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CountdownInfo } from "../api/types";
import { CountdownOverview } from "./CountdownOverview";

const activeCountdown: CountdownInfo = {
  holiday: {
    name: "中秋节",
    start: "2026-09-25",
    end: "2026-09-27",
    status: "active",
    days: 3,
    duration: 3,
  },
  semester: {
    xn: 2026,
    xq: "autumn",
    target_date: "2027-01-03",
    weeks: 16,
    status: "active",
    days: 100,
  },
};

describe("CountdownOverview", () => {
  it("renders holiday and semester values supplied by the API", () => {
    render(<CountdownOverview data={activeCountdown} />);

    expect(screen.getByRole("heading", { name: "倒计时" })).toBeInTheDocument();
    expect(
      screen.getByRole("article", {
        name: "中秋节假期进行中，剩余 3 天，9 月 25 日至 27 日，共 3 天",
      }),
    ).toHaveClass("countdown-item--success");
    expect(
      screen.getByRole("article", {
        name: "距离2026 秋季学期结束还有 100 天，1 月 3 日结束，共 16 周",
      }),
    ).toHaveClass("countdown-item--info");
  });

  it("renders an upcoming holiday without recalculating its days", () => {
    render(
      <CountdownOverview
        data={{
          ...activeCountdown,
          holiday: { ...activeCountdown.holiday!, status: "upcoming", days: 11 },
        }}
      />,
    );

    expect(
      screen.getByRole("article", {
        name: "距离中秋节还有 11 天，9 月 25 日至 27 日，共 3 天",
      }),
    ).toHaveClass("countdown-item--warning");
  });

  it("renders upcoming, completed and missing semester states", () => {
    const { rerender } = render(
      <CountdownOverview
        data={{
          holiday: null,
          semester: {
            ...activeCountdown.semester!,
            status: "upcoming",
            target_date: "2026-09-13",
            days: 3,
          },
        }}
      />,
    );
    expect(
      screen.getByRole("article", {
        name: "距离2026 秋季学期开始还有 3 天，9 月 13 日开始，共 16 周",
      }),
    ).toHaveClass("countdown-item--info");

    rerender(
      <CountdownOverview
        data={{
          holiday: null,
          semester: { ...activeCountdown.semester!, status: "completed", days: 0 },
        }}
      />,
    );
    expect(
      screen.getByRole("article", {
        name: "2026 秋季学期已于 1 月 3 日结束，共 16 周",
      }),
    ).toHaveClass("countdown-item--neutral");

    rerender(<CountdownOverview data={{ holiday: null, semester: null }} />);
    expect(
      screen.getByRole("article", {
        name: "暂无学期倒计时，等待后端同步学期安排",
      }),
    ).toHaveClass("countdown-item--neutral");
  });
});
