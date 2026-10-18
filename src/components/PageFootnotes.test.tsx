import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageFootnotes } from "./PageFootnotes";

describe("PageFootnotes", () => {
  it("renders reusable page notes with visible footnote markers", () => {
    render(
      <PageFootnotes
        items={[
          "数据来源于教务系统。",
          "点击可查看课程成绩的具体组成。",
          "课程分数下方的小数为该门课程的绩点。",
        ]}
      />,
    );

    const note = screen.getByRole("note", { name: "页面说明" });
    expect(
      within(note)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "*数据来源于教务系统。",
      "*点击可查看课程成绩的具体组成。",
      "*课程分数下方的小数为该门课程的绩点。",
    ]);
  });

  it("does not render an empty note region", () => {
    render(<PageFootnotes items={[]} />);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
