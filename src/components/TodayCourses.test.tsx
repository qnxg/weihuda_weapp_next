import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { Course } from "../api/types";
import { TodayCourses } from "./TodayCourses";

function course(courseName: string, time: number, day = 3): Course {
  return {
    course_name: courseName,
    course_id: courseName,
    class_name: "计科2201",
    course_type: "专业核心",
    credit: 3,
    weeks: [2],
    day,
    time,
    extra: null,
    area: "南校区",
    place: "综 213",
    people: 40,
    teacher: "陈老师",
    customize_id: null,
  };
}

function coursesView(now: Date) {
  return (
    <MemoryRouter>
      <TodayCourses
        todayCourses={[
          course("算法设计与分析", 1),
          course("算法设计与分析", 2),
          course("操作系统", 5),
          course("计算机网络", 7),
        ]}
        tomorrowCourses={[course("数据库系统", 3, 4), course("数据库系统", 4, 4)]}
        today={new Date("2026-09-23T00:00:00")}
        tomorrow={new Date("2026-09-24T00:00:00")}
        now={now}
      />
    </MemoryRouter>
  );
}

function renderCourses(now: Date) {
  return render(coursesView(now));
}

describe("TodayCourses", () => {
  it("switches between today and tomorrow without a full schedule button", async () => {
    const user = userEvent.setup();
    renderCourses(new Date("2026-09-23T12:00:00"));

    expect(screen.getByRole("tab", { name: "今日课程" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("算法设计与分析")).toBeInTheDocument();
    expect(screen.queryByText("完整课表")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "明日课程" }));

    expect(screen.getByRole("tab", { name: "明日课程" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("数据库系统")).toBeInTheDocument();
    expect(screen.getByText(/第 3-4 节 \| 综 213 \| 陈老师/)).toBeInTheDocument();
  });

  it("supports arrow-key navigation between date tabs", async () => {
    const user = userEvent.setup();
    renderCourses(new Date("2026-09-23T12:00:00"));
    const todayTab = screen.getByRole("tab", { name: "今日课程" });
    const tomorrowTab = screen.getByRole("tab", { name: "明日课程" });

    todayTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(tomorrowTab).toHaveFocus();
    expect(tomorrowTab).toHaveAttribute("aria-selected", "true");
    expect(todayTab).toHaveAttribute("tabindex", "-1");
  });

  it("renders completed, warning and upcoming card styles", () => {
    renderCourses(new Date("2026-09-23T14:15:00"));

    expect(screen.getByRole("article", { name: "算法设计与分析，已结束" })).toHaveClass("course-card--completed");
    expect(screen.getByRole("article", { name: "操作系统，即将开始" })).toHaveClass("course-card--warning");
    expect(screen.getByRole("article", { name: "计算机网络，未开始" })).toHaveClass("course-card--upcoming");
    expect(screen.queryByText("已结束")).not.toBeInTheDocument();
    expect(screen.getByText("即将开始")).toBeInTheDocument();
    expect(screen.queryByText("未开始")).not.toBeInTheDocument();
  });

  it("uses primary styling while a course is active", () => {
    renderCourses(new Date("2026-09-23T14:40:00"));
    expect(screen.getByRole("article", { name: "操作系统，上课中" })).toHaveClass("course-card--active");
    expect(screen.getByText("上课中")).toBeInTheDocument();
  });

  it("defaults to tomorrow after every course today has ended", () => {
    renderCourses(new Date("2026-09-23T22:00:00"));
    expect(screen.getByRole("tab", { name: "明日课程" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("数据库系统")).toBeInTheDocument();
  });

  it("switches to tomorrow when the final course ends while the page stays open", () => {
    const { rerender } = renderCourses(new Date("2026-09-23T17:14:00"));
    expect(screen.getByRole("tab", { name: "今日课程" })).toHaveAttribute("aria-selected", "true");

    rerender(coursesView(new Date("2026-09-23T17:15:00")));

    expect(screen.getByRole("tab", { name: "明日课程" })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves an explicit day selection after the default changes", async () => {
    const user = userEvent.setup();
    const { rerender } = renderCourses(new Date("2026-09-23T22:00:00"));
    await user.click(screen.getByRole("tab", { name: "今日课程" }));

    rerender(coursesView(new Date("2026-09-23T22:01:00")));

    expect(screen.getByRole("tab", { name: "今日课程" })).toHaveAttribute("aria-selected", "true");
  });
});
