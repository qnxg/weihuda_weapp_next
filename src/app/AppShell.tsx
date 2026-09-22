import { CalendarDays, Home, LayoutGrid, UserRound } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

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
  "/services/grades": "成绩与排名",
  "/services/points": "积分中心",
  "/services/dorm": "宿舍与电量",
  "/services/network": "校园网",
  "/services/exams": "考试安排",
  "/services/gym": "体测",
  "/services/lab": "大物实验",
  "/services/rooms": "空教室",
  "/services/announcements": "校园公告",
};

export function AppShell() {
  const { pathname } = useLocation();

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
      <main className="app-main" id="main-content">
        <Outlet />
      </main>
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
