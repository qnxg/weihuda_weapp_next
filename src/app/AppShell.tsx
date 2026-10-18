import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { CalendarDays, Home, LayoutGrid, UserRound } from "lucide-react";
import { useCallback, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { PullToRefresh } from "../components/PullToRefresh";

const navigation = [
  { to: "/", label: "今日", icon: Home, end: true },
  { to: "/schedule", label: "课表", icon: CalendarDays },
  { to: "/services", label: "服务", icon: LayoutGrid },
  { to: "/me", label: "我的", icon: UserRound },
];

const pageTitles: Record<string, string> = {
  "/": "今日",
  "/schedule": "课表",
  "/services": "服务",
  "/me": "我的",
  "/notices": "通知",
  "/settings": "设置",
  "/feedback": "问题反馈",
  "/about": "关于微生活",
  "/services/card": "校园卡",
  "/services/grades": "课程成绩",
  "/services/rank": "成绩排名",
  "/services/points": "积分中心",
  "/services/dorm": "宿舍与电量",
  "/services/network": "校园网",
  "/services/network/orders": "历史账单",
  "/services/network/details": "流量明细",
  "/services/exams": "考试安排",
  "/services/gym/grade": "体测成绩",
  "/services/gym/appointment": "体测预约",
  "/services/gym/standard": "体测标准",
  "/services/lab/schedule": "实验安排",
  "/services/lab/grade": "实验成绩",
  "/services/rooms": "空教室",
  "/services/calendar": "校历",
};

const authenticatedRefreshRoutes = new Set([
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
]);

const publicRefreshRoutes = new Set(["/", "/about", "/services/calendar"]);

export function canPullToRefresh(pathname: string, isAuthenticated: boolean) {
  return (
    publicRefreshRoutes.has(pathname) ||
    (isAuthenticated && authenticatedRefreshRoutes.has(pathname))
  );
}

async function waitForActiveQueryChain(queryClient: QueryClient, trackActiveQueries: () => void) {
  const queryCache = queryClient.getQueryCache();
  let stableIdlePasses = 0;

  while (stableIdlePasses < 2) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    trackActiveQueries();
    const hasActiveFetch = queryCache
      .findAll({ type: "active" })
      .some((query) => query.state.fetchStatus === "fetching");
    if (!hasActiveFetch) {
      stableIdlePasses += 1;
      continue;
    }

    stableIdlePasses = 0;
    await new Promise<void>((resolve) => {
      const checkForIdle = () => {
        trackActiveQueries();
        const stillFetching = queryCache
          .findAll({ type: "active" })
          .some((query) => query.state.fetchStatus === "fetching");
        if (!stillFetching) {
          unsubscribe();
          resolve();
        }
      };
      const unsubscribe = queryCache.subscribe(checkForIdle);
      checkForIdle();
    });
  }
}

export async function refetchActiveQueries(queryClient: QueryClient) {
  const queryCache = queryClient.getQueryCache();
  const activeQueries = queryCache.findAll({ type: "active" });
  const trackedQueries = new Set(activeQueries);
  const refetchedQueries = new Set(activeQueries);
  const dependentRefetches = new Set<Promise<void>>();
  const previousErrorCounts = new Map(
    queryCache.findAll().map((query) => [query, query.state.errorUpdateCount]),
  );
  const trackActiveQueries = () => {
    queryCache.findAll({ type: "active" }).forEach((query) => {
      trackedQueries.add(query);
      if (refetchedQueries.has(query)) return;
      refetchedQueries.add(query);
      const refetch = queryClient.refetchQueries(
        { queryKey: query.queryKey, exact: true, type: "active" },
        { cancelRefetch: false, throwOnError: false },
      );
      dependentRefetches.add(refetch);
      void refetch.finally(() => dependentRefetches.delete(refetch));
    });
  };
  const unsubscribe = queryCache.subscribe(trackActiveQueries);

  try {
    await queryClient.refetchQueries({ type: "active" }, { throwOnError: false });
    await waitForActiveQueryChain(queryClient, trackActiveQueries);
    await Promise.all(dependentRefetches);
  } finally {
    unsubscribe();
  }

  const failedQuery = [...trackedQueries].find(
    (query) => query.state.errorUpdateCount > (previousErrorCounts.get(query) ?? 0),
  );
  if (failedQuery) {
    throw failedQuery.state.error instanceof Error
      ? failedQuery.state.error
      : new Error("页面刷新失败。");
  }
}

export function AppShell() {
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const pullToRefreshEnabled = canPullToRefresh(pathname, isAuthenticated);
  const refreshPageQueries = useCallback(() => refetchActiveQueries(queryClient), [queryClient]);

  useEffect(() => {
    document.title = `${pageTitles[pathname] || "微生活"} - 微生活`;
    const main = document.getElementById("main-content");
    const focusHeading = () => {
      const heading = main?.querySelector<HTMLHeadingElement>("h1");
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      return true;
    };
    if (focusHeading()) return;
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect();
    });
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <PullToRefresh enabled={pullToRefreshEnabled} key={pathname} onRefresh={refreshPageQueries}>
        <Outlet />
      </PullToRefresh>
      <nav className="bottom-nav" aria-label="主导航">
        {navigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            className={({ isActive }) => `bottom-nav__item${isActive ? " is-active" : ""}`}
            end={end}
            key={to}
            to={to}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
