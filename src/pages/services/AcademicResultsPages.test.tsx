import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Grade, Rank, SemesterTable } from "../../api/types";
import GradesPage from "./GradesPage";
import RankPage from "./RankPage";

const apiMocks = vi.hoisted(() => ({
  gradeList: vi.fn(),
  gradeDetail: vi.fn(),
  rankSchool: vi.fn(),
  rankCa: vi.fn(),
  refreshCa: vi.fn(),
  semester: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    grade: {
      list: apiMocks.gradeList,
      detail: apiMocks.gradeDetail,
    },
    rank: {
      school: apiMocks.rankSchool,
      ca: apiMocks.rankCa,
      refreshCa: apiMocks.refreshCa,
    },
    semester: { get: apiMocks.semester },
  },
}));

const grade: Grade = {
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
};

const rank: Rank = {
  all: {
    arithmetic: "88.2",
    arithmetic_rank: "8/120",
    weighted: "100.00",
    weighted_rank: "6/120",
    gpa: "3.84",
    gpa_rank: "5/120",
  },
  compulsory: null,
  core: null,
};

const semesterTable: SemesterTable = {
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
    {
      xn: 2025,
      xq: 2,
      xq_text: "冬季学期",
      start: "2026-01-04",
      weeks: 6,
      from_zero: false,
    },
    {
      xn: 2025,
      xq: 1,
      xq_text: "秋季学期",
      start: "2025-09-14",
      weeks: 16,
      from_zero: false,
    },
  ],
  now_xn: 2026,
  now_xq: 1,
};

function renderRoute(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/services/grades" element={<GradesPage />} />
          <Route path="/services/rank" element={<RankPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("academic result pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.gradeList.mockResolvedValue([grade]);
    apiMocks.gradeDetail.mockResolvedValue([{ name: "期末考试", score: "95", percentage: "60%" }]);
    apiMocks.rankSchool.mockResolvedValue(rank);
    apiMocks.rankCa.mockResolvedValue(null);
    apiMocks.refreshCa.mockResolvedValue(undefined);
    apiMocks.semester.mockResolvedValue(semesterTable);
  });

  it("switches course semesters without loading ranking data", async () => {
    const user = userEvent.setup();
    apiMocks.gradeDetail.mockResolvedValue([
      { name: "期末考试 B", score: "94", percentage: "20%" },
      { name: "平时作业 B", score: "90", percentage: "10%" },
      { name: "B 项目", score: "92", percentage: "10%" },
      { name: "期中考试 B", score: "91", percentage: "10%" },
      { name: "期末考试 A", score: "95", percentage: "20%" },
      { name: "A 项目", score: "93", percentage: "10%" },
      { name: "平时作业 A", score: "96", percentage: "10%" },
      { name: "期中考试 A", score: "97", percentage: "10%" },
    ]);
    apiMocks.gradeList.mockResolvedValue([{ ...grade, grade_tag: "优秀" }]);
    renderRoute("/services/grades");

    expect(await screen.findByRole("heading", { name: "课程成绩" })).toBeVisible();
    expect(await screen.findByText("数据结构")).toBeVisible();
    const gradeButton = screen.getByRole("button", { name: "查看数据结构成绩组成" });
    const gradeRow = gradeButton.closest<HTMLElement>(".grade-row")!;
    expect(within(gradeRow).getByText("COMP1001 · 3 学分")).toBeVisible();
    const gradeTags = within(gradeRow).getAllByRole("listitem");
    expect(gradeTags.map((tag) => tag.textContent)).toEqual(["优秀", "必修", "专业核心"]);
    expect(gradeTags[0]).toHaveClass("badge--warning");
    expect(gradeTags[1]).toHaveClass("badge--brand");
    expect(gradeTags[2]).toHaveClass("badge--brand");
    expect(within(gradeRow).queryByText("主修")).not.toBeInTheDocument();
    expect(within(gradeRow).getByLabelText("绩点 4.0")).toHaveTextContent("4.0");
    expect(within(gradeRow).queryByText(/GPA/)).not.toBeInTheDocument();
    const pageFootnotes = screen.getByRole("note", { name: "页面说明" });
    expect(
      within(pageFootnotes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "*数据来源于教务系统。",
      "*点击可查看课程成绩的具体组成。",
      "*课程分数下方的小数为该门课程的绩点。",
    ]);
    expect(screen.getByRole("banner").querySelector("p")).toBeNull();
    expect(screen.getByRole("heading", { name: "2026-2027 学年 秋季学期" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "学年" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "学期" })).not.toBeInTheDocument();
    expect(apiMocks.gradeList).toHaveBeenCalledWith(2026, 1);
    expect(apiMocks.rankSchool).not.toHaveBeenCalled();
    expect(apiMocks.rankCa).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "切换学期，当前为2026-2027 秋季学期",
      }),
    );
    const semesterDialog = screen.getByRole("dialog", { name: "选择学期" });
    expect(
      within(semesterDialog).getByRole("button", {
        name: "2026-2027 秋季学期，当前学期",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      within(semesterDialog).getByRole("button", {
        name: "2025-2026 夏季学期",
      }),
    );
    await waitFor(() => expect(apiMocks.gradeList).toHaveBeenLastCalledWith(2025, 4));
    expect(screen.getByRole("heading", { name: "2025-2026 学年 夏季学期" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "查看数据结构成绩组成" }));
    const detailDialog = await screen.findByRole("dialog", { name: "数据结构" });
    expect(detailDialog).not.toHaveTextContent("课程号");
    expect(detailDialog).not.toHaveTextContent("COMP1001");
    const detailList = detailDialog.querySelector<HTMLElement>(".grade-detail-list")!;
    expect(detailList.tagName).toBe("UL");
    expect(detailList).not.toHaveClass("surface");
    expect(
      Array.from(detailList.querySelectorAll(".data-row strong"), (item) => item.textContent),
    ).toEqual([
      "A 项目",
      "B 项目",
      "平时作业 A",
      "平时作业 B",
      "期中考试 A",
      "期中考试 B",
      "期末考试 A",
      "期末考试 B",
    ]);
  });

  it("uses the current semester designated by the server for grades and ranking", async () => {
    apiMocks.semester.mockResolvedValue({
      ...semesterTable,
      now_xn: 2025,
      now_xq: 2,
    });

    const { unmount } = renderRoute("/services/grades");
    expect(await screen.findByRole("heading", { name: "2025-2026 学年 冬季学期" })).toBeVisible();
    await waitFor(() => expect(apiMocks.gradeList).toHaveBeenCalledWith(2025, 2));
    unmount();

    renderRoute("/services/rank");
    expect(
      await screen.findByRole("button", {
        name: "学年学期，当前选择：2025-2026 学年 冬季学期",
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenCalledWith({
        xn: 2025,
        xq: 2,
        range: "major",
        data_source: "total",
        display: "max",
      }),
    );
  });

  it("does not widen an invalid semester deep link to all terms", async () => {
    renderRoute("/services/rank?xn=2025&xq=99");

    expect(
      await screen.findByRole("button", {
        name: "学年学期，当前选择：2026-2027 学年 秋季学期",
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenCalledWith({
        xn: 2026,
        xq: 1,
        range: "major",
        data_source: "total",
        display: "max",
      }),
    );
  });

  it("loads only ranking data and switches ranking sources", async () => {
    const user = userEvent.setup();
    renderRoute("/services/rank");

    expect(await screen.findByRole("heading", { name: "成绩排名" })).toBeVisible();
    expect(screen.getByRole("banner").querySelector("p")).toBeNull();
    const allCourses = await screen.findByRole("group", { name: "全部课程成绩与排名" });
    expect(screen.getByText("排名数据已更新")).toHaveClass("sr-only");
    expect(within(allCourses).getByText("88.20")).toBeVisible();
    expect(within(allCourses).getByText("100")).toBeVisible();
    expect(within(allCourses).getByText("3.8")).toBeVisible();
    expect(within(allCourses).getByLabelText("第 8 名，共 120 人，排名百分比 6.7%")).toBeVisible();
    const resultHeading = screen.getByRole("heading", {
      name: "2026-2027 学年 秋季学期",
      level: 2,
    });
    const resultSection = resultHeading.closest("section")!;
    expect(resultHeading).toBeVisible();
    expect(within(resultSection).getByText("主修 / 成绩主库 / 最大成绩")).toBeVisible();
    expect(within(resultSection).queryByText("排名结果")).not.toBeInTheDocument();
    const schoolRankFootnotes = screen.getByRole("note", { name: "页面说明" });
    expect(
      within(schoolRankFootnotes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["*数据来源于教务系统。"]);
    expect(apiMocks.rankSchool).toHaveBeenCalledWith({
      xn: 2026,
      xq: 1,
      range: "major",
      data_source: "total",
      display: "max",
    });
    expect(apiMocks.gradeList).not.toHaveBeenCalled();

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    const semesterTrigger = screen.getByRole("button", { name: /学年学期，当前选择/ });
    await user.click(semesterTrigger);
    const semesterDialog = screen.getByRole("dialog", { name: "选择学年学期" });
    expect(within(semesterDialog).queryAllByRole("radio")).toHaveLength(0);
    expect(within(semesterDialog).queryByRole("button", { name: "完成" })).not.toBeInTheDocument();
    expect(within(semesterDialog).getByRole("group", { name: "学年" })).toBeVisible();
    expect(within(semesterDialog).getByRole("group", { name: "学期" })).toBeVisible();
    expect(within(semesterDialog).getByRole("button", { name: "秋季学期" })).toBeEnabled();
    expect(within(semesterDialog).getByRole("button", { name: "2026-2027 学年" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const previousYear = within(semesterDialog).getByRole("button", {
      name: "2025-2026 学年",
    });
    expect(previousYear).toHaveAttribute("aria-pressed", "false");
    previousYear.focus();
    await user.keyboard("{Enter}");
    expect(previousYear).toHaveAttribute("aria-pressed", "true");
    for (const semesterName of ["秋季学期", "冬季学期", "春季学期", "夏季学期"]) {
      expect(within(semesterDialog).getByRole("button", { name: semesterName })).toBeEnabled();
    }
    const thirdSemester = within(semesterDialog).getByRole("button", { name: "春季学期" });
    thirdSemester.focus();
    await user.keyboard(" ");
    expect(screen.queryByRole("dialog", { name: "选择学年学期" })).not.toBeInTheDocument();
    expect(semesterTrigger).toHaveFocus();
    expect(
      screen.getByRole("button", {
        name: "学年学期，当前选择：2025-2026 学年 春季学期",
      }),
    ).toBeVisible();

    const rangeGroup = screen.getByRole("radiogroup", { name: "课程范围" });
    expect(within(rangeGroup).getByRole("radio", { name: "主修" })).toBeChecked();
    await user.click(within(rangeGroup).getByRole("radio", { name: "辅修" }));
    expect(within(rangeGroup).getByRole("radio", { name: "辅修" })).toBeChecked();

    const dataSourceGroup = screen.getByRole("radiogroup", { name: "数据来源" });
    expect(within(dataSourceGroup).getByRole("radio", { name: "成绩主库" })).toBeChecked();
    await user.click(within(dataSourceGroup).getByRole("radio", { name: "执行方案" }));
    expect(within(dataSourceGroup).getByRole("radio", { name: "执行方案" })).toBeChecked();

    const displayGroup = screen.getByRole("radiogroup", { name: "成绩取值" });
    expect(within(displayGroup).getByRole("radio", { name: "最大成绩" })).toBeChecked();
    await user.click(within(displayGroup).getByRole("radio", { name: "初修成绩" }));
    expect(within(displayGroup).getByRole("radio", { name: "初修成绩" })).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.rankSchool).toHaveBeenCalledTimes(1);
    const submitButton = screen.getByRole("button", { name: "查询" });
    expect(submitButton.closest(".rank-filter-card")).toBeNull();
    await user.click(submitButton);
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenLastCalledWith({
        xn: 2025,
        xq: 3,
        range: "minor",
        data_source: "execution",
        display: "initial",
      }),
    );
    const updatedResultHeading = screen.getByRole("heading", {
      name: "2025-2026 学年 春季学期",
      level: 2,
    });
    const updatedResultSection = updatedResultHeading.closest("section")!;
    expect(updatedResultHeading).toBeVisible();
    expect(within(updatedResultSection).getByText("辅修 / 执行方案 / 初修成绩")).toBeVisible();
    expect(submitButton).toHaveFocus();

    let resolveRefetch!: (value: Rank) => void;
    apiMocks.rankSchool.mockImplementationOnce(
      () =>
        new Promise<Rank>((resolve) => {
          resolveRefetch = resolve;
        }),
    );
    await user.click(submitButton);
    await waitFor(() => expect(submitButton).toBeDisabled());
    const selectedRange = within(rangeGroup).getByRole("radio", { name: "辅修" });
    selectedRange.focus();
    act(() => resolveRefetch(rank));
    await waitFor(() => expect(submitButton).toBeEnabled());
    expect(selectedRange).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /学年学期，当前选择/ }));
    const allYearsDialog = screen.getByRole("dialog", { name: "选择学年学期" });
    await user.click(within(allYearsDialog).getByRole("button", { name: "全部学年" }));
    expect(screen.queryByRole("dialog", { name: "选择学年学期" })).not.toBeInTheDocument();
    expect(semesterTrigger).toHaveFocus();
    expect(
      screen.getByRole("button", {
        name: "学年学期，当前选择：全部学年 全部学期",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenLastCalledWith({
        xn: undefined,
        xq: undefined,
        range: "minor",
        data_source: "execution",
        display: "initial",
      }),
    );
    const allYearsResultHeading = screen.getByRole("heading", {
      name: "全部学年 全部学期",
      level: 2,
    });
    const allYearsResultSection = allYearsResultHeading.closest("section")!;
    expect(allYearsResultHeading).toBeVisible();
    expect(within(allYearsResultSection).getByText("辅修 / 执行方案 / 初修成绩")).toBeVisible();

    apiMocks.rankCa.mockResolvedValue({
      updated_at: "2026-09-23 14:30:00",
      rank,
    });
    await user.click(screen.getByRole("button", { name: "可信电子凭证" }));
    const updateButton = await screen.findByRole("button", {
      name: /更新可信电子凭证排名，当前数据更新时间：/,
    });
    expect(screen.queryByRole("heading", { name: "可信电子凭证排名" })).not.toBeInTheDocument();
    expect(screen.getByText("更新", { selector: "strong" })).toBeVisible();
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("2026年");
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("9月23日");
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("14:30");
    expect(screen.getByText("可信电子凭证排名数据已更新")).toHaveClass("sr-only");
    const trustedRankFootnotes = screen.getByRole("note", { name: "页面说明" });
    expect(
      within(trustedRankFootnotes)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["*数据来源于可信电子凭证。数据并非实时更新。"]);
    expect(apiMocks.rankCa).toHaveBeenCalledOnce();

    await user.click(updateButton);
    await waitFor(() => expect(apiMocks.refreshCa).toHaveBeenCalledOnce());
    await waitFor(() => expect(apiMocks.rankCa).toHaveBeenCalledTimes(2));
  });

  it("renders complete, score-only, rank-only, and empty course groups", async () => {
    const user = userEvent.setup();
    apiMocks.rankSchool.mockResolvedValue({
      all: rank.all,
      compulsory: {
        arithmetic: "89.40",
        arithmetic_rank: null,
        weighted: "90.10",
        weighted_rank: null,
        gpa: "3.9",
        gpa_rank: null,
      },
      core: {
        arithmetic: null,
        arithmetic_rank: "3/120",
        weighted: null,
        weighted_rank: "2/120",
        gpa: null,
        gpa_rank: "2/120",
      },
    });
    const { unmount } = renderRoute("/services/rank");

    const completeMetrics = await screen.findByRole("group", {
      name: "全部课程成绩与排名",
    });
    expect(within(completeMetrics).getByText("88.20")).toBeVisible();
    expect(within(completeMetrics).getByText("100")).toBeVisible();
    expect(within(completeMetrics).getByText("3.8")).toBeVisible();
    expect(within(completeMetrics).getByText("绩点")).toBeVisible();
    expect(
      within(completeMetrics).getByLabelText("第 8 名，共 120 人，排名百分比 6.7%"),
    ).toBeVisible();
    expect(completeMetrics.querySelectorAll(".rank-stat__values--paired")).toHaveLength(3);
    expect(completeMetrics.querySelectorAll(".rank-stat__datum")).toHaveLength(6);
    expect(screen.getByRole("tab", { name: "全部课程" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tablist", { name: "课程类型" }).closest(".rank-report")).toHaveClass(
      "surface",
    );
    expect(screen.queryByText("成绩与排名", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "必修课程" }));
    const scoreOnlyMetrics = screen.getByRole("group", { name: "必修课程成绩" });
    expect(within(scoreOnlyMetrics).getByText("89.40")).toBeVisible();
    expect(within(scoreOnlyMetrics).queryByText("排名")).not.toBeInTheDocument();
    expect(within(scoreOnlyMetrics).getAllByText("成绩")).toHaveLength(3);
    expect(scoreOnlyMetrics.querySelectorAll(".rank-stat__values--single")).toHaveLength(3);
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("必修课程");
    expect(screen.queryByText("仅成绩")).not.toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    const rankOnlyMetrics = screen.getByRole("group", { name: "核心课程排名" });
    expect(
      within(rankOnlyMetrics).getByLabelText("第 3 名，共 120 人，排名百分比 2.5%"),
    ).toBeVisible();
    expect(within(rankOnlyMetrics).getAllByText("排名")).toHaveLength(3);
    expect(rankOnlyMetrics.querySelectorAll(".rank-stat__score")).toHaveLength(0);
    expect(rankOnlyMetrics.querySelectorAll(".rank-stat__rank")).toHaveLength(3);
    expect(rankOnlyMetrics.querySelectorAll(".rank-stat__values--single")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "核心课程" })).toHaveFocus();
    expect(screen.queryByText("仅排名")).not.toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: "全部课程" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "全部课程" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "核心课程" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "全部课程" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "核心课程" })).toHaveFocus();
    expect(apiMocks.rankSchool).toHaveBeenCalledTimes(1);

    unmount();
    apiMocks.rankSchool.mockResolvedValue({ all: null, compulsory: null, core: null });
    renderRoute("/services/rank");
    expect(await screen.findByText("暂无成绩与排名数据")).toBeVisible();
    expect(document.querySelector(".rank-stat-list")).toBeNull();
  });

  it("redirects legacy ranking links to the separate ranking page", async () => {
    renderRoute("/services/grades?source=ca");

    expect(await screen.findByRole("heading", { name: "成绩排名" })).toBeVisible();
    await waitFor(() => expect(apiMocks.rankCa).toHaveBeenCalledOnce());
    expect(apiMocks.gradeList).not.toHaveBeenCalled();
  });
});
