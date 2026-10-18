import { Link } from "react-router-dom";
import type { Grade, SemesterItem } from "../api/types";
import { Section } from "./ui";

export function SemesterGradesOverview({
  semester,
  grades,
}: {
  semester: SemesterItem;
  grades: readonly Grade[];
}) {
  return (
    <Section title="课程成绩" className="today-grades">
      {grades.length ? (
        <ul
          className="today-grades__track"
          aria-label={`${semester.xn} ${semester.xq_text}课程成绩，共 ${grades.length} 门`}
        >
          {grades.map((grade) => (
            <li key={grade.course_id}>
              <Link
                className="today-grade-card surface"
                to="/services/grades"
                aria-label={`${grade.course_name}，成绩 ${grade.score}，查看课程成绩`}
              >
                <h3>{grade.course_name}</h3>
                <strong>{grade.score}</strong>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          className="today-grades__empty surface"
          to="/services/grades"
          aria-label={`查看${semester.xn} ${semester.xq_text}课程成绩，共 0 门`}
        >
          当前学期暂无课程成绩
        </Link>
      )}
    </Section>
  );
}
