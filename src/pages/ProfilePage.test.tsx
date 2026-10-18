import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "./ProfilePage";

const apiMocks = vi.hoisted(() => ({
  me: vi.fn(),
  unbind: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  logout: vi.fn(),
}));

vi.mock("../api/api", () => ({
  api: {
    me: { get: apiMocks.me },
    auth: { unbind: apiMocks.unbind },
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => authState,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isAuthenticated = true;
    apiMocks.me.mockResolvedValue({
      name: "张同学",
      stu_id: "202208010101",
      class: "计算机 2201",
      college: "信息科学与工程学院",
      major: "计算机科学与技术",
      enter: 2022,
      xz: 4,
      sex: "男",
    });
    apiMocks.unbind.mockResolvedValue(undefined);
  });

  it("shows the account name, college, and student ID without exposing other records", async () => {
    renderPage();

    expect(screen.queryByText("账号、权益与应用设置")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "张同学" })).toBeVisible();
    expect(
      screen.getByRole("region", {
        name: "已登录账号 张同学，信息科学与工程学院，学号 202208010101",
      }),
    ).toBeVisible();
    expect(screen.getByText("信息科学与工程学院")).toBeVisible();
    expect(screen.getByText("202208010101", { exact: true })).toBeVisible();
    expect(screen.queryByText("学号", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("校园账号已绑定")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "更多应用" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "账号与应用" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /积分中心/ })).toHaveAttribute(
      "href",
      "/services/points",
    );
    expect(screen.getByRole("link", { name: /问题反馈/ })).toHaveAttribute("href", "/feedback");
    expect(screen.getByRole("link", { name: /关于微生活/ })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("button", { name: /退出登录/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: "解除绑定并退出" })).not.toBeInTheDocument();

    for (const academicText of [
      "学籍信息",
      "计算机 2201",
      "计算机科学与技术",
      "入学年份",
      "学制",
      "性别",
    ]) {
      expect(screen.queryByText(academicText)).not.toBeInTheDocument();
    }
  });

  it("shows public support and the protected points entry without requesting profile data", async () => {
    authState.isAuthenticated = false;
    renderPage();

    expect(screen.getByRole("heading", { name: "登录校园账号" })).toBeVisible();
    expect(screen.getByRole("link", { name: /积分中心/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /问题反馈/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /关于微生活/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /退出登录/ })).not.toBeInTheDocument();
    await waitFor(() => expect(apiMocks.me).not.toHaveBeenCalled());
  });
});
