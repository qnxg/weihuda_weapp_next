import type { Grade, GradeDetail } from "../api/types";

const gradeDetailKeywords = ["平时", "期中", "期末"] as const;
const gradeDetailNameCollator = new Intl.Collator("zh-CN");
const primaryCourseType2 = new Set(["专业课", "专业基础", "学类核心", "学门核心", "专业核心"]);

export interface GradeTag {
  label: string;
  tone: "neutral" | "primary" | "success" | "warning";
}

function gradeDetailPriority(name: string) {
  const keywordIndex = gradeDetailKeywords.findIndex((keyword) => name.includes(keyword));
  return keywordIndex === -1 ? 0 : keywordIndex + 1;
}

export function formatGradePoint(value: number | null) {
  return value === null ? "—" : value.toFixed(1);
}

export function buildGradeTags(
  grade: Pick<Grade, "course_type1" | "course_type2" | "grade_tag" | "grade_type">,
) {
  const gradeTag = grade.grade_tag?.trim();
  const gradeType = grade.grade_type.trim();
  const courseType1 = grade.course_type1?.trim();
  const courseType2 = grade.course_type2.trim();
  const candidates: GradeTag[] = [];
  if (gradeTag) candidates.push({ label: gradeTag, tone: "warning" });
  if (gradeType === "辅修") candidates.push({ label: gradeType, tone: "success" });
  if (courseType1) {
    candidates.push({
      label: courseType1,
      tone: courseType1 === "必修" ? "primary" : "neutral",
    });
  }
  if (courseType2) {
    candidates.push({
      label: courseType2,
      tone: primaryCourseType2.has(courseType2) ? "primary" : "neutral",
    });
  }
  const seen = new Set<string>();
  return candidates.filter(({ label }) => {
    if (seen.has(label)) return false;
    seen.add(label);
    return true;
  });
}

export function sortGradeDetails(items: readonly GradeDetail[]) {
  return [...items].sort((left, right) => {
    const priorityDifference = gradeDetailPriority(left.name) - gradeDetailPriority(right.name);
    return priorityDifference || gradeDetailNameCollator.compare(left.name, right.name);
  });
}
