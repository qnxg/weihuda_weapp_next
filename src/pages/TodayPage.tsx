import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import type { IndexCardKey, IndexCardSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { CountdownOverview } from "../components/CountdownOverview";
import { TodayCourses } from "../components/TodayCourses";
import { AuthPrompt, PageError, PageHeader, PageSkeleton, Section } from "../components/ui";
import { useMinuteClock } from "../hooks/useMinuteClock";
import {
  currentWeekday,
  formatDate,
  formatDateHeading,
  getCurrentWeek,
  isDateInSemester,
  termName,
} from "../utils/format";

const CAMPUS_IMAGE = "https://placehold.co/640x320";

function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export default function TodayPage() {
  const { isAuthenticated } = useAuth();
  const now = useMinuteClock();
  const semester = useQuery({
    queryKey: ["semester", "current"],
    queryFn: () => api.semester.get(),
    enabled: isAuthenticated,
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

  if (!isAuthenticated) {
    return (
      <div className="page">
        <PageHeader title="微生活" description={formatDate(new Date())} />
        <div className="hero-image">
          <img
            src={CAMPUS_IMAGE}
            width="800"
            height="450"
            alt="清晨的湖南大学校园"
            fetchPriority="high"
          />
          <div className="hero-image__caption">
            <h2>校园生活，从今天开始</h2>
          </div>
        </div>
        <AuthPrompt
          title="登录后查看今日课表"
          description="课程、考试和个人提醒只对你可见，登录后会回到这里。"
        />
        <Link className="button button--secondary button--block" to="/services">
          先看看校园服务
        </Link>
      </div>
    );
  }

  const queries = [semester, courses, exams, notices, cards];
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="今日" />
        <PageError
          error={failed.error}
          onRetry={() => void Promise.all(queries.map((query) => query.refetch()))}
        />
      </div>
    );
  }
  if (queries.some((query) => query.isPending)) {
    return (
      <div className="page">
        <PageSkeleton rows={6} />
      </div>
    );
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const week = getCurrentWeek(semester.data!, today);
  const tomorrowWeek = getCurrentWeek(semester.data!, tomorrow);
  const day = currentWeekday(today);
  const tomorrowDay = currentWeekday(tomorrow);
  const todayCourses = isDateInSemester(semester.data!, today)
    ? courses
        .data!.filter((course) => course.day === day && course.weeks.includes(week))
        .toSorted((left, right) => left.time - right.time)
    : [];
  const tomorrowCourses = isDateInSemester(semester.data!, tomorrow)
    ? courses
        .data!.filter((course) => course.day === tomorrowDay && course.weeks.includes(tomorrowWeek))
        .toSorted((left, right) => left.time - right.time)
    : [];
  const upcomingExam = exams.data!.find(
    (exam) => exam.date && new Date(`${exam.date}T23:59:59`) >= new Date(),
  );
  const configuredCards = cards.data!.setting.cards;
  const overviewCards = configuredCards.filter((card) => !["course", "tasks"].includes(card));

  function overviewRow(card: IndexCardKey): ReactNode {
    switch (card) {
      case "jifen":
        return (
          <Link className="data-row" to="/services/points">
            <span>积分与签到</span>
            <strong>
              {points.data
                ? `${points.data.jifen} 分 · 连续 ${points.data.combo} 天${points.data.is_checked ? " · 已签到" : ""}`
                : "暂不可用"}
            </strong>
          </Link>
        );
      case "electricity":
        return (
          <Link className="data-row" to="/services/dorm">
            <span>宿舍电量</span>
            <strong>{electricity.data?.balance || "暂不可用"}</strong>
          </Link>
        );
      case "campus":
        return (
          <Link className="data-row" to="/services/announcements">
            <span>校园动态</span>
            <strong className="text-clamp-2">{announcements.data?.[0]?.title || "暂无公告"}</strong>
          </Link>
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
          <Link className="data-row" to="/services/exams">
            <span>考试倒计时</span>
            <strong>{days === null ? "暂无考试" : `${days} 天`}</strong>
          </Link>
        );
      }
      case "grade": {
        const latest = grades.data?.[0];
        return (
          <Link className="data-row" to="/services/grades">
            <span>最新成绩</span>
            <strong>
              {latest
                ? `${latest.course_name} ${latest.score} · GPA ${latest.gpa ?? "—"}`
                : "暂无成绩"}
            </strong>
          </Link>
        );
      }
      case "email":
        return (
          <div className="data-row">
            <span>校内邮箱</span>
            <strong>{email.data ? `${email.data.count} 封未读` : "暂不可用"}</strong>
          </div>
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
          <>
            {semester.data!.xn} {termName(semester.data!.xq)} · <strong>第 {week} 周</strong>
          </>
        }
        leadingAction={
          <Link
            className="icon-button"
            to="/notices"
            aria-label={`${notices.data!.count} 条未读通知`}
          >
            <Bell aria-hidden="true" />
          </Link>
        }
      />

      {configuredCards.includes("course") ? (
        <TodayCourses
          key={calendarDateKey(today)}
          todayCourses={todayCourses}
          tomorrowCourses={tomorrowCourses}
          today={today}
          tomorrow={tomorrow}
          now={now}
        />
      ) : null}

      <CountdownOverview semester={semester.data!} now={now} />

      <Section title="近期事项">
        <div className="surface">
          {configuredCards.includes("tasks") && upcomingExam ? (
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
          <Link className="data-row" to="/notices">
            <span>未读通知</span>
            <strong className="tabular">{notices.data!.count}</strong>
          </Link>
        </div>
      </Section>

      {overviewCards.length ? (
        <Section title="校园速览" description={`按首页设置展示 · 版本 ${cards.data!.version}`}>
          <div className="surface list">
            {overviewCards.map((card) => (
              <div key={card}>{overviewRow(card)}</div>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
