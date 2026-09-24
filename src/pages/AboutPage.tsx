import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Radio } from "lucide-react";
import { api } from "../api/api";
import {
  DataRow,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
} from "../components/ui";

export default function AboutPage() {
  const about = useQuery({ queryKey: ["about"], queryFn: api.system.about });
  const health = useQuery({ queryKey: ["health"], queryFn: api.system.health, retry: 1 });

  if (about.isPending)
    return (
      <div className="page">
        <PageSkeleton rows={4} />
      </div>
    );
  if (about.isError) {
    return (
      <div className="page">
        <PageHeader title="关于微生活" back />
        <PageError error={about.error} onRetry={() => void about.refetch()} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="关于微生活" description={about.data.slogans.join(" · ")} back />

      <section className="profile-heading">
        <div className="login-brand__mark" aria-hidden="true">
          微
        </div>
        <div>
          <h2>微生活</h2>
          <p className="muted">版本 {about.data.version}</p>
        </div>
      </section>

      <Section title="项目链接">
        <div className="surface list">
          <a className="menu-link" href={about.data.home} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            <span>项目主页</span>
            <span className="menu-link__meta muted text-sm">{about.data.home}</span>
          </a>
          <a className="menu-link" href={about.data.join} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            <span>加入我们</span>
            <span className="menu-link__meta muted text-sm">{about.data.join}</span>
          </a>
        </div>
      </Section>

      <Section title="服务状态">
        <div className="surface">
          <DataRow
            label="API 连接"
            value={health.isPending ? "检查中…" : health.isSuccess ? "正常" : "不可用"}
            detail={health.data ? `服务回应：${health.data.hello}` : undefined}
          />
        </div>
        {health.isError ? (
          <StatusMessage tone="warning">无法连接本地服务，个人数据页面暂时不可用。</StatusMessage>
        ) : (
          <StatusMessage tone="success">
            <Radio aria-hidden="true" />
            服务连接正常
          </StatusMessage>
        )}
      </Section>
    </div>
  );
}
