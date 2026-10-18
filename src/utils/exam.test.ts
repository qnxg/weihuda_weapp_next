import { describe, expect, it } from "vitest";
import type { ExamScheduleItem } from "../api/types";
import { getExamStatus } from "./exam";

function exam(overrides: Partial<ExamScheduleItem> = {}): ExamScheduleItem {
  return {
    course_id: "COMP1001",
    course_name: "数据结构",
    area: "南校区",
    classroom: "综101",
    date: "2026-10-05",
    start_time: "14:00",
    end_time: "16:00",
    seat: "42",
    customize_id: null,
    invalid: false,
    ...overrides,
  };
}

describe("exam schedule status", () => {
  const duringExam = new Date("2026-10-05T15:00:00");

  it("prioritizes invalid over the schedule time", () => {
    expect(
      getExamStatus(
        exam({ date: "2026-10-08", start_time: "09:00", end_time: "11:00", invalid: true }),
        duringExam,
      ),
    ).toBe("invalid");
  });

  it("distinguishes active, completed, scheduled, and unknown-time exams", () => {
    expect(getExamStatus(exam(), duringExam)).toBe("active");
    expect(getExamStatus(exam(), new Date("2026-10-05T16:00:00"))).toBe("completed");
    expect(getExamStatus(exam({ date: "2026-10-06" }), duringExam)).toBe("scheduled");
    expect(getExamStatus(exam({ date: null, start_time: null, end_time: null }), duringExam)).toBe(
      "scheduled",
    );
  });
});
