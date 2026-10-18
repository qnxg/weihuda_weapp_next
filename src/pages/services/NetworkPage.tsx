import { useQuery } from "@tanstack/react-query";
import {
  ChartNoAxesColumnIncreasing,
  ChevronRight,
  CircleDollarSign,
  LockKeyhole,
  LockKeyholeOpen,
  ReceiptText,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/api";
import { NetworkUsageSummary } from "../../components/NetworkUsageSummary";
import { PageHeader, QueryState } from "../../components/ui";
import { formatCurrency, formatNumber } from "../../utils/format";

export default function NetworkPage() {
  const summary = useQuery({ queryKey: ["network"], queryFn: api.network.summary });

  return (
    <div className="page">
      <PageHeader title="校园网" back />
      <QueryState query={summary} loadingRows={3}>
        {(network) => (
          <>
            <section className="section" aria-label="本月用量">
              <div className="surface surface--padded stack gap-12">
                <NetworkUsageSummary data={network} />
                <div className="metric-grid">
                  <div className="metric">
                    <p className="metric__label">上传流量</p>
                    <p className="metric__value">{network.upload}</p>
                  </div>
                  <div className="metric">
                    <p className="metric__label">下载流量</p>
                    <p className="metric__value">{network.download}</p>
                  </div>
                  <div className="metric">
                    <p className="metric__label">免费流量</p>
                    <p className="metric__value">{network.base_amount}</p>
                  </div>
                  <div className="metric">
                    <p className="metric__label">超出流量</p>
                    <p className="metric__value">{formatNumber(network.extend_usage)} GB</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="section" aria-label="账号信息">
              <ul className="surface list" aria-label="账号信息列表">
                <li className="network-account-item">
                  <CircleDollarSign aria-hidden="true" />
                  <span className="menu-link__copy">
                    <strong>欠费金额</strong>
                    <span>当前待缴费用</span>
                  </span>
                  <strong
                    className={`network-account-item__value ${
                      network.overdue_payment > 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {formatCurrency(network.overdue_payment)}
                  </strong>
                </li>
                <li className="network-account-item">
                  {network.is_locked ? (
                    <LockKeyhole aria-hidden="true" />
                  ) : (
                    <LockKeyholeOpen aria-hidden="true" />
                  )}
                  <span className="menu-link__copy">
                    <strong>锁定状态</strong>
                    <span>当前校园网账号状态</span>
                  </span>
                  <strong
                    className={`network-account-item__value ${
                      network.is_locked ? "text-danger" : "text-success"
                    }`}
                  >
                    {network.is_locked ? "已锁定" : "未锁定"}
                  </strong>
                </li>
                <li>
                  <Link className="menu-link network-history-link" to="/services/network/orders">
                    <ReceiptText aria-hidden="true" />
                    <span className="menu-link__copy">
                      <strong>历史账单</strong>
                      <span>查看每月流量与费用记录</span>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </li>
                <li>
                  <Link className="menu-link" to="/services/network/details">
                    <ChartNoAxesColumnIncreasing aria-hidden="true" />
                    <span className="menu-link__copy">
                      <strong>流量明细</strong>
                      <span>查看本月流量使用明细</span>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </li>
              </ul>
            </section>
          </>
        )}
      </QueryState>
    </div>
  );
}
