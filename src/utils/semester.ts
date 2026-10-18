import type { SemesterId, SemesterItem, SemesterTable } from "../api/types";

export function parseAcademicYear(value: string | null | undefined) {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const year = Number(value);
  return year >= 2000 && year <= 2100 ? year : undefined;
}

export function parseSemesterId(value: string | null | undefined): SemesterId | undefined {
  if (!value || !/^-?\d+$/.test(value)) return undefined;
  const semesterId = Number(value);
  return Number.isSafeInteger(semesterId) ? semesterId : undefined;
}

export function findSemester(
  table: SemesterTable | undefined,
  year: number | undefined,
  semesterId: SemesterId | undefined,
) {
  if (!table || year === undefined || semesterId === undefined) return undefined;
  return table.items.find((item) => item.xn === year && item.xq === semesterId);
}

export function findCurrentSemester(table: SemesterTable | undefined) {
  return findSemester(table, table?.now_xn, table?.now_xq);
}

export function academicYears(table: SemesterTable | undefined) {
  return table ? [...new Set(table.items.map((semester) => semester.xn))] : [];
}

export function semestersForYear(
  semesters: readonly SemesterItem[] | undefined,
  year: number | undefined,
): SemesterItem[] {
  return semesters && year !== undefined
    ? semesters.filter((semester) => semester.xn === year)
    : [];
}

export function academicYearLabel(year: number) {
  return `${year}-${year + 1} 学年`;
}
