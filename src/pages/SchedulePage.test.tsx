import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, ExtraCourse, SemesterItem, SemesterTable, TableSetting } from "../api/types";
import { getCurrentWeek } from "../utils/format";
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

const semester: SemesterItem = {
  xn: 2026,
  xq: 1,
  xq_text: "秋季学期",
  start: "2026-09-13",
  weeks: 16,
  from_zero: false,
};

const semesterTable: SemesterTable = {
  items: [
    semester,
    {
      xn: 2025,
      xq: 2,
      xq_text: "春季学期",
      start: "2026-02-22",
      weeks: 18,
      from_zero: false,
    },
  ],
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

const longExtraCourseRemark =
  "本课程暂无固定上课时间，请加入课程通知群并持续关注课程平台公告。任课教师会根据专题进度安排线上阅读、分组讨论、资料检索、校外访谈和集中研讨，具体日期、教室、参与方式及所需材料将至少提前三天通知。每次活动前请完成指定文献阅读并提交问题清单，活动结束后还需在规定时间内上传讨论记录、阶段报告和个人反思。如遇时间或地点临时调整，请以课程平台最新公告为准；未收到通知时不要自行前往教室，并及时联系任课教师确认后续安排。课程平台会保留历史通知，但请不要只依赖截图或同学转发的消息，以免遗漏后续修订内容。若因课程冲突无法参加集中研讨，应提前提交请假说明，并按照教师要求完成替代任务；多次未查看公告或未按时反馈可能影响过程性评价，请合理安排学习时间。";

const extraCourses: ExtraCourse[] = [
  {
    course_id: "COMP2002",
    course_name: "工程实践",
    class_name: "计科2201",
    course_type: "专业选修",
    credit: 1,
    extra: null,
    area: "南校区",
    people: 30,
    teacher: "王老师",
  },
  {
    course_id: "GENERAL2003",
    course_name: "学术写作专题",
    class_name: "全校选修班",
    course_type: "通识选修",
    credit: 2,
    extra: longExtraCourseRemark,
    area: "南校区",
    people: 45,
    teacher: "赵老师",
  },
];

const schedulePageFootnotes = [
  "对于本科生，数据来源于教务系统。对于研究生，数据来源于研究生系统。未登录时的数据来自于登录时最后一次获得的数据。",
  "点击课表格子或是无课表课程项可查看课程详情信息。",
  "为提升用户体验，湖大微生活会对课表数据进行缓存，课表数据可能未及时更新，你可以通过反复下拉刷新来获取最新数据。",
  "无课表课程指的是没有在学校系统上写明上课时间的课程，这些课程的上课信息需要通过其他途径获得。",
  "彩色格子表示本周上课，灰色格子表示本周不上课，右下角有叠角图标的格子表示该时间段还存在其他非本周课程，格子的左下角如果出现“+N”标识则表示该时间段需要同时上多个课。",
  "如果想要隐藏非本周的课程（灰色格子），可以前往“我的” > “设置” > “课表设置”中开启“仅显示本周课程”。",
] as const;

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
    apiMocks.semester.mockResolvedValue(semesterTable);
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
    expect(courseButton).toHaveClass("schedule-course--color-0");
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
    expect(dialog).toHaveClass("modal--course-detail");
    expect(
      within(dialog).getByRole("article", {
        name: "算法设计与分析，本周上课",
      }),
    ).toHaveClass("schedule-detail-card");
    expect(dialog).toHaveTextContent("综213");
    expect(dialog).toHaveTextContent("陈老师");
    expect(dialog).toHaveTextContent("第 2 周");
    expect(dialog).toHaveTextContent("携带教材");
  });

  it("keeps a clamped location visible in single- and double-period courses", async () => {
    const singlePeriodCourse = {
      ...course,
      course_id: "LONG1001",
      course_name: "跨学科软件工程综合创新实践与复杂系统设计",
      day: 2,
      time: 11,
      place: "信息科学与工程学院实验中心东区超长名称教学机房A204",
      weeks: [1],
    };
    const doublePeriodCourse = {
      ...course,
      course_id: "LONG1002",
      course_name: "面向复杂业务场景的软件架构设计与工程实践",
      day: 5,
      time: 11,
      place: "综合教学楼南栋智慧教室与远程协作实验中心B区405",
    };
    apiMocks.courses.mockResolvedValue([
      singlePeriodCourse,
      doublePeriodCourse,
      { ...doublePeriodCourse, time: 12 },
    ]);
    renderPage();

    const singlePeriod = await screen.findByRole("button", {
      name: /跨学科软件工程综合创新实践与复杂系统设计，周二，第 11 节/,
    });
    const doublePeriod = screen.getByRole("button", {
      name: /面向复杂业务场景的软件架构设计与工程实践，周五，第 11-12 节/,
    });

    expect(singlePeriod).toHaveClass("is-single");
    expect(within(singlePeriod).getByText(/^@信息科学与工程学院/)).toBeVisible();
    expect(singlePeriod).toHaveTextContent("非本周");
    expect(doublePeriod).not.toHaveClass("is-single");
    expect(within(doublePeriod).getByText(/^@综合教学楼南栋/)).toBeVisible();
  });

  it("keeps consecutive periods separate when any course field changes", async () => {
    apiMocks.courses.mockResolvedValue([
      { ...course, course_name: "创新创业实践", course_id: "INNO1001", time: 3, place: "综203" },
      { ...course, course_name: "创新创业实践", course_id: "INNO1001", time: 4, place: "综203" },
      { ...course, course_name: "创新创业实践", course_id: "INNO1001", time: 5, place: "综405" },
    ]);
    renderPage();

    const firstLocation = await screen.findByRole("button", {
      name: /创新创业实践，周三，第 3-4 节.*综203/,
    });
    const secondLocation = screen.getByRole("button", {
      name: /创新创业实践，周三，第 5 节.*综405/,
    });
    expect(screen.getAllByRole("button", { name: /创新创业实践/ })).toHaveLength(2);
    expect(within(firstLocation).getByText("@综203")).toBeVisible();
    expect(within(secondLocation).getByText("@综405")).toBeVisible();
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

  it("distinguishes same-week conflicts from courses sharing a slot in other weeks", async () => {
    const user = userEvent.setup();
    const longRemark =
      "请在课前完成预习任务并携带已经安装好开发环境的笔记本电脑，课堂结束前提交源代码、测试报告和个人总结。";
    apiMocks.courses.mockResolvedValue([
      { ...course, weeks: [1, 3] },
      { ...course, weeks: [1, 3], time: 2 },
      {
        ...course,
        course_name: "程序设计方法",
        course_id: "COMP3014",
        extra: longRemark,
        place: "综214",
        weeks: [2, 4],
      },
      {
        ...course,
        course_name: "程序设计方法",
        course_id: "COMP3014",
        extra: longRemark,
        place: "综214",
        weeks: [2, 4],
        time: 2,
      },
      {
        ...course,
        course_name: "数据库系统",
        course_id: "COMP2004",
        day: 4,
        time: 5,
        weeks: [2],
      },
      {
        ...course,
        course_name: "数据库系统",
        course_id: "COMP2004",
        day: 4,
        time: 6,
        weeks: [2],
      },
      {
        ...course,
        course_name: "数据库系统实验",
        course_id: "COMP2006",
        day: 4,
        time: 5,
        weeks: [2],
      },
      {
        ...course,
        course_name: "数据库系统实验",
        course_id: "COMP2006",
        day: 4,
        time: 6,
        weeks: [2],
      },
    ]);
    renderPage();

    const activeCourse = await screen.findByRole("button", {
      name: /程序设计方法，周三，第 1-2 节.*此时段共有 2 门课程/,
    });
    expect(activeCourse).toHaveClass("has-course-stack");
    expect(activeCourse).not.toHaveClass("has-conflicts");
    const activeCourseColor = [...activeCourse.classList].find((name) =>
      name.startsWith("schedule-course--color-"),
    );
    expect(activeCourseColor).toBeDefined();
    expect(within(activeCourse).queryByText("+1")).not.toBeInTheDocument();
    const conflictingCourse = screen.getByRole("button", {
      name: /数据库系统，周四，第 5-6 节.*此时段共有 2 门课程/,
    });
    expect(conflictingCourse).toHaveClass("has-course-stack", "has-conflicts");
    const conflictCount = within(conflictingCourse).getByText("+1");
    expect(conflictCount).toHaveClass("schedule-course__conflict-count");
    expect(conflictCount).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).not.toBeInTheDocument();

    await user.click(activeCourse);
    const dialog = screen.getByRole("dialog", { name: "程序设计方法" });
    const cards = within(dialog).getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAccessibleName("程序设计方法，本周上课");
    expect(cards[0]).toHaveClass(activeCourseColor!);
    expect(cards[0]).not.toHaveClass("is-inactive");
    expect(cards[0]).toHaveTextContent(`备注：${longRemark}`);
    expect(cards[1]).toHaveAccessibleName("算法设计与分析，第 2 周不上课");
    expect(cards[1]).toHaveClass("is-inactive");
    expect(within(dialog).queryByRole("button", { name: "关闭" })).not.toBeInTheDocument();
    expect(within(cards[1]).queryByText(/第 2 周不上(?:这门)?课/)).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("同一时段共 2 门课程", {
        exact: false,
      }),
    ).toBeInTheDocument();
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
      expect(apiMocks.semester).toHaveBeenCalledOnce();
      expect(apiMocks.courses).toHaveBeenCalledWith(2025, 2);
      expect(apiMocks.extra).toHaveBeenCalledWith(2025, 2);
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

  it("switches weeks with horizontal swipes and ignores vertical gestures", async () => {
    const { container } = renderPage();
    await screen.findByRole("heading", { name: "第 2 周" });
    const calendar = container.querySelector<HTMLElement>(".schedule-calendar")!;
    const courseButton = screen.getByRole("button", { name: /算法设计与分析/ });

    fireEvent.touchStart(courseButton, {
      touches: [{ identifier: 1, clientX: 300, clientY: 240 }],
    });
    fireEvent.touchEnd(courseButton, {
      changedTouches: [{ identifier: 1, clientX: 220, clientY: 244 }],
    });
    fireEvent.click(courseButton);
    expect(await screen.findByRole("heading", { name: "第 3 周" })).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "算法设计与分析" })).not.toBeInTheDocument();

    fireEvent.touchStart(calendar, {
      touches: [{ identifier: 2, clientX: 200, clientY: 180 }],
    });
    fireEvent.touchEnd(calendar, {
      changedTouches: [{ identifier: 2, clientX: 204, clientY: 260 }],
    });
    expect(screen.getByRole("heading", { name: "第 3 周" })).toBeVisible();

    fireEvent.touchStart(calendar, {
      touches: [{ identifier: 3, clientX: 80, clientY: 240 }],
    });
    fireEvent.touchEnd(calendar, {
      changedTouches: [{ identifier: 3, clientX: 160, clientY: 244 }],
    });
    expect(await screen.findByRole("heading", { name: "第 2 周" })).toBeVisible();

    fireEvent.touchStart(calendar, {
      touches: [{ identifier: 4, clientX: 280, clientY: 240 }],
    });
    fireEvent.touchStart(document, {
      touches: [
        { identifier: 4, clientX: 280, clientY: 240 },
        { identifier: 5, clientX: 20, clientY: 20 },
      ],
    });
    fireEvent.touchEnd(calendar, {
      changedTouches: [{ identifier: 4, clientX: 180, clientY: 244 }],
      touches: [{ identifier: 5, clientX: 20, clientY: 20 }],
    });
    expect(screen.getByRole("heading", { name: "第 2 周" })).toBeVisible();

    Object.defineProperties(calendar, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 358 },
    });
    fireEvent.touchStart(calendar, {
      touches: [{ identifier: 6, clientX: 280, clientY: 240 }],
    });
    fireEvent.touchEnd(calendar, {
      changedTouches: [{ identifier: 6, clientX: 180, clientY: 244 }],
    });
    expect(screen.getByRole("heading", { name: "第 2 周" })).toBeVisible();
  });

  it("clamps the server-designated current semester to its first or last week", async () => {
    apiMocks.semester.mockResolvedValue({
      ...semesterTable,
      items: [{ ...semester, start: "2099-09-13" }],
    });
    const futureSemester = renderPage("/schedule");
    expect(await screen.findByRole("heading", { name: "第 1 周" })).toBeVisible();
    futureSemester.unmount();

    apiMocks.semester.mockResolvedValue({
      ...semesterTable,
      items: [{ ...semester, start: "2000-09-13" }],
    });
    renderPage("/schedule");
    expect(await screen.findByRole("heading", { name: "第 16 周" })).toBeVisible();
  });

  it("ignores a stale week when an invalid semester URL falls back to current", async () => {
    renderPage("/schedule?xn=2025&xq=99&week=10");

    expect(
      await screen.findByRole("heading", {
        name: `第 ${getCurrentWeek(semester)} 周`,
      }),
    ).toBeVisible();
    expect(apiMocks.courses).toHaveBeenCalledWith(semester.xn, semester.xq);
  });

  it("keeps the extra-course loading state scoped to its section", async () => {
    apiMocks.extra.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).toBeVisible();
    const extraHeading = screen.getByRole("heading", { name: "无课表课程" });
    const extraSection = extraHeading.closest("section")!;
    expect(extraSection).toHaveClass("schedule-extra-courses");
    expect(within(extraSection).getByRole("status", { name: "正在加载" })).toBeVisible();
    expect(screen.getByRole("note", { name: "课表说明" })).toBeVisible();
  });

  it("hides the entire extra-course section when the response is empty", async () => {
    const { container } = renderPage();

    expect(
      await screen.findByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "无课表课程" })).not.toBeInTheDocument();
    });
    expect(screen.queryByText("没有待排课程")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "无课表课程列表" })).not.toBeInTheDocument();
    expect(container.querySelector(".schedule-extra-courses")).not.toBeInTheDocument();
    expect(container.querySelector(".schedule-calendar + .page-footnotes")).toBeInTheDocument();
    expect(screen.getByRole("note", { name: "课表说明" })).toBeVisible();
  });

  it("labels courses without timetable entries and shows their total", async () => {
    const user = userEvent.setup();
    apiMocks.extra.mockResolvedValue(extraCourses);
    renderPage();

    const extraHeading = await screen.findByRole("heading", { name: "无课表课程" });
    expect(extraHeading).toBeVisible();
    expect(await screen.findByText("共 2 门课程")).toBeVisible();
    expect(await screen.findByText("工程实践", { selector: "span" })).toBeVisible();
    expect(await screen.findByText("学术写作专题", { selector: "span" })).toBeVisible();

    const extraCourseList = screen.getByRole("list", { name: "无课表课程列表" });
    expect(within(extraCourseList).getAllByRole("listitem")).toHaveLength(2);
    const extraCourseButton = within(extraCourseList).getByRole("button", {
      name: "学术写作专题，通识选修，南校区，赵老师，查看课程详情",
    });
    expect(within(extraCourseButton).getByText("通识选修 · 南校区 · 赵老师")).toBeVisible();
    expect(extraCourseButton).not.toHaveTextContent("GENERAL2003");
    expect(extraCourseButton).not.toHaveTextContent("全校选修班");
    expect(extraCourseButton).not.toHaveTextContent("2 学分");
    expect(extraCourseButton).not.toHaveTextContent("45 人");
    expect(extraCourseButton).not.toHaveTextContent(longExtraCourseRemark);

    await user.click(extraCourseButton);
    const detail = screen.getByRole("dialog", { name: "学术写作专题" });
    expect(within(detail).getByRole("region", { name: "课程详细信息" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(detail.querySelectorAll(".schedule-extra-detail > .data-row")).toHaveLength(8);
    expect(within(detail).getByText("备注", { selector: "dt" }).parentElement).toHaveClass(
      "schedule-extra-detail__row--wide",
    );
    for (const [label, value] of [
      ["课程类型", "通识选修"],
      ["课程号", "GENERAL2003"],
      ["班级", "全校选修班"],
      ["校区", "南校区"],
      ["教师", "赵老师"],
      ["学分", "2 学分"],
      ["人数", "45 人"],
      ["备注", longExtraCourseRemark],
    ]) {
      const row = within(detail).getByText(label, { selector: "dt" }).parentElement;
      expect(row).toHaveTextContent(value);
    }

    const footnotes = screen.getByRole("note", { name: "课表说明" });
    expect(
      within(footnotes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(schedulePageFootnotes.map((item) => `*${item}`));
    expect(
      extraHeading.closest("section")!.compareDocumentPosition(footnotes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
  ] as const)("omits the remark row when extra is %s", async (_label, extra) => {
    const user = userEvent.setup();
    apiMocks.extra.mockResolvedValue([{ ...extraCourses[0], extra }]);
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "工程实践，专业选修，南校区，王老师，查看课程详情",
      }),
    );
    const detail = screen.getByRole("dialog", { name: "工程实践" });
    expect(detail.querySelectorAll(".schedule-extra-detail > .data-row")).toHaveLength(7);
    expect(within(detail).queryByText("备注", { selector: "dt" })).not.toBeInTheDocument();
    expect(within(detail).queryByText("无备注")).not.toBeInTheDocument();
    expect(detail.querySelector(".schedule-extra-detail__row--wide")).not.toBeInTheDocument();
  });

  it("keeps courses without timetable entries visible when the weekly grid fails", async () => {
    apiMocks.courses.mockRejectedValue(new Error("周课表加载失败"));
    apiMocks.extra.mockResolvedValue(extraCourses);
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: "学术写作专题，通识选修，南校区，赵老师，查看课程详情",
      }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("周课表加载失败");
    expect(
      screen.queryByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the weekly grid visible when extra courses fail", async () => {
    apiMocks.extra.mockRejectedValue(new Error("无课表课程加载失败"));
    renderPage();

    expect(
      await screen.findByRole("button", {
        name: /算法设计与分析，周三，第 1-2 节/,
      }),
    ).toBeVisible();
    const extraHeading = screen.getByRole("heading", { name: "无课表课程" });
    const extraSection = extraHeading.closest("section")!;
    expect(extraSection).toHaveClass("schedule-extra-courses");
    expect(within(extraSection).getByRole("alert")).toHaveTextContent("无课表课程加载失败");
    expect(screen.getByRole("note", { name: "课表说明" })).toBeVisible();
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
