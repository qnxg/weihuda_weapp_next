import { CalendarClock } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { Course } from "../api/types";
import {
  courseSessionKey,
  courseSessionPeriodLabel,
  courseSessionTimes,
  courseStatusLabels,
  getCourseStatus,
  groupCourseSessions,
  shouldDefaultToTomorrow,
} from "../utils/course";
import { EmptyState } from "./ui";

type SelectedDay = "today" | "tomorrow";

export function TodayCourses({
  todayCourses,
  tomorrowCourses,
  today,
  tomorrow,
  now = new Date(),
}: {
  todayCourses: readonly Course[];
  tomorrowCourses: readonly Course[];
  today: Date;
  tomorrow: Date;
  now?: Date;
}) {
  const todaySessions = groupCourseSessions(todayCourses);
  const tomorrowSessions = groupCourseSessions(tomorrowCourses);
  const todayTabRef = useRef<HTMLButtonElement>(null);
  const tomorrowTabRef = useRef<HTMLButtonElement>(null);
  const defaultToTomorrow = shouldDefaultToTomorrow(todaySessions, today, now);
  const [manualSelection, setManualSelection] = useState<SelectedDay | null>(null);
  const selectedDay = manualSelection ?? (defaultToTomorrow ? "tomorrow" : "today");
  const sessions = selectedDay === "today" ? todaySessions : tomorrowSessions;
  const courseDate = selectedDay === "today" ? today : tomorrow;
  const emptyTitle = selectedDay === "today" ? "今天没有课程" : "明天没有课程";
  const emptyDescription =
    selectedDay === "today"
      ? "可以切换到明日课程，或前往课表查看其他日期。"
      : "可以返回今日课程，或前往课表查看本周安排。";

  function selectDay(day: SelectedDay) {
    setManualSelection(day);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextDay: SelectedDay | null = null;
    if (event.key === "ArrowLeft" || event.key === "Home") nextDay = "today";
    if (event.key === "ArrowRight" || event.key === "End") nextDay = "tomorrow";
    if (!nextDay) return;

    event.preventDefault();
    selectDay(nextDay);
    (nextDay === "today" ? todayTabRef : tomorrowTabRef).current?.focus();
  }

  return (
    <section className="section today-courses stack gap-12" aria-labelledby="today-courses-heading">
      <h2 className="sr-only" id="today-courses-heading">
        今日与明日课程
      </h2>
      <div className="course-day-tabs" role="tablist" aria-label="选择课程日期">
        <button
          className={`course-day-tab${selectedDay === "today" ? " is-active" : ""}`}
          id="course-tab-today"
          ref={todayTabRef}
          type="button"
          role="tab"
          aria-controls="course-day-panel"
          aria-selected={selectedDay === "today"}
          tabIndex={selectedDay === "today" ? 0 : -1}
          onClick={() => selectDay("today")}
          onKeyDown={handleTabKeyDown}
        >
          今日课程
        </button>
        <button
          className={`course-day-tab${selectedDay === "tomorrow" ? " is-active" : ""}`}
          id="course-tab-tomorrow"
          ref={tomorrowTabRef}
          type="button"
          role="tab"
          aria-controls="course-day-panel"
          aria-selected={selectedDay === "tomorrow"}
          tabIndex={selectedDay === "tomorrow" ? 0 : -1}
          onClick={() => selectDay("tomorrow")}
          onKeyDown={handleTabKeyDown}
        >
          明日课程
        </button>
      </div>

      <div
        className="course-day-panel"
        id="course-day-panel"
        role="tabpanel"
        aria-labelledby={`course-tab-${selectedDay}`}
      >
        {sessions.length ? (
          <div className="course-card-list">
            {sessions.map((session) => {
              const times = courseSessionTimes(session);
              const status = getCourseStatus(session, courseDate, now);
              const showStatus = status === "warning" || status === "active";
              const { course } = session;
              return (
                <article
                  className={`course-card course-card--${status}`}
                  key={courseSessionKey(session)}
                  aria-label={`${course.course_name}，${courseStatusLabels[status]}`}
                >
                  <span className="course-card__stripe" aria-hidden="true" />
                  <div className="course-card__content">
                    <div className="course-card__row course-card__row--primary">
                      <time className="course-card__time" dateTime={times?.start}>
                        {times?.start ?? "--:--"}
                      </time>
                      <div className="course-card__title">
                        <h3 className="text-clamp-2">{course.course_name}</h3>
                        {showStatus ? (
                          <span className="course-card__status">{courseStatusLabels[status]}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="course-card__row course-card__row--meta">
                      <time className="course-card__time" dateTime={times?.end}>
                        {times?.end ?? "--:--"}
                      </time>
                      <p
                        className="course-card__meta"
                        title={`${courseSessionPeriodLabel(session)} | ${course.place || "地点待定"} | ${course.teacher || "教师待定"}`}
                      >
                        {courseSessionPeriodLabel(session)} | {course.place || "地点待定"} |{" "}
                        {course.teacher || "教师待定"}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            icon={CalendarClock}
            action={
              <Link className="button button--secondary" to="/schedule">
                查看本周
              </Link>
            }
          />
        )}
      </div>
    </section>
  );
}
