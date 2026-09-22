import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarClock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import type { IndexCardKey, IndexCardSetting } from "../api/types";
import { useAuth } from "../auth/AuthProvider";
import { AuthPrompt, EmptyState, PageError, PageHeader, PageSkeleton, Section } from "../components/ui";
import { currentWeekday, formatDate, getCurrentWeek, periodName, termName } from "../utils/format";

const CAMPUS_IMAGE =
  "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Realistic%20documentary%20photograph%20of%20students%20walking%20between%20red%20brick%20academic%20buildings%20at%20Hunan%20University%20campus%20on%20a%20clear%20early%20autumn%20morning%2C%20natural%20soft%20sunlight%2C%20authentic%20Chinese%20university%20life%2C%20wide%20mobile%20banner%20composition%2C%20no%20text%2C%20no%20logos&image_size=landscape_16_9";

export default function TodayPage() {
  const { isAuthenticated } = useAuth();
  const me = useQuery({ queryKey: ["me"], queryFn: api.me.get, enabled: isAuthenticated });
  const semester = useQuery({
    queryKey: ["semester", 2026, "autumn"],
    queryFn: () => api.semester.get(2026, "autumn"),
    enabled: isAuthenticated,
  });
  const courses = useQuery({
    queryKey: ["courses", 2026, "autumn"],
    queryFn: () => api.course.table(2026, "autumn"),
    enabled: isAuthenticated,
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
  const points = useQuery({ queryKey: ["points"], queryFn: api.points.summary, enabled: isAuthenticated });
  const electricity = useQuery({ queryKey: ["dorm", "electricity"], queryFn: api.dorm.electricity, enabled: isAuthenticated });
  const announcements = useQuery({ queryKey: ["announcements"], queryFn: api.announcement.list, enabled: isAuthenticated });
  const grades = useQuery({
    queryKey: ["grades", 2026, "autumn"],
    queryFn: () => api.grade.list(2026, "autumn"),
    enabled: isAuthenticated,
  });
  const email = useQuery({ queryKey: ["email", "unread"], queryFn: api.email.unread, enabled: isAuthenticated });

  if (!isAuthenticated) {
    return (
      <div className="page">
        <PageHeader title="微生活" description={formatDate(new Date())} />
        <div className="hero-image">
          <img src={CAMPUS_IMAGE} width="800" height="450" alt="清晨的湖南大学校园" fetchPriority="high" />
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

  const queries = [me, semester, courses, exams, notices, cards];
  if (queries.some((query) => query.isPending)) {
    return <div className="page"><PageSkeleton rows={6} /></div>;
  }
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="今日" />
        <PageError error={failed.error} onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      </div>
    );
  }

  const week = getCurrentWeek(semester.data!);
  const day = currentWeekday();
  const todayCourses = courses.data!
    .filter((course) => course.day === day && course.weeks.includes(week))
    .toSorted((left, right) => left.time - right.time);
  const upcomingExam = exams.data!.find((exam) => exam.date && new Date(`${exam.date}T23:59:59`) >= new Date());
  const configuredCards = cards.data!.setting.cards;
  const overviewCards = configuredCards.filter((card) => !["course", "tasks"].includes(card));

  function overviewRow(card: IndexCardKey): ReactNode {
    switch (card) {
      case "jifen":
        return <Link className="data-row" to="/services/points"><span>积分与签到</span><strong>{points.data ? `${points.data.jifen} 分 · 连续 ${points.data.combo} 天${points.data.is_checked ? " · 已签到" : ""}` : "暂不可用"}</strong></Link>;
      case "electricity":
        return <Link className="data-row" to="/services/dorm"><span>宿舍电量</span><strong>{electricity.data?.balance || "暂不可用"}</strong></Link>;
      case "campus":
        return <Link className="data-row" to="/services/announcements"><span>校园动态</span><strong className="text-clamp-2">{announcements.data?.[0]?.title || "暂无公告"}</strong></Link>;
      case "count_down": {
        const days = upcomingExam?.date
          ? Math.max(0, Math.ceil((new Date(`${upcomingExam.date}T00:00:00`).getTime() - Date.now()) / 86_400_000))
          : null;
        return <Link className="data-row" to="/services/exams"><span>考试倒计时</span><strong>{days === null ? "暂无考试" : `${days} 天`}</strong></Link>;
      }
      case "grade": {
        const latest = grades.data?.[0];
        return <Link className="data-row" to="/services/grades"><span>最新成绩</span><strong>{latest ? `${latest.course_name} ${latest.score} · GPA ${latest.gpa ?? "—"}` : "暂无成绩"}</strong></Link>;
      }
      case "email":
        return <div className="data-row"><span>校内邮箱</span><strong>{email.data ? `${email.data.count} 封未读` : "暂不可用"}</strong></div>;
      default:
        return null;
    }
  }

  return (
    <div className="page">
      <PageHeader
        title={`${me.data!.name}，今天好`}
        description={`${formatDate(new Date())} · ${semester.data!.xn} ${termName(semester.data!.xq)} · 第 ${week} 周`}
        action={
          <Link className="icon-button" to="/notices" aria-label={`${notices.data!.count} 条未读通知`}>
            <Bell aria-hidden="true" />
          </Link>
        }
      />

      {configuredCards.includes("course") ? <Section
          title="今日课程"
          action={<Link className="button button--ghost button--small" to="/schedule">完整课表</Link>}
        >
        {todayCourses.length ? (
          <div className="timeline">
            {todayCourses.map((course) => (
              <article className="timeline-item" key={`${course.course_name}-${course.time}-${course.customize_id ?? "school"}`}>
                <time className="timeline-item__time">{periodName(course.time)}</time>
                <span className="timeline-item__dot" aria-hidden="true" />
                <div className="course-block">
                  <p className="course-block__name">{course.course_name}</p>
                  <p className="course-block__meta cluster gap-4">
                    <MapPin aria-hidden="true" />
                    {course.place || "地点待定"}
                  </p>
                  <p className="course-block__meta">{course.teacher || "教师待定"}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="今天没有课程"
            description="可以查看其他日期，或添加一门自定义课程。"
            icon={CalendarClock}
            action={<Link className="button button--secondary" to="/schedule">查看本周</Link>}
          />
        )}
        </Section> : null}

      <Section title="近期事项">
        <div className="surface">
          {configuredCards.includes("tasks") && upcomingExam ? (
            <Link className="data-row" to="/services/exams">
              <div className="min-w-0">
                <p className="data-row__label">{upcomingExam.date ? formatDate(upcomingExam.date) : "日期待定"}</p>
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
            {overviewCards.map((card) => <div key={card}>{overviewRow(card)}</div>)}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
