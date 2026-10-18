import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import type { IndexCardKey, IndexCardSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { CampusAccountOverview } from "../components/CampusAccountOverview";
import { CountdownOverview } from "../components/CountdownOverview";
import { SemesterGradesOverview } from "../components/SemesterGradesOverview";
import { TodayAnnouncements } from "../components/TodayAnnouncements";
import { TodayCourses, TodayCoursesAuthPrompt } from "../components/TodayCourses";
import {
  AuthPrompt,
  PageError,
  PageHeader,
  PageSkeleton,
  QueryState,
  Section,
  StatusMessage,
} from "../components/ui";
import { useMinuteClock } from "../hooks/useMinuteClock";
import {
  currentWeekday,
  daysUntilDate,
  formatDateHeading,
  formatMonthDayWithWeekday,
  formatShanghaiDateKey,
  formatTime,
  getCurrentWeek,
  isDateInSemester,
  parseApiDate,
} from "../utils/format";
import { findCurrentSemester } from "../utils/semester";

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const defaultIndexCards: readonly IndexCardKey[] = [
  "jifen",
  "course",
  "tasks",
  "electricity",
  "campus",
  "email",
];

type RecentMatterTone = "neutral" | "warning" | "success";

interface RecentMatterItem {
  key: string;
  label: string;
  title: string;
  detail: string;
  tone: RecentMatterTone;
  to: string;
  sortAt: number;
}

function recentMatterTone(days: number): RecentMatterTone {
  if (days <= 2) return "warning";
  if (days <= 4) return "success";
  return "neutral";
}

function normalizeTimeRange(value: string | null | undefined) {
  return value?.trim().replace(/\s*[-–—]\s*/g, "–") || null;
}

function recentMatterDetail({
  date,
  time,
  place,
}: {
  date: string;
  time?: string | null;
  place?: string | null;
}) {
  return [formatMonthDayWithWeekday(date), normalizeTimeRange(time), place?.trim() || null]
    .filter((item): item is string => Boolean(item))
    .join(" ｜ ");
}

function collectRecentItems<T>(
  items: readonly T[] | undefined,
  dateOf: (item: T) => string | null,
  mapItem: (item: T, index: number) => Omit<RecentMatterItem, "tone" | "sortAt">,
  today: Date,
) {
  return (items ?? []).flatMap((item, index) => {
    const value = dateOf(item);
    if (!value) return [];
    const days = daysUntilDate(value, today);
    if (days === null || days < 0 || days > 6) return [];
    return [
      {
        ...mapItem(item, index),
        tone: recentMatterTone(days),
        sortAt: parseApiDate(value)?.getTime() ?? Number.MAX_SAFE_INTEGER,
      },
    ];
  });
}

function RecentMatterRow({
  label,
  title,
  detail,
  emptyText,
  tone,
  state,
  to,
  onRetry,
}: {
  label: string;
  title?: string;
  detail?: string;
  emptyText: string;
  tone: RecentMatterTone;
  state: "pending" | "error" | "success";
  to: string;
  onRetry: () => void;
}) {
  const copy = (
    <div className="today-recent-row__copy">
      <span className="today-recent-row__label">{label}</span>
      <strong className="text-clamp-2">
        {state === "pending" ? "加载中…" : state === "error" ? "暂不可用" : (title ?? emptyText)}
      </strong>
      {state === "success" && title && detail ? (
        <span className="today-recent-row__detail text-clamp-2">{detail}</span>
      ) : null}
    </div>
  );
  const rowClassName = `today-recent-row today-recent-row--${tone}`;
  const stripe = (
    <span className={`today-recent-row__stripe today-recent-row__stripe--${tone}`} aria-hidden />
  );

  if (state === "error") {
    return (
      <div className={rowClassName} role="alert">
        {stripe}
        {copy}
        <button
          className="icon-button"
          type="button"
          aria-label={`重新加载${label}`}
          title={`重新加载${label}`}
          onClick={onRetry}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (state === "pending" || !title) {
    return (
      <div
        className={rowClassName}
        role={state === "pending" ? "status" : undefined}
        aria-label={state === "pending" ? `正在加载${label}` : undefined}
      >
        {stripe}
        {copy}
      </div>
    );
  }

  return (
    <Link
      className={rowClassName}
      to={to}
      aria-label={`${label}，${title}${detail ? `，${detail}` : ""}`}
    >
      {stripe}
      {copy}
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

export default function TodayPage() {
  const { isAuthenticated } = useAuth();
  const now = useMinuteClock();
  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: () => api.semester.get(),
  });
  const semester = findCurrentSemester(semesterTable.data);
  const countdown = useQuery({
    queryKey: ["countdown", formatShanghaiDateKey(now)],
    queryFn: api.countdown.get,
    placeholderData: (previousData) => previousData,
  });
  const courses = useQuery({
    queryKey: ["courses", semester?.xn, semester?.xq],
    queryFn: () => api.course.table(semester!.xn, semester!.xq),
    enabled: isAuthenticated && semester !== undefined,
  });
  const exams = useQuery({
    queryKey: ["exams", "recent"],
    queryFn: () => api.exam.list("recent"),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });
  const labSchedule = useQuery({
    queryKey: ["lab", "schedule"],
    queryFn: api.lab.schedule,
    enabled: isAuthenticated,
  });
  const gymAppointments = useQuery({
    queryKey: ["gym", "appointments"],
    queryFn: api.gym.appointments,
    enabled: isAuthenticated,
  });
  const notices = useQuery({
    queryKey: ["notices", "unread"],
    queryFn: () => api.notice.list("unread"),
    enabled: isAuthenticated,
  });
  const cards = useQuery({
    queryKey: ["setting", "index_card"],
    queryFn: () => api.me.setting<IndexCardSetting>("index_card"),
    enabled: isAuthenticated,
  });
  const electricity = useQuery({
    queryKey: ["dorm", "electricity"],
    queryFn: api.dorm.electricity,
    enabled: isAuthenticated,
  });
  const announcements = useQuery({
    queryKey: ["announcements"],
    queryFn: api.announcement.list,
    enabled: isAuthenticated,
  });
  const grades = useQuery({
    queryKey: ["grades", semester?.xn, semester?.xq],
    queryFn: () => api.grade.list(semester!.xn, semester!.xq),
    enabled: isAuthenticated && semester !== undefined,
  });
  const email = useQuery({
    queryKey: ["email", "unread"],
    queryFn: api.email.unread,
    enabled: isAuthenticated,
  });
  const network = useQuery({
    queryKey: ["network"],
    queryFn: api.network.summary,
    enabled: isAuthenticated,
    refetchInterval: 5 * 60 * 1000,
  });
  const campusCard = useQuery({
    queryKey: ["card", "info"],
    queryFn: api.card.info,
    enabled: isAuthenticated,
  });

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const week = semester ? getCurrentWeek(semester, today) : null;
  const tomorrowWeek = semester ? getCurrentWeek(semester, tomorrow) : null;
  const day = currentWeekday(today);
  const tomorrowDay = currentWeekday(tomorrow);
  const todayCourses =
    semester && courses.data && week !== null && isDateInSemester(semester, today)
      ? courses.data
          .filter((course) => course.day === day && course.weeks.includes(week))
          .toSorted((left, right) => left.time - right.time)
      : [];
  const tomorrowCourses =
    semester && courses.data && tomorrowWeek !== null && isDateInSemester(semester, tomorrow)
      ? courses.data
          .filter((course) => course.day === tomorrowDay && course.weeks.includes(tomorrowWeek))
          .toSorted((left, right) => left.time - right.time)
      : [];
  const recentMatters = [
    ...collectRecentItems(
      exams.data,
      (item) => (item.date ? `${item.date} ${item.start_time ?? "00:00"}` : null),
      (item, index) => ({
        key: `exam-${item.course_id ?? "custom"}-${item.date ?? "undated"}-${index}`,
        label: "考试",
        title: item.course_name,
        detail: recentMatterDetail({
          date: item.date!,
          time: item.start_time
            ? `${item.start_time}${item.end_time ? `-${item.end_time}` : ""}`
            : null,
          place: item.classroom || item.area,
        }),
        to: "/services/exams",
      }),
      now,
    ),
    ...collectRecentItems(
      labSchedule.data,
      (item) => item.date_time,
      (item, index) => ({
        key: `lab-${item.name}-${item.date_time}-${index}`,
        label: "实验",
        title: item.name,
        detail: recentMatterDetail({
          date: item.date_time,
          time: formatTime(item.date_time),
          place: item.place,
        }),
        to: "/services/lab/schedule",
      }),
      now,
    ),
    ...collectRecentItems(
      gymAppointments.data,
      (item) => item.show_date,
      (item, index) => ({
        key: `gym-${item.name}-${item.show_date}-${item.time}-${index}`,
        label: "体测预约",
        title: item.name,
        detail: recentMatterDetail({
          date: item.show_date,
          time: item.time,
        }),
        to: "/services/gym/appointment",
      }),
      now,
    ),
  ].toSorted((left, right) => left.sortAt - right.sortAt);
  const recentMattersLoaded =
    exams.data !== undefined &&
    labSchedule.data !== undefined &&
    gymAppointments.data !== undefined;
  const configuredCards = cards.data?.setting.cards ?? defaultIndexCards;
  const announcementPreview = isAuthenticated ? (
    <TodayAnnouncements
      announcements={announcements.data}
      isPending={announcements.isPending}
      error={announcements.error}
      onRetry={() => void announcements.refetch()}
    />
  ) : null;

  return (
    <div className="page">
      <PageHeader
        title={formatDateHeading(now)}
        description={
          semester ? (
            <span aria-live="polite" aria-atomic="true">
              {semester.xn} {semester.xq_text} ·{" "}
              <strong>第 {getCurrentWeek(semester, now)} 周</strong>
            </span>
          ) : undefined
        }
        leadingAction={
          <Link
            className="icon-button today-notice-button"
            to="/notices"
            aria-label={
              isAuthenticated && notices.data
                ? `${notices.data.count} 条未读通知`
                : isAuthenticated
                  ? "查看通知"
                  : "登录后查看通知"
            }
          >
            <Bell aria-hidden="true" />
            {isAuthenticated && notices.data && notices.data.count > 0 ? (
              <span className="today-notice-button__badge" aria-hidden="true">
                {notices.data.count > 99 ? "99+" : notices.data.count}
              </span>
            ) : null}
          </Link>
        }
      />

      {!isAuthenticated && semesterTable.isError && semesterTable.data === undefined ? (
        <StatusMessage tone="danger">
          <span className="flex-1">学期信息加载失败。</span>
          <button
            className="button button--text button--small"
            type="button"
            aria-label="重新加载学期信息"
            onClick={() => void semesterTable.refetch()}
          >
            <RotateCcw aria-hidden="true" />
            重试
          </button>
        </StatusMessage>
      ) : null}

      {announcementPreview}

      {!isAuthenticated ? (
        <TodayCoursesAuthPrompt />
      ) : configuredCards.includes("course") && semester && courses.data ? (
        <TodayCourses
          key={calendarDateKey(today)}
          todayCourses={todayCourses}
          tomorrowCourses={tomorrowCourses}
          today={today}
          tomorrow={tomorrow}
          now={now}
        />
      ) : configuredCards.includes("course") ? (
        <Section title="今日与明日课程" className="today-courses">
          <QueryState query={semesterTable} loadingRows={3}>
            {() => (
              <QueryState query={courses} loadingRows={3}>
                {() => null}
              </QueryState>
            )}
          </QueryState>
        </Section>
      ) : null}

      {countdown.isError && countdown.data === undefined ? (
        <Section title="倒计时">
          <PageError error={countdown.error} onRetry={() => void countdown.refetch()} />
        </Section>
      ) : countdown.data ? (
        <CountdownOverview data={countdown.data} />
      ) : (
        <Section title="倒计时">
          <PageSkeleton rows={2} />
        </Section>
      )}

      {!isAuthenticated ? (
        <Section title="校园账户">
          <AuthPrompt
            headingLevel={3}
            title="登录后查看校园账户"
            description="查看校园网、邮件、宿舍电量和校园卡余额。"
          />
        </Section>
      ) : (
        <CampusAccountOverview
          network={network}
          email={email}
          electricity={electricity}
          campusCard={campusCard}
        />
      )}

      <Section title="近期事项">
        {!isAuthenticated ? (
          <AuthPrompt
            headingLevel={3}
            title="登录后查看近期事项"
            description="考试、实验和体测预约需要登录后查看。"
          />
        ) : (
          <div className="surface list today-recent-list">
            {recentMatters.map((matter) => (
              <RecentMatterRow
                key={matter.key}
                label={matter.label}
                title={matter.title}
                detail={matter.detail}
                emptyText=""
                tone={matter.tone}
                state="success"
                to={matter.to}
                onRetry={() => undefined}
              />
            ))}
            {exams.data === undefined ? (
              <RecentMatterRow
                label="考试"
                emptyText=""
                tone="neutral"
                state={exams.isError ? "error" : "pending"}
                to="/services/exams"
                onRetry={() => void exams.refetch()}
              />
            ) : null}
            {labSchedule.data === undefined ? (
              <RecentMatterRow
                label="实验"
                emptyText=""
                tone="neutral"
                state={labSchedule.isError ? "error" : "pending"}
                to="/services/lab/schedule"
                onRetry={() => void labSchedule.refetch()}
              />
            ) : null}
            {gymAppointments.data === undefined ? (
              <RecentMatterRow
                label="体测预约"
                emptyText=""
                tone="neutral"
                state={gymAppointments.isError ? "error" : "pending"}
                to="/services/gym/appointment"
                onRetry={() => void gymAppointments.refetch()}
              />
            ) : null}
            {recentMattersLoaded && recentMatters.length === 0 ? (
              <p className="today-recent-list__empty">未来 6 天暂无考试、实验或体测预约</p>
            ) : null}
          </div>
        )}
      </Section>

      {!isAuthenticated ? (
        <Section title="课程成绩">
          <AuthPrompt
            headingLevel={3}
            title="登录后查看课程成绩"
            description="查看当前学期已公布的课程成绩和绩点。"
          />
        </Section>
      ) : !semester ? (
        <Section title="课程成绩">
          {semesterTable.isError ? (
            <PageError error={semesterTable.error} onRetry={() => void semesterTable.refetch()} />
          ) : (
            <PageSkeleton rows={2} />
          )}
        </Section>
      ) : grades.isError && grades.data === undefined ? (
        <Section title="课程成绩">
          <PageError error={grades.error} onRetry={() => void grades.refetch()} />
        </Section>
      ) : grades.data ? (
        <SemesterGradesOverview semester={semester} grades={grades.data} />
      ) : (
        <Section title="课程成绩">
          <PageSkeleton rows={3} />
        </Section>
      )}
    </div>
  );
}
