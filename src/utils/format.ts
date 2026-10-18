import type { SemesterItem } from "../api/types";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CHINESE_DATE_PATTERN = /^(\d{4})年(\d{1,2})月(\d{1,2})(?:日|号)/;
const DAY_MS = 86_400_000;

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

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fullDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shanghaiDateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayCharacters = ["日", "一", "二", "三", "四", "五", "六"];
const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
});

export const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function parseApiDate(value: string) {
  const chineseDate = value.match(CHINESE_DATE_PATTERN);
  if (chineseDate) {
    const [, year, month, day] = chineseDate;
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const date = new Date(numericYear, numericMonth - 1, numericDay);
    return date.getFullYear() === numericYear &&
      date.getMonth() + 1 === numericMonth &&
      date.getDate() === numericDay
      ? date
      : null;
  }
  const normalized = DATE_ONLY_PATTERN.test(value)
    ? `${value}T00:00:00`
    : value.includes("T")
      ? value
      : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysUntilDate(value: string, from = new Date()) {
  const target = parseApiDate(value);
  if (!target) return null;
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const targetDay = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay - fromDay) / DAY_MS);
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? parseApiDate(value) : value;
  return date ? dateFormatter.format(date) : "时间待定";
}

export function formatDateWithWeekday(value: string) {
  const date = parseApiDate(value);
  return date ? `${value} 星期${weekdayCharacters[date.getDay()]}` : value;
}

export function formatMonthDayWithWeekday(value: string | Date) {
  const date = typeof value === "string" ? parseApiDate(value) : value;
  return date
    ? `${date.getMonth() + 1}月${date.getDate()}日(星期${weekdayCharacters[date.getDay()]})`
    : "日期待定";
}

export function formatDateHeading(date = new Date()) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 星期${weekdayCharacters[date.getDay()]}`;
}

export function formatShanghaiDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    shanghaiDateKeyFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatDateTime(value: string) {
  const date = parseApiDate(value);
  return date ? dateTimeFormatter.format(date) : value;
}

export function formatTime(value: string) {
  const date = parseApiDate(value);
  return date ? timeFormatter.format(date) : null;
}

export function formatDateTimeWithYear(value: string) {
  const date = parseApiDate(value);
  return date ? fullDateTimeFormatter.format(date) : value;
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function getCurrentWeek(semester: SemesterItem, date = new Date()) {
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

export function isDateInSemester(semester: SemesterItem, date = new Date()) {
  const start = parseApiDate(semester.start);
  if (!start) return false;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + semester.weeks * 7);
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current >= start && current < end;
}

export function dateForSemesterDay(semester: SemesterItem, week: number, day: number) {
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

export function periodName(period: number) {
  return `第 ${period} 节`;
}
