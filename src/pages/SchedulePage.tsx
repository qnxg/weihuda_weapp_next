import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import type { Course, CustomCourseRequest, TableSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import {
  AuthPrompt,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
} from "../components/ui";
import { courseSessionKey, courseSessionPeriodLabel, groupCourseSessions } from "../utils/course";
import { currentWeekday, dateForSemesterDay, getCurrentWeek, termName, weekdays } from "../utils/format";

const dayNumberFormatter = new Intl.DateTimeFormat("zh-CN", { day: "numeric" });

function parseNumberList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[,，\s]+/)
    .map(Number)
    .filter((item) => Number.isInteger(item) && item > 0);
}

function CourseEditor({
  course,
  relatedCourses,
  week,
  day,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  course: Course | null;
  relatedCourses: Course[];
  week: number;
  day: number;
  pending: boolean;
  error: string;
  onSubmit: (input: CustomCourseRequest) => void;
  onClose: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      course_name: String(data.get("course_name") || "").trim(),
      weeks: parseNumberList(data.get("weeks")),
      day: Number(data.get("day")),
      times: parseNumberList(data.get("times")),
      place: String(data.get("place") || "").trim() || null,
      teacher: String(data.get("teacher") || "").trim() || null,
    });
  }

  const times = course
    ? relatedCourses.filter((item) => item.customize_id === course.customize_id).map((item) => item.time)
    : [1];

  return (
    <Modal
      title={course ? "编辑自定义课程" : "添加自定义课程"}
      description="周次和节次可以用逗号分隔。"
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="course-name">课程名称</label>
          <input id="course-name" name="course_name" defaultValue={course?.course_name} required placeholder="例如 项目讨论…" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="course-weeks">上课周次</label>
          <input id="course-weeks" name="weeks" defaultValue={course?.weeks.join(",") || String(week)} required inputMode="numeric" placeholder="例如 2,3,4…" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="course-day">星期</label>
          <select id="course-day" name="day" defaultValue={course?.day ?? day}>
            {weekdays.map((label, index) => {
              const value = (index + 1) % 7;
              return <option key={label} value={value}>{label}</option>;
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-times">节次</label>
          <input id="course-times" name="times" defaultValue={times.join(",")} required inputMode="numeric" placeholder="例如 1,2…" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="course-place">地点</label>
          <input id="course-place" name="place" defaultValue={course?.place || ""} placeholder="例如 综 101…" autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="course-teacher">教师</label>
          <input id="course-teacher" name="teacher" defaultValue={course?.teacher || ""} placeholder="例如 李老师…" autoComplete="off" />
        </div>
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        <button className="button button--primary button--block" type="submit" disabled={pending}>
          {pending ? "正在保存…" : "保存课程"}
        </button>
      </form>
    </Modal>
  );
}

export default function SchedulePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<Course | null | undefined>();
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [formError, setFormError] = useState("");
  const year = 2026;
  const term = "autumn";

  const semester = useQuery({
    queryKey: ["semester", year, term],
    queryFn: () => api.semester.get(year, term),
    enabled: isAuthenticated,
  });
  const courses = useQuery({
    queryKey: ["courses", year, term],
    queryFn: () => api.course.table(year, term),
    enabled: isAuthenticated,
  });
  const extra = useQuery({
    queryKey: ["courses", "extra", year, term],
    queryFn: () => api.course.extra(year, term),
    enabled: isAuthenticated,
  });
  const tableSetting = useQuery({
    queryKey: ["setting", "table"],
    queryFn: () => api.me.setting<TableSetting>("table"),
    enabled: isAuthenticated,
  });

  const saveCourse = useMutation({
    mutationFn: (input: CustomCourseRequest) =>
      editing ? api.course.update(editing.customize_id!, input) : api.course.create(year, term, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["courses", year, term] });
      setEditing(undefined);
      setFormError("");
    },
    onError: (reason) => setFormError(reason instanceof Error ? reason.message : "课程保存失败。"),
  });
  const deleteCourse = useMutation({
    mutationFn: (id: number) => api.course.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["courses", year, term] });
      setDeleting(null);
    },
  });

  const currentWeek = semester.data ? getCurrentWeek(semester.data) : 1;
  const requestedWeek = Number(searchParams.get("week"));
  const selectedWeek = semester.data && requestedWeek >= (semester.data.from_zero ? 0 : 1) && requestedWeek <= semester.data.weeks
    ? requestedWeek
    : currentWeek;
  const requestedDayValue = searchParams.get("day");
  const requestedDay = Number(requestedDayValue);
  const selectedDay = requestedDayValue !== null && requestedDay >= 0 && requestedDay <= 6
    ? requestedDay
    : currentWeekday();

  const visibleCourses = useMemo(() => {
    if (!courses.data) return [];
    return courses.data
      .filter((course) => course.day === selectedDay)
      .filter((course) =>
        tableSetting.data?.setting.display_not_current_week_courses
          ? true
          : course.weeks.includes(selectedWeek),
      )
      .toSorted((left, right) => left.time - right.time);
  }, [courses.data, selectedDay, selectedWeek, tableSetting.data]);
  const visibleSessions = useMemo(() => groupCourseSessions(visibleCourses), [visibleCourses]);

  function setCalendar(next: { week?: number; day?: number }) {
    const value = new URLSearchParams(searchParams);
    if (next.week !== undefined) value.set("week", String(next.week));
    if (next.day !== undefined) value.set("day", String(next.day));
    setSearchParams(value, { replace: true });
  }

  if (!isAuthenticated) {
    return (
      <div className="page">
        <PageHeader title="课表" description="按周查看课程和自定义安排" />
        <AuthPrompt title="登录后查看你的课表" description="课表来自个人教务数据，需要验证校园账号。" />
      </div>
    );
  }

  const queries = [semester, courses, extra, tableSetting];
  if (queries.some((query) => query.isPending)) return <div className="page"><PageSkeleton rows={7} /></div>;
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="课表" />
        <PageError error={failed.error} onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      </div>
    );
  }

  const firstWeek = semester.data!.from_zero ? 0 : 1;
  return (
    <div className="page">
      <PageHeader
        title="课表"
        description={`${semester.data!.xn} ${termName(semester.data!.xq)} · 共 ${semester.data!.weeks} 周`}
        action={
          <button className="icon-button" type="button" aria-label="添加自定义课程" onClick={() => setEditing(null)}>
            <Plus aria-hidden="true" />
          </button>
        }
      />

      <div className="surface surface--padded stack gap-12">
        <div className="week-control">
          <button className="icon-button" type="button" aria-label="上一周" disabled={selectedWeek <= firstWeek} onClick={() => setCalendar({ week: selectedWeek - 1 })}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <div>
            <strong>第 {selectedWeek} 周</strong>
            {selectedWeek !== currentWeek ? (
              <button className="button button--ghost button--small" type="button" onClick={() => setCalendar({ week: currentWeek })}>回到本周</button>
            ) : <p className="muted text-sm">本周</p>}
          </div>
          <button className="icon-button" type="button" aria-label="下一周" disabled={selectedWeek >= semester.data!.weeks} onClick={() => setCalendar({ week: selectedWeek + 1 })}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        <div className="day-strip" aria-label="选择星期">
          {weekdays.map((label, index) => {
            const day = (index + 1) % 7;
            const calendarDate = dateForSemesterDay(semester.data!, selectedWeek, day);
            return (
              <button className={`day-button${selectedDay === day ? " is-active" : ""}`} type="button" key={label} onClick={() => setCalendar({ day })} aria-pressed={selectedDay === day}>
                {label.slice(1)}
                <span>{calendarDate ? dayNumberFormatter.format(calendarDate) : "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Section title={weekdays[selectedDay === 0 ? 6 : selectedDay - 1]}>
        {visibleSessions.length ? (
          <div className="timeline">
            {visibleSessions.map((session) => {
              const { course } = session;
              const active = course.weeks.includes(selectedWeek);
              return (
                <article className="timeline-item" key={courseSessionKey(session)}>
                  <p className="timeline-item__time">{courseSessionPeriodLabel(session)}</p>
                  <span className="timeline-item__dot" aria-hidden="true" />
                  <div className="course-block">
                    <div className="cluster spread gap-8">
                      <p className="course-block__name text-clamp-2">{course.course_name}</p>
                      {!active ? <span className="badge">非本周</span> : null}
                    </div>
                    <p className="course-block__meta cluster gap-4"><MapPin aria-hidden="true" />{course.place || "地点待定"}</p>
                    <p className="course-block__meta">{course.teacher || "教师待定"}</p>
                    <details>
                      <summary>课程详情</summary>
                      <p>课程号：{course.course_id || "自定义课程"}</p>
                      <p>班级：{course.class_name || "未设置"}</p>
                      <p>类型：{course.course_type || "自定义"} · 学分：{course.credit ?? "无"}</p>
                      <p>校区：{course.area || "未设置"} · 人数：{course.people ?? "未知"}</p>
                      <p>周次：{course.weeks.join("、")} · 备注：{course.extra || "无"}</p>
                    </details>
                    {course.customize_id !== null ? (
                      <div className="cluster gap-8">
                        <button className="button button--ghost button--small" type="button" onClick={() => setEditing(course)}>
                          <Pencil aria-hidden="true" />编辑
                        </button>
                        <button className="button button--ghost button--small text-danger" type="button" onClick={() => setDeleting(course)}>
                          <Trash2 aria-hidden="true" />删除
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="这一天没有课程"
            description="切换日期或添加自定义课程。"
            action={<button className="button button--secondary" type="button" onClick={() => setEditing(null)}>添加课程</button>}
          />
        )}
      </Section>

      <Section title="未排入课表" description={`${extra.data!.length} 门课程没有具体上课时间`}>
        {extra.data!.length ? (
          <div className="surface list">
            {extra.data!.map((course) => (
              <article className="record-item" key={course.course_id}>
                <h3>{course.course_name}</h3>
                <p className="muted text-sm">{course.course_id} · {course.class_name} · {course.course_type} · {course.credit} 学分</p>
                <p className="muted text-sm">{course.area} · {course.teacher} · {course.people} 人 · {course.extra || "无备注"}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState title="没有待排课程" description="所有课程都已经排入周课表。" />}
      </Section>

      {editing !== undefined ? (
        <CourseEditor
          course={editing}
          relatedCourses={courses.data!}
          week={selectedWeek}
          day={selectedDay}
          pending={saveCourse.isPending}
          error={formError}
          onSubmit={(input) => saveCourse.mutate(input)}
          onClose={() => { setEditing(undefined); setFormError(""); }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="删除这门课程？"
          description={`“${deleting.course_name}”会从自定义课表中移除。`}
          confirmLabel="删除课程"
          pending={deleteCourse.isPending}
          error={deleteCourse.isError ? deleteCourse.error.message : undefined}
          onCancel={() => setDeleting(null)}
          onConfirm={() => deleteCourse.mutate(deleting.customize_id!)}
        />
      ) : null}
    </div>
  );
}
