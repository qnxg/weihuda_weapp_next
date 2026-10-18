import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NetworkDetailPage from "./NetworkDetailPage";

const apiMocks = vi.hoisted(() => ({
  detail: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    network: {
      detail: apiMocks.detail,
    },
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NetworkDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NetworkDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    apiMocks.detail.mockResolvedValue({
      total: "12.80GB",
      upload: "2.10GB",
      download: "10.70GB",
      items: [
        {
          app: "/基础协议/SSL",
          total: "8.00GB",
          download: "7.50GB",
          upload: "0.50GB",
          percentage: 0.63,
        },
      ],
    });
  });

  it("shows the current month traffic breakdown on its own page", async () => {
    const now = new Date();
    const periodLabel = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
    renderPage();

    expect(screen.getByRole("heading", { name: "流量明细" })).toBeVisible();
    expect(screen.getByRole("heading", { name: periodLabel })).toBeVisible();
    expect(document.querySelector(".page-header p")).toBeNull();
    const categoryHeading = await screen.findByRole("heading", { name: "基础协议/SSL" });
    expect(categoryHeading).toBeVisible();
    const separator = within(categoryHeading).getByText("/");
    expect(separator).toHaveClass("network-detail-category__separator");
    expect(separator).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading", { name: "/基础协议/SSL" })).not.toBeInTheDocument();
    expect(screen.getByText("总流量 12.80GB")).toBeVisible();
    expect(screen.queryByText("合计 12.80GB · 上传 2.10GB · 下载 10.70GB")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: `${periodLabel}流量明细列表` })).toBeVisible();
    const progress = screen.getByRole("progressbar", {
      name: `基础协议/SSL ${periodLabel}流量占比 63%`,
    });
    expect(progress).toHaveValue(0.63);
    expect(progress).toHaveClass("progress-bar--primary");
    expect(apiMocks.detail).toHaveBeenCalledWith(now.getFullYear(), now.getMonth() + 1);
  });

  it("switches between a specific day and the full selected month", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("heading", { name: "基础协议/SSL" });
    await user.click(screen.getByRole("button", { name: /切换日期，当前为.*全月/ }));

    const dialog = screen.getByRole("dialog", { name: "选择日期" });
    fireEvent.change(within(dialog).getByLabelText("年份"), { target: { value: "2025" } });
    await user.selectOptions(within(dialog).getByLabelText("月份"), "2");
    const daySelect = within(dialog).getByLabelText("日期");
    expect(within(daySelect).getAllByRole("option")).toHaveLength(29);
    await user.selectOptions(daySelect, "14");
    await user.click(within(dialog).getByRole("button", { name: "确定" }));

    await waitFor(() => expect(apiMocks.detail).toHaveBeenLastCalledWith(2025, 2, 14));
    const dayHeading = screen.getByRole("heading", { name: "2025 年 2 月 14 日" });
    const sectionHeading = dayHeading.closest<HTMLElement>(".section-heading");
    expect(sectionHeading).not.toBeNull();
    expect(within(sectionHeading!).getByText("总流量 12.80GB")).toBeVisible();
    expect(within(sectionHeading!).queryByText(/上传|下载/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "切换日期，当前为2025年2月14日" }));
    const reopenedDialog = screen.getByRole("dialog", { name: "选择日期" });
    await user.selectOptions(within(reopenedDialog).getByLabelText("日期"), "");
    await user.click(within(reopenedDialog).getByRole("button", { name: "确定" }));

    await waitFor(() => expect(apiMocks.detail).toHaveBeenLastCalledWith(2025, 2));
    expect(screen.getByRole("heading", { name: "2025 年 2 月" })).toBeVisible();
  });

  it("shows a local empty state when the month has no traffic records", async () => {
    const now = new Date();
    apiMocks.detail.mockResolvedValue({
      total: "0GB",
      upload: "0GB",
      download: "0GB",
      items: [],
    });
    renderPage();

    expect(await screen.findByRole("heading", { name: "暂无流量明细" })).toBeVisible();
    expect(
      screen.getByText(`${now.getFullYear()} 年 ${now.getMonth() + 1} 月没有可展示的流量记录。`),
    ).toBeVisible();
  });
});
