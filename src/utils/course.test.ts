import { describe, expect, it } from "vitest";
import type { Course } from "../api/types";
import {
  buildCourseColorMap,
  courseSessionPeriodLabel,
  courseSessionTimes,
  getCourseStatus,
  groupCourseSessions,
  shouldDefaultToTomorrow,
  stackCourseSessions,
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

  it.each([
    ["course name", { course_name: "实验课" }],
    ["course id", { course_id: "COMP9999" }],
    ["class", { class_name: "计科2202" }],
    ["course type", { course_type: "专业选修" }],
    ["credit", { credit: 2 }],
    ["weeks", { weeks: [2, 4] }],
    ["day", { day: 4 }],
    ["extra", { extra: "实验课" }],
    ["empty extra", { extra: "" }],
    ["area", { area: "北校区" }],
    ["place", { place: "综405" }],
    ["people", { people: 20 }],
    ["teacher", { teacher: "李老师" }],
    ["custom id", { customize_id: 7 }],
  ] satisfies Array<[string, Partial<Course>]>)(
    "does not merge adjacent periods when %s differs",
    (_, changedFields) => {
      expect(groupCourseSessions([course(1), course(2, changedFields)])).toHaveLength(2);
    },
  );

  it("does not merge distinct field tuples containing identity delimiters", () => {
    expect(
      groupCourseSessions([
        course(1, { course_id: "A|B", course_name: "C" }),
        course(2, { course_id: "A", course_name: "B|C" }),
      ]),
    ).toHaveLength(2);
  });

  it("does not merge courses when the week arrays use a different order", () => {
    expect(
      groupCourseSessions([course(1, { weeks: [2, 4] }), course(2, { weeks: [4, 2] })]),
    ).toHaveLength(2);
  });

  it("does not treat a missing field as equal to an explicit null", () => {
    expect(
      groupCourseSessions([course(1, { extra: null }), course(2, { extra: undefined })]),
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

  it("stacks courses in the same slot and prioritizes the selected week", () => {
    const sessions = groupCourseSessions([
      course(1, { course_name: "单周课程", course_id: "ODD", weeks: [1, 3] }),
      course(2, { course_name: "单周课程", course_id: "ODD", weeks: [1, 3] }),
      course(1, { course_name: "双周课程", course_id: "EVEN", weeks: [2, 4] }),
      course(2, { course_name: "双周课程", course_id: "EVEN", weeks: [2, 4] }),
      course(3, { course_name: "独立课程", course_id: "OTHER" }),
    ]);

    const stacks = stackCourseSessions(sessions, 2);

    expect(stacks).toHaveLength(2);
    expect(stacks[0].sessions).toHaveLength(2);
    expect(stacks[0].primary.course.course_name).toBe("双周课程");
    expect(stacks[1].primary.course.course_name).toBe("独立课程");
    expect(stackCourseSessions(sessions, 3)[0].primary.course.course_name).toBe("单周课程");
  });

  it("assigns colors by sorted official names before sorted custom-only names", () => {
    const courses = [
      course(1, { course_name: "Beta", course_id: "B" }),
      course(2, { course_name: "Alpha", course_id: "A" }),
      course(3, { course_name: "Aaron", course_id: null, customize_id: 1 }),
      course(4, { course_name: "Zulu", course_id: null, customize_id: 2 }),
      course(5, { course_name: "Alpha", course_id: null, customize_id: 3 }),
    ];
    const colors = buildCourseColorMap(courses, 3);

    expect([...colors]).toEqual([
      ["Alpha", 0],
      ["Beta", 1],
      ["Aaron", 2],
      ["Zulu", 0],
    ]);
    expect([...buildCourseColorMap(courses.toReversed(), 3)]).toEqual([...colors]);
    expect(() => buildCourseColorMap([], 0)).toThrow(RangeError);
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
