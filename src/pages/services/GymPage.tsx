import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { api } from "../../api/api";
import type { GymGrade } from "../../api/types";
import { EmptyState, PageError, PageHeader, PageSkeleton, Section, StatusMessage } from "../../components/ui";

const metricLabels: Array<[keyof Pick<GymGrade, "short_run" | "bmi" | "jump" | "pull_and_sit" | "run" | "sit_and_reach" | "vc">, string]> = [
  ["short_run", "短跑"],
  ["bmi", "体重指数"],
  ["jump", "立定跳远"],
  ["pull_and_sit", "引体 / 仰卧起坐"],
  ["run", "耐力跑"],
  ["sit_and_reach", "坐位体前屈"],
  ["vc", "肺活量"],
];

const eyeLabels: Array<[keyof GymGrade["eye"], string]> = [
  ["sight", "裸眼视力"],
  ["mirror", "戴镜视力"],
  ["ametropia", "屈光状态"],
];

export default function GymPage() {
  const grade = useQuery({ queryKey: ["gym", "grade", 2025], queryFn: () => api.gym.grade(2025) });
  const appointments = useQuery({ queryKey: ["gym", "appointments"], queryFn: api.gym.appointments });
  const queries = [grade, appointments];

  if (queries.some((query) => query.isPending)) return <div className="page"><PageSkeleton rows={8} /></div>;
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="体测" back />
        <PageError error={failed.error} onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      </div>
    );
  }

  const result = grade.data!;
  return (
    <div className="page">
      <PageHeader title="体测" description={`2025 学年 · ${result.report_type}`} back />
      <div className="summary-band surface">
        <div>
          <p className="muted text-sm">体测总评</p>
          <p className="summary-band__value">{result.score}</p>
          <p>{result.grade}</p>
        </div>
        <Activity aria-hidden="true" />
      </div>
      <StatusMessage tone={result.report_status === "已完成" ? "success" : "warning"}>
        {result.report_status} · {result.report_description}
      </StatusMessage>

      <Section title="单项成绩">
        <div className="metric-grid">
          {metricLabels.map(([key, label]) => {
            const metric = result[key];
            return (
              <div className="metric" key={key}>
                <p className="metric__label">{label}</p>
                <p className="metric__value">{metric.score}</p>
                <p className="muted text-sm">{metric.grade} · {metric.rank}</p>
                <span className="badge">{metric.color}</span>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="视力情况">
        <div className="surface list">
          {eyeLabels.map(([key, label]) => {
            const item = result.eye[key];
            return (
              <article className="record-item" key={key}>
                <h3>{label}</h3>
                <p className="text-sm">左眼 {item.left.value} · {item.left.description}</p>
                <p className="text-sm">右眼 {item.right.value} · {item.right.description}</p>
              </article>
            );
          })}
        </div>
      </Section>

      <Section title="预约信息">
        {appointments.data!.length ? (
          <div className="surface list">
            {appointments.data!.map((item) => (
              <article className="record-item stack gap-8" key={`${item.name}-${item.time}`}>
                <div className="cluster spread gap-12"><h3>{item.name}</h3><span className="badge badge--success">{item.status}</span></div>
                <p>{item.description}</p>
                <p className="muted text-sm">{item.show_date} · {item.time}</p>
                <p className="muted text-sm">测试类型：{item.test_type}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="暂无体测预约" description="成功预约后，时间与测试项目会显示在这里。" />}
      </Section>
    </div>
  );
}
