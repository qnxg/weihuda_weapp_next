import { useQuery } from "@tanstack/react-query";
import { CalendarSync } from "lucide-react";
import { Fragment, useState, type FormEvent } from "react";
import { api } from "../../api/api";
import { ProgressBar } from "../../components/ProgressBar";
import { EmptyState, Modal, PageHeader, QueryState, Section } from "../../components/ui";
import { formatNumber } from "../../utils/format";

interface NetworkDetailPeriod {
  year: number;
  month: number;
  day?: number;
}

function periodLabel({ year, month, day }: NetworkDetailPeriod) {
  return `${year} 年 ${month} 月${day === undefined ? "" : ` ${day} 日`}`;
}

function periodAccessibleLabel(period: NetworkDetailPeriod) {
  return `${period.year}年${period.month}月${
    period.day === undefined ? "全月" : `${period.day}日`
  }`;
}

function flowCategoryLabel(app: string) {
  return app.replace(/^\//, "");
}

function FlowCategoryTitle({ label }: { label: string }) {
  return label.split("/").map((segment, index) => (
    <Fragment key={`${index}:${segment}`}>
      {index > 0 ? (
        <span className="network-detail-category__separator" aria-hidden="true">
          /
        </span>
      ) : null}
      {segment}
    </Fragment>
  ));
}

function NetworkDatePicker({
  selected,
  onSelect,
  onClose,
}: {
  selected: NetworkDetailPeriod;
  onSelect: (period: NetworkDetailPeriod) => void;
  onClose: () => void;
}) {
  const [yearValue, setYearValue] = useState(() => String(selected.year));
  const [monthValue, setMonthValue] = useState(() => String(selected.month));
  const [dayValue, setDayValue] = useState(() =>
    selected.day === undefined ? "" : String(selected.day),
  );
  const year = Number(yearValue);
  const month = Number(monthValue);
  const dayCount =
    Number.isInteger(year) && Number.isInteger(month) ? new Date(year, month, 0).getDate() : 0;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    onSelect({
      year,
      month,
      day: dayValue === "" ? undefined : Number(dayValue),
    });
  }

  return (
    <Modal title="选择日期" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="network-date-picker__period">
          <div className="field">
            <label htmlFor="network-detail-year">年份</label>
            <input
              id="network-detail-year"
              type="number"
              min="1"
              step="1"
              value={yearValue}
              required
              onChange={(event) => {
                setYearValue(event.currentTarget.value);
                setDayValue("");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="network-detail-month">月份</label>
            <select
              id="network-detail-month"
              value={monthValue}
              onChange={(event) => {
                setMonthValue(event.currentTarget.value);
                setDayValue("");
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((monthOption) => (
                <option value={monthOption} key={monthOption}>
                  {monthOption} 月
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="network-detail-day">日期</label>
          <select
            id="network-detail-day"
            value={dayValue}
            onChange={(event) => setDayValue(event.currentTarget.value)}
          >
            <option value="">全月</option>
            {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => (
              <option value={day} key={day}>
                {day} 日
              </option>
            ))}
          </select>
        </div>
        <div className="modal__actions">
          <button className="button button--secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button button--primary" type="submit">
            确定
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function NetworkDetailPage() {
  const [period, setPeriod] = useState<NetworkDetailPeriod>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["network", "detail", period.year, period.month, period.day],
    queryFn: () =>
      period.day === undefined
        ? api.network.detail(period.year, period.month)
        : api.network.detail(period.year, period.month, period.day),
  });
  const selectedPeriodLabel = periodLabel(period);

  return (
    <div className="page">
      <PageHeader title="流量明细" back />

      <Section
        title={selectedPeriodLabel}
        description={detail.data ? `总流量 ${detail.data.total}` : undefined}
        action={
          <button
            className="button button--text button--small"
            type="button"
            aria-label={`切换日期，当前为${periodAccessibleLabel(period)}`}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(true)}
          >
            <CalendarSync aria-hidden="true" />
            切换
          </button>
        }
      >
        <QueryState query={detail} loadingRows={4}>
          {(usage) =>
            usage.items.length ? (
              <ul className="surface list" aria-label={`${selectedPeriodLabel}流量明细列表`}>
                {usage.items.map((item) => {
                  const appName = flowCategoryLabel(item.app);
                  const percentage = formatNumber(item.percentage * 100);
                  return (
                    <li className="record-item stack gap-8" key={item.app}>
                      <div className="cluster spread gap-12">
                        <h3 className="min-w-0" aria-label={appName}>
                          <FlowCategoryTitle label={appName} />
                        </h3>
                        <strong>{item.total}</strong>
                      </div>
                      <ProgressBar
                        value={item.percentage}
                        tone="primary"
                        label={`${appName} ${selectedPeriodLabel}流量占比 ${percentage}%`}
                      />
                      <p className="muted text-sm">
                        下载 {item.download} · 上传 {item.upload} · 占比 {percentage}%
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="暂无流量明细"
                description={`${selectedPeriodLabel}没有可展示的流量记录。`}
              />
            )
          }
        </QueryState>
      </Section>

      {pickerOpen ? (
        <NetworkDatePicker
          selected={period}
          onSelect={(nextPeriod) => {
            setPeriod(nextPeriod);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
