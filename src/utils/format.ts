import type { Semester } from "../api/types";

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

const numberFormatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
});

export const weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function parseApiDate(value: string) {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date) {
  const date = typeof value === "string" ? parseApiDate(value) : value;
  return date ? dateFormatter.format(date) : "时间待定";
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
  const elapsedWeeks = Math.floor((current.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const base = semester.from_zero ? 0 : 1;
  return Math.max(base, Math.min(elapsedWeeks + base, semester.weeks));
}

export function currentWeekday(date = new Date()) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
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
