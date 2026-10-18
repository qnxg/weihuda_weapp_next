import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { canPullToRefresh, refetchActiveQueries } from "./AppShell";

describe("pull-to-refresh route policy", () => {
  it.each(["/", "/about", "/services/calendar"])("enables public data route %s", (pathname) => {
    expect(canPullToRefresh(pathname, false)).toBe(true);
  });

  it.each([
    "/schedule",
    "/me",
    "/notices",
    "/services/card",
    "/services/grades",
    "/services/points",
    "/services/dorm",
    "/services/network",
    "/services/network/orders",
    "/services/network/details",
    "/services/exams",
    "/services/gym/grade",
    "/services/gym/appointment",
    "/services/lab/schedule",
    "/services/lab/grade",
  ])("enables authenticated data route %s only after login", (pathname) => {
    expect(canPullToRefresh(pathname, false)).toBe(false);
    expect(canPullToRefresh(pathname, true)).toBe(true);
  });

  it.each([
    "/services",
    "/settings",
    "/feedback",
    "/services/rank",
    "/services/rooms",
    "/services/gym/standard",
    "/login",
    "/unknown",
  ])("keeps static, editing, and explicit-query route %s disabled", (pathname) => {
    expect(canPullToRefresh(pathname, false)).toBe(false);
    expect(canPullToRefresh(pathname, true)).toBe(false);
  });

  it("waits for every active query before reporting a refresh failure", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    let resolveSlowQuery = () => {};
    const failedQuery = vi.fn().mockRejectedValue(new Error("区块刷新失败"));
    const slowQuery = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSlowQuery = () => resolve("慢查询完成");
        }),
    );
    queryClient.setQueryData(["failed"], "失败前缓存");
    queryClient.setQueryData(["slow"], "慢查询缓存");
    const failedObserver = new QueryObserver(queryClient, {
      queryKey: ["failed"],
      queryFn: failedQuery,
    });
    const slowObserver = new QueryObserver(queryClient, {
      queryKey: ["slow"],
      queryFn: slowQuery,
    });
    const unsubscribeFailed = failedObserver.subscribe(() => {});
    const unsubscribeSlow = slowObserver.subscribe(() => {});
    let completed = false;

    const refresh = refetchActiveQueries(queryClient);
    void refresh.then(
      () => {
        completed = true;
      },
      () => {
        completed = true;
      },
    );
    await vi.waitFor(() => {
      expect(failedQuery).toHaveBeenCalledOnce();
      expect(slowQuery).toHaveBeenCalledOnce();
    });
    expect(completed).toBe(false);

    resolveSlowQuery();
    await expect(refresh).rejects.toThrow("区块刷新失败");
    expect(completed).toBe(true);
    unsubscribeFailed();
    unsubscribeSlow();
  });

  it("refetches and waits for a fresh cached query activated by refreshed list data", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    let resolveDependentQuery = () => {};
    const listQuery = vi.fn().mockResolvedValue({ id: 2 });
    const currentDetailQuery = vi.fn().mockResolvedValue("当前详情");
    const dependentDetailQuery = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveDependentQuery = () => resolve("新详情");
        }),
    );
    queryClient.setQueryData(["list"], { id: 1 });
    queryClient.setQueryData(["detail", 1], "旧详情");
    queryClient.setQueryData(["detail", 2], "缓存的新详情");
    const listObserver = new QueryObserver(queryClient, {
      queryKey: ["list"],
      queryFn: listQuery,
    });
    const detailObserver = new QueryObserver(queryClient, {
      queryKey: ["detail", 1],
      queryFn: currentDetailQuery,
    });
    let switchedDetail = false;
    const unsubscribeList = listObserver.subscribe((result) => {
      if (result.data?.id !== 2 || switchedDetail) return;
      switchedDetail = true;
      detailObserver.setOptions({
        queryKey: ["detail", 2],
        queryFn: dependentDetailQuery,
      });
    });
    const unsubscribeDetail = detailObserver.subscribe(() => {});
    let completed = false;

    const refresh = refetchActiveQueries(queryClient);
    void refresh.finally(() => {
      completed = true;
    });
    await vi.waitFor(() => expect(dependentDetailQuery).toHaveBeenCalledOnce());
    expect(completed).toBe(false);

    resolveDependentQuery();
    await expect(refresh).resolves.toBeUndefined();
    expect(completed).toBe(true);
    unsubscribeList();
    unsubscribeDetail();
  });
});
