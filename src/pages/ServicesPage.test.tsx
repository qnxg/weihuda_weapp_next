import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import ServicesPage from "./ServicesPage";

describe("ServicesPage", () => {
  it("contains only campus query services", () => {
    render(
      <MemoryRouter>
        <ServicesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /课程成绩/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /空教室.*按教学楼和日期查询/ })).toHaveAttribute(
      "href",
      "/services/rooms",
    );
    expect(screen.getByRole("link", { name: /校历/ })).toHaveAttribute(
      "href",
      "/services/calendar",
    );
    expect(screen.getByRole("link", { name: /体测成绩/ })).toHaveAttribute(
      "href",
      "/services/gym/grade",
    );
    expect(screen.getByRole("link", { name: /体测预约/ })).toHaveAttribute(
      "href",
      "/services/gym/appointment",
    );
    expect(screen.getByRole("link", { name: /体测标准/ })).toHaveAttribute(
      "href",
      "/services/gym/standard",
    );
    expect(screen.getByRole("link", { name: /实验安排/ })).toHaveAttribute(
      "href",
      "/services/lab/schedule",
    );
    expect(screen.getByRole("link", { name: /实验成绩/ })).toHaveAttribute(
      "href",
      "/services/lab/grade",
    );
    expect(screen.queryByRole("link", { name: /大物实验/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /校园卡/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /校园公告/ })).not.toBeInTheDocument();
    expect(screen.queryByText("校内邮箱")).not.toBeInTheDocument();
    expect(screen.queryByText("积分中心")).not.toBeInTheDocument();
    expect(screen.queryByText("问题反馈")).not.toBeInTheDocument();
    expect(screen.queryByText("关于微生活")).not.toBeInTheDocument();
    expect(screen.queryByText("权益与支持")).not.toBeInTheDocument();
    expect(screen.queryByText("成长记录")).not.toBeInTheDocument();
  });
});
