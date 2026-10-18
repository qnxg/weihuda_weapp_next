import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  AuthPrompt,
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  QueryState,
  RadioGroup,
  Tag,
} from "./ui";

describe("shared page states", () => {
  it("renders shared semantic tags with a tone", () => {
    render(
      <ul>
        <Tag as="li" tone="primary">
          必修
        </Tag>
      </ul>,
    );
    const tag = screen.getByRole("listitem");
    expect(tag).toHaveTextContent("必修");
    expect(tag).toHaveClass("badge", "badge--brand");
  });

  it("renders a controlled shared radio group", () => {
    const onChange = vi.fn();
    render(
      <RadioGroup
        label="性别"
        value="male"
        options={[
          { value: "male", label: "男生" },
          { value: "female", label: "女生" },
        ]}
        onChange={onChange}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "性别" });
    expect(group).toHaveClass("radio-group-row");
    expect(screen.getByRole("radio", { name: "男生" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "女生" }));
    expect(onChange).toHaveBeenCalledWith("female");
  });

  it("provides a clear login action for protected content", () => {
    render(
      <MemoryRouter initialEntries={["/schedule?week=2"]}>
        <AuthPrompt title="登录后查看课表" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "登录后查看课表" })).toBeVisible();
    const loginLink = screen.getByRole("link", { name: "去登录" });
    expect(loginLink).toHaveClass("button--text");
    expect(loginLink).toHaveAttribute("href", "/login?returnTo=%2Fschedule%3Fweek%3D2");
  });

  it("lets the user retry a failed request", () => {
    const retry = vi.fn();
    render(<PageError error={new Error("网络连接失败")} onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("网络连接失败");
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("isolates loading and errors to one query region", () => {
    const retry = vi.fn();
    const { rerender } = render(
      <QueryState
        query={{
          data: undefined,
          error: null,
          isError: false,
          isPending: true,
          refetch: retry,
        }}
      >
        {(data: string) => <p>{data}</p>}
      </QueryState>,
    );
    expect(screen.getByRole("status", { name: "正在加载" })).toBeVisible();

    rerender(
      <QueryState
        query={{
          data: undefined,
          error: new Error("区块加载失败"),
          isError: true,
          isPending: false,
          refetch: retry,
        }}
      >
        {(data: string) => <p>{data}</p>}
      </QueryState>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("区块加载失败");
    fireEvent.click(screen.getByRole("button", { name: "重新加载" }));
    expect(retry).toHaveBeenCalledOnce();

    rerender(
      <QueryState
        query={{
          data: "已加载内容",
          error: null,
          isError: false,
          isPending: false,
          refetch: retry,
        }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>,
    );
    expect(screen.getByText("已加载内容")).toBeVisible();
  });

  it("keeps stale data visible when a background refresh fails", () => {
    render(
      <QueryState
        query={{
          data: "缓存内容",
          error: new Error("刷新失败"),
          isError: true,
          isPending: false,
          refetch: vi.fn(),
        }}
      >
        {(data) => <p>{data}</p>}
      </QueryState>,
    );
    expect(screen.getByText("缓存内容")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("刷新失败");
  });

  it("renders a useful empty state", () => {
    render(<EmptyState title="暂无成绩" description="当前学期还没有可查询的成绩。" />);
    expect(screen.getByRole("heading", { name: "暂无成绩" })).toBeVisible();
    expect(screen.getByText("当前学期还没有可查询的成绩。")).toBeVisible();
  });

  it("supports a leading action and emphasized header metadata", () => {
    render(
      <MemoryRouter>
        <PageHeader
          title="9 月 23 日 星期三"
          description={
            <>
              2026 秋季学期 · <strong>第 2 周</strong>
            </>
          }
          leadingAction={
            <a href="/notices" aria-label="3 条未读通知">
              通知
            </a>
          }
        />
      </MemoryRouter>,
    );
    const header = screen.getByRole("banner");
    const noticeLink = screen.getByRole("link", { name: "3 条未读通知" });
    expect(header.children).toHaveLength(1);
    expect(header.firstElementChild?.firstElementChild).toBe(noticeLink);
    expect(screen.getByText("第 2 周").tagName).toBe("STRONG");
  });

  it("marks the page header as elevated only after the content starts scrolling", () => {
    render(
      <MemoryRouter>
        <main id="main-content">
          <PageHeader title="课表" />
          <div>页面内容</div>
        </main>
      </MemoryRouter>,
    );

    const main = screen.getByRole("main");
    const header = screen.getByRole("banner");
    expect(header).not.toHaveClass("is-scrolled");

    main.scrollTop = 1;
    fireEvent.scroll(main);
    expect(header).toHaveClass("is-scrolled");

    main.scrollTop = 0;
    fireEvent.scroll(main);
    expect(header).not.toHaveClass("is-scrolled");
  });

  it("keeps modal chrome separate from scrollable content and closes from the backdrop", () => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    const onClose = vi.fn();
    render(
      <Modal title="选择内容" bodyLabel="可滚动内容" onClose={onClose}>
        <p>弹窗正文</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "选择内容" });
    expect(dialog.querySelector(":scope > .modal__header")).toBeVisible();
    const body = screen.getByRole("region", { name: "可滚动内容" });
    expect(body).toHaveTextContent("弹窗正文");
    expect(body).toHaveAttribute("tabindex", "0");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 400,
      left: 100,
      right: 400,
      top: 200,
      width: 300,
      x: 100,
      y: 200,
      toJSON: () => ({}),
    });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes course details from transparent carousel space without closing from a card", () => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close() {
      this.open = false;
    };
    const onClose = vi.fn();
    render(
      <Modal title="课程详情" variant="course-detail" onClose={onClose}>
        <article className="schedule-detail-card">课程内容</article>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "课程详情" });
    const card = dialog.querySelector<HTMLElement>(".schedule-detail-card");
    const body = dialog.querySelector<HTMLElement>(".modal__body");
    expect(card).not.toBeNull();
    expect(body).not.toBeNull();

    fireEvent.click(card!);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(body!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
