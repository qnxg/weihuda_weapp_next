import { BookOpenText, CalendarRange, PartyPopper, type LucideIcon } from "lucide-react";
import type { CountdownInfo, HolidayCountdownInfo, SemesterCountdownInfo } from "../api/types";
import { termName } from "../utils/format";
import { Section } from "./ui";

type CountdownTone = "warning" | "success" | "info" | "neutral";

function formatMonthDay(value: string) {
  const [, month, day] = value.split("-").map(Number);
  return month && day ? `${month} 月 ${day} 日` : value;
}

function formatHolidayRange(holiday: HolidayCountdownInfo) {
  const start = formatMonthDay(holiday.start);
  const end = formatMonthDay(holiday.end);
  const [, startMonth] = holiday.start.split("-").map(Number);
  const [, endMonth, endDay] = holiday.end.split("-").map(Number);
  return startMonth === endMonth && endDay ? `${start}至 ${endDay} 日` : `${start}至 ${end}`;
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
          <p>
            <strong>{metricValue}</strong> 天
          </p>
        )}
        {footnote ? <small>{footnote}</small> : null}
      </div>
    </article>
  );
}

function HolidayCountdownItem({ countdown }: { countdown: HolidayCountdownInfo | null }) {
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

  const isActive = countdown.status === "active";
  const dateRange = formatHolidayRange(countdown);
  const ariaLabel = isActive
    ? `${countdown.name}假期进行中，剩余 ${countdown.days} 天，${dateRange}，共 ${countdown.duration} 天`
    : `距离${countdown.name}还有 ${countdown.days} 天，${dateRange}，共 ${countdown.duration} 天`;

  return (
    <CountdownItem
      icon={PartyPopper}
      tone={isActive ? "success" : "warning"}
      eyebrow={isActive ? "假期进行中" : "距离假期"}
      title={countdown.name}
      detail={`${dateRange} · ${countdown.duration} 天`}
      metricLabel={isActive ? "剩余" : "还有"}
      metricValue={countdown.days}
      footnote={isActive ? "含今天" : undefined}
      ariaLabel={ariaLabel}
    />
  );
}

function SemesterCountdownItem({ countdown }: { countdown: SemesterCountdownInfo | null }) {
  if (!countdown) {
    return (
      <CountdownItem
        icon={BookOpenText}
        tone="neutral"
        eyebrow="学期倒计时"
        title="暂无学期信息"
        detail="等待后端同步学期安排"
        metricText="待同步"
        ariaLabel="暂无学期倒计时，等待后端同步学期安排"
      />
    );
  }

  const title = `${countdown.xn} ${termName(countdown.xq)}`;
  const targetDate = formatMonthDay(countdown.target_date);
  if (countdown.status === "completed") {
    return (
      <CountdownItem
        icon={BookOpenText}
        tone="neutral"
        eyebrow="学期倒计时"
        title={title}
        detail={`${targetDate}已结束 · 共 ${countdown.weeks} 周`}
        metricText="已结束"
        ariaLabel={`${title}已于 ${targetDate}结束，共 ${countdown.weeks} 周`}
      />
    );
  }

  const boundaryLabel = countdown.status === "upcoming" ? "开始" : "结束";
  return (
    <CountdownItem
      icon={BookOpenText}
      tone="info"
      eyebrow={`距离学期${boundaryLabel}`}
      title={title}
      detail={`${targetDate}${boundaryLabel} · 共 ${countdown.weeks} 周`}
      metricLabel="还有"
      metricValue={countdown.days}
      ariaLabel={`距离${title}${boundaryLabel}还有 ${countdown.days} 天，${targetDate}${boundaryLabel}，共 ${countdown.weeks} 周`}
    />
  );
}

export function CountdownOverview({ data }: { data: CountdownInfo }) {
  return (
    <Section title="倒计时" className="countdown-overview">
      <div className="countdown-list">
        <HolidayCountdownItem countdown={data.holiday} />
        <SemesterCountdownItem countdown={data.semester} />
      </div>
    </Section>
  );
}
