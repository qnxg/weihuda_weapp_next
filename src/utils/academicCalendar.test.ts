import { describe, expect, it } from "vitest";
import type { AcademicCalendarDetail, AcademicCalendarList } from "../api/types";
import {
  formatAcademicCalendarRange,
  normalizeAcademicCalendarDetailResponse,
  normalizeAcademicCalendarListResponse,
  parseCalendarDate,
  validateAcademicCalendar,
  validateAcademicCalendarList,
} from "./academicCalendar";

const list: AcademicCalendarList = {
  items: [
    {
      xn: "2026 - 2027 学年",
      periods: [
        { id: 1, name: "秋季学期" },
        { id: 2, name: "寒假" },
        { id: 3, name: "春季学期" },
        { id: 4, name: "暑假" },
      ],
    },
    {
      xn: "2025 - 2026 学年",
      periods: [
        { id: 5, name: "秋季学期" },
        { id: 6, name: "寒假" },
        { id: 7, name: "春季学期" },
        { id: 8, name: "暑假" },
      ],
    },
  ],
  now_id: 1,
};

const detail: AcademicCalendarDetail = {
  from: "2026-09-13",
  to: "2026-09-26",
  name: "2026 - 2027 学年 秋季学期",
  prev: [
    { index: -2, name: "夏9" },
    { index: -1, name: "夏10" },
  ],
  notes: [
    { key: "学期安排", value: "2026年9月13日至9月26日，共2周。" },
    { key: "新生军训", value: "2026年10月12日至10月25日。" },
  ],
};

describe("academic calendar adapter", () => {
  it("parses strict calendar dates without timezone shifts", () => {
    expect(parseCalendarDate("2027-02-28")).toEqual({ year: 2027, month: 2, day: 28 });
    expect(parseCalendarDate("2027-02-29")).toBeNull();
    expect(parseCalendarDate("2027/02/28")).toBeNull();
    expect(formatAcademicCalendarRange("2026-09-13", "2027-01-16")).toBe("2026.9.13 到 2027.1.16");
  });

  it("normalizes the slim list and generates complete weeks from detail boundaries", () => {
    expect(validateAcademicCalendarList(list)).toBe(list);
    expect(normalizeAcademicCalendarListResponse(list)).toBe(list);

    const calendar = normalizeAcademicCalendarDetailResponse(detail, list.items[0].periods[0]);

    expect(calendar).toMatchObject({
      name: detail.name,
      period: {
        name: "秋季学期",
        start: detail.from,
        end: detail.to,
        total_weeks: 2,
        notes: [
          { title: "学期安排", content: "2026年9月13日至9月26日，共2周。" },
          { title: "新生军训", content: "2026年10月12日至10月25日。" },
        ],
      },
    });
    expect(calendar.period.weeks.map(({ week_text }) => week_text)).toEqual([
      "夏9",
      "夏10",
      "1",
      "2",
    ]);
    expect(calendar.period.weeks[0].dates[0]).toBe("2026-08-30");
    expect(calendar.period.weeks.at(-1)?.dates.at(-1)).toBe("2026-09-26");
    expect(validateAcademicCalendar(calendar)).toBe(calendar);
  });

  it("rejects invalid list identities and pointers", () => {
    expect(() => normalizeAcademicCalendarListResponse({ now_id: 1 })).toThrow(
      "服务端返回的校历数据无效",
    );
    expect(() => validateAcademicCalendarList({ ...list, now_id: 99 })).toThrow(
      "服务端返回的校历数据无效",
    );

    const duplicateIdList = structuredClone(list);
    duplicateIdList.items[1].periods[0].id = 1;
    expect(() => validateAcademicCalendarList(duplicateIdList)).toThrow("服务端返回的校历数据无效");

    const emptyYearList = structuredClone(list);
    emptyYearList.items[0].xn = " ";
    expect(() => validateAcademicCalendarList(emptyYearList)).toThrow("服务端返回的校历数据无效");
  });

  it("keeps display names independent and accepts sparse previous-week offsets", () => {
    const calendar = normalizeAcademicCalendarDetailResponse(
      {
        ...detail,
        name: "本科校历 秋季阶段",
        prev: [{ index: -2, name: "夏9" }],
      },
      list.items[0].periods[0],
    );
    expect(calendar.name).toBe("本科校历 秋季阶段");
    expect(calendar.period.weeks.map(({ week_text }) => week_text)).toEqual(["夏9", "1", "2"]);
    expect(calendar.period.weeks[0].dates[0]).toBe("2026-08-30");
  });

  it("rejects contradictory detail boundaries and duplicate offsets", () => {
    expect(() =>
      normalizeAcademicCalendarDetailResponse(
        { ...detail, to: "2026-09-25" },
        list.items[0].periods[0],
      ),
    ).toThrow("服务端返回的校历数据无效");

    expect(() =>
      normalizeAcademicCalendarDetailResponse(
        {
          ...detail,
          prev: [
            { index: -1, name: "夏10" },
            { index: -1, name: "重复" },
          ],
        },
        list.items[0].periods[0],
      ),
    ).toThrow("服务端返回的校历数据无效");

    expect(() =>
      normalizeAcademicCalendarDetailResponse(
        { ...detail, notes: [{ key: "", value: "无效" }] },
        list.items[0].periods[0],
      ),
    ).toThrow("服务端返回的校历数据无效");
  });

  it("rejects damaged generated calendar rows", () => {
    const calendar = normalizeAcademicCalendarDetailResponse(detail, list.items[0].periods[0]);
    calendar.period.weeks[0].dates[3] = "2026-09-04";
    expect(() => validateAcademicCalendar(calendar)).toThrow("服务端返回的校历数据无效");
  });
});
