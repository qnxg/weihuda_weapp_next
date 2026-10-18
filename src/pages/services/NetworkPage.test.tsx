import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Netflow } from "../../api/types";
import NetworkPage from "./NetworkPage";

const apiMocks = vi.hoisted(() => ({
  summary: vi.fn(),
  orders: vi.fn(),
  detail: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    network: {
      summary: apiMocks.summary,
      orders: apiMocks.orders,
      detail: apiMocks.detail,
    },
  },
}));

const network: Netflow = {
  overdue_payment: 0,
  total: "36.40GB",
  upload: "4.20GB",
  download: "32.20GB",
  base_amount: "40GB",
  base_usage: 36.4,
  base_percentage: 0.91,
  extend_usage: 0,
  is_locked: false,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NetworkPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NetworkPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.summary.mockResolvedValue(network);
    apiMocks.orders.mockResolvedValue([]);
  });

  it("reuses the homepage usage summary and percentage-based progress tone", async () => {
    renderPage();

    expect(await screen.findByText("本月已用")).toBeVisible();
    expect(screen.getByRole("link", { name: /历史账单/ })).toHaveAttribute(
      "href",
      "/services/network/orders",
    );
    expect(screen.getByRole("link", { name: /流量明细/ })).toHaveAttribute(
      "href",
      "/services/network/details",
    );
    expect(document.querySelector(".page-header p")).toBeNull();
    expect(screen.queryByText("已使用")).not.toBeInTheDocument();
    expect(screen.queryByText("校园网状态正常")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本月用量" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "账号信息" })).not.toBeInTheDocument();
    expect(screen.getByText("36.40GB")).toBeVisible();
    expect(screen.getByRole("region", { name: "本月用量" })).toBeVisible();

    const percentage = screen.getByText("91%", {
      selector: ".network-overview__percentage",
    });
    expect(percentage).toHaveClass("network-overview__percentage");
    expect(percentage).not.toHaveClass("badge");

    const progress = screen.getByRole("progressbar", { name: "免费流量已使用 91%" });
    expect(progress).toHaveValue(0.91);
    expect(progress).toHaveClass("progress-bar--primary");
    expect(document.querySelector(".network-overview__chevron")).toBeNull();

    const metricGrid = screen.getByText("上传流量").closest(".metric-grid");
    expect(metricGrid).not.toBeNull();
    if (!metricGrid) throw new Error("Expected the network metric grid");
    expect(
      Array.from(metricGrid.querySelectorAll(".metric__label"), (label) => label.textContent),
    ).toEqual(["上传流量", "下载流量", "免费流量", "超出流量"]);
    expect(
      Array.from(metricGrid.querySelectorAll(".metric__value"), (value) => value.textContent),
    ).toEqual(["4.20GB", "32.20GB", "40GB", "0 GB"]);
    expect(screen.queryByText("基础用量")).not.toBeInTheDocument();
    expect(screen.queryByText("扩展用量")).not.toBeInTheDocument();
    expect(screen.queryByText("上传 / 下载")).not.toBeInTheDocument();

    const accountSection = screen.getByRole("region", { name: "账号信息" });
    const accountList = screen.getByRole("list", { name: "账号信息列表" });
    expect(accountList).toBeVisible();
    expect(accountList.querySelectorAll("li")).toHaveLength(4);
    expect(
      Array.from(
        accountSection.querySelectorAll(".network-account-item .menu-link__copy strong"),
        (label) => label.textContent,
      ),
    ).toEqual(["欠费金额", "锁定状态"]);
    expect(
      Array.from(
        accountSection.querySelectorAll(".network-account-item__value"),
        (value) => value.textContent,
      ),
    ).toEqual(["¥0.00", "未锁定"]);
    expect(
      Array.from(
        accountSection.querySelectorAll(".network-account-item .menu-link__copy > span"),
        (description) => description.textContent,
      ),
    ).toEqual(["当前待缴费用", "当前校园网账号状态"]);
    const accountItems = Array.from(accountSection.querySelectorAll(".network-account-item"));
    expect(accountItems).toHaveLength(2);
    accountItems.forEach((item) => {
      expect(item.querySelector("a, button")).toBeNull();
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    });
    expect(screen.getByText("查看每月流量与费用记录")).toBeVisible();
    expect(screen.getByText("查看本月流量使用明细")).toBeVisible();
    expect(accountSection).toContainElement(screen.getByRole("link", { name: /历史账单/ }));
    expect(accountSection).toContainElement(screen.getByRole("link", { name: /流量明细/ }));
    expect(document.querySelector(".page > .network-history-link")).toBeNull();
    expect(screen.queryByRole("heading", { name: "应用明细" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本月流量明细" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "历史账单" })).not.toBeInTheDocument();
    expect(apiMocks.orders).not.toHaveBeenCalled();
    expect(apiMocks.detail).not.toHaveBeenCalled();
  });

  it("keeps overdue amount and lock state visible together", async () => {
    apiMocks.summary.mockResolvedValue({
      ...network,
      overdue_payment: 18.5,
      is_locked: true,
    });
    renderPage();

    const overdue = await screen.findByText("¥18.50");
    const lockState = screen.getByText("已锁定");
    expect(overdue).toHaveClass("text-danger");
    expect(lockState).toHaveClass("text-danger");
    expect(screen.getByRole("list", { name: "账号信息列表" })).toContainElement(overdue);
    expect(screen.getByRole("list", { name: "账号信息列表" })).toContainElement(lockState);
  });
});
