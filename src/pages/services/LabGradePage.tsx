import { useQuery } from "@tanstack/react-query";
import { CalendarSync } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { LabGrade, LabGradeItem } from "../../api/types";
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
  type TagTone,
} from "../../components/ui";
import {
  findCurrentSemester,
  findSemester,
  parseAcademicYear,
  parseSemesterId,
} from "../../utils/semester";

const labGradeFootnotes = ["数据来源于实验平台。", "点击可查看每次实验的评分组成。"];

function attendanceText(attendance: string | null) {
  const value = attendance?.trim();
  return value ? `出勤 ${value}` : "出勤未记录";
}

function attendanceTone(attendance: string | null): TagTone {
  const value = attendance?.trim() ?? "";
  if (!value) return "neutral";
  if (value.includes("正常") || value.includes("合格")) return "success";
  if (value.includes("缺") || value.includes("旷")) return "danger";
  if (value.includes("迟") || value.includes("请假") || value.includes("早退")) return "warning";
  return "neutral";
}

function GradeValue({ value, label }: { value: string | null; label: string }) {
  const pending = !value?.trim();
  return (
    <div className="grade-score">
      <strong className={pending ? "grade-score__pending" : undefined}>
        {pending ? "待发布" : value}
      </strong>
      <span>{label}</span>
    </div>
  );
}

function CourseSummary({ grade }: { grade: LabGrade }) {
  return (
    <div className="surface record-item cluster spread gap-12 lab-course-summary">
      <div className="min-w-0">
        <p className="muted text-sm">实验课程</p>
        <h3 className="text-clamp-2">{grade.course_name}</h3>
      </div>
      <GradeValue value={grade.course_score} label="总评" />
    </div>
  );
}

function LabSummary({ lab }: { lab: LabGradeItem }) {
  return (
    <>
      <div className="min-w-0">
        <h3 className="text-clamp-2">{lab.lab_name}</h3>
        <ul className="grade-tags" aria-label="实验信息">
          <Tag as="li" className="grade-tag" tone={attendanceTone(lab.attendance)}>
            {attendanceText(lab.attendance)}
          </Tag>
          <Tag as="li" className="grade-tag">
            {lab.details.length} 项评分
          </Tag>
        </ul>
      </div>
      <GradeValue value={lab.score} label="实验成绩" />
    </>
  );
}

function LabDetailDialog({ lab, onClose }: { lab: LabGradeItem; onClose: () => void }) {
  return (
    <Modal title={lab.lab_name} description={attendanceText(lab.attendance)} onClose={onClose}>
      {lab.details.length ? (
        <ul className="list grade-detail-list">
          {lab.details.map((detail, index) => (
            <li className="data-row" key={`${detail.name}-${index}`}>
              <div className="grade-detail-list__label">
                <strong>{detail.name}</strong>
              </div>
              <span className="metric__value">{detail.score ?? "待发布"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="暂无评分组成" description="这次实验还没有可展示的评分明细。" />
      )}
    </Modal>
  );
}

export default function LabGradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<LabGradeItem | null>(null);
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
  const grade = useQuery({
    queryKey: ["lab", "grade", year, term],
    queryFn: () => api.lab.grade(year!, term!),
    enabled: hasSemester,
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
      <PageHeader title="实验成绩" back />

      <Section
        title={semesterOption ? semesterHeadingLabel(semesterOption) : "学年学期"}
        description={grade.data ? `${grade.data.labs.length} 项实验` : undefined}
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
          <QueryState query={grade} loadingRows={4}>
            {(result) =>
              result ? (
                <div className="stack gap-12">
                  <CourseSummary grade={result} />
                  {result.labs.length ? (
                    <div className="surface list grade-list">
                      {result.labs.map((lab, index) => (
                        <div className="data-row grade-row" key={`${lab.lab_name}-${index}`}>
                          <button
                            className="grade-row__action"
                            type="button"
                            aria-label={`查看${lab.lab_name}评分组成`}
                            onClick={() => setSelected(lab)}
                          />
                          <LabSummary lab={lab} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="暂无实验成绩"
                      description="当前学期还没有可查询的实验成绩。"
                    />
                  )}
                </div>
              ) : (
                <EmptyState title="暂无实验成绩" description="当前学期还没有可查询的实验成绩。" />
              )
            }
          </QueryState>
        ) : null}
      </Section>

      <PageFootnotes items={labGradeFootnotes} />

      {semesterOption && semesterPickerOpen ? (
        <SemesterPickerDialog
          selected={semesterOption}
          semesters={semesterTable.data!.items}
          current={currentSemester}
          onSelect={chooseSemester}
          onClose={() => setSemesterPickerOpen(false)}
        />
      ) : null}

      {selected ? <LabDetailDialog lab={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
