import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, Semester, TableSetting } from "../api/types";
import SchedulePage from "./SchedulePage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  courses: vi.fn(),
  extra: vi.fn(),
  tableSetting: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    course: {
      table: apiMocks.courses,
      extra: apiMocks.extra,
      create: apiMocks.create,
      update: apiMocks.update,
      remove: apiMocks.remove,
    },
    me: { setting: apiMocks.tableSetting },
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
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
  time: 1,
  extra: "携带教材",
  area: "南校区",
  place: "综213",
  people: 40,
  teacher: "陈老师",
  customize_id: null,
};

const tableSetting: TableSetting = {
  version: 1,
  setting: { display_not_current_week_courses: true },
};

function renderPage(initialEntry = "/schedule?week=2&day=3") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <SchedulePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SchedulePage", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.semester.mockImplementation((year?: number, term?: string) =>
      Promise.resolve(
        year && term
          ? {
              ...semester,
              xn: year,
              xq: term,
              start: `${year}-09-13`,
            }
          : semester,
      ),
    );
    apiMocks.courses.mockResolvedValue([course, { ...course, time: 2 }]);
    apiMocks.extra.mockResolvedValue([]);
    apiMocks.tableSetting.mockResolvedValue(tableSetting);
  });

  it("renders merged course sessions in a weekly grid and opens details", async () => {
    const user = userEvent.setup();
    renderPage();

    const courseButton = await screen.findByRole("button", {
      name: /算法设计与分析，周三，第 1-2 节，08:00 到 09:40/,
    });
    expect(courseButton).toHaveAttribute(
      "style",
      expect.stringMatching(/grid-column: 5;.*grid-row: 1 \/ span 2/),
    );
    expect(screen.getByRole("heading", { name: "第 2 周课程表" })).toHaveClass("sr-only");
    const header = screen.getByRole("banner");
    const addCourse = screen.getByRole("button", { name: "添加自定义课程" });
    const changeSemester = screen.getByRole("button", {
      name: "切换学期，当前为2026-2027 秋季学期",
    });
    expect(Array.from(header.querySelector(".schedule-header-actions")?.children || [])).toEqual([
      addCourse,
      changeSemester,
    ]);
    expect(screen.getByText("2026-2027 学年 秋季学期")).toBeVisible();
    expect(screen.getByText("共 16 周")).toBeVisible();

    await user.click(courseButton);

    const dialog = screen.getByRole("dialog", { name: "算法设计与分析" });
    expect(dialog).toHaveTextContent("综213");
    expect(dialog).toHaveTextContent("陈老师");
    expect(dialog).toHaveTextContent("第 2 周");
    expect(dialog).toHaveTextContent("携带教材");
  });

  it("keeps configured off-week courses visible with an explicit state", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("button", { name: /算法设计与分析/ });
    await user.click(screen.getByRole("button", { name: "下一周" }));

    const offWeekCourse = screen.getByRole("button", {
      name: /算法设计与分析.*非本周/,
    });
    expect(offWeekCourse).toHaveClass("is-inactive");
    expect(offWeekCourse).toHaveTextContent("非本周");
    expect(screen.getByText("第 3 周")).toBeVisible();
  });

  it("loads the selected semester and resets its week", async () => {
    const user = userEvent.setup();
    renderPage();

    const semesterTrigger = await screen.findByRole("button", {
      name: "切换学期，当前为2026-2027 秋季学期",
    });
    await user.click(semesterTrigger);

    const dialog = screen.getByRole("dialog", { name: "选择学期" });
    const currentOption = within(dialog).getByRole("button", {
      name: "2026-2027 秋季学期，当前学期",
    });
    expect(currentOption).toHaveAttribute("aria-pressed", "true");
    expect(currentOption).toHaveTextContent("2026-2027 秋季学期");
    expect(currentOption).toHaveTextContent("2026年9月13日 - 2027年1月2日");
    expect(currentOption).toHaveTextContent("当前");
    expect(currentOption).not.toHaveTextContent("已选");
    expect(currentOption.querySelector("svg")).toBeNull();
    await user.click(
      within(dialog).getByRole("button", {
        name: "2025-2026 春季学期",
      }),
    );

    await waitFor(() => {
      expect(apiMocks.semester).toHaveBeenCalledWith(2025, "spring");
      expect(apiMocks.courses).toHaveBeenCalledWith(2025, "spring");
      expect(apiMocks.extra).toHaveBeenCalledWith(2025, "spring");
    });
    expect(screen.queryByRole("dialog", { name: "选择学期" })).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "切换学期，当前为2025-2026 春季学期",
      }),
    ).toBeVisible();
    expect(await screen.findByText("第 1 周")).toBeVisible();
  });

  it("disables week navigation at semester boundaries", async () => {
    const firstWeek = renderPage("/schedule?week=1");
    await screen.findByRole("heading", { name: "第 1 周" });
    expect(screen.getByRole("button", { name: "上一周" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一周" })).toBeEnabled();

    firstWeek.unmount();
    renderPage("/schedule?week=16");
    await screen.findByRole("heading", { name: "第 16 周" });
    expect(screen.getByRole("button", { name: "上一周" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "下一周" })).toBeDisabled();
  });

  it("keeps the weekly grid visible when extra courses fail", async () => {
    apiMocks.extra.mockRejectedValue(new Error("未排课程加载失败"));
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("未排课程加载失败");
  });

  it("uses the default display mode when table settings fail", async () => {
    apiMocks.tableSetting.mockRejectedValue(new Error("课表设置加载失败"));
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).toBeVisible();
    expect(screen.getByText("课表显示设置暂不可用，已使用默认显示方式。")).toBeVisible();
  });
});
