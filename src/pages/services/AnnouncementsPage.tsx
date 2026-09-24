import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Megaphone } from "lucide-react";
import { api } from "../../api/api";
import { EmptyState, PageError, PageHeader, PageSkeleton, Section } from "../../components/ui";
import { formatDateTime } from "../../utils/format";

export default function AnnouncementsPage() {
  const announcements = useQuery({ queryKey: ["announcements"], queryFn: api.announcement.list });

  if (announcements.isPending)
    return (
      <div className="page">
        <PageSkeleton rows={5} />
      </div>
    );
  if (announcements.isError) {
    return (
      <div className="page">
        <PageHeader title="校园公告" back />
        <PageError error={announcements.error} onRetry={() => void announcements.refetch()} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title="校园公告" description={`${announcements.data.length} 条校园动态`} back />
      <Section>
        {announcements.data.length ? (
          <div className="surface list">
            {announcements.data.map((item) => (
              <article className="record-item stack gap-8" key={item.id}>
                <div className="cluster spread gap-12">
                  <h2>{item.title}</h2>
                  <time className="muted text-sm">{formatDateTime(item.created_at)}</time>
                </div>
                <p className="text-pretty">{item.content}</p>
                {item.url ? (
                  <a
                    className="button button--ghost button--small"
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink aria-hidden="true" />
                    查看详情
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="暂无校园公告"
            description="服务动态和重要通知会显示在这里。"
            icon={Megaphone}
          />
        )}
      </Section>
    </div>
  );
}
