import { useQuery } from "@tanstack/react-query";
import { CalendarSync } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { Grade } from "../../api/types";
import { PageFootnotes } from "../../components/PageFootnotes";
import {
  SemesterPickerDialog,
  semesterHeadingLabel,
  semesterOptionLabel,
  type SemesterOption,
} from "../../components/SemesterPicker";
import {
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  QueryState,
  Section,
  Tag,
} from "../../components/ui";
import { buildGradeTags, formatGradePoint, sortGradeDetails } from "../../utils/grade";
import {
  findCurrentSemester,
  findSemester,
  parseAcademicYear,
  parseSemesterId,
} from "../../utils/semester";

const gradePageFootnotes = [
  "数据来源于教务系统。",
  "点击可查看课程成绩的具体组成。",
  "课程分数下方的小数为该门课程的绩点。",
];

function GradeSummary({ grade }: { grade: Grade }) {
  const tags = buildGradeTags(grade);
  const gradePoint = formatGradePoint(grade.gpa);

  return (
    <>
      <div className="min-w-0">
        <h3 className="text-clamp-2">{grade.course_name}</h3>
        <p className="muted text-sm">
          {grade.course_id} · {grade.credit} 学分
        </p>
        <ul className="grade-tags" aria-label="课程属性">
          {tags.map((tag) => (
            <Tag as="li" className="grade-tag" tone={tag.tone} key={tag.label}>
              {tag.label}
            </Tag>
          ))}
        </ul>
      </div>
      <div className="grade-score">
        <strong>{grade.score}</strong>
        <span aria-label={grade.gpa === null ? "绩点暂无" : `绩点 ${gradePoint}`}>
          {gradePoint}
        </span>
      </div>
    </>
  );
}

function CourseGradesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Grade | null>(null);
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false);
  const requestedYear = parseAcademicYear(searchParams.get("xn"));
  const requestedTerm = parseSemesterId(searchParams.get("xq"));
  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: () => api.semester.get(),
  });
  const currentSemester = findCurrentSemester(semesterTable.data);
  const requestedSemester = findSemester(semesterTable.data, requestedYear, requestedTerm);
  const semester = requestedSemester ?? currentSemester;
  const year = semester?.xn;
  const term = semester?.xq;
  const semesterOption: SemesterOption | undefined = semester
    ? { year: semester.xn, term: semester.xq, text: semester.xq_text }
    : undefined;
  const hasSemester = semesterOption !== undefined;
  const grades = useQuery({
    queryKey: ["grades", year, term],
    queryFn: () => api.grade.list(year!, term!),
    enabled: hasSemester,
  });
  const detail = useQuery({
    queryKey: ["grade", "detail", selected?.jx0404id],
    queryFn: () => api.grade.detail(selected!.jx0404id!),
    enabled: Boolean(selected?.jx0404id),
    select: sortGradeDetails,
  });

  function chooseSemester(option: SemesterOption) {
    setSemesterPickerOpen(false);
    const next = new URLSearchParams(searchParams);
    if (currentSemester?.xn === option.year && currentSemester.xq === option.term) {
      next.delete("xn");
      next.delete("xq");
    } else {
      next.set("xn", String(option.year));
      next.set("xq", String(option.term));
    }
    setSelected(null);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page">
      <PageHeader title="课程成绩" back />

      <Section
        title={semesterOption ? semesterHeadingLabel(semesterOption) : "学年学期"}
        description={grades.data ? `${grades.data.length} 门课程` : undefined}
        action={
          <button
            className="button button--text button--small"
            type="button"
            aria-label={
              semesterOption ? `切换学期，当前为${semesterOptionLabel(semesterOption)}` : "切换学期"
            }
            aria-haspopup="dialog"
            aria-expanded={semesterPickerOpen}
            disabled={!hasSemester}
            onClick={() => setSemesterPickerOpen(true)}
          >
            <CalendarSync aria-hidden="true" />
            切换
          </button>
        }
      >
        {semesterTable.isPending && !hasSemester ? <PageSkeleton rows={1} /> : null}
        {semesterTable.isError && !hasSemester ? (
          <PageError error={semesterTable.error} onRetry={() => void semesterTable.refetch()} />
        ) : null}
        {hasSemester ? (
          <QueryState query={grades} loadingRows={5}>
            {(items) =>
              items.length ? (
                <div className="surface list grade-list">
                  {items.map((grade) =>
                    grade.jx0404id ? (
                      <div className="data-row grade-row" key={grade.course_id}>
                        <button
                          className="grade-row__action"
                          type="button"
                          aria-label={`查看${grade.course_name}成绩组成`}
                          onClick={() => setSelected(grade)}
                        />
                        <GradeSummary grade={grade} />
                      </div>
                    ) : (
                      <div className="data-row grade-row grade-row--static" key={grade.course_id}>
                        <GradeSummary grade={grade} />
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <EmptyState title="暂无成绩" description="当前学期还没有可查询的成绩。" />
              )
            }
          </QueryState>
        ) : null}
      </Section>

      <PageFootnotes items={gradePageFootnotes} />

      {semesterOption && semesterPickerOpen ? (
        <SemesterPickerDialog
          selected={semesterOption}
          semesters={semesterTable.data!.items}
          current={currentSemester}
          onSelect={chooseSemester}
          onClose={() => setSemesterPickerOpen(false)}
        />
      ) : null}

      {selected ? (
        <Modal title={selected.course_name} onClose={() => setSelected(null)}>
          {detail.isPending ? <PageSkeleton rows={3} /> : null}
          {detail.isError ? (
            <PageError error={detail.error} onRetry={() => void detail.refetch()} />
          ) : null}
          {detail.data?.length ? (
            <ul className="list grade-detail-list">
              {detail.data.map((item) => (
                <li className="data-row" key={item.name}>
                  <div className="grade-detail-list__label">
                    <strong>{item.name}</strong>
                    <p className="muted text-sm">占比 {item.percentage}</p>
                  </div>
                  <span className="metric__value">{item.score}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {detail.data && detail.data.length === 0 ? (
            <EmptyState title="暂无明细" description="这门课程还没有可展示的成绩构成。" />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

export default function GradesPage() {
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source");

  if (source) {
    const legacySource = source === "ca" ? "ca" : "school";
    const next = new URLSearchParams(searchParams);
    next.set("source", legacySource);
    return <Navigate replace to={`/services/rank?${next}`} />;
  }

  return <CourseGradesPage />;
}
