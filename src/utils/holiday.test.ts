import { describe, expect, it } from "vitest";
import { getHolidayCountdown } from "./holiday";

describe("holiday countdown", () => {
  it("counts local calendar days before a holiday", () => {
    const countdown = getHolidayCountdown(new Date(2026, 8, 23, 23, 59));

    expect(countdown).toMatchObject({
      holiday: { name: "中秋节" },
      status: "upcoming",
      daysUntil: 2,
      duration: 3,
    });
  });

  it("includes both the first and final holiday date", () => {
    expect(getHolidayCountdown(new Date(2026, 8, 25, 0, 0))).toMatchObject({
      status: "active",
      daysRemaining: 3,
    });
    expect(getHolidayCountdown(new Date(2026, 8, 27, 23, 59))).toMatchObject({
      status: "active",
      daysRemaining: 1,
    });
  });

  it("returns no result after the final published holiday", () => {
    expect(getHolidayCountdown(new Date(2026, 9, 8))).toBeNull();
  });
});
