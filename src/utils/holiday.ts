const DAY_MS = 86_400_000;

export interface Holiday {
  name: string;
  start: string;
  end: string;
}

export interface HolidayCountdown {
  holiday: Holiday;
  status: "upcoming" | "active";
  daysUntil: number;
  daysRemaining: number;
  duration: number;
}

// 国务院办公厅公布的 2026 年法定节假日安排。
export const HOLIDAYS_2026 = [
  { name: "元旦", start: "2026-01-01", end: "2026-01-03" },
  { name: "春节", start: "2026-02-15", end: "2026-02-23" },
  { name: "清明节", start: "2026-04-04", end: "2026-04-06" },
  { name: "劳动节", start: "2026-05-01", end: "2026-05-05" },
  { name: "端午节", start: "2026-06-19", end: "2026-06-21" },
  { name: "中秋节", start: "2026-09-25", end: "2026-09-27" },
  { name: "国庆节", start: "2026-10-01", end: "2026-10-07" },
] as const satisfies readonly Holiday[];

function calendarDayValue(value: string | Date) {
  if (value instanceof Date) {
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function calendarDaysBetween(from: string | Date, to: string | Date) {
  return Math.round((calendarDayValue(to) - calendarDayValue(from)) / DAY_MS);
}

export function getHolidayCountdown(
  now = new Date(),
  holidays: readonly Holiday[] = HOLIDAYS_2026,
): HolidayCountdown | null {
  const holiday = holidays.find((item) => calendarDaysBetween(now, item.end) >= 0);
  if (!holiday) return null;

  const daysUntil = Math.max(0, calendarDaysBetween(now, holiday.start));
  return {
    holiday,
    status: daysUntil === 0 ? "active" : "upcoming",
    daysUntil,
    daysRemaining: calendarDaysBetween(now, holiday.end) + 1,
    duration: calendarDaysBetween(holiday.start, holiday.end) + 1,
  };
}

export function formatHolidayRange(holiday: Holiday) {
  const [, startMonth, startDay] = holiday.start.split("-").map(Number);
  const [, endMonth, endDay] = holiday.end.split("-").map(Number);
  if (startMonth === endMonth) {
    return `${startMonth} 月 ${startDay} 日至 ${endDay} 日`;
  }
  return `${startMonth} 月 ${startDay} 日至 ${endMonth} 月 ${endDay} 日`;
}
