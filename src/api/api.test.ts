import { afterEach, describe, expect, it, vi } from "vitest";
import { setSession } from "../auth/session";
import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  setSession(null);
});

describe("API endpoint parameters", () => {
  it("omits semester parameters when requesting the current semester", async () => {
    setSession({ access_token: "token", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        code: "OK",
        data: { xn: 2026, xq: "autumn", start: "2026-09-13", weeks: 16, from_zero: false },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.semester.get();

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.pathname).toBe("/api/semester");
    expect(url.search).toBe("");
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

    await api.rank.school(2026, "autumn");

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.searchParams.get("range")).toBe("major");
    expect(url.searchParams.get("data_source")).toBe("total");
    expect(url.searchParams.get("display")).toBe("max");
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
