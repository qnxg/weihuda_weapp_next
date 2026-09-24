import { useQuery } from "@tanstack/react-query";
import { LockKeyhole, Wifi } from "lucide-react";
import { api } from "../../api/api";
import {
  EmptyState,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
} from "../../components/ui";
import { formatCurrency, formatDateTime, formatNumber } from "../../utils/format";

export default function NetworkPage() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const summary = useQuery({ queryKey: ["network"], queryFn: api.network.summary });
  const orders = useQuery({ queryKey: ["network", "orders"], queryFn: api.network.orders });
  const detail = useQuery({
    queryKey: ["network", "detail", year, month],
    queryFn: () => api.network.detail(year, month),
  });
  const queries = [summary, orders, detail];

  if (queries.some((query) => query.isPending))
    return (
      <div className="page">
        <PageSkeleton rows={7} />
      </div>
    );
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="校园网" back />
        <PageError
          error={failed.error}
          onRetry={() => void Promise.all(queries.map((query) => query.refetch()))}
        />
      </div>
    );
  }

  const network = summary.data!;
  return (
    <div className="page">
      <PageHeader title="校园网" description={`${year} 年 ${month} 月`} back />
      {network.is_locked ? (
        <StatusMessage tone="danger">
          <LockKeyhole aria-hidden="true" />
          账号已锁定，请先处理欠费。
        </StatusMessage>
      ) : network.overdue_payment > 0 ? (
        <StatusMessage tone="warning">
          待缴费用 {formatCurrency(network.overdue_payment)}
        </StatusMessage>
      ) : (
        <StatusMessage tone="success">
          <Wifi aria-hidden="true" />
          校园网状态正常
        </StatusMessage>
      )}

      <Section title="本月用量">
        <div className="surface surface--padded stack gap-12">
          <div className="cluster spread">
            <div>
              <p className="muted text-sm">已使用</p>
              <p className="summary-band__value">{network.total}</p>
            </div>
            <span className="badge">{formatNumber(network.base_percentage * 100)}%</span>
          </div>
          <progress className="progress" value={Math.min(network.base_percentage, 1)} max={1}>
            {formatNumber(network.base_percentage * 100)}%
          </progress>
          <div className="metric-grid">
            <div className="metric">
              <p className="metric__label">套餐流量</p>
              <p className="metric__value">{network.base_amount}</p>
            </div>
            <div className="metric">
              <p className="metric__label">基础用量</p>
              <p className="metric__value">{formatNumber(network.base_usage)} GB</p>
            </div>
            <div className="metric">
              <p className="metric__label">扩展用量</p>
              <p className="metric__value">{formatNumber(network.extend_usage)} GB</p>
            </div>
            <div className="metric">
              <p className="metric__label">上传 / 下载</p>
              <p className="text-sm">
                <strong>{network.upload}</strong> / <strong>{network.download}</strong>
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="应用明细"
        description={`合计 ${detail.data!.total} · 上传 ${detail.data!.upload} · 下载 ${detail.data!.download}`}
      >
        {detail.data!.items.length ? (
          <div className="surface list">
            {detail.data!.items.map((item) => (
              <article className="record-item stack gap-8" key={item.app}>
                <div className="cluster spread gap-12">
                  <h3 className="min-w-0">{item.app}</h3>
                  <strong>{item.total}</strong>
                </div>
                <progress className="progress" value={Math.min(item.percentage, 1)} max={1}>
                  {formatNumber(item.percentage * 100)}%
                </progress>
                <p className="muted text-sm">
                  下载 {item.download} · 上传 {item.upload} · 占比{" "}
                  {formatNumber(item.percentage * 100)}%
                </p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无流量明细" description="当前月份没有可展示的应用流量。" />
        )}
      </Section>

      <Section title="历史账单">
        {orders.data!.length ? (
          <div className="surface list">
            {orders.data!.map((order) => (
              <article className="record-item" key={`${order.year}-${order.month}`}>
                <div className="cluster spread gap-12">
                  <h3>
                    {order.year} 年 {order.month} 月
                  </h3>
                  <strong>{formatCurrency(order.amount)}</strong>
                </div>
                <p className="muted text-sm">
                  下载 {order.download} · 上传 {order.upload} · 超额 {order.over}
                </p>
                <p className="muted text-sm">更新于 {formatDateTime(order.updated_at)}</p>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="暂无历史账单" description="产生月度账单后会显示在这里。" />
        )}
      </Section>
    </div>
  );
}
