import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LabGradePage from "./LabGradePage";
import LabSchedulePage from "./LabSchedulePage";

const apiMocks = vi.hoisted(() => ({
  semester: vi.fn(),
  schedule: vi.fn(),
  grade: vi.fn(),
  bind: vi.fn(),
}));

vi.mock("../../api/api", () => ({
  api: {
    semester: { get: apiMocks.semester },
    lab: {
      schedule: apiMocks.schedule,
      grade: apiMocks.grade,
      bind: apiMocks.bind,
    },
  },
}));

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("lab pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.semester.mockResolvedValue({
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
      ],
      now_xn: 2025,
      now_xq: 3,
    });
    apiMocks.schedule.mockResolvedValue([]);
    apiMocks.grade.mockResolvedValue(null);
    apiMocks.bind.mockResolvedValue(undefined);
  });

  it("loads only schedule data and keeps account binding on the schedule page", async () => {
    const user = userEvent.setup();
    renderPage(<LabSchedulePage />);

    expect(await screen.findByRole("heading", { name: "实验安排" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "暂无实验安排" })).toBeVisible();
    await waitFor(() => expect(apiMocks.schedule).toHaveBeenCalledOnce());
    expect(apiMocks.semester).not.toHaveBeenCalled();
    expect(apiMocks.grade).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("实验平台密码"), "lab-password");
    await user.click(screen.getByRole("button", { name: "绑定账号" }));

    await waitFor(() => expect(apiMocks.bind).toHaveBeenCalledOnce());
    expect(apiMocks.bind.mock.calls[0]?.[0]).toBe("lab-password");
    expect(await screen.findByText("实验平台账号已绑定。")).toBeVisible();
  });

  it("loads only the server-designated semester grade on the grade page", async () => {
    renderPage(<LabGradePage />);

    expect(await screen.findByRole("heading", { name: "实验成绩" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "暂无实验成绩" })).toBeVisible();
    await waitFor(() => expect(apiMocks.grade).toHaveBeenCalledWith(2025, 3));
    expect(apiMocks.schedule).not.toHaveBeenCalled();
    expect(apiMocks.bind).not.toHaveBeenCalled();
  });
});
