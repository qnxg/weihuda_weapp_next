import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../api/api";
import type { CustomExamRequest, Exam } from "../../api/types";
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
} from "../../components/ui";
import { formatDate } from "../../utils/format";

function ExamEditor({
  exam,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  exam: Exam | null;
  pending: boolean;
  error: string;
  onSubmit: (input: CustomExamRequest) => void;
  onClose: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      course_name: String(data.get("course_name") || "").trim(),
      area: String(data.get("area") || "").trim(),
      classroom: String(data.get("classroom") || "").trim(),
      seat: String(data.get("seat") || "").trim(),
      date: String(data.get("date") || ""),
      start_time: String(data.get("start_time") || ""),
      end_time: String(data.get("end_time") || ""),
    });
  }

  return (
    <Modal title={exam ? "编辑考试安排" : "添加考试安排"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="exam-course">课程名称</label>
          <input
            id="exam-course"
            name="course_name"
            defaultValue={exam?.course_name}
            required
            placeholder="例如 数据结构…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="exam-area">校区</label>
          <input
            id="exam-area"
            name="area"
            defaultValue={exam?.area || ""}
            required
            placeholder="例如 南校区…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="exam-room">考场</label>
          <input
            id="exam-room"
            name="classroom"
            defaultValue={exam?.classroom || ""}
            required
            placeholder="例如 综 101…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="exam-seat">座位号</label>
          <input
            id="exam-seat"
            name="seat"
            defaultValue={exam?.seat || ""}
            required
            inputMode="numeric"
            placeholder="例如 42…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="exam-date">日期</label>
          <input id="exam-date" name="date" type="date" defaultValue={exam?.date || ""} required />
        </div>
        <div className="cluster gap-8">
          <div className="field flex-1">
            <label htmlFor="exam-start">开始</label>
            <input
              id="exam-start"
              name="start_time"
              type="time"
              defaultValue={exam?.start_time || ""}
              required
            />
          </div>
          <div className="field flex-1">
            <label htmlFor="exam-end">结束</label>
            <input
              id="exam-end"
              name="end_time"
              type="time"
              defaultValue={exam?.end_time || ""}
              required
            />
          </div>
        </div>
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        <button className="button button--primary button--block" type="submit" disabled={pending}>
          {pending ? "正在保存…" : "保存考试"}
        </button>
      </form>
    </Modal>
  );
}

export default function ExamsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Exam | null | undefined>();
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const exams = useQuery({ queryKey: ["exams"], queryFn: api.exam.list });
  const save = useMutation({
    mutationFn: (input: CustomExamRequest) =>
      editing ? api.exam.update(editing.customize_id, input) : api.exam.create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      setEditing(undefined);
      setError("");
    },
    onError: (reason) => setError(reason instanceof Error ? reason.message : "考试安排保存失败。"),
  });
  const remove = useMutation({
    mutationFn: api.exam.remove,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["exams"] });
      setDeleting(null);
    },
  });

  if (exams.isPending)
    return (
      <div className="page">
        <PageSkeleton rows={5} />
      </div>
    );
  if (exams.isError) {
    return (
      <div className="page">
        <PageHeader title="考试安排" back />
        <PageError error={exams.error} onRetry={() => void exams.refetch()} />
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="考试安排"
        description={`近期 ${exams.data.length} 场考试`}
        back
        action={
          <button
            className="icon-button"
            type="button"
            aria-label="添加自定义考试"
            onClick={() => setEditing(null)}
          >
            <Plus aria-hidden="true" />
          </button>
        }
      />

      <Section>
        {exams.data.length ? (
          <div className="surface list">
            {exams.data.map((exam, index) => (
              <article
                className="exam-item stack gap-8"
                key={`${exam.course_name}-${exam.customize_id}-${index}`}
              >
                <div className="cluster spread gap-12">
                  <div className="min-w-0">
                    <p className="muted text-sm">
                      {exam.date ? formatDate(exam.date) : "日期待定"}
                    </p>
                    <h2>{exam.course_name}</h2>
                  </div>
                  <span className={`badge ${exam.customize_id > 0 ? "badge--brand" : ""}`}>
                    {exam.customize_id > 0 ? "自定义" : "教务"}
                  </span>
                </div>
                <p className="cluster gap-4">
                  <MapPin aria-hidden="true" />
                  {exam.area || "校区待定"} · {exam.classroom || "考场待定"}
                </p>
                <p className="muted text-sm">
                  时间 {exam.start_time || "待定"}–{exam.end_time || "待定"} · 座位{" "}
                  {exam.seat || "待定"}
                </p>
                <p className="muted text-sm">课程号 {exam.course_id || "自定义考试"}</p>
                {exam.customize_id > 0 ? (
                  <div className="cluster gap-8">
                    <button
                      className="button button--ghost button--small"
                      type="button"
                      onClick={() => setEditing(exam)}
                    >
                      <Pencil aria-hidden="true" />
                      编辑
                    </button>
                    <button
                      className="button button--ghost button--small text-danger"
                      type="button"
                      onClick={() => setDeleting(exam)}
                    >
                      <Trash2 aria-hidden="true" />
                      删除
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="暂无考试安排"
            description="新的考试安排会显示在这里，也可以自行添加。"
          />
        )}
      </Section>

      {editing !== undefined ? (
        <ExamEditor
          exam={editing}
          pending={save.isPending}
          error={error}
          onSubmit={(input) => save.mutate(input)}
          onClose={() => setEditing(undefined)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="删除考试安排？"
          description={`“${deleting.course_name}”会从自定义考试中移除。`}
          confirmLabel="删除考试"
          pending={remove.isPending}
          error={remove.isError ? remove.error.message : undefined}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting.customize_id)}
        />
      ) : null}
    </div>
  );
}
