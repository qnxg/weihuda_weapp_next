import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import type { Course, CustomCourseRequest, TableSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import {
  SemesterPickerDialog,
  semesterOptionLabel,
  semesterOptionValue,
  type SemesterOption,
} from "../components/SemesterPicker";
import {
  AuthPrompt,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  QueryState,
  Section,
  StatusMessage,
} from "../components/ui";
import {
  coursePeriods,
  courseSessionKey,
  courseSessionPeriodLabel,
  courseSessionTimes,
  groupCourseSessions,
  type CourseSession,
} from "../utils/course";
import {
  currentWeekday,
  dateForSemesterDay,
  getCurrentWeek,
  termName,
  weekdays,
} from "../utils/format";
import { isGradeTerm } from "../utils/semester";

const scheduleDays = [
  { day: 0, label: "周日" },
  { day: 1, label: "周一" },
  { day: 2, label: "周二" },
  { day: 3, label: "周三" },
  { day: 4, label: "周四" },
  { day: 5, label: "周五" },
  { day: 6, label: "周六" },
] as const;

const schedulePeriods = Object.entries(coursePeriods)
  .map(([period, times]) => ({ period: Number(period), ...times }))
  .toSorted((left, right) => left.period - right.period);

function formatCalendarDate(date: Date | null) {
  return date ? `${date.getMonth() + 1}/${date.getDate()}` : "—";
}

function usePinnedWeekdays(enabled: boolean) {
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const weekdaysRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setPinned(false);
      return;
    }

    const sentinel = sentinelRef.current;
    const weekdaysElement = weekdaysRef.current;
    const root = document.getElementById("main-content");
    const page = sentinel?.closest<HTMLElement>(".schedule-page");
    const calendar = sentinel?.closest<HTMLElement>(".schedule-calendar");
    const header = page?.querySelector<HTMLElement>(".page-header");
    if (!sentinel || !weekdaysElement || !root || !page || !calendar || !header) return;

    const requestFrame =
      typeof window.requestAnimationFrame === "function"
        ? window.requestAnimationFrame.bind(window)
        : (callback: FrameRequestCallback) =>
            window.setTimeout(() => callback(performance.now()), 0);
    const cancelFrame =
      typeof window.cancelAnimationFrame === "function"
        ? window.cancelAnimationFrame.bind(window)
        : window.clearTimeout.bind(window);
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestFrame(() => {
        frame = 0;
        const headerRect = header.getBoundingClientRect();
        const weekdaysHeight = weekdaysElement.getBoundingClientRect().height;
        const supportsStickyLayout =
          typeof window.matchMedia !== "function" ||
          window.matchMedia("(min-width: 360px)").matches;
        page.style.setProperty("--schedule-header-offset", `${Math.ceil(headerRect.height)}px`);
        const nextPinned =
          supportsStickyLayout &&
          sentinel.getBoundingClientRect().top <= headerRect.bottom &&
          calendar.getBoundingClientRect().bottom > headerRect.bottom + weekdaysHeight;
        setPinned((current) => (current === nextPinned ? current : nextPinned));
      });
    };

    root.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resizeObserver?.observe(header);
    update();

    return () => {
      root.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resizeObserver?.disconnect();
      if (frame) cancelFrame(frame);
      page.style.removeProperty("--schedule-header-offset");
    };
  }, [enabled]);

  return { pinned, sentinelRef, weekdaysRef };
}

function formatWeekRanges(weeks: readonly number[]) {
  const sortedWeeks = [...new Set(weeks)].toSorted((left, right) => left - right);
  const ranges: string[] = [];
  let rangeStart = sortedWeeks[0];
  let rangeEnd = sortedWeeks[0];

  for (const week of sortedWeeks.slice(1)) {
    if (week === rangeEnd + 1) {
      rangeEnd = week;
      continue;
    }
    ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
    rangeStart = week;
    rangeEnd = week;
  }
  if (rangeStart !== undefined) {
    ranges.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
  }
  return ranges.length ? `第 ${ranges.join("、")} 周` : "周次待定";
}

function courseTone(course: Course) {
  const identity = course.course_id || course.course_name;
  let hash = 0;
  for (const character of identity) {
    hash = (hash * 31 + (character.codePointAt(0) || 0)) | 0;
  }
  return (hash >>> 0) % 6;
}

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
    ? relatedCourses
        .filter((item) => item.customize_id === course.customize_id)
        .map((item) => item.time)
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
          <input
            id="course-name"
            name="course_name"
            defaultValue={course?.course_name}
            required
            placeholder="例如 项目讨论…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="course-weeks">上课周次</label>
          <input
            id="course-weeks"
            name="weeks"
            defaultValue={course?.weeks.join(",") || String(week)}
            required
            inputMode="numeric"
            placeholder="例如 2,3,4…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="course-day">星期</label>
          <select id="course-day" name="day" defaultValue={course?.day ?? day}>
            {weekdays.map((label, index) => {
              const value = (index + 1) % 7;
              return (
                <option key={label} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-times">节次</label>
          <input
            id="course-times"
            name="times"
            defaultValue={times.join(",")}
            required
            inputMode="numeric"
            placeholder="例如 1,2…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="course-place">地点</label>
          <input
            id="course-place"
            name="place"
            defaultValue={course?.place || ""}
            placeholder="例如 综 101…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="course-teacher">教师</label>
          <input
            id="course-teacher"
            name="teacher"
            defaultValue={course?.teacher || ""}
            placeholder="例如 李老师…"
            autoComplete="off"
          />
        </div>
        {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
        <button className="button button--primary button--block" type="submit" disabled={pending}>
          {pending ? "正在保存…" : "保存课程"}
        </button>
      </form>
    </Modal>
  );
}

function CourseDetails({
  session,
  selectedWeek,
  onEdit,
  onDelete,
  onClose,
}: {
  session: CourseSession;
  selectedWeek: number;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onClose: () => void;
}) {
  const { course } = session;
  const times = courseSessionTimes(session);
  const weekday = scheduleDays.find((item) => item.day === course.day)?.label || "日期待定";
  const active = course.weeks.includes(selectedWeek);

  return (
    <Modal
      title={course.course_name}
      description={`${weekday} · ${courseSessionPeriodLabel(session)}${
        times ? ` · ${times.start}-${times.end}` : ""
      }`}
      onClose={onClose}
    >
      {!active ? <p className="schedule-detail__notice">第 {selectedWeek} 周不上这门课</p> : null}
      <dl className="schedule-detail-list">
        <div>
          <dt>地点</dt>
          <dd>{course.place || "待定"}</dd>
        </div>
        <div>
          <dt>教师</dt>
          <dd>{course.teacher || "待定"}</dd>
        </div>
        <div>
          <dt>上课周次</dt>
          <dd>{formatWeekRanges(course.weeks)}</dd>
        </div>
        <div>
          <dt>课程号</dt>
          <dd>{course.course_id || "自定义课程"}</dd>
        </div>
        <div>
          <dt>班级</dt>
          <dd>{course.class_name || "未设置"}</dd>
        </div>
        <div>
          <dt>类型与学分</dt>
          <dd>
            {course.course_type || "自定义"} · {course.credit ?? "无"} 学分
          </dd>
        </div>
        <div>
          <dt>校区与人数</dt>
          <dd>
            {course.area || "未设置"} · {course.people ?? "未知"} 人
          </dd>
        </div>
        <div>
          <dt>备注</dt>
          <dd>{course.extra || "无"}</dd>
        </div>
      </dl>
      {course.customize_id !== null ? (
        <div className="schedule-detail__actions">
          <button className="button button--secondary" type="button" onClick={() => onEdit(course)}>
            <Pencil aria-hidden="true" />
            编辑课程
          </button>
          <button
            className="button button--ghost text-danger"
            type="button"
            onClick={() => onDelete(course)}
          >
            <Trash2 aria-hidden="true" />
            删除课程
          </button>
        </div>
      ) : null}
    </Modal>
  );
}

export default function SchedulePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false);
  const [details, setDetails] = useState<CourseSession | null>(null);
  const [editing, setEditing] = useState<Course | null | undefined>();
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [formError, setFormError] = useState("");
  const requestedYearValue = searchParams.get("xn");
  const requestedTermValue = searchParams.get("xq");
  const requestedTerm = isGradeTerm(requestedTermValue) ? requestedTermValue : undefined;
  const requestedYear = Number(requestedYearValue);
  const hasRequestedSemester =
    requestedYearValue !== null &&
    Number.isInteger(requestedYear) &&
    requestedYear >= 2000 &&
    requestedYear <= 2100 &&
    requestedTerm !== undefined;

  const currentSemester = useQuery({
    queryKey: ["semester", "current"],
    queryFn: () => api.semester.get(),
    enabled: isAuthenticated,
  });
  const requestedSemester = useQuery({
    queryKey: ["semester", requestedYear, requestedTerm],
    queryFn: () => api.semester.get(requestedYear, requestedTerm!),
    enabled: isAuthenticated && hasRequestedSemester,
  });
  const semester = hasRequestedSemester ? requestedSemester : currentSemester;
  const year = hasRequestedSemester ? requestedYear : currentSemester.data?.xn;
  const term = hasRequestedSemester ? requestedTerm! : currentSemester.data?.xq;
  const hasSemesterSelection = year !== undefined && term !== undefined;

  const courses = useQuery({
    queryKey: ["courses", year, term],
    queryFn: () => api.course.table(year!, term!),
    enabled: isAuthenticated && hasSemesterSelection,
  });
  const extra = useQuery({
    queryKey: ["courses", "extra", year, term],
    queryFn: () => api.course.extra(year!, term!),
    enabled: isAuthenticated && hasSemesterSelection,
  });
  const tableSetting = useQuery({
    queryKey: ["setting", "table"],
    queryFn: () => api.me.setting<TableSetting>("table"),
    enabled: isAuthenticated,
  });

  const saveCourse = useMutation({
    mutationFn: (input: CustomCourseRequest) =>
      editing
        ? api.course.update(editing.customize_id!, input)
        : api.course.create(year!, term!, input),
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

  const currentSemesterIsSelected = Boolean(
    currentSemester.data &&
    semester.data &&
    currentSemester.data.xn === semester.data.xn &&
    currentSemester.data.xq === semester.data.xq,
  );
  const firstWeek = semester.data?.from_zero ? 0 : 1;
  const currentWeek = semester.data ? getCurrentWeek(semester.data) : firstWeek;
  const requestedWeek = Number(searchParams.get("week"));
  const selectedWeek =
    semester.data &&
    requestedWeek >= (semester.data.from_zero ? 0 : 1) &&
    requestedWeek <= semester.data.weeks
      ? requestedWeek
      : currentSemesterIsSelected
        ? currentWeek
        : firstWeek;
  const requestedDayValue = searchParams.get("day");
  const requestedDay = Number(requestedDayValue);
  const selectedDay =
    requestedDayValue !== null && requestedDay >= 0 && requestedDay <= 6
      ? requestedDay
      : currentWeekday();

  const visibleSessions = useMemo(() => {
    if (!courses.data) return [];
    return groupCourseSessions(
      courses.data.filter((course) =>
        tableSetting.data?.setting.display_not_current_week_courses
          ? true
          : course.weeks.includes(selectedWeek),
      ),
    );
  }, [courses.data, selectedWeek, tableSetting.data]);

  function setWeek(week: number) {
    const value = new URLSearchParams(searchParams);
    value.set("week", String(week));
    setSearchParams(value, { replace: true });
  }

  function setSemester(value: string) {
    const [nextYear, nextTerm] = value.split(":");
    const next = new URLSearchParams(searchParams);
    next.set("xn", nextYear);
    next.set("xq", nextTerm);
    next.delete("week");
    setDetails(null);
    setSearchParams(next, { replace: true });
  }

  function returnToCurrentSemester() {
    const value = new URLSearchParams(searchParams);
    value.delete("xn");
    value.delete("xq");
    value.delete("week");
    setDetails(null);
    setSearchParams(value, { replace: true });
  }

  function chooseSemester(option: SemesterOption) {
    setSemesterPickerOpen(false);
    if (currentSemester.data?.xn === option.year && currentSemester.data.xq === option.term) {
      returnToCurrentSemester();
      return;
    }
    if (option.year === year && option.term === term) return;
    setSemester(semesterOptionValue(option));
  }

  const scheduleReady = semester.data !== undefined && courses.data !== undefined;
  const isViewingCurrentWeek = currentSemesterIsSelected && selectedWeek === currentWeek;
  const {
    pinned: weekdaysPinned,
    sentinelRef: weekdaySentinelRef,
    weekdaysRef,
  } = usePinnedWeekdays(isAuthenticated && scheduleReady);

  if (!isAuthenticated) {
    return (
      <div className="page">
        <PageHeader title="课表" description="按周查看课程和自定义安排" />
        <AuthPrompt
          title="登录后查看你的课表"
          description="课表来自个人教务数据，需要验证校园账号。"
        />
      </div>
    );
  }

  const corePending = semester.data === undefined && semester.isPending;
  const coursesPending = courses.data === undefined && courses.isPending;
  const coreFailure =
    semester.data === undefined && semester.isError
      ? semester
      : courses.data === undefined && courses.isError
        ? courses
        : null;
  return (
    <div className={`page schedule-page${weekdaysPinned ? " is-weekdays-pinned" : ""}`}>
      <PageHeader
        title="课表"
        description={
          semester.data ? (
            <span className="schedule-header-description">
              <span className="schedule-header-term">
                {semester.data.xn}-{semester.data.xn + 1} 学年 {termName(semester.data.xq)}
              </span>
              <span
                className={`schedule-header-week${weekdaysPinned ? " is-visible" : ""}`}
                aria-hidden={!weekdaysPinned}
              >
                · 第 {selectedWeek} 周
              </span>
            </span>
          ) : (
            "按周查看课程和自定义安排"
          )
        }
        leadingAction={
          <div className="schedule-header-actions">
            <button
              className="icon-button"
              type="button"
              aria-label="添加自定义课程"
              title="添加自定义课程"
              disabled={!scheduleReady}
              onClick={() => setEditing(null)}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              aria-label={
                semester.data
                  ? `切换学期，当前为${semesterOptionLabel({
                      year: semester.data.xn,
                      term: semester.data.xq,
                    })}`
                  : "切换学期"
              }
              title="切换学期"
              aria-haspopup="dialog"
              aria-expanded={semesterPickerOpen}
              disabled={!semester.data}
              onClick={() => setSemesterPickerOpen(true)}
            >
              <CalendarSync aria-hidden="true" />
            </button>
          </div>
        }
      />

      {corePending || coursesPending ? (
        <Section title="周课表">
          <PageSkeleton rows={7} />
        </Section>
      ) : coreFailure ? (
        <Section title="周课表">
          <PageError error={coreFailure.error} onRetry={() => void coreFailure.refetch()} />
        </Section>
      ) : scheduleReady ? (
        <>
          {tableSetting.isError && tableSetting.data === undefined ? (
            <div className="cluster spread gap-8">
              <StatusMessage tone="warning">
                课表显示设置暂不可用，已使用默认显示方式。
              </StatusMessage>
              <button
                className="button button--text button--small"
                type="button"
                onClick={() => void tableSetting.refetch()}
              >
                重试
              </button>
            </div>
          ) : null}

          <section className="schedule-week-heading" aria-label="选择教学周">
            <div className="schedule-week-heading__title" aria-live="polite">
              <h2>第 {selectedWeek} 周</h2>
              <span>共 {semester.data!.weeks} 周</span>
            </div>
            <div className="schedule-week-heading__actions">
              <button
                className="icon-button"
                type="button"
                aria-label="上一周"
                disabled={selectedWeek <= firstWeek}
                onClick={() => setWeek(selectedWeek - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="下一周"
                disabled={selectedWeek >= semester.data!.weeks}
                onClick={() => setWeek(selectedWeek + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>

          <section
            className="schedule-calendar"
            aria-labelledby="schedule-calendar-title"
            tabIndex={0}
          >
            <h2 className="sr-only" id="schedule-calendar-title">
              第 {selectedWeek} 周课程表
            </h2>
            <span
              className="schedule-weekday-sentinel"
              ref={weekdaySentinelRef}
              aria-hidden="true"
            />
            <div className="schedule-weekdays" ref={weekdaysRef}>
              <div className="schedule-grid__corner" aria-hidden="true">
                节次
              </div>
              {scheduleDays.map(({ day, label }, dayIndex) => {
                const calendarDate = dateForSemesterDay(semester.data!, selectedWeek, day);
                const isToday = isViewingCurrentWeek && currentWeekday() === day;
                return (
                  <div
                    className={`schedule-grid__day${isToday ? " is-today" : ""}`}
                    style={{ gridColumn: dayIndex + 2 } as CSSProperties}
                    key={day}
                    aria-label={`${label} ${formatCalendarDate(calendarDate)}`}
                  >
                    <span>{label.slice(1)}</span>
                    <strong>{formatCalendarDate(calendarDate)}</strong>
                  </div>
                );
              })}
            </div>
            <div className="schedule-grid">
              {schedulePeriods.map(({ period, start, end }) => (
                <div
                  className="schedule-grid__period"
                  style={{ gridRow: period } as CSSProperties}
                  key={period}
                  aria-label={`第 ${period} 节，${start} 到 ${end}`}
                >
                  <strong>{period}</strong>
                  <span>{start}</span>
                  <span>{end}</span>
                </div>
              ))}
              {schedulePeriods.flatMap(({ period }) =>
                scheduleDays.map(({ day }, dayIndex) => (
                  <span
                    className="schedule-grid__slot"
                    style={{ gridColumn: dayIndex + 2, gridRow: period } as CSSProperties}
                    key={`${day}-${period}`}
                    aria-hidden="true"
                  />
                )),
              )}
              {visibleSessions.map((session) => {
                const { course, startPeriod, endPeriod } = session;
                const active = course.weeks.includes(selectedWeek);
                const dayIndex = scheduleDays.findIndex((item) => item.day === course.day);
                const weekday = scheduleDays[dayIndex]?.label || "日期待定";
                const times = courseSessionTimes(session);
                const periodCount = endPeriod - startPeriod + 1;
                const courseLabel = [
                  course.course_name,
                  weekday,
                  courseSessionPeriodLabel(session),
                  times ? `${times.start} 到 ${times.end}` : null,
                  course.place || "地点待定",
                  course.teacher || "教师待定",
                  active ? null : "非本周",
                  "查看详情",
                ]
                  .filter(Boolean)
                  .join("，");

                if (dayIndex < 0) return null;
                return (
                  <button
                    className={`schedule-course schedule-course--tone-${courseTone(course)}${
                      active ? "" : " is-inactive"
                    }${periodCount === 1 ? " is-single" : ""}`}
                    style={
                      {
                        gridColumn: dayIndex + 2,
                        gridRow: `${startPeriod} / span ${periodCount}`,
                      } as CSSProperties
                    }
                    type="button"
                    key={courseSessionKey(session)}
                    aria-label={courseLabel}
                    onClick={() => setDetails(session)}
                  >
                    <span className="schedule-course__name">{course.course_name}</span>
                    <span className="schedule-course__place">@{course.place || "待定"}</span>
                    {!active ? <span className="schedule-course__inactive">非本周</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {!visibleSessions.length ? (
            <EmptyState
              title="本周没有课程"
              description="切换教学周或添加自定义课程。"
              action={
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  添加课程
                </button>
              }
            />
          ) : null}
        </>
      ) : null}

      <Section
        title="未排入课表"
        description={extra.data ? `${extra.data.length} 门课程没有具体上课时间` : undefined}
      >
        <QueryState query={extra} loadingRows={3}>
          {(items) =>
            items.length ? (
              <div className="surface list">
                {items.map((course) => (
                  <article className="record-item" key={course.course_id}>
                    <h3>{course.course_name}</h3>
                    <p className="muted text-sm">
                      {course.course_id} · {course.class_name} · {course.course_type} ·{" "}
                      {course.credit} 学分
                    </p>
                    <p className="muted text-sm">
                      {course.area} · {course.teacher} · {course.people} 人 ·{" "}
                      {course.extra || "无备注"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="没有待排课程" description="所有课程都已经排入周课表。" />
            )
          }
        </QueryState>
      </Section>

      {scheduleReady && semesterPickerOpen ? (
        <SemesterPickerDialog
          selected={{ year: year!, term: term! }}
          selectedSemester={semester.data}
          current={currentSemester.data}
          onSelect={chooseSemester}
          onClose={() => setSemesterPickerOpen(false)}
        />
      ) : null}
      {scheduleReady && details ? (
        <CourseDetails
          session={details}
          selectedWeek={selectedWeek}
          onEdit={(course) => {
            setDetails(null);
            setEditing(course);
          }}
          onDelete={(course) => {
            setDetails(null);
            setDeleting(course);
          }}
          onClose={() => setDetails(null)}
        />
      ) : null}
      {scheduleReady && editing !== undefined ? (
        <CourseEditor
          course={editing}
          relatedCourses={courses.data}
          week={selectedWeek}
          day={selectedDay}
          pending={saveCourse.isPending}
          error={formError}
          onSubmit={(input) => saveCourse.mutate(input)}
          onClose={() => {
            setEditing(undefined);
            setFormError("");
          }}
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
