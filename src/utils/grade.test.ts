import { describe, expect, it } from "vitest";
import type { GradeDetail } from "../api/types";
import { buildGradeTags, formatGradePoint, sortGradeDetails } from "./grade";

function detail(name: string): GradeDetail {
  return { name, score: "90", percentage: "10%" };
}

function gradeMetadata(
  overrides: Partial<Parameters<typeof buildGradeTags>[0]> = {},
): Parameters<typeof buildGradeTags>[0] {
  return {
    course_type1: "选修",
    course_type2: "公共基础",
    grade_tag: null,
    grade_type: "主修",
    ...overrides,
  };
}

describe("grade detail sorting", () => {
  it("formats grade points with one decimal place", () => {
    expect(formatGradePoint(4)).toBe("4.0");
    expect(formatGradePoint(3.74)).toBe("3.7");
    expect(formatGradePoint(3.75)).toBe("3.8");
    expect(formatGradePoint(null)).toBe("—");
  });

  it("puts unmatched items first, then daily, midterm, and final items", () => {
    const items = [
      detail("期末考试 B"),
      detail("平时作业 B"),
      detail("B 项目"),
      detail("期中考试 B"),
      detail("期末考试 A"),
      detail("A 项目"),
      detail("平时作业 A"),
      detail("期中考试 A"),
    ];

    expect(sortGradeDetails(items).map((item) => item.name)).toEqual([
      "A 项目",
      "B 项目",
      "平时作业 A",
      "平时作业 B",
      "期中考试 A",
      "期中考试 B",
      "期末考试 A",
      "期末考试 B",
    ]);
  });

  it("does not mutate the API response", () => {
    const items = [detail("期末考试"), detail("课程论文")];

    sortGradeDetails(items);

    expect(items.map((item) => item.name)).toEqual(["期末考试", "课程论文"]);
  });
});

describe("grade tags", () => {
  it("orders tags by grade tag, minor, course type 1, then course type 2", () => {
    expect(
      buildGradeTags(
        gradeMetadata({
          grade_tag: "补考",
          grade_type: "辅修",
          course_type1: "必修",
          course_type2: "专业核心",
        }),
      ),
    ).toEqual([
      { label: "补考", tone: "warning" },
      { label: "辅修", tone: "success" },
      { label: "必修", tone: "primary" },
      { label: "专业核心", tone: "primary" },
    ]);
  });

  it("hides major and null grade tags while keeping unmatched course types neutral", () => {
    expect(buildGradeTags(gradeMetadata())).toEqual([
      { label: "选修", tone: "neutral" },
      { label: "公共基础", tone: "neutral" },
    ]);
  });

  it.each(["专业课", "专业基础", "学类核心", "学门核心", "专业核心"])(
    "uses the primary tone for %s",
    (courseType2) => {
      expect(
        buildGradeTags(gradeMetadata({ course_type1: null, course_type2: courseType2 })),
      ).toEqual([{ label: courseType2, tone: "primary" }]);
    },
  );

  it("keeps only the highest-priority instance of a duplicate label", () => {
    expect(
      buildGradeTags(
        gradeMetadata({
          grade_tag: "必修",
          grade_type: "辅修",
          course_type1: "必修",
          course_type2: "专业核心",
        }),
      ),
    ).toEqual([
      { label: "必修", tone: "warning" },
      { label: "辅修", tone: "success" },
      { label: "专业核心", tone: "primary" },
    ]);
  });
});
