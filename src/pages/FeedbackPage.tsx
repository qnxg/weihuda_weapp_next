import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleHelp, Image as ImageIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { EmptyState, PageError, PageHeader, PageSkeleton, Section, StatusMessage } from "../components/ui";
import { formatDateTime } from "../utils/format";

function AuthenticatedImage({ id, alt }: { id: string; alt: string }) {
  const image = useQuery({ queryKey: ["image", id], queryFn: () => api.image.get(id) });
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!image.data) return;
    const url = URL.createObjectURL(image.data);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [image.data]);

  if (image.isPending) return <div className="skeleton feedback-image" aria-label="正在加载反馈图片" />;
  if (image.isError || !src) return <span className="muted text-sm">图片暂时无法显示</span>;
  return <img className="feedback-image" src={src} width="320" height="180" loading="lazy" alt={alt} />;
}

export default function FeedbackPage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [historySize, setHistorySize] = useState(20);
  const history = useQuery({
    queryKey: ["feedback", historySize],
    queryFn: () => api.feedback.list(1, historySize),
    placeholderData: (previous) => previous,
    enabled: isAuthenticated,
  });
  const submitFeedback = useMutation({
    mutationFn: async ({ form, file }: { form: HTMLFormElement; file: File | null }) => {
      const data = new FormData(form);
      const contact = String(data.get("contact") || "").trim();
      const description = String(data.get("description") || "").trim();
      if (isAuthenticated) {
        const image = file ? await api.image.upload(file) : null;
        return api.feedback.create({ contact: contact || null, description, img: image?.id || null });
      }
      return api.feedback.createPublic({
        stu_id: String(data.get("stu_id") || "").trim(),
        contact,
        description,
      });
    },
    onSuccess: async (_, { form }) => {
      form.reset();
      setMessage("反馈已提交，可以在本页查看处理进度。");
      if (isAuthenticated) await queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("image") as HTMLInputElement | null;
    submitFeedback.mutate({ form: event.currentTarget, file: input?.files?.[0] || null });
  }

  return (
    <div className="page">
      <PageHeader title="问题反馈" description="描述遇到的问题和期望结果" back />

      <Section title="提交反馈">
        <form className="form surface surface--padded" onSubmit={submit}>
          {!isAuthenticated ? (
            <div className="field">
              <label htmlFor="feedback-stu-id">学号</label>
              <input id="feedback-stu-id" name="stu_id" required inputMode="numeric" autoComplete="username" spellCheck={false} placeholder="例如 202208010101…" />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="feedback-contact">联系方式{isAuthenticated ? "（可选）" : ""}</label>
            <input id="feedback-contact" name="contact" required={!isAuthenticated} autoComplete="tel" placeholder="手机号或邮箱…" />
          </div>
          <div className="field">
            <label htmlFor="feedback-description">问题描述</label>
            <textarea id="feedback-description" name="description" required minLength={8} placeholder="请描述发生了什么、出现问题的页面和期望结果…" />
          </div>
          {isAuthenticated ? (
            <div className="field">
              <label htmlFor="feedback-image">截图（可选）</label>
              <input id="feedback-image" name="image" type="file" accept="image/png,image/jpeg,image/webp" />
            </div>
          ) : null}
          {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
          {submitFeedback.isError ? <StatusMessage tone="danger">{submitFeedback.error.message}</StatusMessage> : null}
          <button className="button button--primary button--block" type="submit" disabled={submitFeedback.isPending}>
            {submitFeedback.isPending ? "正在提交…" : "提交反馈"}
          </button>
        </form>
      </Section>

      {isAuthenticated ? (
        <Section title="我的反馈">
          {history.isPending ? <PageSkeleton rows={4} /> : null}
          {history.isError ? <PageError error={history.error} onRetry={() => void history.refetch()} /> : null}
          {history.data?.items.length ? (
            <div className="surface list">
              {history.data.items.map((item) => (
                <article className="record-item stack gap-8" key={item.id}>
                  <div className="cluster spread gap-12">
                    <span className={`badge ${item.status === "resolved" ? "badge--success" : "badge--warning"}`}>{item.status}</span>
                    <time className="muted text-sm">{formatDateTime(item.created_at)}</time>
                  </div>
                  <p>{item.description}</p>
                  <p className="muted text-sm">联系方式：{item.contact || "未提供"} · 更新于 {formatDateTime(item.updated_at)}</p>
                  {item.img ? <AuthenticatedImage id={item.img} alt={`反馈 ${item.id} 的附件`} /> : null}
                  {item.replies.map((reply, index) => (
                    <div className="status-message" key={`${reply.created_at}-${index}`}>
                      <strong>{reply.stu_id}</strong>
                      <p>{reply.msg}</p>
                      <time className="muted text-sm">{formatDateTime(reply.created_at)}</time>
                    </div>
                  ))}
                </article>
              ))}
            </div>
          ) : history.isSuccess ? <EmptyState title="还没有反馈记录" description="提交的问题和处理回复会显示在这里。" icon={CircleHelp} /> : null}
          {history.data ? <p className="muted text-sm">共 {history.data.total} 条反馈</p> : null}
          {history.data && history.data.total > history.data.items.length ? (
            <button className="button button--secondary button--block" type="button" disabled={history.isFetching} onClick={() => setHistorySize((size) => size + 20)}>
              {history.isFetching ? "正在加载…" : "加载更多反馈"}
            </button>
          ) : null}
        </Section>
      ) : (
        <EmptyState title="匿名反馈" description="你当前未登录，反馈提交成功后不会显示处理记录。" icon={ImageIcon} />
      )}
    </div>
  );
}
