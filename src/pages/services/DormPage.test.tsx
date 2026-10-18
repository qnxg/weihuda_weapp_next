import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DormPage from "./DormPage";

const apiMocks = vi.hoisted(() => ({
  info: vi.fn(),
  refresh: vi.fn(),
  electricity: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    dorm: {
      info: apiMocks.info,
      refresh: apiMocks.refresh,
      electricity: apiMocks.electricity,
    },
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DormPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.info.mockResolvedValue({
      park: "天马园区",
      build: "二区6栋",
      room: "618",
    });
    apiMocks.electricity.mockResolvedValue({ balance: "186.50度" });
    apiMocks.refresh.mockResolvedValue(undefined);
  });

  it("renders electricity and dorm information as two separate Material cards", async () => {
    renderPage();

    const balanceValue = await screen.findByText("186.50");
    expect(balanceValue.parentElement).toHaveClass("summary-band__value");
    expect(screen.getByText("度", { selector: ".summary-band__unit" })).toBeVisible();
    const location = screen.getByText("天马园区 二区6栋 618");
    expect(location).toBeVisible();
    expect(document.querySelector(".page-header p")).toBeNull();
    expect(document.querySelector(".summary-band > svg")).toBeNull();
    expect(document.querySelectorAll(".dorm-page__cards > .surface")).toHaveLength(2);

    const updateButton = screen.getByRole("button", { name: /^更新宿舍信息/ });
    const dormCard = updateButton.closest(".dorm-info-card");
    expect(updateButton).toHaveClass("data-update-button", "dorm-info-card__action");
    expect(updateButton).not.toHaveClass("surface");
    expect(dormCard).toHaveClass("surface");
    expect(dormCard).toContainElement(location);
    expect(screen.getByRole("heading", { name: "宿舍信息" })).toHaveClass("muted", "text-sm");
    expect(document.querySelector(".summary-band")).not.toContainElement(location);
    expect(screen.queryByRole("button", { name: "同步宿舍" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "刷新电量" })).not.toBeInTheDocument();
  });

  it("updates dorm information from the action below the electricity card", async () => {
    const user = userEvent.setup();
    renderPage();

    const updateButton = await screen.findByRole("button", { name: /^更新宿舍信息/ });
    await user.click(updateButton);

    await waitFor(() => expect(apiMocks.refresh).toHaveBeenCalledOnce());
    expect(await screen.findByText("宿舍信息已更新。")).toHaveClass(
      "dorm-info-card__action-status",
      "is-success",
    );
  });
});
