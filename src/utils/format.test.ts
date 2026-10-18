import { describe, expect, it } from "vitest";
import type { SemesterItem } from "../api/types";
import {
  currentWeekday,
  dateForSemesterDay,
  daysUntilDate,
  formatDateHeading,
  formatDateTimeWithYear,
  formatMonthDayWithWeekday,
  formatDateWithWeekday,
  formatShanghaiDateKey,
  formatTime,
  getCurrentWeek,
  isDateInSemester,
  parseApiDate,
  periodName,
} from "./format";

describe("calendar formatting", () => {
  it("parses API date-only values as local calendar dates", () => {
    const date = parseApiDate("2026-09-13");
    expect(date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([
      2026, 9, 13,
    ]);
  });

  it("changes the countdown date key at midnight in Asia/Shanghai", () => {
    expect(formatShanghaiDateKey(new Date("2026-09-24T15:59:59Z"))).toBe("2026-09-24");
    expect(formatShanghaiDateKey(new Date("2026-09-24T16:00:00Z"))).toBe("2026-09-25");
  });

  it("includes the year in a full date-time label", () => {
    expect(formatDateTimeWithYear("2026-09-23 14:30:00")).toBe("2026年9月23日 14:30");
  });

  it("appends the weekday to an API date without shifting the calendar day", () => {
    expect(formatDateWithWeekday("2026-10-17")).toBe("2026-10-17 星期六");
    expect(formatDateWithWeekday("invalid")).toBe("invalid");
  });

  it("formats compact homepage dates and times without a year", () => {
    expect(formatMonthDayWithWeekday("2026-09-25")).toBe("9月25日(星期五)");
    expect(formatMonthDayWithWeekday("2026年9月28日（周一）")).toBe("9月28日(星期一)");
    expect(formatTime("2026-09-26 14:30")).toBe("14:30");
  });

  it("calculates local calendar-day distance across supported API date formats", () => {
    const today = new Date(2026, 8, 23, 23, 30);
    expect(daysUntilDate("2026-09-23", today)).toBe(0);
    expect(daysUntilDate("2026-09-25 14:30", today)).toBe(2);
    expect(daysUntilDate("2026年9月27号（周日）", today)).toBe(4);
    expect(daysUntilDate("2026年2月30号", today)).toBeNull();
  });

  it("calculates a one-based semester week", () => {
    const semester: SemesterItem = {
      xn: 2026,
      xq: 1,
      xq_text: "秋季学期",
      start: "2026-09-13",
      weeks: 16,
      from_zero: false,
    };
    expect(getCurrentWeek(semester, new Date("2025-09-13T12:00:00"))).toBe(1);
    expect(getCurrentWeek(semester, new Date("2026-09-22T12:00:00"))).toBe(2);
    expect(getCurrentWeek(semester, new Date("2027-09-13T12:00:00"))).toBe(16);
  });

  it("supports zero-based semester numbering and clamps the range", () => {
    const semester: SemesterItem = {
      xn: 2026,
      xq: 1,
      xq_text: "秋季学期",
      start: "2026-09-13",
      weeks: 16,
      from_zero: true,
    };
    expect(getCurrentWeek(semester, new Date("2025-09-13T12:00:00"))).toBe(0);
    expect(getCurrentWeek(semester, new Date("2026-09-13T12:00:00"))).toBe(0);
    expect(getCurrentWeek(semester, new Date("2027-09-13T12:00:00"))).toBe(16);
  });

  it("uses the API weekday convention where Sunday is zero", () => {
    expect(currentWeekday(new Date("2026-09-20T12:00:00"))).toBe(0);
  });

  it("maps API weekdays from the semester start date", () => {
    const semester: SemesterItem = {
      xn: 2026,
      xq: 1,
      xq_text: "秋季学期",
      start: "2026-09-13",
      weeks: 16,
      from_zero: false,
    };
    expect(dateForSemesterDay(semester, 1, 0)?.getDate()).toBe(13);
    expect(dateForSemesterDay(semester, 1, 1)?.getDate()).toBe(14);
    expect(dateForSemesterDay(semester, 2, 0)?.getDate()).toBe(20);
  });

  it("detects dates outside the teaching weeks", () => {
    const semester: SemesterItem = {
      xn: 2026,
      xq: 1,
      xq_text: "秋季学期",
      start: "2026-09-13",
      weeks: 16,
      from_zero: false,
    };
    expect(isDateInSemester(semester, new Date("2026-09-13T12:00:00"))).toBe(true);
    expect(isDateInSemester(semester, new Date("2027-01-02T12:00:00"))).toBe(true);
    expect(isDateInSemester(semester, new Date("2027-01-03T00:00:00"))).toBe(false);
  });

  it.each([
    [new Date(2026, 8, 20), "9 月 20 日 星期日"],
    [new Date(2026, 8, 23), "9 月 23 日 星期三"],
  ])("formats %s as a homepage date heading", (date, expected) => {
    expect(formatDateHeading(date)).toBe(expected);
  });

  it("formats period numbers", () => {
    expect(periodName(3)).toBe("第 3 节");
  });
});
