import type { Semester } from "../api/types";

const DAY_MS = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const weekdayCharacters = ["日", "一", "二", "三", "四", "五", "六"];
const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
});

export const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export interface SemesterCountdown {
  status: "upcoming" | "active" | "completed";
  days: number;
  target: Date;
}

function calendarDayValue(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDaysBetween(from: Date, to: Date) {
  return Math.round((calendarDayValue(to) - calendarDayValue(from)) / DAY_MS);
}

export function parseApiDate(value: string) {
  const normalized = DATE_ONLY_PATTERN.test(value)
    ? `${value}T00:00:00`
    : value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? parseApiDate(value) : value;
  return date ? dateFormatter.format(date) : "时间待定";
}

export function formatDateHeading(date = new Date()) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${weekdayCharacters[date.getDay()]}`;
}

export function formatDateTime(value: string) {
  const date = parseApiDate(value);
  return date ? dateTimeFormatter.format(date) : value;
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function getCurrentWeek(semester: Semester, date = new Date()) {
  const start = parseApiDate(semester.start);
  if (!start) return semester.from_zero ? 0 : 1;
  start.setHours(0, 0, 0, 0);
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  const elapsedWeeks = Math.floor(
    (current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  const base = semester.from_zero ? 0 : 1;
  return Math.max(base, Math.min(elapsedWeeks + base, semester.weeks));
}

export function isDateInSemester(semester: Semester, date = new Date()) {
  const start = parseApiDate(semester.start);
  if (!start) return false;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + semester.weeks * 7);
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current >= start && current < end;
}

export function getSemesterCountdown(
  semester: Semester,
  now = new Date(),
): SemesterCountdown | null {
  const start = parseApiDate(semester.start);
  if (!start) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + semester.weeks * 7);

  const daysUntilStart = calendarDaysBetween(now, start);
  if (daysUntilStart > 0) {
    return { status: "upcoming", days: daysUntilStart, target: start };
  }

  const daysUntilEnd = calendarDaysBetween(now, end);
  if (daysUntilEnd > 0) {
    return { status: "active", days: daysUntilEnd, target: end };
  }

  return { status: "completed", days: 0, target: end };
}

export function dateForSemesterDay(semester: Semester, week: number, day: number) {
  const start = parseApiDate(semester.start);
  if (!start) return null;
  start.setHours(0, 0, 0, 0);
  const baseWeek = semester.from_zero ? 0 : 1;
  const dayOffset = (day - start.getDay() + 7) % 7;
  start.setDate(start.getDate() + (week - baseWeek) * 7 + dayOffset);
  return start;
}

export function currentWeekday(date = new Date()) {
  return date.getDay();
}

export function termName(term: string) {
  const names: Record<string, string> = {
    spring: "春季学期",
    summer: "夏季学期",
    autumn: "秋季学期",
    winter: "冬季学期",
  };
  return names[term] || term;
}

export function periodName(period: number) {
  return `第 ${period} 节`;
}
