import { describe, expect, it } from "vitest";
import {
  currentWeekday,
  dateForSemesterDay,
  formatDateHeading,
  getCurrentWeek,
  getSemesterCountdown,
  isDateInSemester,
  parseApiDate,
  periodName,
  termName,
} from "./format";

describe("calendar formatting", () => {
  it("parses API date-only values as local calendar dates", () => {
    const date = parseApiDate("2026-09-13");
    expect(date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 9, 13]);
  });

  it("calculates a one-based semester week", () => {
    expect(
      getCurrentWeek(
        { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false },
        new Date("2026-09-22T12:00:00"),
      ),
    ).toBe(2);
  });

  it("supports zero-based semester numbering and clamps the range", () => {
    const semester = { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: true };
    expect(getCurrentWeek(semester, new Date("2026-09-13T12:00:00"))).toBe(0);
    expect(getCurrentWeek(semester, new Date("2027-09-13T12:00:00"))).toBe(16);
  });

  it("uses the API weekday convention where Sunday is zero", () => {
    expect(currentWeekday(new Date("2026-09-20T12:00:00"))).toBe(0);
  });

  it("maps API weekdays from the semester start date", () => {
    const semester = { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false };
    expect(dateForSemesterDay(semester, 1, 0)?.getDate()).toBe(13);
    expect(dateForSemesterDay(semester, 1, 1)?.getDate()).toBe(14);
    expect(dateForSemesterDay(semester, 2, 0)?.getDate()).toBe(20);
  });

  it("detects dates outside the teaching weeks", () => {
    const semester = { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false };
    expect(isDateInSemester(semester, new Date("2026-09-13T12:00:00"))).toBe(true);
    expect(isDateInSemester(semester, new Date("2027-01-02T12:00:00"))).toBe(true);
    expect(isDateInSemester(semester, new Date("2027-01-03T00:00:00"))).toBe(false);
  });

  it("counts down to the semester boundary by local calendar day", () => {
    const semester = { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false };

    expect(getSemesterCountdown(semester, new Date(2026, 8, 10, 23, 59))).toMatchObject({
      status: "upcoming",
      days: 3,
    });
    expect(getSemesterCountdown(semester, new Date(2026, 8, 23, 23, 59))).toMatchObject({
      status: "active",
      days: 102,
    });
    expect(getSemesterCountdown(semester, new Date(2027, 0, 3, 0, 0))).toMatchObject({
      status: "completed",
      days: 0,
    });
  });

  it.each([
    [new Date(2026, 8, 20), "9 月 20 日 星期日"],
    [new Date(2026, 8, 23), "9 月 23 日 星期三"],
  ])("formats %s as a homepage date heading", (date, expected) => {
    expect(formatDateHeading(date)).toBe(expected);
  });

  it("formats known and unknown academic labels", () => {
    expect(termName("autumn")).toBe("秋季学期");
    expect(termName("custom")).toBe("custom");
    expect(periodName(3)).toBe("第 3 节");
  });
});
