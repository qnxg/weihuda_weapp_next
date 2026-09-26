import { useQuery } from "@tanstack/react-query";
import { CalendarSync } from "lucide-react";
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { Grade } from "../../api/types";
import {
  gradeTerms,
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
} from "../../components/ui";
import { isGradeTerm, parseAcademicYear } from "../../utils/semester";

function GradeSummary({ grade }: { grade: Grade }) {
  const hasDetail = Boolean(grade.jx0404id);
  return (
    <>
      <div className="min-w-0">
        <h3 className="text-clamp-2">{grade.course_name}</h3>
        <p className="muted text-sm">
          {grade.course_id} · {grade.credit} 学分 · {grade.grade_type}
        </p>
        <p className="muted text-sm">
          {grade.course_type1 || "未分类"} / {grade.course_type2}
          {grade.grade_tag ? ` · ${grade.grade_tag}` : ""}
        </p>
      </div>
      <div className="grade-score">
        <strong>{grade.score}</strong>
        <span>{hasDetail ? `GPA ${grade.gpa ?? "—"}` : "暂无明细"}</span>
      </div>
    </>
  );
}

function CourseGradesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Grade | null>(null);
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false);
  const requestedYear = parseAcademicYear(searchParams.get("xn"));
  const requestedTermValue = searchParams.get("xq");
  const requestedTerm = isGradeTerm(requestedTermValue) ? requestedTermValue : undefined;
  const currentSemester = useQuery({
    queryKey: ["semester", "current"],
    queryFn: () => api.semester.get(),
  });
  const currentTerm = isGradeTerm(currentSemester.data?.xq) ? currentSemester.data.xq : undefined;
  const year = requestedYear ?? currentSemester.data?.xn;
  const term = requestedTerm ?? currentTerm;
  const hasSemester = year !== undefined && term !== undefined;
  const grades = useQuery({
    queryKey: ["grades", year, term],
    queryFn: () => api.grade.list(year!, term!),
    enabled: hasSemester,
  });
  const detail = useQuery({
    queryKey: ["grade", "detail", selected?.jx0404id],
    queryFn: () => api.grade.detail(selected!.jx0404id!),
    enabled: Boolean(selected?.jx0404id),
  });

  function chooseSemester(option: SemesterOption) {
    setSemesterPickerOpen(false);
    const next = new URLSearchParams(searchParams);
    if (currentSemester.data?.xn === option.year && currentSemester.data.xq === option.term) {
      next.delete("xn");
      next.delete("xq");
    } else {
      next.set("xn", String(option.year));
      next.set("xq", option.term);
    }
    setSelected(null);
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page">
      <PageHeader title="课程成绩" back />

      <Section
        title={hasSemester ? semesterHeadingLabel({ year, term }) : "学年学期"}
        description={grades.data ? `${grades.data.length} 门课程` : undefined}
        action={
          <button
            className="button button--text button--small"
            type="button"
            aria-label={
              hasSemester ? `切换学期，当前为${semesterOptionLabel({ year, term })}` : "切换学期"
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
        {currentSemester.isPending && !hasSemester ? <PageSkeleton rows={1} /> : null}
        {currentSemester.isError && !hasSemester ? (
          <PageError error={currentSemester.error} onRetry={() => void currentSemester.refetch()} />
        ) : null}
        {hasSemester ? (
          <QueryState query={grades} loadingRows={5}>
            {(items) =>
              items.length ? (
                <div className="surface list grade-list">
                  {items.map((grade) =>
                    grade.jx0404id ? (
                      <button
                        className="data-row grade-row"
                        type="button"
                        key={grade.course_id}
                        onClick={() => setSelected(grade)}
                      >
                        <GradeSummary grade={grade} />
                      </button>
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

      {hasSemester && semesterPickerOpen ? (
        <SemesterPickerDialog
          selected={{ year, term }}
          selectedSemester={
            currentSemester.data?.xn === year && currentSemester.data.xq === term
              ? currentSemester.data
              : undefined
          }
          current={currentSemester.data}
          terms={gradeTerms}
          onSelect={chooseSemester}
          onClose={() => setSemesterPickerOpen(false)}
        />
      ) : null}

      {selected ? (
        <Modal
          title={selected.course_name}
          description={`课程号 ${selected.course_id}`}
          onClose={() => setSelected(null)}
        >
          {detail.isPending ? <PageSkeleton rows={3} /> : null}
          {detail.isError ? (
            <PageError error={detail.error} onRetry={() => void detail.refetch()} />
          ) : null}
          {detail.data?.length ? (
            <div className="surface list">
              {detail.data.map((item) => (
                <div className="data-row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted text-sm">占比 {item.percentage}</p>
                  </div>
                  <span className="metric__value">{item.score}</span>
                </div>
              ))}
            </div>
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
