import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, ExamScheduleItem, SemesterItem, SemesterTable } from "../api/types";
import TodayPage from "./TodayPage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  countdown: vi.fn(),
  courses: vi.fn(),
  exams: vi.fn(),
  labSchedule: vi.fn(),
  gymAppointments: vi.fn(),
  notices: vi.fn(),
  cards: vi.fn(),
  points: vi.fn(),
  electricity: vi.fn(),
  announcements: vi.fn(),
  grades: vi.fn(),
  email: vi.fn(),
  network: vi.fn(),
  campusCard: vi.fn(),
}));

vi.mock("../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    countdown: { get: apiMocks.countdown },
    course: { table: apiMocks.courses },
    exam: { list: apiMocks.exams },
    lab: { schedule: apiMocks.labSchedule },
    gym: { appointments: apiMocks.gymAppointments },
    notice: { list: apiMocks.notices },
    me: { setting: apiMocks.cards },
    points: { summary: apiMocks.points },
    dorm: { electricity: apiMocks.electricity },
    announcement: { list: apiMocks.announcements },
    grade: { list: apiMocks.grades },
    email: { unread: apiMocks.email },
    network: { summary: apiMocks.network },
    card: { info: apiMocks.campusCard },
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("../hooks/useMinuteClock", () => ({
  useMinuteClock: () => new Date("2026-09-23T14:15:00"),
}));

const semester: SemesterItem = {
  xn: 2026,
  xq: 1,
  xq_text: "秋季学期",
  start: "2026-09-13",
  weeks: 16,
  from_zero: false,
};

const semesterTable: SemesterTable = {
  items: [semester],
  now_xn: semester.xn,
  now_xq: semester.xq,
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

const exam = (
  courseName: string,
  date: string,
  startTime: string,
  endTime: string,
  invalid = false,
): ExamScheduleItem => ({
  course_id: "COMP1001",
  course_name: courseName,
  area: "南校区",
  classroom: "综101",
  date,
  start_time: startTime,
  end_time: endTime,
  seat: "42",
  customize_id: null,
  invalid,
});

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
    apiMocks.semester.mockResolvedValue(semesterTable);
    apiMocks.countdown.mockResolvedValue({ holiday: null, semester: null });
    apiMocks.courses.mockResolvedValue([course]);
    apiMocks.exams.mockResolvedValue([]);
    apiMocks.labSchedule.mockResolvedValue([
      {
        seat: "12",
        name: "示波器的使用",
        course: "大学物理实验",
        teacher: "周老师",
        week: 2,
        day: 4,
        date_time: "2026-09-26 14:30",
        place: "物理实验楼205",
        phone: null,
        email: "teacher@example.edu.cn",
      },
    ]);
    apiMocks.gymAppointments.mockResolvedValue([
      {
        name: "秋季体质测试",
        description: "请提前到场签到",
        show_date: "2026年9月28日（周一）",
        time: "09:00-10:00",
        test_type: "年度测试",
        status: "已预约",
      },
    ]);
    apiMocks.notices.mockResolvedValue({ count: 2, notices: [] });
    apiMocks.cards.mockResolvedValue({
      version: 1,
      setting: { cards: ["course", "tasks", "jifen", "electricity", "campus", "email"] },
    });
    apiMocks.points.mockResolvedValue({ jifen: 18, combo: 2, is_checked: false });
    apiMocks.electricity.mockResolvedValue({ balance: "42.5 kWh" });
    apiMocks.announcements.mockResolvedValue([]);
    apiMocks.grades.mockResolvedValue([
      {
        course_id: "COMP1001",
        course_name: "数据结构",
        credit: 3,
        gpa: 4,
        score: 95,
        course_type1: "必修",
        course_type2: "专业核心",
        grade_tag: null,
        grade_type: "主修",
        jx0404id: "GRADE001",
      },
      {
        course_id: "MATH1002",
        course_name: "高等数学",
        credit: 5,
        gpa: 3.7,
        score: 88,
        course_type1: "选修",
        course_type2: "公共基础",
        grade_tag: null,
        grade_type: "辅修",
        jx0404id: "GRADE002",
      },
      {
        course_id: "PHYS1001",
        course_name: "大学物理",
        credit: 4,
        gpa: 3.3,
        score: 84,
        course_type1: "必修",
        course_type2: "专业基础",
        grade_tag: null,
        grade_type: "主修",
        jx0404id: "GRADE003",
      },
    ]);
    apiMocks.email.mockResolvedValue({ count: 3 });
    apiMocks.campusCard.mockResolvedValue({ id: 123456, balance: 86.5 });
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
    expect(screen.getByRole("heading", { name: "校园账户" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "近期事项" })).toBeVisible();
    expect(screen.getByText("实验")).toBeVisible();
    expect(screen.getByText("体测预约")).toBeVisible();
  });

  it("renders local data and skips dependent requests when semester fails", async () => {
    apiMocks.semester.mockRejectedValue(new Error("学期加载失败"));
    renderPage();

    expect(screen.getByRole("heading", { name: "9 月 23 日 星期三" })).toBeVisible();
    expect(await screen.findByText("暂无学期信息")).toBeVisible();
    expect(await screen.findByRole("link", { name: /校园网本月已用 12 GB/ })).toBeVisible();
    expect(screen.getByRole("heading", { name: "今日与明日课程" })).toBeVisible();
    expect(
      screen.getAllByRole("alert").every((alert) => alert.textContent?.includes("学期加载失败")),
    ).toBe(true);
    await waitFor(() => expect(apiMocks.courses).not.toHaveBeenCalled());
    expect(apiMocks.grades).not.toHaveBeenCalled();
  });

  it("loads every announcement with the homepage and places them above the course section", async () => {
    apiMocks.announcements.mockResolvedValue([
      {
        id: 1,
        title: "服务通知",
        url: null,
        content: "微生活服务正常运行。",
        created_at: "2026-09-22 08:00:00",
      },
      {
        id: 2,
        title: "校园网维护安排",
        url: "https://qnxg.cn",
        content:
          "本周五深夜将进行校园网例行维护。\n维护期间校园网可能短暂中断。\n请提前保存在线任务。",
        created_at: "2026-09-20 18:00:00",
      },
    ]);
    renderPage();

    const announcementRegion = await screen.findByRole("region", { name: "公告" });
    const items = within(announcementRegion).getAllByRole("article");
    expect(items.map((item) => within(item).getByRole("heading").textContent)).toEqual([
      "服务通知",
      "校园网维护安排",
    ]);
    expect(items[1].querySelector(".today-announcement__content")?.textContent).toContain("\n");
    expect(announcementRegion.nextElementSibling).toHaveClass("today-courses");
  });

  it("keeps an announcement failure local and retries only that request", async () => {
    const user = userEvent.setup();
    apiMocks.announcements.mockRejectedValueOnce(new Error("公告加载失败")).mockResolvedValueOnce([
      {
        id: 1,
        title: "服务恢复通知",
        url: null,
        content: "公告服务已经恢复。",
        created_at: "2026-09-23 15:00:00",
      },
    ]);
    renderPage();

    const alert = await screen.findByRole("alert");
    await user.click(within(alert).getByRole("button", { name: "重新加载公告" }));
    expect(await screen.findByRole("region", { name: "公告" })).toHaveTextContent("服务恢复通知");
    expect(apiMocks.announcements).toHaveBeenCalledTimes(2);
  });

  it("combines every recent exam, lab, and gym appointment in date order", async () => {
    apiMocks.exams.mockResolvedValue([
      exam("正在进行的考试", "2026-09-23", "14:00", "16:00"),
      exam("后续考试", "2026-09-24", "09:00", "11:00"),
    ]);
    apiMocks.labSchedule.mockResolvedValue([
      {
        seat: "12",
        name: "示波器的使用",
        course: "大学物理实验",
        teacher: "周老师",
        week: 2,
        day: 6,
        date_time: "2026-09-26 14:30",
        place: "物理实验楼205",
        phone: null,
        email: null,
      },
      {
        seat: "08",
        name: "电桥测量",
        course: "大学物理实验",
        teacher: "周老师",
        week: 2,
        day: 0,
        date_time: "2026-09-27 10:00",
        place: "物理实验楼206",
        phone: null,
        email: null,
      },
    ]);
    apiMocks.gymAppointments.mockResolvedValue([
      {
        name: "秋季体质测试",
        description: "请提前到场签到",
        show_date: "2026年9月28日（周一）",
        time: "09:00-10:00",
        test_type: "年度测试",
        status: "已预约",
      },
      {
        name: "体测补测",
        description: "请提前到场签到",
        show_date: "2026年9月29日（周二）",
        time: "15:00-16:00",
        test_type: "补测",
        status: "已预约",
      },
    ]);
    renderPage();

    const recentSection = screen
      .getByRole("heading", { name: "近期事项" })
      .closest("section") as HTMLElement;
    expect(await within(recentSection).findByText("正在进行的考试")).toBeVisible();
    expect(within(recentSection).getByText("后续考试")).toBeVisible();
    expect(within(recentSection).getByText("电桥测量")).toBeVisible();
    expect(within(recentSection).getByText("体测补测")).toBeVisible();
    expect(
      within(recentSection).getByText("9月23日(星期三) ｜ 14:00–16:00 ｜ 综101"),
    ).toBeVisible();
    expect(
      within(recentSection).getByText("9月26日(星期六) ｜ 14:30 ｜ 物理实验楼205"),
    ).toBeVisible();
    expect(within(recentSection).getByText("9月28日(星期一) ｜ 09:00–10:00")).toBeVisible();
    expect(
      [...recentSection.querySelectorAll(".today-recent-row__label")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["考试", "考试", "实验", "实验", "体测预约", "体测预约"]);
    const stripes = recentSection.querySelectorAll(".today-recent-row__stripe");
    expect(stripes[0]).toHaveClass("today-recent-row__stripe--warning");
    expect(stripes[1]).toHaveClass("today-recent-row__stripe--warning");
    expect(stripes[2]).toHaveClass("today-recent-row__stripe--success");
    expect(stripes[3]).toHaveClass("today-recent-row__stripe--success");
    expect(stripes[4]).toHaveClass("today-recent-row__stripe--neutral");
    expect(stripes[5]).toHaveClass("today-recent-row__stripe--neutral");
    expect(stripes[4]).not.toHaveClass(
      "today-recent-row__stripe--warning",
      "today-recent-row__stripe--success",
    );
    expect(within(recentSection).getByRole("link", { name: /实验，示波器的使用/ })).toHaveAttribute(
      "href",
      "/services/lab/schedule",
    );
    expect(
      within(recentSection).getByRole("link", { name: /体测预约，秋季体质测试/ }),
    ).toHaveAttribute("href", "/services/gym/appointment");
    expect(within(recentSection).queryByText("未读通知")).not.toBeInTheDocument();
    expect(within(recentSection).queryByText("校内邮箱")).not.toBeInTheDocument();
    const noticeLink = screen.getByRole("link", { name: "2 条未读通知" });
    expect(within(noticeLink).getByText("2")).toHaveClass("today-notice-button__badge");
    expect(apiMocks.exams).toHaveBeenCalledWith("recent");
    expect(apiMocks.labSchedule).toHaveBeenCalledOnce();
    expect(apiMocks.gymAppointments).toHaveBeenCalledOnce();
  });

  it("only treats events within six local calendar days as recent", async () => {
    apiMocks.exams.mockResolvedValue([
      exam("七天后的考试", "2026-09-30", "09:00", "11:00"),
      exam("两天后的考试", "2026-09-25", "09:00", "11:00"),
    ]);
    apiMocks.labSchedule.mockResolvedValue([
      {
        seat: "12",
        name: "昨天的实验",
        course: "大学物理实验",
        teacher: "周老师",
        week: 2,
        day: 2,
        date_time: "2026-09-22 14:30",
        place: "物理实验楼205",
        phone: null,
        email: null,
      },
    ]);
    apiMocks.gymAppointments.mockResolvedValue([
      {
        name: "七天后的体测",
        description: "请提前到场签到",
        show_date: "2026年9月30日（周三）",
        time: "09:00-10:00",
        test_type: "年度测试",
        status: "已预约",
      },
    ]);
    renderPage();

    expect(await screen.findByText("两天后的考试")).toBeVisible();
    expect(screen.queryByText("七天后的考试")).not.toBeInTheDocument();
    expect(screen.queryByText("昨天的实验")).not.toBeInTheDocument();
    expect(screen.queryByText("七天后的体测")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /考试，两天后的考试/ })).toHaveLength(1);
    expect(document.querySelectorAll(".today-recent-row")).toHaveLength(1);
  });

  it("keeps a lab failure local and retries only the lab request", async () => {
    const user = userEvent.setup();
    apiMocks.exams.mockResolvedValue([exam("正在进行的考试", "2026-09-23", "14:00", "16:00")]);
    apiMocks.labSchedule
      .mockRejectedValueOnce(new Error("实验安排加载失败"))
      .mockResolvedValueOnce([
        {
          seat: "12",
          name: "电桥测量",
          course: "大学物理实验",
          teacher: "周老师",
          week: 2,
          day: 4,
          date_time: "2026-09-24 14:30",
          place: "物理实验楼205",
          phone: null,
          email: null,
        },
      ]);
    renderPage();

    expect(await screen.findByText("正在进行的考试")).toBeVisible();
    expect(await screen.findByText("秋季体质测试")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "重新加载实验" }));

    expect(await screen.findByRole("link", { name: /实验，电桥测量/ })).toBeVisible();
    expect(apiMocks.labSchedule).toHaveBeenCalledTimes(2);
    expect(apiMocks.exams).toHaveBeenCalledOnce();
    expect(apiMocks.gymAppointments).toHaveBeenCalledOnce();
  });

  it("caps the visible notice badge without losing the full accessible count", async () => {
    apiMocks.notices.mockResolvedValue({ count: 120, notices: [] });
    renderPage();

    const noticeLink = await screen.findByRole("link", { name: "120 条未读通知" });
    expect(within(noticeLink).getByText("99+")).toHaveClass("today-notice-button__badge");
  });

  it("groups the network and three account cards in one section", async () => {
    renderPage();

    const accountSection = screen
      .getByRole("heading", { name: "校园账户" })
      .closest("section") as HTMLElement;
    expect(
      await within(accountSection).findByRole("link", {
        name: "校园网本月已用 12 GB，账号正常，无欠费",
      }),
    ).toBeVisible();
    expect(within(accountSection).getByRole("article", { name: "未读邮件，3 封" })).toBeVisible();
    expect(
      within(accountSection).getByRole("link", { name: "宿舍剩余电量，42.5 kWh" }),
    ).toHaveAttribute("href", "/services/dorm");
    expect(
      within(accountSection).getByRole("link", { name: "校园卡金额，¥86.50" }),
    ).toHaveAttribute("href", "/services/card");
    expect(accountSection.querySelector(".campus-account-overview__grid")?.children).toHaveLength(
      3,
    );
  });

  it("renders every current-semester grade in a compact horizontal card list", async () => {
    renderPage();

    const gradeList = await screen.findByRole("list", {
      name: "2026 秋季学期课程成绩，共 3 门",
    });
    const gradeSection = gradeList.closest("section") as HTMLElement;
    expect(within(gradeList).getAllByRole("listitem")).toHaveLength(3);
    expect(
      within(gradeList).getByRole("link", {
        name: "数据结构，成绩 95，查看课程成绩",
      }),
    ).toHaveAttribute("href", "/services/grades");
    expect(within(gradeList).getByText("高等数学")).toBeVisible();
    expect(within(gradeList).getByText("大学物理")).toBeVisible();
    expect(within(gradeSection).queryByText("2026 秋季学期")).not.toBeInTheDocument();
    expect(within(gradeSection).queryByText(/绩点|学分|必修|选修/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "校园速览" })).not.toBeInTheDocument();
    expect(apiMocks.grades).toHaveBeenCalledWith(2026, 1);
  });

  it("keeps a grade failure local and retries only the grade request", async () => {
    const user = userEvent.setup();
    apiMocks.grades.mockRejectedValueOnce(new Error("课程成绩加载失败")).mockResolvedValueOnce([]);
    renderPage();

    const gradeSection = screen
      .getByRole("heading", { name: "课程成绩" })
      .closest("section") as HTMLElement;
    const unrelatedExamCalls = apiMocks.exams.mock.calls.length;
    await user.click(await within(gradeSection).findByRole("button", { name: "重新加载" }));

    expect(
      await screen.findByRole("link", {
        name: "查看2026 秋季学期课程成绩，共 0 门",
      }),
    ).toBeVisible();
    expect(apiMocks.grades).toHaveBeenCalledTimes(2);
    expect(apiMocks.exams).toHaveBeenCalledTimes(unrelatedExamCalls);
  });

  it("keeps an email failure local and retries only the unread count", async () => {
    const user = userEvent.setup();
    apiMocks.email.mockRejectedValueOnce(new Error("邮件加载失败")).mockResolvedValueOnce({
      count: 1,
    });
    renderPage();

    const emailAlert = await screen.findByRole("alert", { name: "未读邮件暂不可用" });
    const unrelatedRequestCounts = {
      courses: apiMocks.courses.mock.calls.length,
      notices: apiMocks.notices.mock.calls.length,
      cards: apiMocks.cards.mock.calls.length,
      network: apiMocks.network.mock.calls.length,
    };

    await user.click(within(emailAlert).getByRole("button", { name: "重新加载未读邮件" }));

    expect(await screen.findByRole("article", { name: "未读邮件，1 封" })).toBeVisible();
    expect(apiMocks.email).toHaveBeenCalledTimes(2);
    expect(apiMocks.courses).toHaveBeenCalledTimes(unrelatedRequestCounts.courses);
    expect(apiMocks.notices).toHaveBeenCalledTimes(unrelatedRequestCounts.notices);
    expect(apiMocks.cards).toHaveBeenCalledTimes(unrelatedRequestCounts.cards);
    expect(apiMocks.network).toHaveBeenCalledTimes(unrelatedRequestCounts.network);
  });

  it("keeps fixed account and recent summaries when legacy settings omit them", async () => {
    apiMocks.cards.mockResolvedValue({
      version: 2,
      setting: { cards: ["course", "jifen", "campus"] },
    });
    renderPage();

    await screen.findByText("算法设计与分析");
    expect(await screen.findByRole("article", { name: "未读邮件，3 封" })).toBeVisible();
    expect(screen.getByText("示波器的使用")).toBeVisible();
    expect(screen.getByRole("heading", { name: "课程成绩" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "校园速览" })).not.toBeInTheDocument();
    expect(apiMocks.email).toHaveBeenCalledOnce();
    expect(apiMocks.labSchedule).toHaveBeenCalledOnce();
  });
});
