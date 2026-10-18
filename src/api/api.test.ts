import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../auth/session";
import type { AcademicCalendarDetail, AcademicCalendarList } from "./types";
import { api } from "./api";
// @ts-expect-error the dependency-free mock package intentionally has no declaration file.
import { fixtures } from "../../mock-server/src/fixtures.js";

afterEach(() => {
  vi.unstubAllGlobals();
  setSession(null);
});

describe("API endpoint parameters", () => {
  it("serializes monthly and daily network detail periods", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const detail = {
      total: "12.80GB",
      upload: "2.10GB",
      download: "10.70GB",
      items: [],
    };
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: "OK", data: detail }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.network.detail(2025, 2);
    await api.network.detail(2025, 2, 14);

    const urls = fetchMock.mock.calls.map(
      ([request]) => new URL(String(request), "http://localhost"),
    );
    expect(urls.map(({ pathname }) => pathname)).toEqual([
      "/api/netflow/detail",
      "/api/netflow/detail",
    ]);
    expect(urls.map(({ search }) => search)).toEqual([
      "?year=2025&month=2",
      "?year=2025&month=2&day=14",
    ]);
  });

  it("sends the documented exam type and only uses offset for ended exams", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: "OK", data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.exam.list();
    await api.exam.list("recent", 10);
    await api.exam.list("end", 10);

    const urls = fetchMock.mock.calls.map(([request]) => {
      const url = new URL(String(request), "http://localhost");
      return `${url.pathname}${url.search}`;
    });
    expect(urls).toEqual([
      "/api/exam?type=recent",
      "/api/exam?type=recent",
      "/api/exam?type=end&offset=10",
    ]);
  });

  it("loads countdown information without authentication", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const data = {
      holiday: {
        name: "中秋节",
        start: "2026-09-25",
        end: "2026-09-27",
        status: "active",
        days: 3,
        duration: 3,
      },
      semester: {
        xn: 2026,
        xq: 1,
        xq_text: "秋季学期",
        target_date: "2027-01-03",
        weeks: 16,
        status: "active",
        days: 100,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.countdown.get()).resolves.toEqual(data);

    const [, options] = fetchMock.mock.calls[0] ?? [];
    expect(new Headers(options?.headers).get("Authorization")).toBeNull();
  });

  it("loads and validates the public academic calendar list and detail", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const academicCalendars = fixtures.academicCalendars as Array<{
      xn: string;
      periods: Array<{ id: number; name: string; detail: AcademicCalendarDetail }>;
    }>;
    const list: AcademicCalendarList = {
      items: academicCalendars.map(({ xn, periods }) => ({
        xn,
        periods: periods.map(({ id, name }) => ({ id, name })),
      })),
      now_id: 1,
    };
    const historicalCalendar = academicCalendars[1];
    const historicalPeriod = historicalCalendar.periods[0];
    const detail = historicalPeriod.detail;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "OK", data: list }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "OK", data: detail }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.calendar.list()).resolves.toEqual(list);
    const normalized = await api.calendar.detail(list.items[1].periods[0]);
    expect(normalized).toMatchObject({
      name: detail.name,
      period: {
        name: historicalPeriod.name,
        start: detail.from,
        end: detail.to,
        total_weeks: 18,
        notes: detail.notes.map(({ key, value }) => ({ title: key, content: value })),
      },
    });
    expect(normalized.period.weeks).toHaveLength(20);
    expect(normalized.period.weeks[0].dates[0]).toBe("2025-08-31");
    expect(normalized.period.weeks.at(-1)?.dates.at(-1)).toBe("2026-01-17");

    const paths = fetchMock.mock.calls.map(
      ([request]) => new URL(String(request), "http://localhost"),
    );
    expect(paths.map(({ pathname }) => pathname)).toEqual(["/api/calendar", "/api/calendar/5"]);
    expect(paths.every(({ search }) => search === "")).toBe(true);
    fetchMock.mock.calls.forEach(([, options]) => {
      expect(new Headers(options?.headers).get("Authorization")).toBeNull();
    });
  });

  it("loads the current semester without authentication or query parameters", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "OK",
          data: {
            items: [
              {
                xn: 2026,
                xq: 1,
                xq_text: "秋季学期",
                start: "2026-09-13",
                weeks: 16,
                from_zero: false,
              },
            ],
            now_xn: 2026,
            now_xq: 1,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.semester.get();

    const [request, options] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request), "http://localhost");
    expect(url.pathname).toBe("/api/semester");
    expect(url.search).toBe("");
    expect(new Headers(options?.headers).get("Authorization")).toBeNull();
  });

  it("requests gym grades for the selected academic year with authentication", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: fixtures.gymGrade }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.gym.grade(2025);

    const [request, options] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request), "http://localhost");
    expect(`${url.pathname}${url.search}`).toBe("/api/gym/grade?xn=2025");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("rejects a semester table whose current pointer is not in its items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "OK",
            data: {
              items: [
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
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(api.semester.get()).rejects.toThrow("服务端返回的学期表无效");
  });

  it("rejects a semester table without a display name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "OK",
            data: {
              items: [
                {
                  xn: 2026,
                  xq: 1,
                  xq_text: " ",
                  start: "2026-09-13",
                  weeks: 16,
                  from_zero: false,
                },
              ],
              now_xn: 2026,
              now_xq: 1,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    await expect(api.semester.get()).rejects.toThrow("服务端返回的学期表无效");
  });

  it("loads the authenticated building catalog", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const buildings = [
      {
        building_id: "106",
        building_name: "综合楼",
        description: "可能无法查询到数据",
        favorite: true,
        last_query_at: "2026-10-03T09:20:00+08:00",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: buildings }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.room.buildings()).resolves.toEqual(buildings);

    const [request, options] = fetchMock.mock.calls[0] ?? [];
    const url = new URL(String(request), "http://localhost");
    expect(url.pathname).toBe("/api/building");
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("updates a building favorite with an encoded path and JSON body", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const building = {
      building_id: "W134b2a60000WH",
      building_name: "综合楼机房",
      description: "可能无法查询到数据",
      favorite: true,
      last_query_at: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: building }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.room.updateFavorite(building.building_id, true)).resolves.toEqual(building);

    const [request, options] = fetchMock.mock.calls[0] ?? [];
    expect(new URL(String(request), "http://localhost").pathname).toBe(
      "/api/building/W134b2a60000WH/favorite",
    );
    expect(options?.method).toBe("PUT");
    expect(options?.body).toBe(JSON.stringify({ favorite: true }));
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token");
  });

  it("queries empty rooms for the selected small periods", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const room = {
      room_name: "综合楼 101",
      room_type: "多媒体教室",
      seat_count: 48,
      exam_seat_count: 30,
    };
    const result = { time: 1, items: [room] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.room.empty("W134b2a60000WH", "2026-10-08", [1, 2, 5])).resolves.toEqual(
      result,
    );

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/empty_room");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      building_id: "W134b2a60000WH",
      date: "2026-10-08",
      times: "1,2,5",
    });
  });

  it("normalizes the current Apifox single-room schema", async () => {
    const room = {
      room_name: "综合楼 101",
      room_type: "多媒体教室",
      seat_count: 48,
      exam_seat_count: 30,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "OK", data: { time: 1, items: room } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api.room.empty("106", "2026-10-08", [1, 2])).resolves.toEqual({
      time: 1,
      items: [room],
    });
  });

  it("serializes the documented numeric ranking semester ID", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "OK",
          data: { all: null, compulsory: null, core: null },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.rank.school({
      xn: 2025,
      xq: 4,
      range: "minor",
      data_source: "execution",
      display: "initial",
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      xn: "2025",
      xq: "4",
      range: "minor",
      data_source: "execution",
      display: "initial",
    });
  });

  it("omits optional ranking dates for an all-time query", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "OK",
          data: { all: null, compulsory: null, core: null },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.rank.school();

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      range: "major",
      data_source: "total",
      display: "max",
    });
  });

  it("serializes numeric course-grade semester IDs", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.grade.list(2025, 2);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      xn: "2025",
      xq: "2",
    });
  });

  it("uses numeric semester IDs for course and lab requests", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: "OK", data: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.course.table(2025, 3);
    await api.course.extra(2025, 3);
    await api.course.create(2025, 3, {
      course_name: "测试课程",
      weeks: [1],
      day: 1,
      times: [1],
      place: null,
      teacher: null,
    });
    await api.lab.grade(2025, 3);

    const urls = fetchMock.mock.calls.map(
      ([request]) => new URL(String(request), "http://localhost"),
    );
    expect(urls.map(({ pathname }) => pathname)).toEqual([
      "/api/classtable",
      "/api/course/extra",
      "/api/course/custom",
      "/api/lab/grade",
    ]);
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({ xn: "2025", xq: "3" });
    expect(Object.fromEntries(urls[1].searchParams)).toEqual({ xn: "2025", xq: "3" });
    expect(Object.fromEntries(urls[3].searchParams)).toEqual({ xn: "2025", xq: "3" });
    expect(JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body))).toMatchObject({
      xn: 2025,
      xq: 3,
    });
  });

  it("preserves an empty trusted-ranking response", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "OK", data: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(api.rank.ca()).resolves.toBeNull();
  });
});
