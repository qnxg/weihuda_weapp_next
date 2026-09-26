import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Grade, Rank } from "../../api/types";
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
    arithmetic: "88.20",
    arithmetic_rank: "8/120",
    weighted: "89.10",
    weighted_rank: "6/120",
    gpa: "3.8",
    gpa_rank: "5/120",
  },
  compulsory: null,
  core: null,
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
    apiMocks.semester.mockResolvedValue({
      xn: 2026,
      xq: "autumn",
      start: "2026-09-13",
      weeks: 16,
      from_zero: false,
    });
  });

  it("switches course semesters without loading ranking data", async () => {
    const user = userEvent.setup();
    renderRoute("/services/grades");

    expect(await screen.findByRole("heading", { name: "课程成绩" })).toBeVisible();
    expect(await screen.findByText("数据结构")).toBeVisible();
    expect(screen.getByRole("banner").querySelector("p")).toBeNull();
    expect(screen.getByRole("heading", { name: "2026-2027 学年 秋季学期" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "学年" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "学期" })).not.toBeInTheDocument();
    expect(apiMocks.gradeList).toHaveBeenCalledWith(2026, "autumn");
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
    await waitFor(() => expect(apiMocks.gradeList).toHaveBeenLastCalledWith(2025, "summer"));
    expect(screen.getByRole("heading", { name: "2025-2026 学年 夏季学期" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /数据结构/ }));
    expect(await screen.findByRole("dialog", { name: "数据结构" })).toHaveTextContent("期末考试");
  });

  it("supports winter course grades without sending winter to the ranking endpoint", async () => {
    apiMocks.semester.mockResolvedValue({
      xn: 2025,
      xq: "winter",
      start: "2026-01-04",
      weeks: 6,
      from_zero: false,
    });

    const { unmount } = renderRoute("/services/grades");
    expect(await screen.findByRole("heading", { name: "2025-2026 学年 冬季学期" })).toBeVisible();
    await waitFor(() => expect(apiMocks.gradeList).toHaveBeenCalledWith(2025, "winter"));
    unmount();

    renderRoute("/services/rank");
    expect(await screen.findByRole("combobox", { name: "学期" })).toHaveValue("all");
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenCalledWith({
        xn: 2025,
        xq: undefined,
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
    const allCourses = await screen.findByRole("table", { name: "全部课程成绩与排名" });
    expect(screen.getByText("排名数据已更新")).toHaveClass("sr-only");
    expect(within(allCourses).getByRole("cell", { name: "88.20" })).toBeVisible();
    expect(within(allCourses).getByRole("cell", { name: "8/120" })).toBeVisible();
    expect(apiMocks.rankSchool).toHaveBeenCalledWith({
      xn: 2026,
      xq: "autumn",
      range: "major",
      data_source: "total",
      display: "max",
    });
    expect(apiMocks.gradeList).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByRole("combobox", { name: "学年" }), "2025");
    await user.selectOptions(screen.getByRole("combobox", { name: "学期" }), "spring");
    await user.selectOptions(screen.getByRole("combobox", { name: "课程范围" }), "minor");
    await user.selectOptions(screen.getByRole("combobox", { name: "数据来源" }), "execution");
    await user.selectOptions(screen.getByRole("combobox", { name: "成绩取值" }), "initial");
    expect(apiMocks.rankSchool).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "查询排名" }));
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenLastCalledWith({
        xn: 2025,
        xq: "spring",
        range: "minor",
        data_source: "execution",
        display: "initial",
      }),
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "学年" }), "all");
    expect(screen.getByRole("combobox", { name: "学期" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "查询排名" }));
    await waitFor(() =>
      expect(apiMocks.rankSchool).toHaveBeenLastCalledWith({
        xn: undefined,
        xq: undefined,
        range: "minor",
        data_source: "execution",
        display: "initial",
      }),
    );

    apiMocks.rankCa.mockResolvedValue({
      updated_at: "2026-09-23 14:30:00",
      rank,
    });
    await user.click(screen.getByRole("button", { name: "可信凭证" }));
    const updateButton = await screen.findByRole("button", {
      name: /更新可信凭证排名，当前数据更新时间：/,
    });
    expect(screen.queryByRole("heading", { name: "可信凭证排名" })).not.toBeInTheDocument();
    expect(screen.getByText("更新", { selector: "strong" })).toBeVisible();
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("2026年");
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("9月23日");
    expect(screen.getByText(/当前数据更新时间：/)).toHaveTextContent("14:30");
    expect(screen.getByText("可信凭证排名数据已更新")).toHaveClass("sr-only");
    expect(apiMocks.rankCa).toHaveBeenCalledOnce();

    await user.click(updateButton);
    await waitFor(() => expect(apiMocks.refreshCa).toHaveBeenCalledOnce());
    await waitFor(() => expect(apiMocks.rankCa).toHaveBeenCalledTimes(2));
  });

  it("renders complete, score-only, rank-only, and empty course groups", async () => {
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

    const completeTable = await screen.findByRole("table", {
      name: "全部课程成绩与排名",
    });
    expect(within(completeTable).getByRole("rowheader", { name: "成绩" })).toBeVisible();
    expect(within(completeTable).getByRole("rowheader", { name: "排名" })).toBeVisible();

    const scoreOnlyTable = screen.getByRole("table", { name: "必修课程成绩" });
    expect(within(scoreOnlyTable).getByRole("rowheader", { name: "成绩" })).toBeVisible();
    expect(
      within(scoreOnlyTable).queryByRole("rowheader", { name: "排名" }),
    ).not.toBeInTheDocument();

    const rankOnlyTable = screen.getByRole("table", { name: "核心课程排名" });
    expect(
      within(rankOnlyTable).queryByRole("rowheader", { name: "成绩" }),
    ).not.toBeInTheDocument();
    expect(within(rankOnlyTable).getByRole("rowheader", { name: "排名" })).toBeVisible();
    expect(screen.queryByText("—")).not.toBeInTheDocument();

    unmount();
    apiMocks.rankSchool.mockResolvedValue({ all: null, compulsory: null, core: null });
    renderRoute("/services/rank");
    expect(await screen.findAllByText("暂无成绩与排名数据")).toHaveLength(3);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("redirects legacy ranking links to the separate ranking page", async () => {
    renderRoute("/services/grades?source=ca");

    expect(await screen.findByRole("heading", { name: "成绩排名" })).toBeVisible();
    await waitFor(() => expect(apiMocks.rankCa).toHaveBeenCalledOnce());
    expect(apiMocks.gradeList).not.toHaveBeenCalled();
  });
});
