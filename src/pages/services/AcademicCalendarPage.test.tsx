import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AcademicCalendar,
  AcademicCalendarList,
  AcademicCalendarPeriodItem,
  AcademicCalendarYearItem,
} from "../../api/types";
import AcademicCalendarPage from "./AcademicCalendarPage";

const apiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    calendar: {
      list: apiMocks.list,
      detail: apiMocks.detail,
    },
  },
}));

const periodNames = ["秋季学期", "寒假", "春季学期", "暑假"] as const;
const yearItems: AcademicCalendarYearItem[] = [
  {
    xn: "2026 - 2027 学年",
    periods: periodNames.map((name, index) => ({ id: index + 1, name })),
  },
  {
    xn: "2025 - 2026 学年",
    periods: periodNames.map((name, index) => ({ id: index + 5, name })),
  },
];
const calendarList: AcademicCalendarList = { items: yearItems, now_id: 1 };
const starts = [
  "2026-09-13",
  "2027-01-17",
  "2027-02-21",
  "2027-07-11",
  "2025-09-14",
  "2026-01-18",
  "2026-02-22",
  "2026-07-12",
];

function weekDates(start: string) {
  const [year, month, day] = start.split("-").map(Number);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index));
    return [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0"),
    ].join("-");
  });
}

function detailForId(id: number): AcademicCalendar {
  for (const year of yearItems) {
    const summary = year.periods.find((period) => period.id === id);
    if (!summary) continue;
    const dates = weekDates(starts[id - 1]);
    return {
      name: `${year.xn} ${summary.name}`,
      period: {
        name: summary.name,
        start: dates[0],
        end: dates[6],
        total_weeks: 1,
        weeks: [{ week_text: "1", description: `${summary.name}第1周`, dates }],
        notes: [{ title: "安排", content: `${summary.name}完整安排。` }],
      },
    };
  }
  throw new Error(`Unknown calendar id ${id}`);
}

function LocationProbe() {
  return <output data-testid="location-search">{useLocation().search}</output>;
}

function renderPage(initialEntry = "/services/calendar") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AcademicCalendarPage />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("academic calendar page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.list.mockResolvedValue(calendarList);
    apiMocks.detail.mockImplementation((period: AcademicCalendarPeriodItem) =>
      Promise.resolve(detailForId(period.id)),
    );
  });

  it("uses the detail name and switches one stable period ID at a time", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("heading", { name: "2026 - 2027 学年 秋季学期" })).toBeVisible();
    expect(await screen.findByText("2026.9.13 到 2026.9.19 共 1 周")).toBeVisible();
    expect(apiMocks.detail).toHaveBeenCalledWith(yearItems[0].periods[0]);
    expect(document.querySelector(".page-header p")).toBeNull();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "秋季学期校历" })).toBeVisible();
    expect(screen.getAllByRole("cell")).toHaveLength(7);
    expect(screen.queryByRole("list", { name: "英文安排说明" })).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "切换学年和学期，当前为2026 - 2027 学年 秋季学期",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "切换" });
    expect(within(dialog).getByRole("group", { name: "学年" })).toBeVisible();
    expect(within(dialog).getByRole("group", { name: "学期" })).toBeVisible();
    expect(within(dialog).queryByText("当前", { exact: true })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "秋季学期" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(within(dialog).getByRole("button", { name: "寒假" }));
    await waitFor(() => expect(apiMocks.detail).toHaveBeenLastCalledWith(yearItems[0].periods[1]));
    expect(await screen.findByRole("heading", { name: "2026 - 2027 学年 寒假" })).toBeVisible();
    expect(await screen.findByText("2027.1.17 到 2027.1.23 共 1 周")).toBeVisible();
    expect(screen.getByTestId("location-search")).toHaveTextContent("?id=2");
  });

  it("switches the year column locally before requesting the selected period", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", {
        name: "切换学年和学期，当前为2026 - 2027 学年 秋季学期",
      }),
    );
    const dialog = screen.getByRole("dialog", { name: "切换" });
    await user.click(within(dialog).getByRole("button", { name: "2025 - 2026 学年" }));
    expect(apiMocks.detail).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "春季学期" }));
    await waitFor(() => expect(apiMocks.detail).toHaveBeenLastCalledWith(yearItems[1].periods[2]));
    expect(await screen.findByRole("heading", { name: "2025 - 2026 学年 春季学期" })).toBeVisible();
    expect(screen.getByTestId("location-search")).toHaveTextContent("?id=7");
  });

  it("shows and retries a selected period detail failure", async () => {
    const user = userEvent.setup();
    let historicalFails = true;
    apiMocks.detail.mockImplementation((period: AcademicCalendarPeriodItem) =>
      period.id === 8 && historicalFails
        ? Promise.reject(new Error("历史校历加载失败"))
        : Promise.resolve(detailForId(period.id)),
    );
    renderPage("/services/calendar?id=8");

    expect(await screen.findByRole("alert")).toHaveTextContent("历史校历加载失败");
    expect(
      screen.getByRole("button", { name: "切换学年和学期，当前为2025 - 2026 学年 暑假" }),
    ).toBeVisible();
    historicalFails = false;
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByRole("heading", { name: "2025 - 2026 学年 暑假" })).toBeVisible();
  });

  it("normalizes malformed IDs and recovers from unknown IDs", async () => {
    const malformed = renderPage("/services/calendar?id=not-an-id");
    expect(await screen.findByRole("heading", { name: "2026 - 2027 学年 秋季学期" })).toBeVisible();
    await waitFor(() => expect(screen.getByTestId("location-search")).toBeEmptyDOMElement());
    malformed.unmount();

    const user = userEvent.setup();
    renderPage("/services/calendar?id=999");
    expect(await screen.findByRole("alert")).toHaveTextContent("未找到该阶段校历");
    await user.click(screen.getByRole("button", { name: "查看当前阶段" }));
    expect(await screen.findByRole("heading", { name: "2026 - 2027 学年 秋季学期" })).toBeVisible();
    expect(screen.getByTestId("location-search")).toBeEmptyDOMElement();
  });

  it("canonicalizes an explicit current ID and omits an empty notes section", async () => {
    apiMocks.detail.mockResolvedValue({
      ...detailForId(1),
      name: "本科生校历 当前秋季阶段",
      period: { ...detailForId(1).period, notes: [] },
    });
    renderPage("/services/calendar?id=1");

    expect(await screen.findByRole("heading", { name: "本科生校历 当前秋季阶段" })).toBeVisible();
    await waitFor(() => expect(screen.getByTestId("location-search")).toBeEmptyDOMElement());
    expect(screen.queryByRole("heading", { name: "安排说明" })).not.toBeInTheDocument();
  });

  it("keeps the header and retry action available when the list fails", async () => {
    const user = userEvent.setup();
    apiMocks.list.mockRejectedValueOnce(new Error("校历列表加载失败"));
    renderPage();

    expect(screen.getByRole("heading", { name: "校历" })).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent("校历列表加载失败");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(await screen.findByRole("heading", { name: "2026 - 2027 学年 秋季学期" })).toBeVisible();
    expect(apiMocks.list).toHaveBeenCalledTimes(2);
  });
});
