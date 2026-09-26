import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Netflow } from "../api/types";
import { formatCurrency, formatNumber } from "../utils/format";
import { Section } from "./ui";

interface NetworkOverviewProps {
  data: Netflow;
}

export function NetworkOverview({ data }: NetworkOverviewProps) {
  const hasPaymentDue = data.overdue_payment > 0;
  const needsAttention = data.is_locked || hasPaymentDue;
  const hasExtendedUsage = data.extend_usage > 0;
  const usagePercentage = formatNumber(data.base_percentage * 100);
  const usageTone =
    data.base_percentage > 0.9 ? "primary" : data.base_percentage > 0.5 ? "warning" : "normal";
  const accountStatus = data.is_locked ? "已锁定" : "正常";
  const paymentStatus = hasPaymentDue ? formatCurrency(data.overdue_payment) : "无欠费";
  const extendedUsage = `${formatNumber(data.extend_usage)} GB`;

  return (
    <Section title="校园网">
      <Link
        className={`network-overview${needsAttention ? " network-overview--attention" : ""}`}
        to="/services/network"
        aria-label={`校园网本月已用 ${data.total}${hasExtendedUsage ? `，超额流量 ${extendedUsage}` : ""}，账号${accountStatus}，${hasPaymentDue ? `欠费 ${paymentStatus}` : paymentStatus}`}
      >
        <div className="network-overview__heading">
          <span className="network-overview__eyebrow">本月已用</span>
          <ChevronRight className="network-overview__chevron" aria-hidden="true" />
        </div>

        <div className="network-overview__usage">
          <div className="network-overview__usage-main">
            <strong>{data.total}</strong>
            {hasExtendedUsage ? (
              <span className="network-overview__overage">超额 {extendedUsage}</span>
            ) : null}
          </div>
          <span className="network-overview__percentage">{usagePercentage}%</span>
        </div>
        <progress
          className={`progress network-overview__progress network-overview__progress--${usageTone}`}
          value={Math.min(Math.max(data.base_percentage, 0), 1)}
          max={1}
          aria-label={`免费流量已使用 ${usagePercentage}%`}
        >
          {usagePercentage}%
        </progress>

        <dl className="network-overview__status">
          <div>
            <dt>免费流量</dt>
            <dd>{data.base_amount}</dd>
          </div>
          <div>
            <dt>账号状态</dt>
            <dd className={data.is_locked ? "is-attention" : "is-normal"}>{accountStatus}</dd>
          </div>
          <div>
            <dt>欠费</dt>
            <dd className={hasPaymentDue ? "is-attention" : "is-normal"}>{paymentStatus}</dd>
          </div>
        </dl>
      </Link>
    </Section>
  );
}
