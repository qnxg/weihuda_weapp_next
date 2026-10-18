import type { ReactNode } from "react";
import type { Netflow } from "../api/types";
import { formatNumber } from "../utils/format";
import { ProgressBar, type ProgressBarTone } from "./ProgressBar";

function getNetworkUsageTone(basePercentage: number): ProgressBarTone {
  if (basePercentage > 0.9) return "primary";
  if (basePercentage > 0.5) return "warning";
  return "success";
}

export function NetworkUsageSummary({
  data,
  action,
  eyebrow = "本月已用",
  showExtendedUsage = false,
}: {
  data: Netflow;
  action?: ReactNode;
  eyebrow?: ReactNode;
  showExtendedUsage?: boolean;
}) {
  const usagePercentage = formatNumber(data.base_percentage * 100);
  const usageTone = getNetworkUsageTone(data.base_percentage);
  const hasExtendedUsage = showExtendedUsage && data.extend_usage > 0;

  return (
    <div className="network-usage-summary">
      <div className="network-overview__heading">
        <span className="network-overview__eyebrow">{eyebrow}</span>
        {action}
      </div>

      <div className="network-overview__usage">
        <div className="network-overview__usage-main">
          <strong>{data.total}</strong>
          {hasExtendedUsage ? (
            <span className="network-overview__overage">
              超额 {formatNumber(data.extend_usage)} GB
            </span>
          ) : null}
        </div>
        <span className="network-overview__percentage">{usagePercentage}%</span>
      </div>

      <ProgressBar
        className="network-overview__progress"
        value={data.base_percentage}
        tone={usageTone}
        label={`免费流量已使用 ${usagePercentage}%`}
      />
    </div>
  );
}
