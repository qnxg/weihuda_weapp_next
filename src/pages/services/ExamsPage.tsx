import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { api } from "../../api/api";
import type { CustomExamScheduleRequest, ExamScheduleItem } from "../../api/types";
import { PageFootnotes } from "../../components/PageFootnotes";
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
import { useMinuteClock } from "../../hooks/useMinuteClock";
import { getExamStatus, type ExamDisplayItem, type ExamStatus } from "../../utils/exam";
import { formatDate } from "../../utils/format";

type ExamTab = "unfinished" | "finished";
const EXAM_PAGE_SIZE = 10;
const examSourceFootnote = "非自定义考试安排数据来源于教务系统。";
const unfinishedExamFootnotes = [examSourceFootnote] as const;
const finishedExamFootnotes = [
  examSourceFootnote,
  "已失效的考试安排是原来出现于教务系统，但是可能由于考试安排信息发生更改或是到了新的学期，之前的考试安排已经不存在，微生活将其标记为“已失效”。",
] as const;

const examStatusLabels: Record<ExamStatus, string> = {
  scheduled: "未开始",
  active: "考试中",
  completed: "已结束",
  invalid: "已失效",
};

const examStatusBadgeClasses: Record<ExamStatus, string> = {
  scheduled: "badge--brand",
  active: "badge--success",
  completed: "",
  invalid: "badge--warning",
};

function examTimeLabel(exam: ExamScheduleItem) {
  return `${exam.start_time || "开始待定"} – ${exam.end_time || "结束待定"}`;
}

function examVenueLabel(exam: ExamScheduleItem) {
  const venue = exam.classroom || exam.area || "地点待定";
  return exam.seat ? `${venue} · ${exam.seat}` : venue;
}

function examMetaLabel(exam: ExamScheduleItem, isCustom: boolean) {
  return isCustom ? "自定义考试" : exam.course_id || "教务安排";
}

function ExamTabs({ selected, onSelect }: { selected: ExamTab; onSelect: (tab: ExamTab) => void }) {
  const unfinishedRef = useRef<HTMLButtonElement>(null);
  const finishedRef = useRef<HTMLButtonElement>(null);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let next: ExamTab | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = selected === "unfinished" ? "finished" : "unfinished";
    }
    if (event.key === "Home") next = "unfinished";
    if (event.key === "End") next = "finished";
    if (!next) return;

    event.preventDefault();
    onSelect(next);
    (next === "unfinished" ? unfinishedRef : finishedRef).current?.focus();
  }

  return (
    <div className="segmented exam-tabs" role="tablist" aria-label="考试安排状态">
      <button
        className={selected === "unfinished" ? "is-active" : ""}
        id="exam-tab-unfinished"
        ref={unfinishedRef}
        type="button"
        role="tab"
        aria-controls="exam-tab-panel"
        aria-selected={selected === "unfinished"}
        tabIndex={selected === "unfinished" ? 0 : -1}
        onClick={() => onSelect("unfinished")}
        onKeyDown={handleKeyDown}
      >
        未结束
      </button>
      <button
        className={selected === "finished" ? "is-active" : ""}
        id="exam-tab-finished"
        ref={finishedRef}
        type="button"
        role="tab"
        aria-controls="exam-tab-panel"
        aria-selected={selected === "finished"}
        tabIndex={selected === "finished" ? 0 : -1}
        onClick={() => onSelect("finished")}
        onKeyDown={handleKeyDown}
      >
        已结束
      </button>
    </div>
  );
}

function ExamCard({
  item: { exam, status },
  onEdit,
  onDelete,
}: {
  item: ExamDisplayItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCustom = exam.customize_id !== null;
  const isEditDisabled = status === "completed" || status === "invalid";
  const badgeClass = examStatusBadgeClasses[status];

  return (
    <article
      className={`exam-card exam-card--${status}`}
      aria-label={`${exam.course_name}，${examStatusLabels[status]}`}
    >
      <div className="exam-card__content">
        <p className="exam-card__date">
          {exam.date ? <time dateTime={exam.date}>{formatDate(exam.date)}</time> : "日期待定"}
        </p>
        <span className={`badge exam-card__status${badgeClass ? ` ${badgeClass}` : ""}`}>
          {examStatusLabels[status]}
        </span>

        <h2 className="exam-card__title">{exam.course_name}</h2>
        <p className="exam-card__venue" title={examVenueLabel(exam)}>
          {examVenueLabel(exam)}
        </p>

        <p className="exam-card__meta" title={examMetaLabel(exam, isCustom)}>
          {examMetaLabel(exam, isCustom)}
        </p>
        <p className="exam-card__time tabular">{examTimeLabel(exam)}</p>
      </div>

      {isCustom ? (
        <footer className="exam-card__actions">
          <button
            className="exam-card__action"
            type="button"
            title={isEditDisabled ? "已结束的考试不能编辑" : undefined}
            disabled={isEditDisabled}
            onClick={onEdit}
          >
            <Pencil aria-hidden="true" />
            编辑
          </button>
          <button
            className="exam-card__action exam-card__action--danger"
            type="button"
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
            删除
          </button>
        </footer>
      ) : null}
    </article>
  );
}

function ExamEditor({
  exam,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  exam: ExamScheduleItem | null;
  pending: boolean;
  error: string;
  onSubmit: (input: CustomExamScheduleRequest) => void;
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
  const now = useMinuteClock();
  const [selectedTab, setSelectedTab] = useState<ExamTab>("unfinished");
  const [editing, setEditing] = useState<ExamScheduleItem | null | undefined>();
  const [deleting, setDeleting] = useState<ExamScheduleItem | null>(null);
  const [error, setError] = useState("");
  const recentExams = useQuery({
    queryKey: ["exams", "recent"],
    queryFn: () => api.exam.list("recent"),
    refetchInterval: 60_000,
  });
  const endedExams = useInfiniteQuery({
    queryKey: ["exams", "end"],
    queryFn: ({ pageParam }) => api.exam.list("end", pageParam),
    initialPageParam: 0,
    refetchInterval: 60_000,
    getNextPageParam: (lastPage, pages) =>
      lastPage.length === EXAM_PAGE_SIZE
        ? pages.reduce((count, page) => count + page.length, 0)
        : undefined,
  });
  const save = useMutation({
    mutationFn: (input: CustomExamScheduleRequest) =>
      editing && editing.customize_id !== null
        ? api.exam.update(editing.customize_id, input)
        : api.exam.create(input),
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
  const unfinished = (recentExams.data ?? []).map((exam) => ({
    exam,
    status: getExamStatus(exam, now),
  }));
  const finished = (endedExams.data?.pages.flat() ?? []).map((exam) => ({
    exam,
    status: getExamStatus(exam, now),
  }));
  const visibleExams = selectedTab === "unfinished" ? unfinished : finished;
  const selectedQuery = selectedTab === "unfinished" ? recentExams : endedExams;
  const selectedHasData =
    selectedTab === "unfinished" ? recentExams.data !== undefined : endedExams.data !== undefined;
  const initialError = selectedQuery.isError && !selectedHasData;
  const selectedRefetchError = selectedQuery.isRefetchError && selectedHasData;
  const retrySelectedQuery = () => {
    void selectedQuery.refetch();
  };

  return (
    <div className="page">
      <PageHeader title="考试安排" back />

      <ExamTabs selected={selectedTab} onSelect={setSelectedTab} />

      <div
        className="exam-tab-panel"
        id="exam-tab-panel"
        role="tabpanel"
        aria-labelledby={`exam-tab-${selectedTab}`}
        tabIndex={0}
      >
        <Section>
          <div className="exam-list">
            {selectedTab === "unfinished" ? (
              <button
                className="exam-add-card"
                type="button"
                aria-label="添加考试安排"
                title="添加考试安排"
                onClick={() => setEditing(null)}
              >
                <Plus aria-hidden="true" />
                <span>添加</span>
              </button>
            ) : null}
            {selectedQuery.isPending ? <PageSkeleton rows={5} /> : null}
            {initialError ? (
              <PageError error={selectedQuery.error} onRetry={retrySelectedQuery} />
            ) : null}
            {!selectedQuery.isPending && !initialError && visibleExams.length
              ? visibleExams.map((item, index) => (
                  <ExamCard
                    item={item}
                    key={`${item.exam.course_name}-${item.exam.customize_id}-${index}`}
                    onEdit={() => setEditing(item.exam)}
                    onDelete={() => setDeleting(item.exam)}
                  />
                ))
              : null}
            {!selectedQuery.isPending && !initialError && !visibleExams.length ? (
              <EmptyState
                title={selectedTab === "unfinished" ? "暂无未结束的考试" : "暂无已结束的考试"}
                description={
                  selectedTab === "unfinished"
                    ? "新的考试安排会显示在这里，也可以自行添加。"
                    : "已经结束或失效的考试安排会显示在这里。"
                }
              />
            ) : null}
            {selectedRefetchError ? (
              <PageError error={selectedQuery.error} onRetry={retrySelectedQuery} />
            ) : null}
            {selectedTab === "finished" && endedExams.isFetchNextPageError ? (
              <PageError error={endedExams.error} onRetry={() => void endedExams.fetchNextPage()} />
            ) : null}
            {selectedTab === "finished" &&
            endedExams.hasNextPage &&
            !endedExams.isFetchNextPageError ? (
              <button
                className="button button--text exam-load-more"
                type="button"
                disabled={endedExams.isFetchingNextPage}
                onClick={() => void endedExams.fetchNextPage()}
              >
                <ChevronDown aria-hidden="true" />
                {endedExams.isFetchingNextPage ? "正在加载…" : "加载更多"}
              </button>
            ) : null}
          </div>
        </Section>
        <PageFootnotes
          items={selectedTab === "unfinished" ? unfinishedExamFootnotes : finishedExamFootnotes}
          label={selectedTab === "unfinished" ? "未结束考试安排说明" : "已结束考试安排说明"}
        />
      </div>

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
          onConfirm={() => remove.mutate(deleting.customize_id!)}
        />
      ) : null}
    </div>
  );
}
