import { useQuery } from "@tanstack/react-query";
import {
  Award,
  BedDouble,
  BookOpenCheck,
  Building2,
  CircleGauge,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FlaskConical,
  Gift,
  GraduationCap,
  HelpCircle,
  LockKeyhole,
  Mail,
  Megaphone,
  RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader, Section, StatusMessage } from "../components/ui";

const groups = [
  {
    title: "学习",
    tone: "blue",
    items: [
      { id: "grades", title: "成绩与排名", meta: "成绩构成、绩点与排名", icon: GraduationCap },
      { id: "exams", title: "考试安排", meta: "考场、时间与座位", icon: ClipboardList },
      { id: "rooms", title: "空教室", meta: "按日期和节次查询", icon: Building2 },
      { id: "lab", title: "大物实验", meta: "安排与实验成绩", icon: FlaskConical },
      { id: "gym", title: "体测", meta: "成绩与预约", icon: Dumbbell },
    ],
  },
  {
    title: "校园生活",
    tone: "green",
    items: [
      { id: "card", title: "校园卡", meta: "余额与消费记录", icon: CreditCard },
      { id: "dorm", title: "宿舍电量", meta: "寝室信息与剩余电量", icon: BedDouble },
      { id: "network", title: "校园网", meta: "流量、账单与明细", icon: CircleGauge },
      { id: "announcements", title: "校园公告", meta: "服务动态与通知", icon: Megaphone },
    ],
  },
  {
    title: "权益与支持",
    tone: "amber",
    items: [
      { id: "points", title: "积分中心", meta: "签到、记录与奖品", icon: Gift },
      { id: "feedback", title: "问题反馈", meta: "提交问题并跟踪进度", icon: HelpCircle, public: true },
      { id: "about", title: "关于微生活", meta: "版本与项目链接", icon: BookOpenCheck, public: true },
    ],
  },
];

export default function ServicesPage() {
  const { isAuthenticated } = useAuth();
  const email = useQuery({
    queryKey: ["email", "unread"],
    queryFn: api.email.unread,
    enabled: isAuthenticated,
  });

  return (
    <div className="page">
      <PageHeader title="服务" description="校园事务集中查询" />

      {isAuthenticated ? (
        <>
          <div className="summary-band surface">
            <div>
              <p className="muted text-sm">校园邮箱</p>
              <p className="text-lg">待处理邮件</p>
            </div>
            <div className="cluster gap-8">
              <Mail aria-hidden="true" />
              <strong className="summary-band__value">{email.isPending ? "…" : email.data?.count ?? "—"}</strong>
            </div>
          </div>
          {email.isError ? (
            <div className="cluster spread gap-8">
              <StatusMessage tone="warning">{email.error.message}</StatusMessage>
              <button className="button button--ghost button--small" type="button" onClick={() => void email.refetch()}>
                <RotateCcw aria-hidden="true" />
                重试
              </button>
            </div>
          ) : null}
        </>
      ) : null}

      {groups.map((group) => (
        <Section title={group.title} key={group.title}>
          <div className="service-grid">
            {group.items.map(({ id, title, meta, icon: Icon, public: isPublic }) => (
              <Link className="service-item" key={id} to={id === "feedback" || id === "about" ? `/${id}` : `/services/${id}`}>
                <span className={`service-item__icon service-item__icon--${group.tone}`}>
                  <Icon aria-hidden="true" />
                </span>
                <span className="service-item__title text-clamp-2">{title}</span>
                <span className="service-item__meta text-clamp-2">{meta}</span>
                {!isAuthenticated && !isPublic ? <LockKeyhole className="service-item__lock" aria-label="需要登录" /> : null}
              </Link>
            ))}
          </div>
        </Section>
      ))}

      <Section title="成长记录">
        <Link className="surface menu-link" to="/services/points">
          <Award aria-hidden="true" />
          <span>查看积分与连续签到</span>
          {!isAuthenticated ? <LockKeyhole aria-label="需要登录" /> : null}
        </Link>
      </Section>
    </div>
  );
}
