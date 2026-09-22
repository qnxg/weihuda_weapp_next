import { useMutation, useQuery } from "@tanstack/react-query";
import { FlaskConical, Mail, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../api/api";
import { EmptyState, PageError, PageHeader, PageSkeleton, Section, StatusMessage } from "../../components/ui";
import { formatDateTime, weekdays } from "../../utils/format";

export default function LabPage() {
  const [bindMessage, setBindMessage] = useState("");
  const schedule = useQuery({ queryKey: ["lab", "schedule"], queryFn: api.lab.schedule });
  const grade = useQuery({ queryKey: ["lab", "grade", 2026, "autumn"], queryFn: () => api.lab.grade(2026, "autumn") });
  const bind = useMutation({
    mutationFn: api.lab.bind,
    onSuccess: () => setBindMessage("实验平台账号已绑定。"),
  });
  const queries = [schedule, grade];

  if (queries.some((query) => query.isPending)) return <div className="page"><PageSkeleton rows={7} /></div>;
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="大物实验" back />
        <PageError error={failed.error} onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      </div>
    );
  }

  function submitBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    bind.mutate(String(data.get("password") || ""));
  }

  return (
    <div className="page">
      <PageHeader title="大物实验" description={`${grade.data!.course_name} · 总评 ${grade.data!.course_score ?? "待发布"}`} back />

      <Section title="实验安排">
        {schedule.data!.length ? (
          <div className="surface list">
            {schedule.data!.map((item) => (
              <article className="record-item stack gap-8" key={`${item.name}-${item.date_time}`}>
                <div className="cluster spread gap-12"><h3>{item.name}</h3><span className="badge badge--brand">第 {item.week} 周 {weekdays[item.day - 1]}</span></div>
                <p>{item.course} · {item.teacher}</p>
                <p className="muted text-sm">{formatDateTime(item.date_time)} · {item.place} · 座位 {item.seat}</p>
                <div className="cluster gap-8">
                  {item.phone ? <a className="button button--ghost button--small" href={`tel:${item.phone}`}><Phone aria-hidden="true" />联系教师</a> : null}
                  {item.email ? <a className="button button--ghost button--small" href={`mailto:${item.email}`}><Mail aria-hidden="true" />发送邮件</a> : null}
                  {!item.phone && !item.email ? <span className="muted text-sm">暂无联系方式</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="暂无实验安排" description="新的实验排期会显示在这里。" icon={FlaskConical} />}
      </Section>

      <Section title="实验成绩">
        {grade.data!.labs.length ? (
          <div className="surface list">
            {grade.data!.labs.map((lab) => (
              <article className="record-item stack gap-8" key={lab.lab_name}>
                <div className="cluster spread gap-12"><h3>{lab.lab_name}</h3><strong>{lab.score}</strong></div>
                <p className="muted text-sm">出勤：{lab.attendance || "未记录"}</p>
                {lab.details.map((detail) => (
                  <div className="cluster spread text-sm" key={detail.name}><span>{detail.name}</span><strong>{detail.score ?? "待发布"}</strong></div>
                ))}
              </article>
            ))}
          </div>
        ) : <EmptyState title="暂无实验成绩" description="成绩发布后会显示评分组成。" />}
      </Section>

      <Section title="绑定实验平台" description="绑定信息只用于同步实验安排与成绩。">
        <form className="form surface surface--padded" onSubmit={submitBind}>
          <div className="field"><label htmlFor="lab-password">实验平台密码</label><input id="lab-password" name="password" type="password" autoComplete="current-password" required placeholder="输入平台密码…" /></div>
          {bindMessage ? <StatusMessage tone="success">{bindMessage}</StatusMessage> : null}
          {bind.isError ? <StatusMessage tone="danger">{bind.error.message}</StatusMessage> : null}
          <button className="button button--secondary button--block" type="submit" disabled={bind.isPending}>{bind.isPending ? "正在绑定…" : "绑定账号"}</button>
        </form>
      </Section>
    </div>
  );
}
