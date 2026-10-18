import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GymGrade, SemesterTable } from "../../api/types";
import GymAppointmentPage from "./GymAppointmentPage";
import GymGradePage from "./GymGradePage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  grade: vi.fn(),
  appointments: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    gym: {
      grade: apiMocks.grade,
      appointments: apiMocks.appointments,
    },
  },
}));

const gymGrade: GymGrade = {
  grade: "优秀",
  score: 92,
  report_description: "体测报告已生成",
  report_status: "已完成",
  report_type: "本科生",
  eye: {
    sight: {
      left: { value: "4.9", description: "正常" },
      right: { value: "5.0", description: "正常" },
    },
    mirror: {
      left: { value: "5.0", description: "矫正正常" },
      right: { value: "5.0", description: "矫正正常" },
    },
    ametropia: {
      left: { value: "-1.25D", description: "轻度近视" },
      right: { value: "-1.00D", description: "轻度近视" },
    },
  },
  short_run: { color: "green", rank: "优秀", grade: "7.0 秒", score: 91 },
  bmi: { color: "green", rank: "正常", grade: "21.2", score: 100 },
  jump: { color: "green", rank: "良好", grade: "2.35 米", score: 85 },
  pull_and_sit: { color: "green", rank: "良好", grade: "12 次", score: 82 },
  run: { color: "red", rank: "及格", grade: "4 分 05 秒", score: 72 },
  sit_and_reach: { color: "green", rank: "优秀", grade: "18.6 厘米", score: 92 },
  vc: { color: "blue", rank: "需要继续加强锻炼", grade: "4200 毫升", score: 86 },
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
      xq: 3,
      xq_text: "春季学期",
      start: "2026-02-22",
      weeks: 16,
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

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="当前地址">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(page: ReactNode, entry = "/", configure?: (queryClient: QueryClient) => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  configure?.(queryClient);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        {page}
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("gym pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.semester.mockResolvedValue(semesterTable);
    apiMocks.grade.mockResolvedValue(gymGrade);
    apiMocks.appointments.mockResolvedValue([
      {
        name: "秋季体质测试",
        description: "请提前到场签到",
        show_date: "2026-10-18",
        time: "09:00-10:00",
        test_type: "年度测试",
        status: "已预约",
      },
    ]);
  });

  it("switches academic years without a page-header subtitle", async () => {
    const user = userEvent.setup();
    renderPage(<GymGradePage />, "/services/gym/grade");

    expect(await screen.findByRole("heading", { name: "体测成绩" })).toBeVisible();
    expect(screen.getByRole("banner").querySelector("p")).toBeNull();
    expect(await screen.findByRole("heading", { name: "2026-2027 学年" })).toBeVisible();
    expect(await screen.findByRole("article", { name: /体测总评 92 分/ })).toBeVisible();
    await waitFor(() => expect(apiMocks.grade).toHaveBeenCalledWith(2026));
    expect(apiMocks.appointments).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "切换学年，当前为2026-2027 学年" }));
    const previousYear = screen.getByRole("button", { name: "2025-2026 学年" });
    expect(previousYear).toBeVisible();
    await user.click(previousYear);

    expect(await screen.findByRole("heading", { name: "2025-2026 学年" })).toBeVisible();
    await waitFor(() => expect(apiMocks.grade).toHaveBeenCalledWith(2025));
  });

  it("integrates report details and opens eye details from the metric grid", async () => {
    const user = userEvent.setup();
    renderPage(<GymGradePage />, "/services/gym/grade");

    const summary = await screen.findByRole("article", { name: "体测总评 92 分，优秀" });
    expect(within(summary).queryByText("本科生")).not.toBeInTheDocument();
    expect(within(summary).queryByText("已完成")).not.toBeInTheDocument();
    expect(within(summary).queryByText("体测报告已生成")).not.toBeInTheDocument();
    const reportDetails = screen.getByRole("region", { name: "体测报告信息" });
    expect(reportDetails.querySelector("dl")).not.toHaveAttribute("role");
    expect(reportDetails.querySelectorAll(".data-row")).toHaveLength(3);
    const statusRow = within(reportDetails)
      .getByText("成绩状态", { selector: "dt" })
      .closest<HTMLElement>(".data-row");
    const typeRow = within(reportDetails)
      .getByText("成绩类型", { selector: "dt" })
      .closest<HTMLElement>(".data-row");
    const descriptionRow = within(reportDetails)
      .getByText("成绩描述", { selector: "dt" })
      .closest<HTMLElement>(".data-row");
    expect(statusRow).not.toBeNull();
    expect(typeRow).not.toBeNull();
    expect(descriptionRow).not.toBeNull();
    expect(within(statusRow!).getByText("已完成")).toHaveClass("data-row__value");
    expect(within(statusRow!).getByText("已完成")).not.toHaveClass("badge");
    expect(within(typeRow!).getByText("本科生")).toBeVisible();
    expect(within(descriptionRow!).getByText("体测报告已生成")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "单项成绩" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "视力情况" })).not.toBeInTheDocument();

    const eyeMetric = screen.getByRole("button", {
      name: "查看视力详情，裸眼视力左眼 4.9，右眼 5.0",
    });
    expect(eyeMetric).toBeVisible();
    const metricGrid = eyeMetric.closest<HTMLElement>(".metric-grid");
    expect(metricGrid).not.toBeNull();
    expect(metricGrid!.querySelectorAll(".metric")).toHaveLength(8);
    expect(metricGrid!.nextElementSibling).toBe(reportDetails);
    [
      ["50 米跑", "7.0 秒", "91", "20%", "优秀", "badge--success"],
      ["体重指数", "21.2", "100", "15%", "正常", "badge--success"],
      ["立定跳远", "2.35 米", "85", "10%", "良好", "badge--success"],
      ["引体 / 仰卧起坐", "12 次", "82", "10%", "良好", "badge--success"],
      ["耐力跑", "4 分 05 秒", "72", "20%", "及格", "badge--danger"],
      ["坐位体前屈", "18.6 厘米", "92", "10%", "优秀", "badge--success"],
      ["肺活量", "4200 毫升", "86", "15%", "需要继续加强锻炼", ""],
    ].forEach(([label, grade, score, weight, rank, toneClass]) => {
      const metricItem = screen.getByRole("group", {
        name: `${label}，成绩 ${grade}，${score} 分，占比 ${weight}，${rank}`,
      });
      expect(within(metricItem).getByText(grade, { exact: true })).toHaveClass("metric__value");
      expect(
        within(metricItem).getByText(`${score} 分 / 占比 ${weight}`, { exact: true }),
      ).toBeVisible();
      const rankBadge = within(metricItem).getByText(rank, { exact: true });
      expect(rankBadge).toHaveClass("badge");
      if (toneClass) {
        expect(rankBadge).toHaveClass(toneClass);
      } else {
        expect(rankBadge).not.toHaveClass("badge--success", "badge--danger");
      }
    });
    await user.click(eyeMetric);

    const dialog = screen.getByRole("dialog", { name: "视力详情" });
    const sight = within(dialog).getByText("裸眼视力").closest(".gym-eye-detail-list__item");
    const mirror = within(dialog).getByText("戴镜视力").closest(".gym-eye-detail-list__item");
    const ametropia = within(dialog).getByText("屈光状态").closest(".gym-eye-detail-list__item");
    expect(sight).toHaveTextContent("左眼4.9正常右眼5.0正常");
    expect(mirror).toHaveTextContent("左眼5.0矫正正常右眼5.0矫正正常");
    expect(ametropia).toHaveTextContent("左眼-1.25D轻度近视右眼-1.00D轻度近视");
    await user.click(within(dialog).getByRole("button", { name: "关闭" }));
    expect(eyeMetric).toHaveFocus();
  });

  it("normalizes an unavailable year to the server-designated current year", async () => {
    renderPage(<GymGradePage />, "/services/gym/grade?xn=2099");

    expect(await screen.findByRole("heading", { name: "2026-2027 学年" })).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "当前地址" })).toHaveTextContent(
        "/services/gym/grade",
      ),
    );
    expect(apiMocks.grade).toHaveBeenCalledWith(2026);
  });

  it("keeps cached grade content visible when the year directory refresh fails", async () => {
    apiMocks.semester.mockRejectedValue(new Error("学年目录更新失败"));
    renderPage(<GymGradePage />, "/services/gym/grade", (queryClient) => {
      queryClient.setQueryData(["semester"], semesterTable);
    });

    expect(await screen.findByRole("article", { name: /体测总评 92 分/ })).toBeVisible();
    expect(await screen.findByText("学年目录更新失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
    expect(apiMocks.grade).toHaveBeenCalledWith(2026);
  });

  it("loads only appointment data on the gym appointment page", async () => {
    renderPage(<GymAppointmentPage />);

    expect(await screen.findByRole("heading", { name: "体测预约" })).toBeVisible();
    expect(await screen.findByText("秋季体质测试")).toBeVisible();
    await waitFor(() => expect(apiMocks.appointments).toHaveBeenCalledOnce());
    expect(apiMocks.grade).not.toHaveBeenCalled();
    expect(apiMocks.semester).not.toHaveBeenCalled();
  });
});
