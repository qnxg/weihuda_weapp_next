import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import { EmptyState, PageHeader, QueryState, Section } from "../../components/ui";
import { formatCurrency, formatDateTime } from "../../utils/format";

export default function CardPage() {
  const now = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const month = Number(searchParams.get("month")) || now.getMonth() + 1;
  const type = searchParams.get("type") === "recharge" ? "recharge" : "consumption";
  const info = useQuery({ queryKey: ["card", "info"], queryFn: api.card.info });
  const records = useQuery({
    queryKey: ["card", "records", year, month, type],
    queryFn: () => api.card.records(year, month, type),
  });

  return (
    <div className="page">
      <PageHeader
        title="校园卡"
        description={info.data ? `卡号 ${info.data.id}` : undefined}
        back
      />
      <QueryState query={info} loadingRows={2}>
        {(card) => (
          <div className="summary-band surface">
            <div>
              <p className="muted text-sm">当前余额</p>
              <p className="summary-band__value">{formatCurrency(card.balance)}</p>
            </div>
            <CreditCard aria-hidden="true" />
          </div>
        )}
      </QueryState>

      <Section
        title="交易记录"
        description={`${year} 年 ${month} 月${records.data ? ` · ${records.data.count} 笔` : ""}`}
      >
        <form
          className="cluster gap-8"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const [nextYear, nextMonth] = String(data.get("month")).split("-");
            setSearchParams({
              year: nextYear,
              month: nextMonth,
              type: String(data.get("type")),
            });
          }}
        >
          <div className="field flex-1">
            <label className="sr-only" htmlFor="card-month">
              月份
            </label>
            <input
              id="card-month"
              name="month"
              type="month"
              defaultValue={`${year}-${String(month).padStart(2, "0")}`}
            />
          </div>
          <div className="field flex-1">
            <label className="sr-only" htmlFor="card-type">
              交易类型
            </label>
            <select id="card-type" name="type" defaultValue={type}>
              <option value="consumption">消费</option>
              <option value="recharge">充值</option>
            </select>
          </div>
          <button className="button button--secondary" type="submit">
            查询
          </button>
        </form>
        <QueryState query={records} loadingRows={4}>
          {(recordPage) => (
            <>
              <div className="surface summary-band">
                <span className="muted">期间合计</span>
                <strong
                  className={recordPage.total < 0 ? "text-danger tabular" : "text-success tabular"}
                >
                  {formatCurrency(recordPage.total)}
                </strong>
              </div>
              {recordPage.records.length ? (
                <div className="surface list">
                  {recordPage.records.map((record) => (
                    <article className="record-item stack gap-8" key={record.id}>
                      <div className="cluster spread gap-12">
                        <div className="min-w-0">
                          <h3>{record.name}</h3>
                          <p className="muted text-sm">
                            {record.location || "地点未记录"} · {formatDateTime(record.date_time)}
                          </p>
                        </div>
                        <span
                          className={`record-item__amount ${record.amount < 0 ? "text-danger" : "text-success"}`}
                        >
                          {formatCurrency(record.amount)}
                        </span>
                      </div>
                      <div className="cluster spread text-sm muted">
                        <span>余额 {formatCurrency(record.now_balance)}</span>
                        <span>{record.status}</span>
                      </div>
                      <p className="muted text-sm">
                        流水号 {record.id} · 入账 {formatDateTime(record.journal_time)}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="没有交易记录" description="当前筛选条件下没有校园卡流水。" />
              )}
            </>
          )}
        </QueryState>
      </Section>
    </div>
  );
}
