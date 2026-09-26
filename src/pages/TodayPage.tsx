import { useQuery } from "@tanstack/react-query";
import { Bell, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import type { IndexCardKey, IndexCardSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { CountdownOverview } from "../components/CountdownOverview";
import { NetworkOverview } from "../components/NetworkOverview";
import { TodayCourses, TodayCoursesAuthPrompt } from "../components/TodayCourses";
import {
  AuthPrompt,
  PageError,
  PageHeader,
  PageSkeleton,
  QueryState,
  Section,
} from "../components/ui";
import { useMinuteClock } from "../hooks/useMinuteClock";
import {
  currentWeekday,
  formatDate,
  formatDateHeading,
  formatShanghaiDateKey,
  getCurrentWeek,
  isDateInSemester,
  termName,
} from "../utils/format";

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const defaultIndexCards: readonly IndexCardKey[] = [
  "jifen",
  "course",
  "tasks",
  "electricity",
  "campus",
];

function OverviewRow({
  label,
  value,
  state,
  to,
  onRetry,
}: {
  label: string;
  value: ReactNode;
  state: "pending" | "error" | "success";
  to?: string;
  onRetry: () => void;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong className="text-clamp-2">{state === "pending" ? "加载中…" : value}</strong>
    </>
  );

  if (state === "error") {
    return (
      <div className="data-row">
        <span>{label}</span>
        <span className="cluster gap-8">
          <strong>暂不可用</strong>
          <button
            className="button button--text button--small"
            type="button"
            aria-label={`重新加载${label}`}
            onClick={onRetry}
          >
            重试
          </button>
        </span>
      </div>
    );
  }

  return to ? (
    <Link className="data-row" to={to}>
      {content}
    </Link>
  ) : (
    <div className="data-row">{content}</div>
  );
}

export default function TodayPage() {
  const { isAuthenticated } = useAuth();
  const now = useMinuteClock();
  const semester = useQuery({
    queryKey: ["semester", "current"],
    queryFn: () => api.semester.get(),
  });
  const countdown = useQuery({
    queryKey: ["countdown", formatShanghaiDateKey(now)],
    queryFn: api.countdown.get,
    placeholderData: (previousData) => previousData,
  });
  const courses = useQuery({
    queryKey: ["courses", semester.data?.xn, semester.data?.xq],
    queryFn: () => api.course.table(semester.data!.xn, semester.data!.xq),
    enabled: isAuthenticated && semester.data !== undefined,
  });
  const exams = useQuery({ queryKey: ["exams"], queryFn: api.exam.list, enabled: isAuthenticated });
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
  const points = useQuery({
    queryKey: ["points"],
    queryFn: api.points.summary,
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
    queryKey: ["grades", semester.data?.xn, semester.data?.xq],
    queryFn: () => api.grade.list(semester.data!.xn, semester.data!.xq),
    enabled: isAuthenticated && semester.data !== undefined,
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

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const week = semester.data ? getCurrentWeek(semester.data, today) : null;
  const tomorrowWeek = semester.data ? getCurrentWeek(semester.data, tomorrow) : null;
  const day = currentWeekday(today);
  const tomorrowDay = currentWeekday(tomorrow);
  const todayCourses =
    semester.data && courses.data && week !== null && isDateInSemester(semester.data, today)
      ? courses.data
          .filter((course) => course.day === day && course.weeks.includes(week))
          .toSorted((left, right) => left.time - right.time)
      : [];
  const tomorrowCourses =
    semester.data &&
    courses.data &&
    tomorrowWeek !== null &&
    isDateInSemester(semester.data, tomorrow)
      ? courses.data
          .filter((course) => course.day === tomorrowDay && course.weeks.includes(tomorrowWeek))
          .toSorted((left, right) => left.time - right.time)
      : [];
  const upcomingExam = exams.data?.find(
    (exam) => exam.date && new Date(`${exam.date}T23:59:59`) >= new Date(),
  );
  const configuredCards = cards.data?.setting.cards ?? defaultIndexCards;
  const overviewCards = configuredCards.filter((card) => !["course", "tasks"].includes(card));

  function overviewRow(card: IndexCardKey): ReactNode {
    switch (card) {
      case "jifen":
        return (
          <OverviewRow
            label="积分与签到"
            value={
              points.data
                ? `${points.data.jifen} 分 · 连续 ${points.data.combo} 天${points.data.is_checked ? " · 已签到" : ""}`
                : ""
            }
            state={points.data ? "success" : points.isError ? "error" : "pending"}
            to="/services/points"
            onRetry={() => void points.refetch()}
          />
        );
      case "electricity":
        return (
          <OverviewRow
            label="宿舍电量"
            value={electricity.data?.balance ?? ""}
            state={electricity.data ? "success" : electricity.isError ? "error" : "pending"}
            to="/services/dorm"
            onRetry={() => void electricity.refetch()}
          />
        );
      case "campus":
        return (
          <OverviewRow
            label="校园动态"
            value={announcements.data?.[0]?.title ?? "暂无公告"}
            state={announcements.data ? "success" : announcements.isError ? "error" : "pending"}
            to="/services/announcements"
            onRetry={() => void announcements.refetch()}
          />
        );
      case "count_down": {
        const days = upcomingExam?.date
          ? Math.max(
              0,
              Math.ceil(
                (new Date(`${upcomingExam.date}T00:00:00`).getTime() - Date.now()) / 86_400_000,
              ),
            )
          : null;
        return (
          <OverviewRow
            label="考试倒计时"
            value={days === null ? "暂无考试" : `${days} 天`}
            state={exams.data ? "success" : exams.isError ? "error" : "pending"}
            to="/services/exams"
            onRetry={() => void exams.refetch()}
          />
        );
      }
      case "grade": {
        const latest = grades.data?.[0];
        return (
          <OverviewRow
            label="最新成绩"
            value={
              latest
                ? `${latest.course_name} ${latest.score} · GPA ${latest.gpa ?? "—"}`
                : "暂无成绩"
            }
            state={
              grades.data ? "success" : semester.isError || grades.isError ? "error" : "pending"
            }
            to="/services/grades"
            onRetry={() => void (semester.isError ? semester.refetch() : grades.refetch())}
          />
        );
      }
      case "email":
        return (
          <OverviewRow
            label="校内邮箱"
            value={email.data ? `${email.data.count} 封未读` : ""}
            state={email.data ? "success" : email.isError ? "error" : "pending"}
            onRetry={() => void email.refetch()}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={formatDateHeading(now)}
        description={
          semester.data ? (
            <span aria-live="polite" aria-atomic="true">
              {semester.data.xn} {termName(semester.data.xq)} ·{" "}
              <strong>第 {getCurrentWeek(semester.data, now)} 周</strong>
            </span>
          ) : undefined
        }
        leadingAction={
          <Link
            className="icon-button"
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
          </Link>
        }
        action={
          semester.isError ? (
            <button
              className="icon-button"
              type="button"
              onClick={() => void semester.refetch()}
              aria-label="重新加载学期信息"
            >
              <RotateCcw aria-hidden="true" />
            </button>
          ) : null
        }
      />

      {!isAuthenticated ? (
        <TodayCoursesAuthPrompt />
      ) : configuredCards.includes("course") && semester.data && courses.data ? (
        <TodayCourses
          key={calendarDateKey(today)}
          todayCourses={todayCourses}
          tomorrowCourses={tomorrowCourses}
          today={today}
          tomorrow={tomorrow}
          now={now}
        />
      ) : configuredCards.includes("course") ? (
        <Section title="今日与明日课程">
          <QueryState query={semester} loadingRows={3}>
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
        <Section title="校园网">
          <AuthPrompt
            headingLevel={3}
            title="登录后查看校园网"
            description="查看本月流量、账号状态和欠费信息。"
          />
        </Section>
      ) : network.isError && network.data === undefined ? (
        <Section title="校园网">
          <PageError error={network.error} onRetry={() => void network.refetch()} />
        </Section>
      ) : network.data ? (
        <NetworkOverview data={network.data} />
      ) : (
        <Section title="校园网">
          <PageSkeleton rows={2} />
        </Section>
      )}

      <Section title="近期事项">
        {!isAuthenticated ? (
          <AuthPrompt
            headingLevel={3}
            title="登录后查看近期事项"
            description="考试安排和未读通知需要登录后查看。"
          />
        ) : (
          <div className="surface">
            {configuredCards.includes("tasks") && exams.isError && !exams.data ? (
              <OverviewRow
                label="近期考试"
                value=""
                state="error"
                onRetry={() => void exams.refetch()}
              />
            ) : configuredCards.includes("tasks") && !exams.data ? (
              <OverviewRow
                label="近期考试"
                value=""
                state="pending"
                onRetry={() => void exams.refetch()}
              />
            ) : configuredCards.includes("tasks") && upcomingExam ? (
              <Link className="data-row" to="/services/exams">
                <div className="min-w-0">
                  <p className="data-row__label">
                    {upcomingExam.date ? formatDate(upcomingExam.date) : "日期待定"}
                  </p>
                  <strong className="text-clamp-2">{upcomingExam.course_name}</strong>
                </div>
                <span className="badge badge--warning">考试</span>
              </Link>
            ) : configuredCards.includes("tasks") ? (
              <p className="muted text-sm surface--padded">近期没有考试安排。</p>
            ) : null}
            <OverviewRow
              label="未读通知"
              value={notices.data?.count ?? ""}
              state={notices.data ? "success" : notices.isError ? "error" : "pending"}
              to="/notices"
              onRetry={() => void notices.refetch()}
            />
          </div>
        )}
      </Section>

      {!isAuthenticated ? (
        <Section title="校园速览">
          <AuthPrompt
            headingLevel={3}
            title="登录后查看校园速览"
            description="首页卡片会按你的个人设置展示。"
          />
        </Section>
      ) : cards.isError && !cards.data ? (
        <Section title="校园速览">
          <PageError error={cards.error} onRetry={() => void cards.refetch()} />
        </Section>
      ) : cards.data && overviewCards.length ? (
        <Section title="校园速览" description={`按首页设置展示 · 版本 ${cards.data.version}`}>
          <div className="surface list">
            {overviewCards.map((card) => (
              <div key={card}>{overviewRow(card)}</div>
            ))}
          </div>
        </Section>
      ) : cards.isPending ? (
        <Section title="校园速览">
          <PageSkeleton rows={3} />
        </Section>
      ) : null}
    </div>
  );
}
