import { describe, expect, it } from "vitest";
import type { Course } from "../api/types";
import {
  courseSessionPeriodLabel,
  courseSessionTimes,
  getCourseStatus,
  groupCourseSessions,
  shouldDefaultToTomorrow,
} from "./course";

function course(time: number, overrides: Partial<Course> = {}): Course {
  return {
    course_name: "操作系统",
    course_id: "COMP2001",
    class_name: "计科2201",
    course_type: "专业核心",
    credit: 3,
    weeks: [2],
    day: 3,
    time,
    extra: null,
    area: "南校区",
    place: "综 213",
    people: 40,
    teacher: "陈老师",
    customize_id: null,
    ...overrides,
  };
}

describe("course sessions", () => {
  it("merges adjacent periods for the same course", () => {
    const sessions = groupCourseSessions([
      course(2),
      course(1),
      course(5, { course_name: "计算机网络", course_id: "COMP2003" }),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ startPeriod: 1, endPeriod: 2 });
    expect(courseSessionPeriodLabel(sessions[0])).toBe("第 1-2 节");
    expect(courseSessionTimes(sessions[0])).toEqual({ start: "08:00", end: "09:40" });
  });

  it("keeps non-adjacent periods as separate sessions", () => {
    expect(groupCourseSessions([course(1), course(3)])).toHaveLength(2);
  });

  it("does not merge adjacent periods when displayed details differ", () => {
    expect(
      groupCourseSessions([course(1), course(2, { extra: "实验课", people: 20 })]),
    ).toHaveLength(2);
  });

  it("merges interleaved concurrent courses independently", () => {
    const sessions = groupCourseSessions([
      course(1),
      course(1, { course_name: "数据库系统", course_id: "COMP2004" }),
      course(2),
      course(2, { course_name: "数据库系统", course_id: "COMP2004" }),
    ]);

    expect(sessions).toHaveLength(2);
    expect(sessions.map(({ startPeriod, endPeriod }) => [startPeriod, endPeriod])).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it.each([
    ["2026-09-23T07:39:59", "upcoming"],
    ["2026-09-23T07:40:00", "warning"],
    ["2026-09-23T08:00:00", "active"],
    ["2026-09-23T09:39:59", "active"],
    ["2026-09-23T09:40:00", "completed"],
  ] as const)("classifies the course state at %s", (now, expected) => {
    const [session] = groupCourseSessions([course(1), course(2)]);
    expect(getCourseStatus(session, new Date("2026-09-23T00:00:00"), new Date(now))).toBe(expected);
  });

  it("defaults to tomorrow only after a non-empty day is fully completed", () => {
    const [session] = groupCourseSessions([course(1), course(2)]);
    const today = new Date("2026-09-23T00:00:00");

    expect(shouldDefaultToTomorrow([], today, new Date("2026-09-23T22:00:00"))).toBe(false);
    expect(shouldDefaultToTomorrow([session], today, new Date("2026-09-23T09:39:59"))).toBe(false);
    expect(shouldDefaultToTomorrow([session], today, new Date("2026-09-23T09:40:00"))).toBe(true);
  });
});
