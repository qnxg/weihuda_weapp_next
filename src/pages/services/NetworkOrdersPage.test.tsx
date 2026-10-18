import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NetworkOrdersPage from "./NetworkOrdersPage";

const apiMocks = vi.hoisted(() => ({
  orders: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    network: {
      orders: apiMocks.orders,
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
        <NetworkOrdersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NetworkOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.orders.mockResolvedValue([
      {
        year: 2026,
        month: 9,
        download: "10.70GB",
        upload: "2.10GB",
        over: "0GB",
        amount: 0,
        updated_at: "2026-10-11T09:32:00+08:00",
      },
    ]);
  });

  it("loads billing history independently from the network detail page", async () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "历史账单" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "2026 年 9 月" })).toBeVisible();
    expect(screen.getByRole("list", { name: "历史账单列表" })).toBeVisible();
    expect(screen.getByRole("listitem")).toBeVisible();
    expect(screen.getByText("¥0.00")).toBeVisible();
    expect(screen.getByText("下载 10.70GB · 上传 2.10GB · 超额 0GB")).toBeVisible();
    expect(apiMocks.orders).toHaveBeenCalledOnce();
  });

  it("shows a local empty state when there are no bills", async () => {
    apiMocks.orders.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByRole("heading", { name: "暂无历史账单" })).toBeVisible();
    expect(screen.getByText("产生月度账单后会显示在这里。")).toBeVisible();
  });
});
