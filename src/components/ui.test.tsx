import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AuthPrompt, EmptyState, PageError } from "./ui";

describe("shared page states", () => {
  it("provides a clear login action for protected content", () => {
    render(
      <MemoryRouter initialEntries={["/schedule?week=2"]}>
        <AuthPrompt title="登录后查看课表" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "登录后查看课表" })).toBeVisible();
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fschedule%3Fweek%3D2",
    );
  });

  it("lets the user retry a failed request", () => {
    const retry = vi.fn();
    render(<PageError error={new Error("网络连接失败")} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("网络连接失败");
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders a useful empty state", () => {
    render(<EmptyState title="暂无成绩" description="当前学期还没有可查询的成绩。" />);
    expect(screen.getByRole("heading", { name: "暂无成绩" })).toBeVisible();
    expect(screen.getByText("当前学期还没有可查询的成绩。")).toBeVisible();
  });
});
