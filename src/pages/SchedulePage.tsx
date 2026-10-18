import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarSync, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/api";
import type { Course, CustomCourseRequest, ExtraCourse, TableSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { PageFootnotes } from "../components/PageFootnotes";
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
  buildCourseColorMap,
  coursePeriods,
  courseSessionKey,
  courseSessionPeriodLabel,
  courseSessionTimes,
  groupCourseSessions,
  stackCourseSessions,
  type CourseSessionStack,
} from "../utils/course";
import { currentWeekday, dateForSemesterDay, getCurrentWeek, weekdays } from "../utils/format";
import {
  findCurrentSemester,
  findSemester,
  parseAcademicYear,
  parseSemesterId,
} from "../utils/semester";

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

const COURSE_CELL_COLOR_COUNT = 10;
const WEEK_SWIPE_MIN_DISTANCE = 48;
const WEEK_SWIPE_AXIS_RATIO = 1.25;
const schedulePageFootnotes = [
  "对于本科生，数据来源于教务系统。对于研究生，数据来源于研究生系统。未登录时的数据来自于登录时最后一次获得的数据。",
  "点击课表格子或是无课表课程项可查看课程详情信息。",
  "为提升用户体验，湖大微生活会对课表数据进行缓存，课表数据可能未及时更新，你可以通过反复下拉刷新来获取最新数据。",
  "无课表课程指的是没有在学校系统上写明上课时间的课程，这些课程的上课信息需要通过其他途径获得。",
  "彩色格子表示本周上课，灰色格子表示本周不上课，右下角有叠角图标的格子表示该时间段还存在其他非本周课程，格子的左下角如果出现“+N”标识则表示该时间段需要同时上多个课。",
  "如果想要隐藏非本周的课程（灰色格子），可以前往“我的” > “设置” > “课表设置”中开启“仅显示本周课程”。",
] as const;

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
  stack,
  courseColorMap,
  selectedWeek,
  onEdit,
  onDelete,
  onClose,
}: {
  stack: CourseSessionStack;
  courseColorMap: ReadonlyMap<string, number>;
  selectedWeek: number;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  onClose: () => void;
}) {
  const primaryTimes = courseSessionTimes(stack.primary);
  const primaryWeekday =
    scheduleDays.find((item) => item.day === stack.primary.course.day)?.label || "日期待定";

  return (
    <Modal
      title={stack.primary.course.course_name}
      description={`${primaryWeekday} · ${courseSessionPeriodLabel(stack.primary)}${
        primaryTimes ? ` · ${primaryTimes.start}-${primaryTimes.end}` : ""
      }${stack.sessions.length > 1 ? ` · 同一时段共 ${stack.sessions.length} 门课程` : ""}`}
      variant="course-detail"
      showClose={false}
      onClose={onClose}
    >
      {stack.sessions.map((session) => {
        const { course } = session;
        const active = course.weeks.includes(selectedWeek);
        const location =
          course.place && course.area
            ? `${course.place}（${course.area}）`
            : course.place || course.area || "地点待定";
        return (
          <article
            className={`schedule-detail-card schedule-course--color-${
              courseColorMap.get(course.course_name) ?? 0
            }${active ? "" : " is-inactive"}`}
            key={courseSessionKey(session)}
            aria-label={`${course.course_name}，${active ? "本周上课" : `第 ${selectedWeek} 周不上课`}`}
            tabIndex={stack.sessions.length > 1 ? 0 : undefined}
          >
            <header>
              <p>{course.course_type || "自定义课程"}</p>
              <p>{course.course_id || "自定义课程"}</p>
              <h3>{course.course_name}</h3>
            </header>
            <div className="schedule-detail-card__facts">
              <p>{location}</p>
              <p>{course.class_name || "班级未设置"}</p>
              <p>{course.teacher || "教师待定"}</p>
              <p>{formatWeekRanges(course.weeks)}</p>
              <p>{course.credit === null ? "学分未设置" : `${course.credit} 学分`}</p>
              <p>上课人数：{course.people ?? "未知"}</p>
              {course.extra ? <p>备注：{course.extra}</p> : null}
            </div>
            {course.customize_id !== null ? (
              <div className="schedule-detail-card__actions">
                <button type="button" onClick={() => onEdit(course)}>
                  <Pencil aria-hidden="true" />
                  编辑
                </button>
                <button type="button" onClick={() => onDelete(course)}>
                  <Trash2 aria-hidden="true" />
                  删除
                </button>
              </div>
            ) : null}
          </article>
        );
      })}
    </Modal>
  );
}

export default function SchedulePage() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [semesterPickerOpen, setSemesterPickerOpen] = useState(false);
  const [details, setDetails] = useState<CourseSessionStack | null>(null);
  const [extraDetails, setExtraDetails] = useState<ExtraCourse | null>(null);
  const [editing, setEditing] = useState<Course | null | undefined>();
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [formError, setFormError] = useState("");
  const weekSwipeStartRef = useRef<{
    identifier: number;
    x: number;
    y: number;
  } | null>(null);
  const weekSwipeGuardCleanupRef = useRef<(() => void) | null>(null);
  const suppressCourseClickUntilRef = useRef(0);
  useEffect(
    () => () => {
      weekSwipeGuardCleanupRef.current?.();
    },
    [],
  );
  const requestedYearValue = searchParams.get("xn");
  const requestedTermValue = searchParams.get("xq");
  const requestedYear = parseAcademicYear(requestedYearValue);
  const requestedTerm = parseSemesterId(requestedTermValue);

  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: () => api.semester.get(),
    enabled: isAuthenticated,
  });
  const currentSemester = findCurrentSemester(semesterTable.data);
  const requestedSemester = findSemester(semesterTable.data, requestedYear, requestedTerm);
  const semester = requestedSemester ?? currentSemester;
  const fellBackFromSemesterUrl =
    semesterTable.data !== undefined &&
    (requestedYearValue !== null || requestedTermValue !== null) &&
    requestedSemester === undefined;
  const year = semester?.xn;
  const term = semester?.xq;
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
    currentSemester &&
    semester &&
    currentSemester.xn === semester.xn &&
    currentSemester.xq === semester.xq,
  );
  const firstWeek = semester?.from_zero ? 0 : 1;
  const currentWeek = semester ? getCurrentWeek(semester) : firstWeek;
  const requestedWeek = Number(searchParams.get("week"));
  const selectedWeek =
    semester &&
    !fellBackFromSemesterUrl &&
    requestedWeek >= (semester.from_zero ? 0 : 1) &&
    requestedWeek <= semester.weeks
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

  const visibleSessionStacks = useMemo(() => {
    if (!courses.data) return [];
    return stackCourseSessions(
      groupCourseSessions(
        courses.data.filter((course) =>
          tableSetting.data?.setting.display_not_current_week_courses
            ? true
            : course.weeks.includes(selectedWeek),
        ),
      ),
      selectedWeek,
    );
  }, [courses.data, selectedWeek, tableSetting.data]);
  const courseColorMap = useMemo(
    () => buildCourseColorMap(courses.data ?? [], COURSE_CELL_COLOR_COUNT),
    [courses.data],
  );

  function setWeek(week: number) {
    const value = new URLSearchParams(searchParams);
    value.set("week", String(week));
    setSearchParams(value, { replace: true });
  }

  function moveWeek(offset: -1 | 1) {
    if (!semester) return;
    const nextWeek = selectedWeek + offset;
    if (nextWeek < firstWeek || nextWeek > semester.weeks) return;
    setWeek(nextWeek);
  }

  function cancelWeekSwipe() {
    weekSwipeStartRef.current = null;
    weekSwipeGuardCleanupRef.current?.();
    weekSwipeGuardCleanupRef.current = null;
  }

  function handleWeekSwipeStart(event: ReactTouchEvent<HTMLElement>) {
    cancelWeekSwipe();
    if (event.touches.length !== 1) {
      return;
    }
    const calendar = event.currentTarget;
    if (calendar.scrollWidth - calendar.clientWidth > 1) {
      return;
    }
    const touch = event.touches[0];
    weekSwipeStartRef.current = {
      identifier: touch.identifier,
      x: touch.clientX,
      y: touch.clientY,
    };
    const cancelMultiTouchSwipe = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length > 1) cancelWeekSwipe();
    };
    document.addEventListener("touchstart", cancelMultiTouchSwipe, {
      capture: true,
      passive: true,
    });
    document.addEventListener("touchmove", cancelMultiTouchSwipe, {
      capture: true,
      passive: true,
    });
    weekSwipeGuardCleanupRef.current = () => {
      document.removeEventListener("touchstart", cancelMultiTouchSwipe, true);
      document.removeEventListener("touchmove", cancelMultiTouchSwipe, true);
    };
  }

  function handleWeekSwipeEnd(event: ReactTouchEvent<HTMLElement>) {
    const start = weekSwipeStartRef.current;
    cancelWeekSwipe();
    if (!start || event.touches.length > 0) return;

    let touch: { clientX: number; clientY: number } | null = null;
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      const candidate = event.changedTouches[index];
      if (candidate.identifier === start.identifier) {
        touch = candidate;
        break;
      }
    }
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (
      Math.abs(deltaX) < WEEK_SWIPE_MIN_DISTANCE ||
      Math.abs(deltaX) < Math.abs(deltaY) * WEEK_SWIPE_AXIS_RATIO
    ) {
      return;
    }

    if (event.cancelable) event.preventDefault();
    suppressCourseClickUntilRef.current = performance.now() + 120;
    moveWeek(deltaX < 0 ? 1 : -1);
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
    if (currentSemester?.xn === option.year && currentSemester.xq === option.term) {
      returnToCurrentSemester();
      return;
    }
    if (option.year === year && option.term === term) return;
    setSemester(semesterOptionValue(option));
  }

  const scheduleReady = semester !== undefined && courses.data !== undefined;
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

  const corePending = semester === undefined && semesterTable.isPending;
  const coursesPending = courses.data === undefined && courses.isPending;
  const coreFailure =
    semester === undefined && semesterTable.isError
      ? semesterTable
      : courses.data === undefined && courses.isError
        ? courses
        : null;
  return (
    <div className={`page schedule-page${weekdaysPinned ? " is-weekdays-pinned" : ""}`}>
      <PageHeader
        title="课表"
        description={
          semester ? (
            <span className="schedule-header-description">
              <span className="schedule-header-term">
                {semester.xn}-{semester.xn + 1} 学年 {semester.xq_text}
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
                semester
                  ? `切换学期，当前为${semesterOptionLabel({
                      year: semester.xn,
                      term: semester.xq,
                      text: semester.xq_text,
                    })}`
                  : "切换学期"
              }
              title="切换学期"
              aria-haspopup="dialog"
              aria-expanded={semesterPickerOpen}
              disabled={!semester}
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
              <span>共 {semester!.weeks} 周</span>
            </div>
            <div className="schedule-week-heading__actions">
              <button
                className="icon-button"
                type="button"
                aria-label="上一周"
                disabled={selectedWeek <= firstWeek}
                onClick={() => moveWeek(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="下一周"
                disabled={selectedWeek >= semester!.weeks}
                onClick={() => moveWeek(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </section>

          <section
            className="schedule-calendar"
            aria-labelledby="schedule-calendar-title"
            tabIndex={0}
            onTouchStart={handleWeekSwipeStart}
            onTouchEnd={handleWeekSwipeEnd}
            onTouchCancel={cancelWeekSwipe}
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
                const calendarDate = dateForSemesterDay(semester!, selectedWeek, day);
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
              {visibleSessionStacks.map((stack) => {
                const session = stack.primary;
                const { course, startPeriod, endPeriod } = session;
                const active = course.weeks.includes(selectedWeek);
                const hasCourseStack = stack.sessions.length > 1;
                const additionalConcurrentCourses = Math.max(
                  0,
                  stack.sessions.filter(({ course: stackedCourse }) =>
                    stackedCourse.weeks.includes(selectedWeek),
                  ).length - 1,
                );
                const hasConflicts = additionalConcurrentCourses > 0;
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
                  hasCourseStack ? `此时段共有 ${stack.sessions.length} 门课程` : null,
                  hasCourseStack ? "查看该时段全部课程" : "查看详情",
                ]
                  .filter(Boolean)
                  .join("，");

                if (dayIndex < 0) return null;
                return (
                  <button
                    className={`schedule-course schedule-course--color-${
                      courseColorMap.get(course.course_name) ?? 0
                    }${active ? "" : " is-inactive"}${periodCount === 1 ? " is-single" : ""}${
                      hasConflicts ? " has-conflicts" : ""
                    }${hasCourseStack ? " has-course-stack" : ""}`}
                    style={
                      {
                        gridColumn: dayIndex + 2,
                        gridRow: `${startPeriod} / span ${periodCount}`,
                      } as CSSProperties
                    }
                    type="button"
                    key={courseSessionKey(session)}
                    aria-label={courseLabel}
                    onClick={() => {
                      if (performance.now() < suppressCourseClickUntilRef.current) return;
                      setDetails(stack);
                    }}
                  >
                    <span className="schedule-course__name">{course.course_name}</span>
                    <span className="schedule-course__place">@{course.place || "待定"}</span>
                    {hasConflicts ? (
                      <span className="schedule-course__conflict-count" aria-hidden="true">
                        +{additionalConcurrentCourses}
                      </span>
                    ) : null}
                    {!active ? <span className="schedule-course__inactive">非本周</span> : null}
                  </button>
                );
              })}
            </div>
          </section>

          {!visibleSessionStacks.length ? (
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

      {extra.data?.length === 0 && !extra.isError ? null : (
        <Section
          title="无课表课程"
          description={extra.data?.length ? `共 ${extra.data.length} 门课程` : undefined}
          className="schedule-extra-courses"
        >
          <QueryState query={extra} loadingRows={3}>
            {(items) =>
              items.length ? (
                <ul className="surface list" aria-label="无课表课程列表">
                  {items.map((course) => (
                    <li className="schedule-extra-course-item" key={course.course_id}>
                      <button
                        className="record-item schedule-extra-course"
                        type="button"
                        aria-label={`${course.course_name}，${course.course_type}，${course.area}，${course.teacher}，查看课程详情`}
                        onClick={() => setExtraDetails(course)}
                      >
                        <span className="schedule-extra-course__title">{course.course_name}</span>
                        <span className="schedule-extra-course__meta">
                          {course.course_type} · {course.area} · {course.teacher}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          </QueryState>
        </Section>
      )}

      <PageFootnotes items={schedulePageFootnotes} label="课表说明" />

      {scheduleReady && semesterPickerOpen ? (
        <SemesterPickerDialog
          selected={{ year: year!, term: term!, text: semester!.xq_text }}
          semesters={semesterTable.data!.items}
          current={currentSemester}
          onSelect={chooseSemester}
          onClose={() => setSemesterPickerOpen(false)}
        />
      ) : null}
      {scheduleReady && details ? (
        <CourseDetails
          stack={details}
          courseColorMap={courseColorMap}
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
      {extraDetails ? (
        <Modal
          title={extraDetails.course_name}
          bodyLabel="课程详细信息"
          onClose={() => setExtraDetails(null)}
        >
          <dl className="list schedule-extra-detail">
            {[
              { label: "课程类型", value: extraDetails.course_type },
              { label: "课程号", value: extraDetails.course_id },
              { label: "班级", value: extraDetails.class_name },
              { label: "校区", value: extraDetails.area },
              { label: "教师", value: extraDetails.teacher },
              { label: "学分", value: `${extraDetails.credit} 学分` },
              { label: "人数", value: `${extraDetails.people} 人` },
              ...(extraDetails.extra
                ? [{ label: "备注", value: extraDetails.extra, wide: true }]
                : []),
            ].map(({ label, value, wide }) => (
              <div
                className={`data-row${wide ? " schedule-extra-detail__row--wide" : ""}`}
                key={label}
              >
                <dt className="data-row__label">{label}</dt>
                <dd className="data-row__value">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
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
