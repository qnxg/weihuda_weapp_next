import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Radio, RotateCcw } from "lucide-react";
import { api } from "../api/api";
import { DataRow, PageHeader, QueryState, Section, StatusMessage } from "../components/ui";

export default function AboutPage() {
  const about = useQuery({ queryKey: ["about"], queryFn: api.system.about });
  const health = useQuery({ queryKey: ["health"], queryFn: api.system.health, retry: 1 });

  return (
    <div className="page">
      <PageHeader title="关于微生活" description={about.data?.slogans.join(" · ")} back />

      <QueryState query={about} loadingRows={4}>
        {(metadata) => (
          <>
            <section className="profile-heading">
              <div className="login-brand__mark" aria-hidden="true">
                微
              </div>
              <div>
                <h2>微生活</h2>
                <p className="muted">版本 {metadata.version}</p>
              </div>
            </section>

            <Section title="项目链接">
              <div className="surface list">
                <a className="menu-link" href={metadata.home} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  <span>项目主页</span>
                  <span className="menu-link__meta muted text-sm">{metadata.home}</span>
                </a>
                <a className="menu-link" href={metadata.join} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  <span>加入我们</span>
                  <span className="menu-link__meta muted text-sm">{metadata.join}</span>
                </a>
              </div>
            </Section>
          </>
        )}
      </QueryState>

      <Section title="服务状态">
        <div className="surface">
          <DataRow
            label="API 连接"
            value={health.isPending ? "检查中…" : health.isSuccess ? "正常" : "不可用"}
            detail={health.data ? `服务回应：${health.data.hello}` : undefined}
          />
        </div>
        {health.isError ? (
          <div className="cluster spread gap-8">
            <StatusMessage tone="warning">无法连接本地服务，个人数据页面暂时不可用。</StatusMessage>
            <button
              className="button button--text button--small"
              type="button"
              onClick={() => void health.refetch()}
            >
              <RotateCcw aria-hidden="true" />
              重试
            </button>
          </div>
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
