import { BookOpenText, CalendarRange, PartyPopper, type LucideIcon } from "lucide-react";
import type { Semester } from "../api/types";
import { getSemesterCountdown, termName } from "../utils/format";
import { formatHolidayRange, getHolidayCountdown } from "../utils/holiday";
import { Section } from "./ui";

type CountdownTone = "warning" | "success" | "info" | "neutral";

function formatMonthDay(date: Date) {
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

function CountdownItem({
  icon: Icon,
  tone,
  eyebrow,
  title,
  detail,
  metricLabel,
  metricValue,
  metricText,
  footnote,
  ariaLabel,
}: {
  icon: LucideIcon;
  tone: CountdownTone;
  eyebrow: string;
  title: string;
  detail: string;
  metricLabel?: string;
  metricValue?: number;
  metricText?: string;
  footnote?: string;
  ariaLabel: string;
}) {
  return (
    <article className={`countdown-item countdown-item--${tone}`} aria-label={ariaLabel}>
      <div className="countdown-item__summary">
        <span className="countdown-item__icon" aria-hidden="true">
          <Icon />
        </span>
        <div className="countdown-item__copy">
          <p className="countdown-item__eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <p className="countdown-item__detail">
          <CalendarRange aria-hidden="true" />
          <span>{detail}</span>
        </p>
      </div>
      <div className="countdown-item__metric" aria-hidden="true">
        {metricLabel ? <span>{metricLabel}</span> : null}
        {metricValue === undefined ? (
          <strong className="countdown-item__metric-text">{metricText}</strong>
        ) : (
          <p><strong>{metricValue}</strong> 天</p>
        )}
        {footnote ? <small>{footnote}</small> : null}
      </div>
    </article>
  );
}

function HolidayCountdownItem({ now }: { now: Date }) {
  const countdown = getHolidayCountdown(now);
  if (!countdown) {
    return (
      <CountdownItem
        icon={PartyPopper}
        tone="neutral"
        eyebrow="假期安排"
        title="暂无后续假期"
        detail="等待新的放假安排"
        metricText="待公布"
        ariaLabel="暂无后续假期安排，等待新的放假安排"
      />
    );
  }

  const { holiday, status, daysUntil, daysRemaining, duration } = countdown;
  const isActive = status === "active";
  const count = isActive ? daysRemaining : daysUntil;
  const ariaLabel = isActive
    ? `${holiday.name}假期进行中，剩余 ${count} 天，${formatHolidayRange(holiday)}，共 ${duration} 天`
    : `距离${holiday.name}还有 ${count} 天，${formatHolidayRange(holiday)}，共 ${duration} 天`;

  return (
    <CountdownItem
      icon={PartyPopper}
      tone={isActive ? "success" : "warning"}
      eyebrow={isActive ? "假期进行中" : "距离假期"}
      title={holiday.name}
      detail={`${formatHolidayRange(holiday)} · ${duration} 天`}
      metricLabel={isActive ? "剩余" : "还有"}
      metricValue={count}
      footnote={isActive ? "含今天" : undefined}
      ariaLabel={ariaLabel}
    />
  );
}

function SemesterCountdownItem({
  semester,
  now,
}: {
  semester: Semester;
  now: Date;
}) {
  const countdown = getSemesterCountdown(semester, now);
  const title = `${semester.xn} ${termName(semester.xq)}`;
  if (!countdown) {
    return (
      <CountdownItem
        icon={BookOpenText}
        tone="neutral"
        eyebrow="学期倒计时"
        title={title}
        detail="学期日期待定"
        metricText="待确定"
        ariaLabel={`${title}日期待定`}
      />
    );
  }

  const targetDate = formatMonthDay(countdown.target);
  if (countdown.status === "completed") {
    return (
      <CountdownItem
        icon={BookOpenText}
        tone="neutral"
        eyebrow="学期倒计时"
        title={title}
        detail={`${targetDate}已结束 · 共 ${semester.weeks} 周`}
        metricText="已结束"
        ariaLabel={`${title}已于 ${targetDate}结束，共 ${semester.weeks} 周`}
      />
    );
  }

  const isUpcoming = countdown.status === "upcoming";
  const boundaryLabel = isUpcoming ? "开始" : "结束";
  return (
    <CountdownItem
      icon={BookOpenText}
      tone="info"
      eyebrow={`距离学期${boundaryLabel}`}
      title={title}
      detail={`${targetDate}${boundaryLabel} · 共 ${semester.weeks} 周`}
      metricLabel="还有"
      metricValue={countdown.days}
      ariaLabel={`距离${title}${boundaryLabel}还有 ${countdown.days} 天，${targetDate}${boundaryLabel}，共 ${semester.weeks} 周`}
    />
  );
}

export function CountdownOverview({
  semester,
  now = new Date(),
}: {
  semester: Semester;
  now?: Date;
}) {
  return (
    <Section title="倒计时" className="countdown-overview">
      <div className="countdown-list">
        <HolidayCountdownItem now={now} />
        <SemesterCountdownItem semester={semester} now={now} />
      </div>
    </Section>
  );
}
