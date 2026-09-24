import { afterEach, describe, expect, it, vi } from "vitest";
import { getSession, setSession } from "../auth/session";
import { getTfaChallenge, setTfaChallenge } from "../auth/tfa";
import { request, requestBlob } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  setSession(null);
  setTfaChallenge(null);
});

describe("API client", () => {
  it("unwraps successful envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "OK", data: { value: 42 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(request<{ value: number }>("/value", { auth: false })).resolves.toEqual({
      value: 42,
    });
  });

  it("uses a server-provided message for friendly errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "MESSAGE", data: "当前学期暂未开放查询。" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(request("/value", { auth: false })).rejects.toMatchObject({
      code: "MESSAGE",
      message: "当前学期暂未开放查询。",
    });
  });

  it("shares one token refresh across concurrent 401 responses", async () => {
    setSession({ access_token: "expired", refresh_token: "refresh" });
    let refreshCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      const path = String(url);
      const authorization = new Headers(options?.headers).get("Authorization");
      if (path.endsWith("/auth/refresh")) {
        refreshCount += 1;
        return new Response(
          JSON.stringify({
            code: "OK",
            data: { access_token: "fresh", refresh_token: "next" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (authorization === "Bearer expired") {
        return new Response(JSON.stringify({ code: "AUTH_TOKEN_INVALID" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ code: "OK", data: { name: "张同学" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      request<{ name: string }>("/me"),
      request<{ name: string }>("/me"),
    ]);
    expect(first.name).toBe("张同学");
    expect(second.name).toBe("张同学");
    expect(refreshCount).toBe(1);
  });

  it("refreshes authentication for binary responses", async () => {
    setSession({ access_token: "expired", refresh_token: "refresh" });
    let imageCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const path = String(url);
        if (path.endsWith("/auth/refresh")) {
          return new Response(
            JSON.stringify({
              code: "OK",
              data: { access_token: "fresh", refresh_token: "next" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        imageCalls += 1;
        return imageCalls === 1
          ? new Response(JSON.stringify({ code: "AUTH_TOKEN_INVALID" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          : new Response("image-bytes", { status: 200, headers: { "Content-Type": "image/png" } });
      }),
    );

    const blob = await requestBlob("/img/example");
    expect(blob.size).toBeGreaterThan(0);
    expect(imageCalls).toBe(2);
  });

  it("does not restore an obsolete session after a concurrent login", async () => {
    setSession({ access_token: "expired", refresh_token: "old-refresh" });
    let resolveRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).endsWith("/auth/refresh")) return pendingRefresh;
        return new Response(JSON.stringify({ code: "AUTH_TOKEN_INVALID" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const requestPromise = request("/me");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    setSession({ access_token: "new-login", refresh_token: "new-refresh" });
    resolveRefresh(
      new Response(
        JSON.stringify({
          code: "OK",
          data: { access_token: "stale", refresh_token: "stale-refresh" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(requestPromise).rejects.toMatchObject({ code: "STALE_SESSION" });
    expect(getSession()?.access_token).toBe("new-login");
  });

  it("captures a two-factor challenge without refreshing the token", async () => {
    setSession({ access_token: "active", refresh_token: "refresh" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "TFA", data: { phone: "138****8000" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("/me")).rejects.toMatchObject({ code: "TFA" });
    expect(getTfaChallenge()?.phone).toBe("138****8000");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("captures a two-factor challenge after refreshing an expired token", async () => {
    setSession({ access_token: "expired", refresh_token: "refresh" });
    let protectedCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url).endsWith("/auth/refresh")) {
          return new Response(
            JSON.stringify({
              code: "OK",
              data: { access_token: "fresh", refresh_token: "next" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        protectedCalls += 1;
        return new Response(
          JSON.stringify(
            protectedCalls === 1
              ? { code: "AUTH_TOKEN_INVALID" }
              : { code: "TFA", data: { phone: "138****8000" } },
          ),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    await expect(request("/me")).rejects.toMatchObject({ code: "TFA" });
    expect(getTfaChallenge()).toEqual({ phone: "138****8000", returnTo: "/" });
  });

  it("preserves the original return path across concurrent TFA responses", async () => {
    setSession({ access_token: "active", refresh_token: "refresh" });
    setTfaChallenge({ phone: "138****8000", returnTo: "/services/grades" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "TFA", data: { phone: "139****9000" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(request("/me")).rejects.toMatchObject({ code: "TFA" });
    expect(getTfaChallenge()).toEqual({ phone: "138****8000", returnTo: "/services/grades" });
  });
});
