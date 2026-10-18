import type {
  AcademicCalendar,
  AcademicCalendarDetail,
  AcademicCalendarList,
  AcademicCalendarPeriodItem,
  AcademicCalendarWeek,
} from "../api/types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export function parseCalendarDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function calendarDateValue(value: string) {
  const parts = parseCalendarDate(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

function calendarDateKey(value: number) {
  const date = new Date(value);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function weekDates(startValue: number) {
  return Array.from({ length: 7 }, (_, day) => calendarDateKey(startValue + day * DAY_MS));
}

export function formatAcademicCalendarRange(start: string, end: string) {
  const startDate = parseCalendarDate(start);
  const endDate = parseCalendarDate(end);
  if (!startDate || !endDate) return `${start} 到 ${end}`;

  return `${startDate.year}.${startDate.month}.${startDate.day} 到 ${endDate.year}.${endDate.month}.${endDate.day}`;
}

function isSundayToSaturday(dates: string[]) {
  if (dates.length !== 7) return false;
  const values = dates.map(calendarDateValue);
  if (values.some((value) => value === null) || new Date(values[0]!).getUTCDay() !== 0) {
    return false;
  }
  return values.every(
    (value, index) => index === 0 || value === (values[index - 1] as number) + DAY_MS,
  );
}

export function validateAcademicCalendar(calendar: AcademicCalendar) {
  const { period } = calendar ?? {};
  const startValue = calendarDateValue(period?.start);
  const endValue = calendarDateValue(period?.end);
  const weeks = Array.isArray(period?.weeks) ? period.weeks : [];
  const officialWeeks =
    startValue === null || endValue === null
      ? []
      : weeks.filter((week) => {
          const weekStart = calendarDateValue(week?.dates?.[0]);
          const weekEnd = calendarDateValue(week?.dates?.[6]);
          return (
            weekStart !== null && weekEnd !== null && weekStart >= startValue && weekEnd <= endValue
          );
        });

  if (
    !calendar ||
    typeof calendar.name !== "string" ||
    calendar.name.trim().length === 0 ||
    !period ||
    typeof period.name !== "string" ||
    period.name.trim().length === 0 ||
    startValue === null ||
    endValue === null ||
    startValue > endValue ||
    !Number.isInteger(period.total_weeks) ||
    period.total_weeks <= 0 ||
    weeks.length === 0 ||
    !weeks.every(
      (week, index) =>
        Boolean(week) &&
        typeof week.week_text === "string" &&
        week.week_text.trim().length > 0 &&
        typeof week.description === "string" &&
        week.description.trim().length > 0 &&
        Array.isArray(week.dates) &&
        isSundayToSaturday(week.dates) &&
        (index === 0 ||
          (calendarDateValue(week.dates[0]) as number) >
            (calendarDateValue(weeks[index - 1].dates[0]) as number)),
    ) ||
    officialWeeks.length !== period.total_weeks ||
    officialWeeks[0]?.dates[0] !== period.start ||
    officialWeeks.at(-1)?.dates[6] !== period.end ||
    !Array.isArray(period.notes) ||
    !period.notes.every(
      (note) =>
        Boolean(note) &&
        typeof note.title === "string" &&
        note.title.trim().length > 0 &&
        typeof note.content === "string" &&
        note.content.trim().length > 0,
    )
  ) {
    throw new Error("服务端返回的校历数据无效。");
  }

  return calendar;
}

export function validateAcademicCalendarList(list: AcademicCalendarList) {
  const validItems =
    Array.isArray(list?.items) &&
    list.items.length > 0 &&
    list.items.every(
      (item) =>
        typeof item?.xn === "string" &&
        item.xn.trim().length > 0 &&
        Array.isArray(item.periods) &&
        item.periods.length === 4 &&
        item.periods.every(
          (period) =>
            Number.isInteger(period?.id) &&
            period.id > 0 &&
            typeof period.name === "string" &&
            period.name.trim().length > 0,
        ),
    );
  const periods = validItems ? list.items.flatMap(({ periods: items }) => items) : [];
  const uniqueIds = validItems && new Set(periods.map(({ id }) => id)).size === periods.length;
  const uniqueYears =
    validItems && new Set(list.items.map(({ xn }) => xn)).size === list.items.length;
  const hasCurrentCalendar =
    validItems && Number.isInteger(list?.now_id) && periods.some(({ id }) => id === list.now_id);

  if (!validItems || !uniqueIds || !uniqueYears || !hasCurrentCalendar) {
    throw new Error("服务端返回的校历数据无效。");
  }

  return list;
}

function validateAcademicCalendarDetail(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("服务端返回的校历数据无效。");
  }
  const detail = value as AcademicCalendarDetail;
  const startValue = calendarDateValue(detail.from);
  const endValue = calendarDateValue(detail.to);
  const duration = startValue === null || endValue === null ? 0 : endValue - startValue + DAY_MS;
  const validPreviousWeeks =
    Array.isArray(detail.prev) &&
    detail.prev.every(
      (week) =>
        Number.isInteger(week?.index) &&
        week.index < 0 &&
        typeof week.name === "string" &&
        week.name.trim().length > 0,
    );
  const previousIndexes = validPreviousWeeks
    ? detail.prev.map(({ index }) => index).toSorted((left, right) => left - right)
    : [];
  const uniquePreviousIndexes =
    validPreviousWeeks && new Set(previousIndexes).size === previousIndexes.length;

  if (
    startValue === null ||
    endValue === null ||
    startValue > endValue ||
    new Date(startValue).getUTCDay() !== 0 ||
    new Date(endValue).getUTCDay() !== 6 ||
    duration % WEEK_MS !== 0 ||
    typeof detail.name !== "string" ||
    detail.name.trim().length === 0 ||
    !validPreviousWeeks ||
    !uniquePreviousIndexes ||
    !Array.isArray(detail.notes) ||
    !detail.notes.every(
      (note) =>
        typeof note?.key === "string" &&
        note.key.trim().length > 0 &&
        typeof note.value === "string" &&
        note.value.trim().length > 0,
    )
  ) {
    throw new Error("服务端返回的校历数据无效。");
  }

  return { detail, startValue, totalWeeks: duration / WEEK_MS };
}

function buildCalendarWeeks(
  startValue: number,
  totalWeeks: number,
  periodName: string,
  previousWeeks: AcademicCalendarDetail["prev"],
): AcademicCalendarWeek[] {
  const referenceWeeks = previousWeeks
    .toSorted((left, right) => left.index - right.index)
    .map(({ index, name }) => ({
      week_text: name,
      description: name,
      dates: weekDates(startValue + index * WEEK_MS),
    }));
  const officialWeeks = Array.from({ length: totalWeeks }, (_, index) => ({
    week_text: String(index + 1),
    description: `${periodName}第${index + 1}周`,
    dates: weekDates(startValue + index * WEEK_MS),
  }));
  return [...referenceWeeks, ...officialWeeks];
}

export function normalizeAcademicCalendarListResponse(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new Error("服务端返回的校历数据无效。");
  }
  return validateAcademicCalendarList(value as AcademicCalendarList);
}

export function normalizeAcademicCalendarDetailResponse(
  value: unknown,
  requestedPeriod: AcademicCalendarPeriodItem,
) {
  const { detail, startValue, totalWeeks } = validateAcademicCalendarDetail(value);

  return validateAcademicCalendar({
    name: detail.name,
    period: {
      name: requestedPeriod.name,
      start: detail.from,
      end: detail.to,
      total_weeks: totalWeeks,
      weeks: buildCalendarWeeks(startValue, totalWeeks, requestedPeriod.name, detail.prev),
      notes: detail.notes.map(({ key, value: content }) => ({ title: key, content })),
    },
  });
}
