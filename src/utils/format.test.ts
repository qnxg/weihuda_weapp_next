import { describe, expect, it } from "vitest";
import { currentWeekday, getCurrentWeek, periodName, termName } from "./format";

describe("calendar formatting", () => {
  it("calculates a one-based semester week", () => {
    expect(getCurrentWeek(
      { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false },
      new Date("2026-09-22T12:00:00"),
    )).toBe(2);
  });

  it("supports zero-based semester numbering and clamps the range", () => {
    const semester = { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: true };
    expect(getCurrentWeek(semester, new Date("2026-09-13T12:00:00"))).toBe(0);
    expect(getCurrentWeek(semester, new Date("2027-09-13T12:00:00"))).toBe(16);
  });

  it("maps Sunday to day seven", () => {
    expect(currentWeekday(new Date("2026-09-20T12:00:00"))).toBe(7);
  });

  it("formats known and unknown academic labels", () => {
    expect(termName("autumn")).toBe("秋季学期");
    expect(termName("custom")).toBe("custom");
    expect(periodName(3)).toBe("第 3 节");
  });
});
