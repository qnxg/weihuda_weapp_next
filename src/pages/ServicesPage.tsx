import {
  BedDouble,
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CalendarRange,
  ChartNoAxesColumnIncreasing,
  CircleGauge,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Trophy,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, Section } from "../components/ui";

const groups = [
  {
    title: "学习",
    items: [
      { id: "grades", title: "课程成绩", meta: "成绩构成、学分与绩点", icon: GraduationCap },
      { id: "rank", title: "成绩排名", meta: "算术、加权与 GPA 排名", icon: Trophy },
      { id: "exams", title: "考试安排", meta: "考场、时间与座位", icon: ClipboardList },
      { id: "calendar", title: "校历", meta: "学期、假期与教学安排", icon: CalendarRange },
      { id: "rooms", title: "空教室", meta: "按教学楼和日期查询", icon: Building2 },
      {
        id: "lab/schedule",
        title: "实验安排",
        meta: "排期、座位与教师联系",
        icon: FlaskConical,
      },
      {
        id: "lab/grade",
        title: "实验成绩",
        meta: "总评、出勤与评分组成",
        icon: ChartNoAxesColumnIncreasing,
      },
      { id: "gym/grade", title: "体测成绩", meta: "总评、单项与视力", icon: Dumbbell },
      {
        id: "gym/appointment",
        title: "体测预约",
        meta: "预约时间与测试项目",
        icon: CalendarCheck,
      },
      {
        id: "gym/standard",
        title: "体测标准",
        meta: "单项分数与成绩要求",
        icon: BookOpenCheck,
      },
    ],
  },
  {
    title: "校园生活",
    items: [
      { id: "card", title: "校园卡", meta: "余额与消费记录", icon: CreditCard },
      { id: "dorm", title: "宿舍电量", meta: "寝室信息与剩余电量", icon: BedDouble },
      { id: "network", title: "校园网", meta: "流量、账单与明细", icon: CircleGauge },
    ],
  },
];

export default function ServicesPage() {
  return (
    <div className="page services-page">
      <PageHeader title="服务" description="校园事务集中查询" />

      {groups.map((group) => (
        <Section title={group.title} key={group.title}>
          <div className="service-grid">
            {group.items.map(({ id, title, meta, icon: Icon }) => (
              <Link className="service-item" key={id} to={`/services/${id}`}>
                <span className="service-item__icon">
                  <Icon aria-hidden="true" />
                </span>
                <span className="service-item__title text-clamp-2">{title}</span>
                <span className="service-item__meta text-clamp-2">{meta}</span>
              </Link>
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}
