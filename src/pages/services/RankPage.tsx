import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type {
  Rank,
  RankDataSource,
  RankDisplay,
  RankRange,
  SemesterId,
  SemesterItem,
} from "../../api/types";
import { PageFootnotes } from "../../components/PageFootnotes";
import {
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  RadioGroup,
  Section,
  StatusMessage,
} from "../../components/ui";
import { formatDateTimeWithYear } from "../../utils/format";
import {
  academicYearLabel,
  academicYears,
  findCurrentSemester,
  findSemester,
  parseAcademicYear,
  parseSemesterId,
  semestersForYear,
} from "../../utils/semester";
import { formatRankScore, parseRankPosition } from "../../utils/rank";

const rankGroups: Array<[keyof Rank, string]> = [
  ["all", "全部课程"],
  ["compulsory", "必修课程"],
  ["core", "核心课程"],
];

const rankMetrics = [
  { label: "算术平均", scoreKey: "arithmetic", rankKey: "arithmetic_rank", valueType: "score" },
  { label: "加权平均", scoreKey: "weighted", rankKey: "weighted_rank", valueType: "score" },
  { label: "绩点", scoreKey: "gpa", rankKey: "gpa_rank", valueType: "gpa" },
] as const;

const rangeOptions: Array<{ value: RankRange; label: string }> = [
  { value: "major", label: "主修" },
  { value: "minor", label: "辅修" },
];

const dataSourceOptions: Array<{ value: RankDataSource; label: string }> = [
  { value: "total", label: "成绩主库" },
  { value: "execution", label: "执行方案" },
];

const displayOptions: Array<{ value: RankDisplay; label: string }> = [
  { value: "max", label: "最大成绩" },
  { value: "initial", label: "初修成绩" },
];

const schoolRankFootnotes = ["数据来源于教务系统。"];
const trustedRankFootnotes = ["数据来源于可信电子凭证。数据并非实时更新。"];

interface SchoolRankFilterForm {
  year: string;
  term: SemesterId | "all";
  range: RankRange;
  dataSource: RankDataSource;
  display: RankDisplay;
}

function semesterFilterLabel(
  { year, term }: Pick<SchoolRankFilterForm, "year" | "term">,
  semesters: readonly SemesterItem[],
) {
  if (year === "all") return "全部学年 全部学期";
  const parsedYear = Number(year);
  const yearLabel = Number.isInteger(parsedYear) ? academicYearLabel(parsedYear) : "学年待选择";
  if (term === "all") return `${yearLabel} 全部学期`;
  const semester = semesters.find((item) => item.xn === parsedYear && item.xq === term);
  return `${yearLabel} ${semester?.xq_text ?? "学期待选择"}`;
}

function schoolRankFilterSignature(filters: SchoolRankFilterForm) {
  return [filters.year, filters.term, filters.range, filters.dataSource, filters.display].join(":");
}

function RankPosition({ value }: { value: string | null }) {
  if (value === null) return null;
  const parsed = parseRankPosition(value);
  if (!parsed) return <strong className="rank-stat__rank">{value}</strong>;
  const { position, total, percentage } = parsed;

  return (
    <strong
      className="rank-stat__rank"
      aria-label={`第 ${position} 名，共 ${total} 人，排名百分比 ${percentage}%`}
    >
      <span className="rank-stat__rank-position" aria-hidden="true">
        {position}
      </span>
      <span className="rank-stat__rank-total" aria-hidden="true">
        /{total}
      </span>
      <span className="rank-stat__rank-percent" aria-hidden="true">
        ({percentage}%)
      </span>
    </strong>
  );
}

function RankSemesterDialog({
  selected,
  yearOptions,
  semesters,
  onSelect,
  onClose,
}: {
  selected: Pick<SchoolRankFilterForm, "year" | "term">;
  yearOptions: number[];
  semesters: readonly SemesterItem[];
  onSelect: (selection: Pick<SchoolRankFilterForm, "year" | "term">) => void;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState(selected);
  const allYearsSelected = selection.year === "all";
  const selectedYear = parseAcademicYear(selection.year);
  const termOptions = semestersForYear(semesters, selectedYear);

  function completeSelection(nextSelection: Pick<SchoolRankFilterForm, "year" | "term">) {
    onSelect(nextSelection);
    onClose();
  }

  return (
    <Modal title="选择学年学期" onClose={onClose}>
      <div className="rank-filter-semester-columns">
        <fieldset className="rank-filter-choice-group">
          <legend>学年</legend>
          <div className="rank-filter-choice-list rank-filter-choice-list--years">
            <button
              className={`rank-filter-choice${allYearsSelected ? " is-selected" : ""}`}
              type="button"
              aria-pressed={allYearsSelected}
              onClick={() => completeSelection({ year: "all", term: "all" })}
            >
              <span>全部学年</span>
            </button>
            {yearOptions.map((year) => {
              const value = String(year);
              return (
                <button
                  className={`rank-filter-choice${selection.year === value ? " is-selected" : ""}`}
                  key={year}
                  type="button"
                  aria-pressed={selection.year === value}
                  onClick={() =>
                    setSelection({
                      year: value,
                      term: "all",
                    })
                  }
                >
                  <span>{academicYearLabel(year)}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rank-filter-choice-group">
          <legend>学期</legend>
          <div className="rank-filter-choice-list">
            {[
              { value: "all" as const, label: "全部学期" },
              ...termOptions.map((semester) => ({
                value: semester.xq,
                label: semester.xq_text,
              })),
            ].map((option) => {
              const disabled = allYearsSelected && option.value !== "all";
              return (
                <button
                  className={`rank-filter-choice${
                    selection.term === option.value ? " is-selected" : ""
                  }${disabled ? " is-disabled" : ""}`}
                  key={option.value}
                  type="button"
                  aria-pressed={selection.term === option.value}
                  disabled={disabled}
                  onClick={() => completeSelection({ ...selection, term: option.value })}
                >
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

function RankPanel({ rank }: { rank: Rank }) {
  const [selectedGroup, setSelectedGroup] = useState<keyof Rank>("all");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = rankGroups.findIndex(([key]) => key === selectedGroup);
  const [, selectedLabel] = rankGroups[selectedIndex];
  const item = rank[selectedGroup];
  const hasScores = Boolean(item && rankMetrics.some(({ scoreKey }) => item[scoreKey] !== null));
  const hasRanks = Boolean(item && rankMetrics.some(({ rankKey }) => item[rankKey] !== null));
  const availableDataLabel =
    hasScores && hasRanks ? "成绩与排名" : hasScores ? "成绩" : hasRanks ? "排名" : "暂无数据";

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + rankGroups.length) % rankGroups.length;
    }
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % rankGroups.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = rankGroups.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    setSelectedGroup(rankGroups[nextIndex][0]);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="surface rank-report">
      <div className="rank-scope-tabs" role="tablist" aria-label="课程类型">
        {rankGroups.map(([key, label], index) => (
          <button
            className={`rank-scope-tab${selectedGroup === key ? " is-active" : ""}`}
            id={`rank-scope-tab-${key}`}
            key={key}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-controls="rank-scope-panel"
            aria-selected={selectedGroup === key}
            tabIndex={selectedGroup === key ? 0 : -1}
            onClick={() => setSelectedGroup(key)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className="rank-report__panel"
        id="rank-scope-panel"
        role="tabpanel"
        aria-labelledby={`rank-scope-tab-${selectedGroup}`}
        tabIndex={0}
      >
        {hasScores || hasRanks ? (
          <dl
            className="rank-stat-list"
            role="group"
            aria-label={`${selectedLabel}${availableDataLabel}`}
            key={selectedGroup}
          >
            {rankMetrics.map((metric) => (
              <div className="rank-stat" key={metric.scoreKey}>
                <dt>{metric.label}</dt>
                <dd
                  className={
                    hasScores && hasRanks
                      ? "rank-stat__values rank-stat__values--paired"
                      : "rank-stat__values rank-stat__values--single"
                  }
                >
                  {hasScores ? (
                    <span className="rank-stat__datum rank-stat__datum--score">
                      <span>成绩</span>
                      <strong className="rank-stat__score">
                        {formatRankScore(item?.[metric.scoreKey] ?? null, metric.valueType)}
                      </strong>
                    </span>
                  ) : null}
                  {hasRanks ? (
                    <span className="rank-stat__datum rank-stat__datum--rank">
                      <span>排名</span>
                      <RankPosition value={item?.[metric.rankKey] ?? null} />
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="rank-report__empty">
            <p>暂无成绩与排名数据</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolRankFilterControls({
  filters,
  yearOptions,
  semesters,
  pending,
  onApply,
}: {
  filters: SchoolRankFilterForm;
  yearOptions: number[];
  semesters: readonly SemesterItem[];
  pending: boolean;
  onApply: (filters: SchoolRankFilterForm) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [semesterDialogOpen, setSemesterDialogOpen] = useState(false);
  const filterSignature = schoolRankFilterSignature(filters);
  const [appliedSignature, setAppliedSignature] = useState(filterSignature);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSubmitFocus = useRef(false);

  if (appliedSignature !== filterSignature) {
    setAppliedSignature(filterSignature);
    setDraft(filters);
    setSemesterDialogOpen(false);
  }

  function updateDraft(next: Partial<SchoolRankFilterForm>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    restoreSubmitFocus.current = document.activeElement === submitButtonRef.current;
    onApply(draft);
  }

  useEffect(() => {
    if (!pending && restoreSubmitFocus.current) {
      restoreSubmitFocus.current = false;
      if (
        document.activeElement === document.body ||
        document.activeElement === submitButtonRef.current
      ) {
        submitButtonRef.current?.focus();
      }
    }
  }, [pending]);

  return (
    <form className="rank-filter" autoComplete="off" onSubmit={submit}>
      <div className="surface rank-filter-card">
        <div className="rank-filter-list">
          <button
            className="rank-filter-row"
            type="button"
            aria-label={`学年学期，当前选择：${semesterFilterLabel(draft, semesters)}`}
            onClick={() => setSemesterDialogOpen(true)}
          >
            <span className="rank-filter-row__label">学年学期</span>
            <span className="rank-filter-row__value">{semesterFilterLabel(draft, semesters)}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          <RadioGroup
            label="课程范围"
            name="rank-range"
            value={draft.range}
            options={rangeOptions}
            onChange={(range) => updateDraft({ range })}
          />
          <RadioGroup
            label="数据来源"
            name="rank-data-source"
            value={draft.dataSource}
            options={dataSourceOptions}
            onChange={(dataSource) => updateDraft({ dataSource })}
          />
          <RadioGroup
            label="成绩取值"
            name="rank-display"
            value={draft.display}
            options={displayOptions}
            onChange={(display) => updateDraft({ display })}
          />
        </div>
      </div>
      <button
        className="button button--primary rank-filter__submit"
        ref={submitButtonRef}
        type="submit"
        disabled={pending}
      >
        <Search aria-hidden="true" />
        {pending ? "查询中…" : "查询"}
      </button>

      {semesterDialogOpen ? (
        <RankSemesterDialog
          selected={draft}
          yearOptions={yearOptions}
          semesters={semesters}
          onSelect={updateDraft}
          onClose={() => setSemesterDialogOpen(false)}
        />
      ) : null}
    </form>
  );
}

export default function RankPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const source = searchParams.get("source") === "ca" ? "ca" : "school";
  const requestedYearValue = searchParams.get("xn");
  const requestedYear = parseAcademicYear(requestedYearValue);
  const allYearsSelected = requestedYearValue === "all";
  const hasExplicitYear = allYearsSelected || requestedYear !== undefined;
  const requestedTermValue = searchParams.get("xq");
  const requestedTerm = parseSemesterId(requestedTermValue);
  const allTermsSelected = requestedTermValue === "all";
  const range: RankRange = searchParams.get("range") === "minor" ? "minor" : "major";
  const dataSource: RankDataSource =
    searchParams.get("data_source") === "execution" ? "execution" : "total";
  const display: RankDisplay = searchParams.get("display") === "initial" ? "initial" : "max";
  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: () => api.semester.get(),
    enabled: source === "school",
  });
  const currentSemester = findCurrentSemester(semesterTable.data);
  const yearOptions = academicYears(semesterTable.data);
  const requestedSemester = findSemester(semesterTable.data, requestedYear, requestedTerm);
  const invalidExplicitSemester =
    semesterTable.data !== undefined &&
    requestedTermValue !== null &&
    !allTermsSelected &&
    requestedSemester === undefined;
  const validRequestedYear =
    requestedYear !== undefined && yearOptions.includes(requestedYear) ? requestedYear : undefined;
  const year = allYearsSelected
    ? undefined
    : invalidExplicitSemester
      ? currentSemester?.xn
      : (validRequestedYear ?? currentSemester?.xn);
  const term =
    allYearsSelected || allTermsSelected
      ? undefined
      : invalidExplicitSemester
        ? currentSemester?.xq
        : (requestedSemester?.xq ?? (hasExplicitYear ? undefined : currentSemester?.xq));
  const filtersReady = semesterTable.data !== undefined && currentSemester !== undefined;
  const appliedFilters: SchoolRankFilterForm = {
    year: allYearsSelected ? "all" : year === undefined ? "" : String(year),
    term: term ?? "all",
    range,
    dataSource,
    display,
  };
  const schoolRank = useQuery({
    queryKey: ["rank", "school", year ?? "all", term ?? "all", range, dataSource, display],
    queryFn: () =>
      api.rank.school({
        xn: year,
        xq: term,
        range,
        data_source: dataSource,
        display,
      }),
    enabled: source === "school" && filtersReady,
  });
  const caRank = useQuery({
    queryKey: ["rank", "ca"],
    queryFn: api.rank.ca,
    enabled: source === "ca",
  });
  const refreshCa = useMutation({
    mutationFn: api.rank.refreshCa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rank", "ca"] }),
  });
  const caUpdatedAt = caRank.data
    ? formatDateTimeWithYear(caRank.data.updated_at)
    : caRank.isPending
      ? "加载中…"
      : "暂无";

  function setSource(nextSource: "school" | "ca") {
    const next = new URLSearchParams(searchParams);
    next.set("source", nextSource);
    setSearchParams(next, { replace: true });
  }

  function applyFilters(filters: SchoolRankFilterForm) {
    const filtersChanged = Object.entries(filters).some(
      ([key, value]) => appliedFilters[key as keyof SchoolRankFilterForm] !== value,
    );
    if (!filtersChanged) {
      void schoolRank.refetch();
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("source", "school");
    next.set("xn", filters.year);
    next.set("xq", filters.year === "all" ? "all" : String(filters.term));
    next.set("range", filters.range);
    next.set("data_source", filters.dataSource);
    next.set("display", filters.display);
    setSearchParams(next, { replace: true });
  }

  const resultTitle = [
    year === undefined ? "全部学年" : academicYearLabel(year),
    term === undefined
      ? "全部学期"
      : (findSemester(semesterTable.data, year, term)?.xq_text ?? "学期待选择"),
  ].join(" ");
  const resultFilterDescription = [
    rangeOptions.find((option) => option.value === range)?.label,
    dataSourceOptions.find((option) => option.value === dataSource)?.label,
    displayOptions.find((option) => option.value === display)?.label,
  ].join(" / ");
  const rankLiveMessage =
    source === "school"
      ? !schoolRank.isFetching && schoolRank.data
        ? "排名数据已更新"
        : ""
      : !caRank.isFetching && !refreshCa.isPending
        ? caRank.data
          ? "可信电子凭证排名数据已更新"
          : caRank.isSuccess
            ? "可信电子凭证排名暂未生成"
            : ""
        : "";

  return (
    <div className="page">
      <PageHeader title="成绩排名" back />

      <div className="segmented" aria-label="排名来源">
        <button
          type="button"
          className={source === "school" ? "is-active" : ""}
          aria-pressed={source === "school"}
          onClick={() => setSource("school")}
        >
          教务系统
        </button>
        <button
          type="button"
          className={source === "ca" ? "is-active" : ""}
          aria-pressed={source === "ca"}
          onClick={() => setSource("ca")}
        >
          可信电子凭证
        </button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {rankLiveMessage}
      </p>

      {source === "school" ? (
        <>
          <Section title="筛选条件">
            {semesterTable.isPending && !filtersReady ? <PageSkeleton rows={1} /> : null}
            {semesterTable.isError && !filtersReady ? (
              <PageError error={semesterTable.error} onRetry={() => void semesterTable.refetch()} />
            ) : null}
            {filtersReady ? (
              <>
                <SchoolRankFilterControls
                  filters={appliedFilters}
                  yearOptions={yearOptions}
                  semesters={semesterTable.data!.items}
                  pending={schoolRank.isFetching}
                  onApply={applyFilters}
                />
              </>
            ) : null}
          </Section>

          {filtersReady ? (
            <Section
              className="rank-result-section"
              title={resultTitle}
              description={resultFilterDescription}
            >
              {schoolRank.isPending ? <PageSkeleton rows={3} /> : null}
              {schoolRank.isError ? (
                <PageError error={schoolRank.error} onRetry={() => void schoolRank.refetch()} />
              ) : null}
              {schoolRank.data ? <RankPanel rank={schoolRank.data} /> : null}
            </Section>
          ) : null}
        </>
      ) : (
        <Section>
          <button
            className="trusted-rank-update surface"
            type="button"
            onClick={() => refreshCa.mutate()}
            disabled={refreshCa.isPending}
            aria-busy={refreshCa.isPending}
            aria-label={`${refreshCa.isPending ? "正在更新" : "更新"}可信电子凭证排名，当前数据更新时间：${caUpdatedAt}`}
          >
            <RefreshCw
              className={
                refreshCa.isPending
                  ? "trusted-rank-update__icon is-spinning"
                  : "trusted-rank-update__icon"
              }
              aria-hidden="true"
            />
            <span className="trusted-rank-update__copy">
              <strong>更新</strong>
              <span>当前数据更新时间：{caUpdatedAt}</span>
            </span>
          </button>
          {refreshCa.isError ? (
            <StatusMessage tone="danger">{refreshCa.error.message}</StatusMessage>
          ) : null}
          {caRank.isPending ? <PageSkeleton rows={3} /> : null}
          {caRank.isError ? (
            <PageError error={caRank.error} onRetry={() => void caRank.refetch()} />
          ) : null}
          {caRank.data ? <RankPanel rank={caRank.data.rank} /> : null}
          {caRank.isSuccess && caRank.data === null ? (
            <EmptyState title="排名生成中" description="可信电子凭证排名尚未生成，可以稍后更新。" />
          ) : null}
        </Section>
      )}

      <PageFootnotes items={source === "school" ? schoolRankFootnotes : trustedRankFootnotes} />
    </div>
  );
}
