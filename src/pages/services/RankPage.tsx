import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { Rank, RankDataSource, RankDisplay, RankRange, RankTerm } from "../../api/types";
import {
  EmptyState,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
} from "../../components/ui";
import { formatDateTimeWithYear } from "../../utils/format";
import {
  academicYearLabel,
  buildAcademicYears,
  isRankTerm,
  parseAcademicYear,
  rankTermOptions,
} from "../../utils/semester";

const rankGroups: Array<[keyof Rank, string]> = [
  ["all", "全部课程"],
  ["compulsory", "必修课程"],
  ["core", "核心课程"],
];

const rankMetrics = [
  { label: "算术平均", scoreKey: "arithmetic", rankKey: "arithmetic_rank" },
  { label: "加权平均", scoreKey: "weighted", rankKey: "weighted_rank" },
  { label: "GPA", scoreKey: "gpa", rankKey: "gpa_rank" },
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

interface SchoolRankFilterForm {
  year: string;
  term: RankTerm | "all";
  range: RankRange;
  dataSource: RankDataSource;
  display: RankDisplay;
}

function RankPanel({ rank }: { rank: Rank }) {
  return (
    <div className="surface list rank-list">
      {rankGroups.map(([key, label]) => {
        const item = rank[key];
        const hasScores = Boolean(
          item && rankMetrics.some(({ scoreKey }) => item[scoreKey] !== null),
        );
        const hasRanks = Boolean(item && rankMetrics.some(({ rankKey }) => item[rankKey] !== null));
        const availableDataLabel =
          hasScores && hasRanks ? "成绩与排名" : hasScores ? "成绩" : "排名";

        return (
          <article className="rank-group" key={key}>
            <h3 className="rank-group__title">{label}</h3>
            {hasScores || hasRanks ? (
              <table className="rank-data-table" aria-label={`${label}${availableDataLabel}`}>
                <thead>
                  <tr>
                    <th scope="col">项目</th>
                    {rankMetrics.map((metric) => (
                      <th scope="col" key={metric.scoreKey}>
                        {metric.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasScores ? (
                    <tr className="rank-data-table__scores">
                      <th scope="row">成绩</th>
                      {rankMetrics.map((metric) => (
                        <td key={metric.scoreKey}>{item?.[metric.scoreKey] ?? "—"}</td>
                      ))}
                    </tr>
                  ) : null}
                  {hasRanks ? (
                    <tr className="rank-data-table__ranks">
                      <th scope="row">排名</th>
                      {rankMetrics.map((metric) => (
                        <td key={metric.rankKey}>{item?.[metric.rankKey] ?? "—"}</td>
                      ))}
                    </tr>
                  ) : null}
                </tbody>
              </table>
            ) : (
              <p className="rank-group__empty">暂无成绩与排名数据</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function SchoolRankFilterControls({
  filters,
  yearOptions,
  pending,
  onApply,
}: {
  filters: SchoolRankFilterForm;
  yearOptions: number[];
  pending: boolean;
  onApply: (filters: SchoolRankFilterForm) => void;
}) {
  const [draft, setDraft] = useState(filters);

  function updateDraft(next: Partial<SchoolRankFilterForm>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply(draft);
  }

  return (
    <form className="academic-filter-grid" onSubmit={submit}>
      <div className="field">
        <label htmlFor="rank-year">学年</label>
        <select
          id="rank-year"
          value={draft.year}
          onChange={(event) =>
            updateDraft({
              year: event.currentTarget.value,
              term: event.currentTarget.value === "all" ? "all" : draft.term,
            })
          }
        >
          <option value="all">全部学年</option>
          {yearOptions.map((option) => (
            <option key={option} value={option}>
              {academicYearLabel(option)}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rank-term">学期</label>
        <select
          id="rank-term"
          value={draft.term}
          disabled={draft.year === "all"}
          onChange={(event) =>
            updateDraft({
              term: event.currentTarget.value as RankTerm | "all",
            })
          }
        >
          <option value="all">全部学期</option>
          {rankTermOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rank-range">课程范围</label>
        <select
          id="rank-range"
          value={draft.range}
          onChange={(event) => updateDraft({ range: event.currentTarget.value as RankRange })}
        >
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="rank-data-source">数据来源</label>
        <select
          id="rank-data-source"
          value={draft.dataSource}
          onChange={(event) =>
            updateDraft({
              dataSource: event.currentTarget.value as RankDataSource,
            })
          }
        >
          {dataSourceOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field academic-filter-grid__wide">
        <label htmlFor="rank-display">成绩取值</label>
        <select
          id="rank-display"
          value={draft.display}
          onChange={(event) => updateDraft({ display: event.currentTarget.value as RankDisplay })}
        >
          {displayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        className="button button--primary academic-filter-grid__wide"
        type="submit"
        disabled={pending}
      >
        <Search aria-hidden="true" />
        {pending ? "查询中…" : "查询排名"}
      </button>
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
  const requestedTerm = isRankTerm(requestedTermValue) ? requestedTermValue : undefined;
  const allTermsSelected = requestedTermValue === "all";
  const range: RankRange = searchParams.get("range") === "minor" ? "minor" : "major";
  const dataSource: RankDataSource =
    searchParams.get("data_source") === "execution" ? "execution" : "total";
  const display: RankDisplay = searchParams.get("display") === "initial" ? "initial" : "max";
  const currentSemester = useQuery({
    queryKey: ["semester", "current"],
    queryFn: () => api.semester.get(),
    enabled: source === "school",
  });
  const currentTerm = isRankTerm(currentSemester.data?.xq) ? currentSemester.data.xq : undefined;
  const year = allYearsSelected ? undefined : (requestedYear ?? currentSemester.data?.xn);
  const term =
    allYearsSelected || allTermsSelected
      ? undefined
      : (requestedTerm ?? (hasExplicitYear ? undefined : currentTerm));
  const filtersReady =
    allYearsSelected || requestedYear !== undefined || currentSemester.data !== undefined;
  const yearOptions = buildAcademicYears(currentSemester.data?.xn, requestedYear);
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
    next.set("xq", filters.year === "all" ? "all" : filters.term);
    next.set("range", filters.range);
    next.set("data_source", filters.dataSource);
    next.set("display", filters.display);
    setSearchParams(next, { replace: true });
  }

  const resultDescription = [
    year === undefined ? "全部学年" : academicYearLabel(year),
    term === undefined
      ? "全部学期"
      : rankTermOptions.find((option) => option.value === term)?.label,
    rangeOptions.find((option) => option.value === range)?.label,
    dataSourceOptions.find((option) => option.value === dataSource)?.label,
    displayOptions.find((option) => option.value === display)?.label,
  ].join(" · ");
  const rankLiveMessage =
    source === "school"
      ? !schoolRank.isFetching && schoolRank.data
        ? "排名数据已更新"
        : ""
      : !caRank.isFetching && !refreshCa.isPending
        ? caRank.data
          ? "可信凭证排名数据已更新"
          : caRank.isSuccess
            ? "可信凭证排名暂未生成"
            : ""
        : "";

  return (
    <div className="page">
      <PageHeader title="成绩排名" description="教务系统与可信凭证" back />

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
          可信凭证
        </button>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {rankLiveMessage}
      </p>

      {source === "school" ? (
        <>
          <Section title="筛选条件">
            {currentSemester.isPending && !filtersReady ? <PageSkeleton rows={1} /> : null}
            {currentSemester.isError && !filtersReady ? (
              <PageError
                error={currentSemester.error}
                onRetry={() => void currentSemester.refetch()}
              />
            ) : null}
            {filtersReady ? (
              <>
                <SchoolRankFilterControls
                  key={[
                    appliedFilters.year,
                    appliedFilters.term,
                    appliedFilters.range,
                    appliedFilters.dataSource,
                    appliedFilters.display,
                  ].join(":")}
                  filters={appliedFilters}
                  yearOptions={yearOptions}
                  pending={schoolRank.isFetching}
                  onApply={applyFilters}
                />
                {currentSemester.isError ? (
                  <div className="cluster spread gap-8">
                    <StatusMessage tone="warning">可选学年范围暂时无法更新。</StatusMessage>
                    <button
                      className="button button--text button--small"
                      type="button"
                      onClick={() => void currentSemester.refetch()}
                    >
                      重试
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </Section>

          {filtersReady ? (
            <Section title="排名结果" description={resultDescription}>
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
            aria-label={`${refreshCa.isPending ? "正在更新" : "更新"}可信凭证排名，当前数据更新时间：${caUpdatedAt}`}
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
            <EmptyState title="排名生成中" description="可信凭证排名尚未生成，可以稍后更新。" />
          ) : null}
        </Section>
      )}
    </div>
  );
}
