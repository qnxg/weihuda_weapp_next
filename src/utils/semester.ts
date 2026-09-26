import type { GradeTerm, RankTerm } from "../api/types";

export const gradeTermOptions = [
  { value: "autumn", label: "秋季学期" },
  { value: "winter", label: "冬季学期" },
  { value: "spring", label: "春季学期" },
  { value: "summer", label: "夏季学期" },
] as const;

export const rankTermOptions = gradeTermOptions.filter((option) => option.value !== "winter");

export function isGradeTerm(value: string | null | undefined): value is GradeTerm {
  return gradeTermOptions.some((option) => option.value === value);
}

export function isRankTerm(value: string | null | undefined): value is RankTerm {
  return rankTermOptions.some((option) => option.value === value);
}

export function parseAcademicYear(value: string | null | undefined) {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : undefined;
}

export function buildAcademicYears(
  currentYear: number | undefined,
  selectedYear?: number,
  count = 6,
) {
  const years = currentYear ? Array.from({ length: count }, (_, index) => currentYear - index) : [];
  if (selectedYear !== undefined && !years.includes(selectedYear)) years.unshift(selectedYear);
  return years;
}

export function academicYearLabel(year: number) {
  return `${year}-${year + 1} 学年`;
}
