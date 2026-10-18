import { describe, expect, it } from "vitest";
import type { SemesterTable } from "../api/types";
import {
  academicYears,
  findCurrentSemester,
  findSemester,
  parseAcademicYear,
  parseSemesterId,
  semestersForYear,
} from "./semester";

const semesterTable: SemesterTable = {
  items: [
    {
      xn: 2026,
      xq: 1,
      xq_text: "秋季学期",
      start: "2027-09-13",
      weeks: 16,
      from_zero: false,
    },
    {
      xn: 2025,
      xq: 4,
      xq_text: "夏季学期",
      start: "2026-06-28",
      weeks: 4,
      from_zero: false,
    },
    {
      xn: 2025,
      xq: 3,
      xq_text: "春季学期",
      start: "2026-02-22",
      weeks: 16,
      from_zero: false,
    },
  ],
  now_xn: 2026,
  now_xq: 1,
};

describe("academic semester helpers", () => {
  it("parses academic years and numeric semester IDs", () => {
    expect(parseAcademicYear("2025")).toBe(2025);
    expect(parseAcademicYear("25")).toBeUndefined();
    expect(parseAcademicYear("2200")).toBeUndefined();
    expect(parseSemesterId("4")).toBe(4);
    expect(parseSemesterId("spring")).toBeUndefined();
    expect(parseSemesterId("1.5")).toBeUndefined();
  });

  it("uses the server-designated current semester regardless of its date range", () => {
    expect(findCurrentSemester(semesterTable)).toEqual(semesterTable.items[0]);
    expect(findSemester(semesterTable, 2025, 3)).toEqual(semesterTable.items[2]);
    expect(findSemester(semesterTable, 2024, 1)).toBeUndefined();
  });

  it("derives visible options only from the server-provided table", () => {
    expect(academicYears(semesterTable)).toEqual([2026, 2025]);
    expect(semestersForYear(semesterTable.items, 2025)).toEqual([
      semesterTable.items[1],
      semesterTable.items[2],
    ]);
  });
});
