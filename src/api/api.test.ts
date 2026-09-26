import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../auth/session";
import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  setSession(null);
});

describe("API endpoint parameters", () => {
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
        xq: "autumn",
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

  it("loads the current semester without authentication or query parameters", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "OK",
          data: { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false },
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

  it("uses the documented ranking enum values", async () => {
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
      xq: "summer",
      range: "minor",
      data_source: "execution",
      display: "initial",
    });

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      xn: "2025",
      xq: "summer",
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

  it("serializes winter course-grade queries", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "OK", data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.grade.list(2025, "winter");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      xn: "2025",
      xq: "winter",
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
