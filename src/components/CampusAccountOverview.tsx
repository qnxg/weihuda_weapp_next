import {
  BatteryCharging,
  CreditCard,
  Mail,
  RotateCcw,
  Wifi,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { CardInfo, Netflow } from "../api/types";
import { formatCurrency } from "../utils/format";
import { NetworkOverview } from "./NetworkOverview";
import { Section } from "./ui";

interface QueryResource<T> {
  data: T | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => unknown;
}

interface CampusAccountOverviewProps {
  network: QueryResource<Netflow>;
  email: QueryResource<{ count: number }>;
  electricity: QueryResource<{ balance: string }>;
  campusCard: QueryResource<CardInfo>;
}

interface AccountSummaryCardProps {
  icon: LucideIcon;
  label: string;
  value?: string;
  state: "pending" | "error" | "success";
  to?: string;
  onRetry: () => void;
}

function AccountSummaryCard({
  icon: Icon,
  label,
  value,
  state,
  to,
  onRetry,
}: AccountSummaryCardProps) {
  const content = (
    <>
      <Icon aria-hidden="true" />
      <span className="campus-account-card__copy">
        <span className="campus-account-card__label">{label}</span>
        {state === "pending" ? (
          <span className="skeleton campus-account-card__skeleton" aria-hidden="true" />
        ) : (
          <strong>{state === "error" ? "暂不可用" : value}</strong>
        )}
      </span>
    </>
  );
  const className = `campus-account-card surface campus-account-card--${state}`;

  if (state === "error") {
    return (
      <div className={className} role="alert" aria-label={`${label}暂不可用`}>
        {content}
        <button
          className="icon-button campus-account-card__retry"
          type="button"
          aria-label={`重新加载${label}`}
          title={`重新加载${label}`}
          onClick={onRetry}
        >
          <RotateCcw aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className={className} role="status" aria-label={`正在加载${label}`}>
        {content}
      </div>
    );
  }

  return to ? (
    <Link className={className} to={to} aria-label={`${label}，${value}`}>
      {content}
    </Link>
  ) : (
    <article className={className} aria-label={`${label}，${value}`}>
      {content}
    </article>
  );
}

function queryState(resource: QueryResource<unknown>) {
  if (resource.data !== undefined) return "success";
  if (resource.isError) return "error";
  return "pending";
}

export function CampusAccountOverview({
  network,
  email,
  electricity,
  campusCard,
}: CampusAccountOverviewProps) {
  return (
    <Section title="校园账户" className="campus-account-overview">
      <div className="campus-account-overview__content">
        {network.data ? (
          <NetworkOverview data={network.data} />
        ) : network.isError ? (
          <div className="campus-account-overview__network-state surface" role="alert">
            <WifiOff aria-hidden="true" />
            <div className="min-w-0">
              <strong>校园网暂不可用</strong>
              <span>其他账户数据仍可查看</span>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="重新加载校园网"
              title="重新加载校园网"
              onClick={() => void network.refetch()}
            >
              <RotateCcw aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div
            className="campus-account-overview__network-state surface"
            role="status"
            aria-label="正在加载校园网"
          >
            <Wifi aria-hidden="true" />
            <div className="stack gap-8 flex-1" aria-hidden="true">
              <span className="skeleton skeleton--line skeleton--short" />
              <span className="skeleton skeleton--line" />
              <span className="skeleton campus-account-overview__network-progress" />
            </div>
          </div>
        )}

        <div className="campus-account-overview__grid">
          <AccountSummaryCard
            icon={Mail}
            label="未读邮件"
            value={`${email.data?.count ?? 0} 封`}
            state={queryState(email)}
            onRetry={() => void email.refetch()}
          />
          <AccountSummaryCard
            icon={BatteryCharging}
            label="宿舍剩余电量"
            value={electricity.data?.balance}
            state={queryState(electricity)}
            to="/services/dorm"
            onRetry={() => void electricity.refetch()}
          />
          <AccountSummaryCard
            icon={CreditCard}
            label="校园卡金额"
            value={
              campusCard.data === undefined ? undefined : formatCurrency(campusCard.data.balance)
            }
            state={queryState(campusCard)}
            to="/services/card"
            onRetry={() => void campusCard.refetch()}
          />
        </div>
      </div>
    </Section>
  );
}
