import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExamScheduleItem } from "../../api/types";
import ExamsPage from "./ExamsPage";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    exam: apiMocks,
  },
}));

vi.mock("../../hooks/useMinuteClock", () => ({
  useMinuteClock: () => new Date("2026-10-05T15:00:00"),
}));

const exams: ExamScheduleItem[] = [
  {
    course_id: "COMP1001",
    course_name: "数据结构",
    area: "南校区（天马）",
    classroom: "综101",
    date: "2026-10-04",
    start_time: "09:00",
    end_time: "11:00",
    seat: "42",
    customize_id: null,
    invalid: false,
  },
  {
    course_id: "COMP2001",
    course_name: "操作系统",
    area: "南校区（天马）",
    classroom: "综212",
    date: "2026-10-04",
    start_time: "14:00",
    end_time: "16:00",
    seat: "18",
    customize_id: null,
    invalid: true,
  },
  {
    course_id: "COMP2003",
    course_name: "计算机网络",
    area: "南校区",
    classroom: "研究生楼B301",
    date: "2026-10-05",
    start_time: "14:00",
    end_time: "16:00",
    seat: "07",
    customize_id: null,
    invalid: false,
  },
  {
    course_id: "COMP2004",
    course_name: "数据库系统",
    area: "南校区",
    classroom: "综合楼205",
    date: "2026-10-05",
    start_time: "14:00",
    end_time: "16:00",
    seat: "31",
    customize_id: null,
    invalid: true,
  },
  {
    course_id: null,
    course_name: "竞赛模拟考试",
    area: "南校区",
    classroom: "综合楼205",
    date: "2026-10-06",
    start_time: "14:00",
    end_time: "16:00",
    seat: "8",
    customize_id: 101,
    invalid: false,
  },
  {
    course_id: "COMP2010",
    course_name: "软件工程",
    area: "北校区",
    classroom: "二教楼302",
    date: "2026-10-07",
    start_time: "09:00",
    end_time: "11:00",
    seat: "24",
    customize_id: null,
    invalid: true,
  },
  {
    course_id: "COMP3013",
    course_name: "编译原理",
    area: "南校区",
    classroom: "综合楼208",
    date: "2026-10-03",
    start_time: "09:00",
    end_time: "11:00",
    seat: "26",
    customize_id: null,
    invalid: false,
  },
  {
    course_id: null,
    course_name: "专业能力模拟考试",
    area: "南校区",
    classroom: "综合楼203",
    date: "2026-10-03",
    start_time: "14:00",
    end_time: "16:00",
    seat: "12",
    customize_id: 102,
    invalid: false,
  },
];

const recentExams = [exams[2], exams[4]] as ExamScheduleItem[];
const endedExams = [
  exams[0],
  exams[1],
  exams[3],
  exams[5],
  exams[6],
  exams[7],
  ...Array.from({ length: 6 }, (_, index) => ({
    ...exams[0]!,
    course_id: `HISTORY${index + 1}`,
    course_name: `历史考试 ${index + 1}`,
  })),
] as ExamScheduleItem[];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExamsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, queryClient };
}

describe("ExamsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.list.mockImplementation((type = "recent", offset = 0) =>
      Promise.resolve(type === "end" ? endedExams.slice(offset, offset + 10) : recentExams),
    );
    apiMocks.create.mockResolvedValue(undefined);
    apiMocks.update.mockResolvedValue(undefined);
    apiMocks.remove.mockResolvedValue(undefined);
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
  });

  it("separates unfinished exams from completed and invalid exams", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    expect(await screen.findByRole("heading", { name: "考试安排" })).toBeVisible();
    expect(screen.getByRole("banner").children).toHaveLength(1);
    expect(screen.queryByText(/共 \d+ 场考试安排/)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "未结束" })).toHaveAttribute("aria-selected", "true");
    expect(apiMocks.list).toHaveBeenCalledWith("recent");
    expect(apiMocks.list).toHaveBeenCalledWith("end", 0);
    expect(await screen.findByRole("article", { name: "计算机网络，考试中" })).toBeVisible();

    let cards = container.querySelectorAll(".exam-card");
    expect(cards).toHaveLength(2);
    expect(within(cards[0] as HTMLElement).getByText("计算机网络")).toBeVisible();
    expect(within(cards[0] as HTMLElement).getByText("考试中")).toBeVisible();
    expect(within(cards[0] as HTMLElement).getByText("研究生楼B301 · 07")).toBeVisible();
    expect(within(cards[0] as HTMLElement).getByText("COMP2003")).toBeVisible();
    expect(within(cards[0] as HTMLElement).queryByText("南校区")).not.toBeInTheDocument();
    expect(within(cards[0] as HTMLElement).getByText("14:00 – 16:00")).toBeVisible();
    expect(within(cards[1] as HTMLElement).getByRole("button", { name: "编辑" })).toBeVisible();
    expect(
      within(screen.getByRole("note", { name: "未结束考试安排说明" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["*非自定义考试安排数据来源于教务系统。"]);

    const addButton = screen.getByRole("button", { name: "添加考试安排" });
    expect(addButton).toHaveClass("exam-add-card");
    expect(addButton).toHaveTextContent("添加");
    expect(addButton.parentElement?.firstElementChild).toBe(addButton);

    await user.click(screen.getByRole("tab", { name: "已结束" }));
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("已结束");
    expect(
      within(screen.getByRole("note", { name: "已结束考试安排说明" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "*非自定义考试安排数据来源于教务系统。",
      "*已失效的考试安排是原来出现于教务系统，但是可能由于考试安排信息发生更改或是到了新的学期，之前的考试安排已经不存在，微生活将其标记为“已失效”。",
    ]);
    cards = container.querySelectorAll(".exam-card");
    expect(cards).toHaveLength(10);

    const completedCard = screen.getByRole("article", { name: "数据结构，已结束" });
    expect(within(completedCard).getByText("已结束")).toBeVisible();
    expect(within(completedCard).queryByText("信息可能已调整")).not.toBeInTheDocument();

    const invalidCard = screen.getByRole("article", { name: "操作系统，已失效" });
    expect(within(invalidCard).getByText("已失效")).toBeVisible();
    expect(within(invalidCard).queryByText("信息可能已调整")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "软件工程，已失效" })).toBeVisible();
    expect(screen.getByRole("article", { name: "编译原理，已结束" })).toBeVisible();
    const completedCustomExam = screen.getByRole("article", {
      name: "专业能力模拟考试，已结束",
    });
    expect(within(completedCustomExam).getByRole("button", { name: "编辑" })).toBeDisabled();
    expect(within(completedCustomExam).getByRole("button", { name: "删除" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "添加考试安排" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "加载更多" }));
    expect(await screen.findByRole("article", { name: "历史考试 6，已结束" })).toBeVisible();
    expect(container.querySelectorAll(".exam-card")).toHaveLength(12);
    expect(apiMocks.list).toHaveBeenCalledWith("end", 10);
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
  });

  it("keeps the add card at the top of the unfinished list", async () => {
    const user = userEvent.setup();
    renderPage();

    const addButton = await screen.findByRole("button", { name: "添加考试安排" });
    expect(addButton).toHaveClass("exam-add-card");
    expect(addButton).toHaveTextContent("添加");
    expect(addButton.parentElement?.firstElementChild).toBe(addButton);

    await user.click(addButton);
    expect(screen.getByRole("dialog", { name: "添加考试安排" })).toBeVisible();
  });

  it("keeps recent exams available when the ended request fails", async () => {
    const user = userEvent.setup();
    apiMocks.list.mockImplementation((type = "recent") =>
      type === "end"
        ? Promise.reject(new Error("已结束考试暂时无法加载"))
        : Promise.resolve(recentExams),
    );
    renderPage();

    expect(await screen.findByRole("article", { name: "计算机网络，考试中" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "已结束" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("已结束考试暂时无法加载");
    expect(screen.getByRole("heading", { name: "考试安排" })).toBeVisible();
  });

  it("keeps cached ended exams visible when a pull refresh fails", async () => {
    const user = userEvent.setup();
    let endedRequestCount = 0;
    apiMocks.list.mockImplementation((type = "recent", offset = 0) => {
      if (type !== "end") return Promise.resolve(recentExams);
      endedRequestCount += 1;
      return endedRequestCount === 2
        ? Promise.reject(new Error("已结束考试刷新失败"))
        : Promise.resolve(endedExams.slice(offset, offset + 10));
    });
    const { queryClient } = renderPage();
    await user.click(await screen.findByRole("tab", { name: "已结束" }));
    const cachedExam = await screen.findByRole("article", { name: "数据结构，已结束" });

    await act(async () => {
      await queryClient.refetchQueries({ queryKey: ["exams", "end"] });
    });

    expect(cachedExam).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("已结束考试刷新失败");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByRole("article", { name: "数据结构，已结束" })).toBeVisible();
  });
});
