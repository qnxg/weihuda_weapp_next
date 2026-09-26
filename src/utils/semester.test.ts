import { describe, expect, it } from "vitest";
import { buildAcademicYears, isGradeTerm, isRankTerm, parseAcademicYear } from "./semester";

describe("academic semester helpers", () => {
  it("validates supported academic terms and years", () => {
    expect(isGradeTerm("winter")).toBe(true);
    expect(isRankTerm("winter")).toBe(false);
    expect(isRankTerm("summer")).toBe(true);
    expect(parseAcademicYear("2025")).toBe(2025);
    expect(parseAcademicYear("25")).toBeUndefined();
    expect(parseAcademicYear("2200")).toBeUndefined();
  });

  it("builds recent academic years and preserves a linked historical year", () => {
    expect(buildAcademicYears(2026, 2025)).toEqual([2026, 2025, 2024, 2023, 2022, 2021]);
    expect(buildAcademicYears(2026, 2019)).toEqual([2019, 2026, 2025, 2024, 2023, 2022, 2021]);
  });
});
