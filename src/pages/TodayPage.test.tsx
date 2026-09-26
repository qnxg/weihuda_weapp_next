import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, Semester } from "../api/types";
import TodayPage from "./TodayPage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  countdown: vi.fn(),
  courses: vi.fn(),
  exams: vi.fn(),
  notices: vi.fn(),
  cards: vi.fn(),
  points: vi.fn(),
  electricity: vi.fn(),
  announcements: vi.fn(),
  grades: vi.fn(),
  email: vi.fn(),
  network: vi.fn(),
}));

vi.mock("../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    countdown: { get: apiMocks.countdown },
    course: { table: apiMocks.courses },
    exam: { list: apiMocks.exams },
    notice: { list: apiMocks.notices },
    me: { setting: apiMocks.cards },
    points: { summary: apiMocks.points },
    dorm: { electricity: apiMocks.electricity },
    announcement: { list: apiMocks.announcements },
    grade: { list: apiMocks.grades },
    email: { unread: apiMocks.email },
    network: { summary: apiMocks.network },
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../hooks/useMinuteClock", () => ({
  useMinuteClock: () => new Date("2026-09-23T14:15:00"),
}));

const semester: Semester = {
  xn: 2026,
  xq: "autumn",
  start: "2026-09-13",
  weeks: 16,
  from_zero: false,
};

const course: Course = {
  course_name: "算法设计与分析",
  course_id: "COMP3011",
  class_name: "计科2201",
  course_type: "专业核心",
  credit: 3,
  weeks: [2],
  day: 3,
  time: 7,
  extra: null,
  area: "南校区",
  place: "综213",
  people: 40,
  teacher: "陈老师",
  customize_id: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TodayPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TodayPage request isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.semester.mockResolvedValue(semester);
    apiMocks.countdown.mockResolvedValue({ holiday: null, semester: null });
    apiMocks.courses.mockResolvedValue([course]);
    apiMocks.exams.mockResolvedValue([]);
    apiMocks.notices.mockResolvedValue({ count: 2, notices: [] });
    apiMocks.cards.mockResolvedValue({
      version: 1,
      setting: { cards: ["course", "tasks", "jifen", "electricity", "campus"] },
    });
    apiMocks.points.mockResolvedValue({ jifen: 18, combo: 2, is_checked: false });
    apiMocks.electricity.mockResolvedValue({ balance: "42.5 kWh" });
    apiMocks.announcements.mockResolvedValue([]);
    apiMocks.grades.mockResolvedValue([]);
    apiMocks.email.mockResolvedValue({ count: 0 });
    apiMocks.network.mockResolvedValue({
      overdue_payment: 0,
      total: "12 GB",
      upload: "2 GB",
      download: "10 GB",
      base_amount: "100 GB",
      base_usage: 12,
      base_percentage: 0.12,
      extend_usage: 0,
      is_locked: false,
    });
  });

  it("keeps the rest of the homepage visible when countdown fails", async () => {
    apiMocks.countdown.mockRejectedValue(new Error("倒计时加载失败"));
    renderPage();

    expect(screen.getByRole("heading", { name: "9 月 23 日 星期三" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("倒计时加载失败");
    expect(await screen.findByRole("tab", { name: "今日课程" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "校园网" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "近期事项" })).toBeVisible();
    expect(screen.getByText("未读通知")).toBeVisible();
  });

  it("renders local data and skips dependent requests when semester fails", async () => {
    apiMocks.semester.mockRejectedValue(new Error("学期加载失败"));
    renderPage();

    expect(screen.getByRole("heading", { name: "9 月 23 日 星期三" })).toBeVisible();
    expect(await screen.findByText("暂无后续假期")).toBeVisible();
    expect(await screen.findByRole("link", { name: /校园网本月已用 12 GB/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "今日与明日课程" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("学期加载失败");
    await waitFor(() => expect(apiMocks.courses).not.toHaveBeenCalled());
    expect(apiMocks.grades).not.toHaveBeenCalled();
  });
});
