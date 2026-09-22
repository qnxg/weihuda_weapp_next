import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type { Grade, Rank } from "../../api/types";
import { EmptyState, Modal, PageError, PageHeader, PageSkeleton, Section, StatusMessage } from "../../components/ui";
import { formatDateTime } from "../../utils/format";

const rankGroups: Array<[keyof Rank, string]> = [
  ["all", "全部课程"],
  ["compulsory", "必修课程"],
  ["core", "核心课程"],
];

function RankPanel({ rank }: { rank: Rank }) {
  return (
    <div className="surface list">
      {rankGroups.map(([key, label]) => {
        const item = rank[key];
        return (
          <div className="record-item stack gap-8" key={key}>
            <h3>{label}</h3>
            {item ? (
              <div className="metric-grid metric-grid--rank">
                <div className="metric"><p className="metric__label">算术平均</p><p className="metric__value">{item.arithmetic ?? "—"}</p><p className="muted text-sm">排名 {item.arithmetic_rank ?? "—"}</p></div>
                <div className="metric"><p className="metric__label">加权平均</p><p className="metric__value">{item.weighted ?? "—"}</p><p className="muted text-sm">排名 {item.weighted_rank ?? "—"}</p></div>
                <div className="metric"><p className="metric__label">GPA</p><p className="metric__value">{item.gpa ?? "—"}</p><p className="muted text-sm">排名 {item.gpa_rank ?? "—"}</p></div>
              </div>
            ) : <p className="muted text-sm">这一分类暂时没有排名数据。</p>}
          </div>
        );
      })}
    </div>
  );
}

function GradeSummary({ grade }: { grade: Grade }) {
  const hasDetail = Boolean(grade.jx0404id);
  return (
    <>
      <div className="min-w-0">
        <h3 className="text-clamp-2">{grade.course_name}</h3>
        <p className="muted text-sm">{grade.course_id} · {grade.credit} 学分 · {grade.grade_type}</p>
        <p className="muted text-sm">{grade.course_type1 || "未分类"} / {grade.course_type2}{grade.grade_tag ? ` · ${grade.grade_tag}` : ""}</p>
      </div>
      <div className="grade-score">
        <strong>{grade.score}</strong>
        <span>{hasDetail ? `GPA ${grade.gpa ?? "—"}` : "暂无明细"}</span>
      </div>
    </>
  );
}

export default function GradesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selected, setSelected] = useState<Grade | null>(null);
  const source = searchParams.get("source") === "ca" ? "ca" : "school";
  const year = 2026;
  const term = "autumn";
  const grades = useQuery({ queryKey: ["grades", year, term], queryFn: () => api.grade.list(year, term) });
  const schoolRank = useQuery({
    queryKey: ["rank", "school", year, term],
    queryFn: () => api.rank.school(year, term),
    enabled: source === "school",
  });
  const caRank = useQuery({ queryKey: ["rank", "ca"], queryFn: api.rank.ca, enabled: source === "ca" });
  const detail = useQuery({
    queryKey: ["grade", "detail", selected?.jx0404id],
    queryFn: () => api.grade.detail(selected!.jx0404id!),
    enabled: Boolean(selected?.jx0404id),
  });
  const refreshCa = useMutation({
    mutationFn: api.rank.refreshCa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rank", "ca"] }),
  });
  const activeRank = source === "ca" ? caRank : schoolRank;

  if (grades.isPending) return <div className="page"><PageSkeleton rows={7} /></div>;
  if (grades.isError) {
    return (
      <div className="page">
        <PageHeader title="成绩与排名" back />
        <PageError error={grades.error} onRetry={() => void grades.refetch()} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="成绩与排名" description={`${year} 秋季学期`} back />

      <Section
        title="排名"
        action={source === "ca" ? (
          <button className="button button--ghost button--small" type="button" onClick={() => refreshCa.mutate()} disabled={refreshCa.isPending}>
            <RefreshCw aria-hidden="true" />{refreshCa.isPending ? "更新中…" : "更新"}
          </button>
        ) : null}
      >
        <div className="segmented">
          <button type="button" className={source === "school" ? "is-active" : ""} aria-pressed={source === "school"} onClick={() => setSearchParams({ source: "school" })}>教务系统</button>
          <button type="button" className={source === "ca" ? "is-active" : ""} aria-pressed={source === "ca"} onClick={() => setSearchParams({ source: "ca" })}>可信凭证</button>
        </div>
        {source === "ca" && caRank.data ? <p className="muted text-sm">更新时间：{formatDateTime(caRank.data.updated_at)}</p> : null}
        {refreshCa.isError ? <StatusMessage tone="danger">{refreshCa.error.message}</StatusMessage> : null}
        {activeRank.isPending ? <PageSkeleton rows={3} /> : null}
        {activeRank.isError ? <PageError error={activeRank.error} onRetry={() => void activeRank.refetch()} /> : null}
        {source === "school" && schoolRank.data ? <RankPanel rank={schoolRank.data} /> : null}
        {source === "ca" && caRank.data ? <RankPanel rank={caRank.data.rank} /> : null}
        {source === "ca" && caRank.isSuccess && caRank.data === null ? (
          <EmptyState title="排名生成中" description="可信凭证排名尚未生成，可以稍后更新。" />
        ) : null}
      </Section>

      <Section title="课程成绩" description={`${grades.data!.length} 门课程`}>
        {grades.data!.length ? (
          <div className="surface list">
            {grades.data!.map((grade) => grade.jx0404id ? (
              <button className="data-row grade-row" type="button" key={grade.course_id} onClick={() => setSelected(grade)}>
                <GradeSummary grade={grade} />
              </button>
            ) : (
              <div className="data-row grade-row grade-row--static" key={grade.course_id}>
                <GradeSummary grade={grade} />
              </div>
            ))}
          </div>
        ) : <EmptyState title="暂无成绩" description="当前学期还没有可查询的成绩。" />}
      </Section>

      {selected ? (
        <Modal title={selected.course_name} description={`课程号 ${selected.course_id}`} onClose={() => setSelected(null)}>
          {detail.isPending ? <PageSkeleton rows={3} /> : null}
          {detail.isError ? <PageError error={detail.error} onRetry={() => void detail.refetch()} /> : null}
          {detail.data?.length ? (
            <div className="surface list">
              {detail.data.map((item) => (
                <div className="data-row" key={item.name}>
                  <div><strong>{item.name}</strong><p className="muted text-sm">占比 {item.percentage}</p></div>
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
