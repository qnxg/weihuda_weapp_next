import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarSync, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { GymGrade } from "../../api/types";
import { AcademicYearPickerDialog } from "../../components/SemesterPicker";
import {
  PageError,
  PageHeader,
  PageSkeleton,
  QueryState,
  Section,
  Modal,
} from "../../components/ui";
import { academicYearLabel, academicYears, parseAcademicYear } from "../../utils/semester";

const metricLabels: Array<
  [
    keyof Pick<
      GymGrade,
      "short_run" | "bmi" | "jump" | "pull_and_sit" | "run" | "sit_and_reach" | "vc"
    >,
    string,
    number,
  ]
> = [
  ["short_run", "50 米跑", 20],
  ["bmi", "体重指数", 15],
  ["jump", "立定跳远", 10],
  ["pull_and_sit", "引体 / 仰卧起坐", 10],
  ["run", "耐力跑", 20],
  ["sit_and_reach", "坐位体前屈", 10],
  ["vc", "肺活量", 15],
];

const eyeLabels: Array<[keyof GymGrade["eye"], string]> = [
  ["sight", "裸眼视力"],
  ["mirror", "戴镜视力"],
  ["ametropia", "屈光状态"],
];

function metricBadgeClass(color: string) {
  switch (color.trim().toLowerCase()) {
    case "green":
      return "badge badge--success";
    case "red":
      return "badge badge--danger";
    default:
      return "badge";
  }
}

function EyeDetailsDialog({ eye, onClose }: { eye: GymGrade["eye"]; onClose: () => void }) {
  return (
    <Modal title="视力详情" onClose={onClose}>
      <dl className="gym-eye-detail-list">
        {eyeLabels.map(([key, label]) => {
          const item = eye[key];
          return (
            <div className="gym-eye-detail-list__item" key={key}>
              <dt>{label}</dt>
              <dd>
                <div>
                  <span>左眼</span>
                  <strong>{item.left.value}</strong>
                  <p>{item.left.description}</p>
                </div>
                <div>
                  <span>右眼</span>
                  <strong>{item.right.value}</strong>
                  <p>{item.right.description}</p>
                </div>
              </dd>
            </div>
          );
        })}
      </dl>
    </Modal>
  );
}

export default function GymGradePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [eyeDetailsOpen, setEyeDetailsOpen] = useState(false);
  const requestedYearValue = searchParams.get("xn");
  const requestedYear = parseAcademicYear(requestedYearValue);
  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: () => api.semester.get(),
  });
  const yearOptions = academicYears(semesterTable.data);
  const invalidRequestedYear =
    semesterTable.data !== undefined &&
    requestedYearValue !== null &&
    (requestedYear === undefined || !yearOptions.includes(requestedYear));
  const year =
    requestedYear !== undefined && yearOptions.includes(requestedYear)
      ? requestedYear
      : semesterTable.data?.now_xn;
  const hasYear = year !== undefined;
  const grade = useQuery({
    queryKey: ["gym", "grade", year],
    queryFn: () => api.gym.grade(year!),
    enabled: hasYear,
  });

  useEffect(() => {
    if (!invalidRequestedYear) return;
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("xn");
        return next;
      },
      { replace: true },
    );
  }, [invalidRequestedYear, setSearchParams]);

  function chooseYear(nextYear: number) {
    setYearPickerOpen(false);
    const next = new URLSearchParams(searchParams);
    if (nextYear === semesterTable.data?.now_xn) {
      next.delete("xn");
    } else {
      next.set("xn", String(nextYear));
    }
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page">
      <PageHeader title="体测成绩" back />

      <Section
        title={year === undefined ? "学年" : academicYearLabel(year)}
        action={
          <button
            className="button button--text button--small"
            type="button"
            aria-label={
              year === undefined ? "切换学年" : `切换学年，当前为${academicYearLabel(year)}`
            }
            aria-haspopup="dialog"
            aria-expanded={yearPickerOpen}
            disabled={!hasYear}
            onClick={() => setYearPickerOpen(true)}
          >
            <CalendarSync aria-hidden="true" />
            切换
          </button>
        }
      >
        {semesterTable.isPending && !hasYear ? <PageSkeleton rows={1} /> : null}
        {semesterTable.isError ? (
          <PageError error={semesterTable.error} onRetry={() => void semesterTable.refetch()} />
        ) : null}
        {hasYear ? (
          <QueryState query={grade} loadingRows={6}>
            {(result) => (
              <>
                <article
                  className="gym-grade-summary surface"
                  aria-label={`体测总评 ${result.score} 分，${result.grade}`}
                >
                  <div className="gym-grade-summary__score">
                    <div>
                      <p className="metric__label">体测总评</p>
                      <div className="gym-grade-summary__score-value">
                        <strong>{result.score}</strong>
                        <span>{result.grade}</span>
                      </div>
                    </div>
                    <Activity aria-hidden="true" />
                  </div>
                </article>

                <div className="metric-grid gym-grade-metrics">
                  {metricLabels.map(([key, label, weight]) => {
                    const metric = result[key];
                    return (
                      <div
                        className="metric"
                        role="group"
                        aria-label={`${label}，成绩 ${metric.grade}，${metric.score} 分，占比 ${weight}%，${metric.rank}`}
                        key={key}
                      >
                        <p className="metric__label">{label}</p>
                        <p className="metric__value">{metric.grade}</p>
                        <p className="muted text-sm">
                          {metric.score} 分 / 占比 {weight}%
                        </p>
                        <span className={metricBadgeClass(metric.color)}>{metric.rank}</span>
                      </div>
                    );
                  })}
                  <button
                    className="metric gym-eye-metric"
                    type="button"
                    aria-label={`查看视力详情，裸眼视力左眼 ${result.eye.sight.left.value}，右眼 ${result.eye.sight.right.value}`}
                    onClick={() => setEyeDetailsOpen(true)}
                  >
                    <span className="metric__label gym-eye-metric__line">视力</span>
                    <span className="metric__value gym-eye-metric__line">
                      {result.eye.sight.left.value} / {result.eye.sight.right.value}
                    </span>
                    <span className="muted text-sm gym-eye-metric__line">左眼 / 右眼</span>
                    <span className="gym-eye-metric__action">
                      查看详情
                      <ChevronRight aria-hidden="true" />
                    </span>
                  </button>
                </div>

                <section className="surface gym-grade-report" aria-label="体测报告信息">
                  <dl className="list">
                    <div className="data-row">
                      <dt className="data-row__label">成绩状态</dt>
                      <dd className="data-row__value">{result.report_status}</dd>
                    </div>
                    <div className="data-row">
                      <dt className="data-row__label">成绩类型</dt>
                      <dd className="data-row__value">{result.report_type}</dd>
                    </div>
                    <div className="data-row gym-grade-report__description">
                      <dt className="data-row__label">成绩描述</dt>
                      <dd className="data-row__value">{result.report_description}</dd>
                    </div>
                  </dl>
                </section>

                {eyeDetailsOpen ? (
                  <EyeDetailsDialog eye={result.eye} onClose={() => setEyeDetailsOpen(false)} />
                ) : null}
              </>
            )}
          </QueryState>
        ) : null}
      </Section>

      {yearPickerOpen && hasYear && semesterTable.data ? (
        <AcademicYearPickerDialog
          selected={year}
          current={semesterTable.data.now_xn}
          years={yearOptions}
          onSelect={chooseYear}
          onClose={() => setYearPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
