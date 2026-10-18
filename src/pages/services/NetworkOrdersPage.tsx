import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/api";
import { EmptyState, PageHeader, QueryState, Section } from "../../components/ui";
import { formatCurrency, formatDateTime } from "../../utils/format";

export default function NetworkOrdersPage() {
  const orders = useQuery({
    queryKey: ["network", "orders"],
    queryFn: api.network.orders,
  });

  return (
    <div className="page">
      <PageHeader title="历史账单" back />

      <Section title="账单记录">
        <QueryState query={orders} loadingRows={4}>
          {(items) =>
            items.length ? (
              <ul className="surface list" aria-label="历史账单列表">
                {items.map((order) => (
                  <li className="record-item" key={`${order.year}-${order.month}`}>
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
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="暂无历史账单" description="产生月度账单后会显示在这里。" />
            )
          }
        </QueryState>
      </Section>
    </div>
  );
}
