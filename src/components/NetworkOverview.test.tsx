import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Netflow } from "../api/types";
import { NetworkOverview } from "./NetworkOverview";

const normalNetwork: Netflow = {
  overdue_payment: 0,
  total: "12.80GB",
  upload: "2.10GB",
  download: "10.70GB",
  base_amount: "40GB",
  base_usage: 12.8,
  base_percentage: 0.32,
  extend_usage: 0,
  is_locked: false,
};

function renderOverview(data: Netflow) {
  return render(
    <MemoryRouter>
      <NetworkOverview data={data} />
    </MemoryRouter>,
  );
}

describe("NetworkOverview", () => {
  it("shows monthly usage, account status and payment state", () => {
    renderOverview(normalNetwork);

    expect(
      screen.getByRole("link", {
        name: "校园网本月已用 12.80GB，账号正常，无欠费",
      }),
    ).toHaveAttribute("href", "/services/network");
    expect(screen.getByRole("progressbar", { name: "免费流量已使用 32%" })).toHaveValue(0.32);
    expect(screen.getByRole("progressbar")).toHaveClass("network-overview__progress--normal");
    expect(screen.getByText("免费流量")).toBeVisible();
    expect(screen.getByText("40GB")).toBeVisible();
    expect(screen.getByText("正常")).toHaveClass("is-normal");
    expect(screen.getByText("无欠费")).toHaveClass("is-normal");
    expect(screen.queryByText(/超额/)).not.toBeInTheDocument();
    expect(screen.getByText("本月已用").querySelector("svg")).toBeNull();
  });

  it("keeps lock and overdue amount visible at the same time", () => {
    renderOverview({
      ...normalNetwork,
      overdue_payment: 18.5,
      extend_usage: 5.25,
      is_locked: true,
    });

    const overview = screen.getByRole("link", {
      name: "校园网本月已用 12.80GB，超额流量 5.25 GB，账号已锁定，欠费 ¥18.50",
    });
    expect(overview).toHaveClass("network-overview--attention");
    expect(screen.getByText("超额 5.25 GB")).toBeVisible();
    expect(screen.getByText("已锁定")).toHaveClass("is-attention");
    expect(screen.getByText("¥18.50")).toHaveClass("is-attention");
  });

  it.each([
    [0.5, "normal"],
    [0.5001, "warning"],
    [0.9, "warning"],
    [0.9001, "primary"],
  ])("uses the %s usage ratio as the %s progress tone", (basePercentage, tone) => {
    renderOverview({ ...normalNetwork, base_percentage: basePercentage });

    expect(screen.getByRole("progressbar")).toHaveClass(`network-overview__progress--${tone}`);
  });
});
