import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import { EmptyState, PageHeader, QueryState, Section, StatusMessage } from "../components/ui";
import { formatDateTime } from "../utils/format";

export default function NoticesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [size, setSize] = useState(20);
  const filter = searchParams.get("status") === "unread" ? "unread" : "all";
  const notices = useQuery({
    queryKey: ["notices", filter, size],
    queryFn: () => api.notice.list(filter, 1, size),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === filter ? previous : undefined,
  });
  const markRead = useMutation({
    mutationFn: api.notice.read,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notices"] }),
  });

  return (
    <div className="page">
      <PageHeader
        title="通知"
        description={notices.data ? `共 ${notices.data.count} 条` : undefined}
        back
      />
      <div className="segmented" aria-label="筛选通知">
        <button
          className={filter === "all" ? "is-active" : ""}
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setSearchParams({ status: "all" })}
        >
          全部
        </button>
        <button
          className={filter === "unread" ? "is-active" : ""}
          type="button"
          aria-pressed={filter === "unread"}
          onClick={() => setSearchParams({ status: "unread" })}
        >
          未读
        </button>
      </div>

      <Section>
        <QueryState query={notices} loadingRows={5}>
          {(noticePage) => (
            <>
              {markRead.isError ? (
                <StatusMessage tone="danger">{markRead.error.message}</StatusMessage>
              ) : null}
              {noticePage.notices.length ? (
                <div className="surface list">
                  {noticePage.notices.map((notice) => (
                    <article
                      className={`notice-item stack gap-8${notice.status === "unread" ? " is-unread" : ""}`}
                      key={notice.id}
                    >
                      <div className="cluster spread gap-12">
                        <span
                          className={`badge ${notice.status === "unread" ? "badge--brand" : ""}`}
                        >
                          {notice.status === "unread" ? "未读" : "已读"}
                        </span>
                        <time className="muted text-sm">{formatDateTime(notice.created_at)}</time>
                      </div>
                      <p>{notice.content}</p>
                      <div className="cluster gap-8">
                        {notice.url ? (
                          <a
                            className="button button--ghost button--small"
                            href={notice.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink aria-hidden="true" />
                            打开链接
                          </a>
                        ) : null}
                        {notice.status === "unread" ? (
                          <button
                            className="button button--secondary button--small"
                            type="button"
                            disabled={markRead.isPending}
                            onClick={() => markRead.mutate(notice.id)}
                          >
                            <Check aria-hidden="true" />
                            标记已读
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={filter === "unread" ? "没有未读通知" : "暂无通知"}
                  description="新的校园提醒会显示在这里。"
                />
              )}
              {noticePage.count > noticePage.notices.length ? (
                <button
                  className="button button--secondary button--block"
                  type="button"
                  disabled={notices.isFetching}
                  onClick={() => setSize((value) => value + 20)}
                >
                  {notices.isFetching ? "正在加载…" : "加载更多通知"}
                </button>
              ) : null}
            </>
          )}
        </QueryState>
      </Section>
    </div>
  );
}
