import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LabGradePage from "./LabGradePage";
import LabSchedulePage from "./LabSchedulePage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  schedule: vi.fn(),
  grade: vi.fn(),
  bind: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    lab: {
      schedule: apiMocks.schedule,
      grade: apiMocks.grade,
      bind: apiMocks.bind,
    },
  },
}));

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const currentGrade = {
  course_name: "大学物理实验",
  course_score: "92",
  labs: [
    {
      lab_name: "示波器的使用",
      score: "94",
      attendance: "正常",
      details: [
        { name: "实验报告", score: 94 },
        { name: "课堂操作", score: 92 },
      ],
    },
    {
      lab_name: "用分光计测定三棱镜的折射率",
      score: "90",
      attendance: "迟到",
      details: [
        { name: "实验报告", score: 91 },
        { name: "课堂操作", score: null },
      ],
    },
    {
      lab_name: "光的干涉与衍射",
      score: "88",
      attendance: null,
      details: [],
    },
  ],
};

const historicalGrade = {
  course_name: "电子电路实验",
  course_score: "86",
  labs: [
    {
      lab_name: "基尔霍夫定律的验证",
      score: "89",
      attendance: "正常",
      details: [
        { name: "实验报告", score: 90 },
        { name: "课堂操作", score: 88 },
      ],
    },
  ],
};

describe("lab pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.semester.mockResolvedValue({
      items: [
        {
          xn: 2026,
          xq: 1,
          xq_text: "秋季学期",
          start: "2026-09-13",
          weeks: 16,
          from_zero: false,
        },
        {
          xn: 2025,
          xq: 4,
          xq_text: "夏季学期",
          start: "2026-06-28",
          weeks: 8,
          from_zero: false,
        },
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
    });
    apiMocks.schedule.mockResolvedValue([]);
    apiMocks.grade.mockImplementation((_year: number, term: number) =>
      Promise.resolve(term === 1 ? currentGrade : historicalGrade),
    );
    apiMocks.bind.mockResolvedValue(undefined);
  });

  it("loads only schedule data and keeps account binding on the schedule page", async () => {
    const user = userEvent.setup();
    renderPage(<LabSchedulePage />);

    expect(await screen.findByRole("heading", { name: "实验安排" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "暂无实验安排" })).toBeVisible();
    await waitFor(() => expect(apiMocks.schedule).toHaveBeenCalledOnce());
    expect(apiMocks.semester).not.toHaveBeenCalled();
    expect(apiMocks.grade).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("实验平台密码"), "lab-password");
    await user.click(screen.getByRole("button", { name: "绑定账号" }));

    await waitFor(() => expect(apiMocks.bind).toHaveBeenCalledOnce());
    expect(apiMocks.bind.mock.calls[0]?.[0]).toBe("lab-password");
    expect(await screen.findByText("实验平台账号已绑定。")).toBeVisible();
  });

  it("renders schedule cards with course, date, venue, teacher and contact actions", async () => {
    apiMocks.schedule.mockResolvedValue([
      {
        seat: "12",
        name: "示波器的使用",
        course: "大学物理实验",
        teacher: "周老师",
        week: 6,
        day: 3,
        date_time: "2026-09-26 14:30",
        place: "物理实验楼205",
        phone: "13800000000",
        email: "teacher@example.edu.cn",
      },
      {
        seat: "",
        name: "用分光计测定三棱镜的折射率",
        course: "大学物理实验",
        teacher: "李老师",
        week: 7,
        day: 4,
        date_time: "2026-10-01 08:00",
        place: "物理实验楼301",
        phone: null,
        email: null,
      },
    ]);
    renderPage(<LabSchedulePage />);

    const card = (
      await screen.findByRole("heading", { name: /示波器的使用/ })
    ).closest<HTMLElement>(".lab-schedule-item")!;
    expect(within(card).queryByText("大学物理实验")).not.toBeInTheDocument();
    expect(within(card).getByText("实验时间")).toBeVisible();
    expect(within(card).getByText("实验地点")).toBeVisible();
    expect(within(card).getByText("授课教师")).toBeVisible();
    expect(within(card).getByText("9月26日(星期六) 14:30")).toBeVisible();
    expect(within(card).getByText("物理实验楼205 · 座位 12")).toBeVisible();
    expect(within(card).getByText("周老师")).toBeVisible();
    expect(within(card).getByText("(teacher@example.edu.cn)")).toBeVisible();
    expect(within(card).queryByText("指导教师")).not.toBeInTheDocument();
    expect(within(card).queryByText(/第 6 周/)).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "电话联系" })).toHaveAttribute(
      "href",
      "tel:13800000000",
    );
    expect(
      within(card).getByRole("link", { name: "发送邮件给周老师（teacher@example.edu.cn）" }),
    ).toHaveAttribute("href", "mailto:teacher@example.edu.cn");
    expect(within(card).queryByRole("link", { name: "发送邮件" })).not.toBeInTheDocument();

    const noContactCard = screen
      .getByText("用分光计测定三棱镜的折射率")
      .closest<HTMLElement>(".lab-schedule-item")!;
    expect(within(noContactCard).getByText("暂无联系方式")).toBeVisible();
    expect(within(noContactCard).queryByRole("link")).not.toBeInTheDocument();
  });

  it("loads lab grades, switches semesters, and opens scoring details", async () => {
    const user = userEvent.setup();
    renderPage(<LabGradePage />);

    expect(await screen.findByRole("heading", { name: "实验成绩" })).toBeVisible();
    expect(screen.getByRole("banner").querySelector("p")).toBeNull();
    expect(await screen.findByRole("heading", { name: "2026-2027 学年 秋季学期" })).toBeVisible();
    await waitFor(() => expect(apiMocks.grade).toHaveBeenCalledWith(2026, 1));
    expect(apiMocks.schedule).not.toHaveBeenCalled();
    expect(apiMocks.bind).not.toHaveBeenCalled();

    const summary = screen.getByText("大学物理实验").closest<HTMLElement>(".lab-course-summary")!;
    expect(within(summary).getByText("92")).toBeVisible();
    expect(within(summary).getByText("总评")).toBeVisible();

    const normalRow = screen
      .getByRole("button", { name: "查看示波器的使用评分组成" })
      .closest<HTMLElement>(".grade-row")!;
    expect(within(normalRow).getByText("示波器的使用")).toBeVisible();
    expect(within(normalRow).getByText("出勤 正常")).toHaveClass("badge--success");
    expect(within(normalRow).getByText("2 项评分")).toBeVisible();
    expect(within(normalRow).getByText("94")).toBeVisible();

    const lateRow = screen
      .getByRole("button", { name: "查看用分光计测定三棱镜的折射率评分组成" })
      .closest<HTMLElement>(".grade-row")!;
    expect(within(lateRow).getByText("出勤 迟到")).toHaveClass("badge--warning");

    const unrecordedRow = screen
      .getByRole("button", { name: "查看光的干涉与衍射评分组成" })
      .closest<HTMLElement>(".grade-row")!;
    expect(within(unrecordedRow).getByText("出勤未记录")).not.toHaveClass("badge--success");
    expect(within(unrecordedRow).getByText("0 项评分")).toBeVisible();
    expect(screen.queryByText("实验报告")).not.toBeInTheDocument();

    const pageFootnotes = screen.getByRole("note", { name: "页面说明" });
    expect(
      within(pageFootnotes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["*数据来源于实验平台。", "*点击可查看每次实验的评分组成。"]);

    await user.click(screen.getByRole("button", { name: "切换学期，当前为2026-2027 秋季学期" }));
    const semesterDialog = screen.getByRole("dialog", { name: "选择学期" });
    expect(
      within(semesterDialog).getByRole("button", {
        name: "2026-2027 秋季学期，当前学期",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(semesterDialog).getByRole("button", {
        name: "2025-2026 春季学期",
      }),
    );
    await waitFor(() => expect(apiMocks.grade).toHaveBeenLastCalledWith(2025, 3));
    expect(screen.getByRole("heading", { name: "2025-2026 学年 春季学期" })).toBeVisible();
    expect(await screen.findByText("电子电路实验")).toBeVisible();
    expect(screen.queryByText("大学物理实验")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "查看基尔霍夫定律的验证评分组成" }));
    const detailDialog = await screen.findByRole("dialog", {
      name: "基尔霍夫定律的验证",
    });
    expect(within(detailDialog).getByText("出勤 正常")).toBeVisible();
    const detailList = detailDialog.querySelector<HTMLElement>(".grade-detail-list")!;
    expect(within(detailList).getByText("实验报告")).toBeVisible();
    expect(within(detailList).getByText("90")).toBeVisible();
    expect(within(detailList).getByText("课堂操作")).toBeVisible();
  });

  it("uses the server-designated current semester and handles a null grade", async () => {
    apiMocks.semester.mockResolvedValue({
      items: [
        {
          xn: 2026,
          xq: 1,
          xq_text: "秋季学期",
          start: "2026-09-13",
          weeks: 16,
          from_zero: false,
        },
        {
          xn: 2025,
          xq: 3,
          xq_text: "春季学期",
          start: "2026-02-22",
          weeks: 16,
          from_zero: false,
        },
      ],
      now_xn: 2025,
      now_xq: 3,
    });
    apiMocks.grade.mockResolvedValue(null);
    renderPage(<LabGradePage />);

    expect(await screen.findByRole("heading", { name: "2025-2026 学年 春季学期" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "暂无实验成绩" })).toBeVisible();
    await waitFor(() => expect(apiMocks.grade).toHaveBeenCalledWith(2025, 3));
    expect(apiMocks.schedule).not.toHaveBeenCalled();
    expect(apiMocks.bind).not.toHaveBeenCalled();
  });
});
