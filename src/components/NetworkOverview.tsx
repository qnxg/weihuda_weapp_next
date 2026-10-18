import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Netflow } from "../api/types";
import { formatCurrency, formatNumber } from "../utils/format";
import { NetworkUsageSummary } from "./NetworkUsageSummary";

interface NetworkOverviewProps {
  data: Netflow;
}

export function NetworkOverview({ data }: NetworkOverviewProps) {
  const hasPaymentDue = data.overdue_payment > 0;
  const needsAttention = data.is_locked || hasPaymentDue;
  const hasExtendedUsage = data.extend_usage > 0;
  const accountStatus = data.is_locked ? "已锁定" : "正常";
  const paymentStatus = hasPaymentDue ? formatCurrency(data.overdue_payment) : "无欠费";
  const extendedUsage = `${formatNumber(data.extend_usage)} GB`;

  return (
    <Link
      className={`network-overview${needsAttention ? " network-overview--attention" : ""}`}
      to="/services/network"
      aria-label={`校园网本月已用 ${data.total}${hasExtendedUsage ? `，超额流量 ${extendedUsage}` : ""}，账号${accountStatus}，${hasPaymentDue ? `欠费 ${paymentStatus}` : paymentStatus}`}
    >
      <NetworkUsageSummary
        data={data}
        eyebrow={
          <>
            <strong>校园网</strong>
            <span>本月已用</span>
          </>
        }
        action={<ChevronRight className="network-overview__chevron" aria-hidden="true" />}
        showExtendedUsage
      />

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
  );
}
