import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PullToRefresh } from "./PullToRefresh";

function touch(clientX: number, clientY: number) {
  return [{ clientX, clientY }];
}

function pull(target: HTMLElement, deltaX: number, deltaY: number) {
  fireEvent.touchStart(target, { touches: touch(120, 100) });
  fireEvent.touchMove(target, { touches: touch(120 + deltaX, 100 + deltaY) });
  fireEvent.touchEnd(target);
}

describe("PullToRefresh", () => {
  it("requires a deliberate vertical pull past the threshold", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>页面内容</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");

    pull(screen.getByText("页面内容"), 0, 80);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(main).toHaveAttribute("data-pull-state", "idle");
  });

  it("does not take over horizontal gestures or pulls away from the scroll top", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>页面内容</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const content = screen.getByText("页面内容");

    pull(content, 140, 20);
    main.scrollTop = 12;
    pull(content, 0, 160);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(main).toHaveAttribute("data-pull-state", "idle");
  });

  it("refreshes once, locks repeated pulls, and announces completion", async () => {
    let resolveRefresh = () => {};
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>页面内容</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const content = screen.getByText("页面内容");

    pull(content, 0, 160);

    expect(onRefresh).toHaveBeenCalledOnce();
    expect(main).toHaveAttribute("data-pull-state", "refreshing");
    expect(screen.getByRole("status")).toHaveTextContent("正在刷新当前页面");

    pull(content, 0, 160);
    expect(onRefresh).toHaveBeenCalledOnce();

    resolveRefresh();
    await waitFor(() => expect(main).toHaveAttribute("data-pull-state", "success"));
    expect(screen.getByRole("status")).toHaveTextContent("刷新完成");
  });

  it("announces a failed refresh without leaving the page displaced indefinitely", async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error("网络错误"));
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>缓存内容仍然可见</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");

    pull(screen.getByText("缓存内容仍然可见"), 0, 160);

    await waitFor(() => expect(main).toHaveAttribute("data-pull-state", "error"));
    expect(screen.getByRole("status")).toHaveTextContent("刷新失败");
    expect(screen.getByText("缓存内容仍然可见")).toBeVisible();
  });

  it("cancels a tracked pull as soon as another touch is added", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>页面内容</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const content = screen.getByText("页面内容");

    fireEvent.touchStart(content, { touches: touch(120, 100) });
    fireEvent.touchMove(content, { touches: touch(120, 260) });
    expect(main).toHaveAttribute("data-pull-state", "ready");

    fireEvent.touchMove(content, {
      touches: [...touch(120, 260), ...touch(180, 240)],
    });
    fireEvent.touchEnd(content, { touches: touch(120, 260) });
    fireEvent.touchEnd(content, { touches: [] });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(main).toHaveAttribute("data-pull-state", "idle");
  });

  it("resets an in-progress gesture when refresh becomes disabled", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <p>登录态内容</p>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const content = screen.getByText("登录态内容");
    fireEvent.touchStart(content, { touches: touch(120, 100) });
    fireEvent.touchMove(content, { touches: touch(120, 260) });
    expect(main).toHaveAttribute("data-pull-state", "ready");

    rerender(
      <PullToRefresh enabled={false} onRefresh={onRefresh}>
        <p>登录态内容</p>
      </PullToRefresh>,
    );

    await waitFor(() => expect(main).toHaveAttribute("data-pull-state", "idle"));
    expect(main).not.toHaveAttribute("data-pull-target");
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("ignores gestures that start from form controls", () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <label>
          备注
          <textarea />
        </label>
        <button type="button">重试</button>
      </PullToRefresh>,
    );
    const input = screen.getByRole("textbox");
    const button = screen.getByRole("button", { name: "重试" });

    pull(input, 0, 160);
    pull(button, 0, 160);

    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByRole("main")).toHaveAttribute("data-pull-state", "idle");
  });

  it("keeps the page header fixed and replaces only page content with a skeleton", () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <div className="page">
          <header className="page-header">页面标题</header>
          <section>数据正文</section>
        </div>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const header = screen.getByText("页面标题");

    pull(screen.getByText("数据正文"), 0, 160);

    expect(main).toHaveAttribute("data-pull-target", "page");
    expect(header).not.toHaveClass("pull-to-refresh__target");
    expect(header.parentElement).toHaveClass("pull-to-refresh__target");
    expect(main.querySelector(".pull-to-refresh__skeleton")).toBeInTheDocument();
  });

  it("anchors tabbed refresh below the tabs and targets only the active panel", () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <div className="page">
          <header className="page-header">考试安排</header>
          <div className="segmented" role="tablist">
            <button type="button" role="tab">
              未结束
            </button>
          </div>
          <div role="tabpanel">考试列表</div>
        </div>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const panel = screen.getByRole("tabpanel");

    pull(panel, 0, 160);

    expect(main).toHaveAttribute("data-pull-target", "panel");
    expect(panel).toHaveClass("pull-to-refresh__target");
    expect(screen.getByRole("tablist")).not.toHaveClass("pull-to-refresh__target");
    expect(main.querySelector(".pull-to-refresh__skeleton")).toBeInTheDocument();
  });

  it("keeps an explicit page filter outside its refresh panel", () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <div className="page">
          <header className="page-header">校历</header>
          <section>2026 - 2027 学年 秋季学期</section>
          <div data-pull-to-refresh-panel>校历日期</div>
        </div>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");
    const panel = screen.getByText("校历日期");
    const filter = screen.getByText("2026 - 2027 学年 秋季学期");

    pull(panel, 0, 160);

    expect(main).toHaveAttribute("data-pull-target", "panel");
    expect(panel).toHaveClass("pull-to-refresh__target");
    expect(filter).not.toHaveClass("pull-to-refresh__target");
    expect(main.querySelector(".pull-to-refresh__skeleton")).toBeInTheDocument();
  });

  it("keeps a top-level segmented filter outside the refresh target", () => {
    const onRefresh = vi.fn(() => new Promise<void>(() => {}));
    render(
      <PullToRefresh enabled onRefresh={onRefresh}>
        <div className="page">
          <header className="page-header">通知</header>
          <div className="segmented">
            <button type="button">全部</button>
            <button type="button">未读</button>
          </div>
          <section>通知列表</section>
        </div>
      </PullToRefresh>,
    );
    const main = screen.getByRole("main");

    pull(screen.getByText("通知列表"), 0, 160);

    expect(main).toHaveAttribute("data-pull-target", "segmented");
    expect(screen.getByText("全部").parentElement).not.toHaveClass("pull-to-refresh__target");
    expect(screen.getByText("通知列表").parentElement).toHaveClass("pull-to-refresh__target");
    expect(main.querySelector(".pull-to-refresh__skeleton")).toBeInTheDocument();
  });
});
