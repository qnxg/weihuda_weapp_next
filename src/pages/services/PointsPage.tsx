import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Flame, Gift, RotateCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../../api/api";
import type { Goods } from "../../api/types";
import {
  ConfirmDialog,
  EmptyState,
  PageHeader,
  QueryState,
  Section,
  StatusMessage,
} from "../../components/ui";
import { formatDateTime, formatNumber } from "../../utils/format";

function GoodsImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span
      className="goods-item__cover goods-item__cover--fallback"
      role="img"
      aria-label={`${alt}图片暂不可用`}
    >
      <Gift aria-hidden="true" />
    </span>
  ) : (
    <img
      className="goods-item__cover"
      src={src}
      width="56"
      height="56"
      loading="lazy"
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

export default function PointsPage() {
  const queryClient = useQueryClient();
  const [selectedGoods, setSelectedGoods] = useState<Goods | null>(null);
  const [recordSize, setRecordSize] = useState(20);
  const [message, setMessage] = useState("");
  const summary = useQuery({ queryKey: ["points"], queryFn: api.points.summary });
  const description = useQuery({
    queryKey: ["points", "description"],
    queryFn: api.points.description,
  });
  const records = useQuery({
    queryKey: ["points", "records", recordSize],
    queryFn: () => api.points.records(1, recordSize),
    placeholderData: (previous) => previous,
  });
  const goods = useQuery({ queryKey: ["points", "goods"], queryFn: api.points.goods });
  const exchanged = useQuery({ queryKey: ["points", "exchanged"], queryFn: api.points.exchanged });
  const checkIn = useMutation({
    mutationFn: api.points.checkIn,
    onSuccess: async ({ delta }) => {
      setMessage(`签到成功，获得 ${delta} 积分。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["points"] }),
        queryClient.invalidateQueries({ queryKey: ["points", "records"] }),
      ]);
    },
  });
  const exchange = useMutation({
    mutationFn: (id: number) => api.points.exchange(id),
    onSuccess: async () => {
      setMessage("兑换成功，请留意领取信息。");
      setSelectedGoods(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["points"] }),
        queryClient.invalidateQueries({ queryKey: ["points", "goods"] }),
        queryClient.invalidateQueries({ queryKey: ["points", "exchanged"] }),
      ]);
    },
  });

  return (
    <div className="page">
      <PageHeader
        title="积分中心"
        description={description.data?.description}
        back
        action={
          description.isError ? (
            <button
              className="icon-button"
              type="button"
              aria-label="重新加载积分说明"
              onClick={() => void description.refetch()}
            >
              <RotateCcw aria-hidden="true" />
            </button>
          ) : null
        }
      />

      <QueryState query={summary} loadingRows={2}>
        {(points) => (
          <>
            <div className="summary-band surface">
              <div>
                <p className="muted text-sm">可用积分</p>
                <p className="summary-band__value">{formatNumber(points.jifen)}</p>
                <p className="muted text-sm cluster gap-4">
                  <Flame aria-hidden="true" />
                  连续 {points.combo} 天
                </p>
              </div>
              <button
                className="button button--primary"
                type="button"
                disabled={points.is_checked || checkIn.isPending}
                onClick={() => checkIn.mutate()}
              >
                <CheckCircle2 aria-hidden="true" />
                {checkIn.isPending ? "签到中…" : points.is_checked ? "今日已签到" : "签到"}
              </button>
            </div>
            {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
            {checkIn.isError ? (
              <StatusMessage tone="danger">{checkIn.error.message}</StatusMessage>
            ) : null}
          </>
        )}
      </QueryState>

      <Section title="积分好物">
        <QueryState query={goods} loadingRows={4}>
          {(items) =>
            items.length ? (
              <div className="surface list">
                {items.map((item) => (
                  <article className="goods-item" key={item.id}>
                    <GoodsImage src={item.cover} alt={item.name} />
                    <div className="stack gap-8 min-w-0">
                      <div className="cluster spread gap-8">
                        <div className="min-w-0">
                          <h3 className="text-clamp-2">{item.name}</h3>
                          <p className="muted text-sm">{item.description || "暂无说明"}</p>
                        </div>
                        <strong className="text-danger tabular">{item.price} 分</strong>
                      </div>
                      <div className="cluster spread">
                        <span className="muted text-sm">库存 {item.count}</span>
                        <button
                          className="button button--secondary button--small"
                          type="button"
                          disabled={item.count <= 0}
                          onClick={() => setSelectedGoods(item)}
                        >
                          兑换
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="暂无可兑换奖品"
                description="新的积分好物会在这里上架。"
                icon={Gift}
              />
            )
          }
        </QueryState>
      </Section>

      <Section
        title="积分记录"
        description={records.data ? `共 ${records.data.total} 条` : undefined}
      >
        <QueryState query={records} loadingRows={4}>
          {(recordPage) => (
            <>
              {recordPage.records.length ? (
                <div className="surface list">
                  {recordPage.records.map((record) => (
                    <div className="record-item cluster spread gap-12" key={record.id}>
                      <div className="min-w-0">
                        <h3>{record.description}</h3>
                        <time className="muted text-sm">{formatDateTime(record.created_at)}</time>
                      </div>
                      <strong
                        className={
                          record.jifen >= 0 ? "text-success tabular" : "text-danger tabular"
                        }
                      >
                        {record.jifen >= 0 ? "+" : ""}
                        {record.jifen}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="暂无积分记录" description="签到或兑换后会生成积分流水。" />
              )}
              {recordPage.total > recordPage.records.length ? (
                <button
                  className="button button--secondary button--block"
                  type="button"
                  disabled={records.isFetching}
                  onClick={() => setRecordSize((size) => size + 20)}
                >
                  {records.isFetching ? "正在加载…" : "加载更多记录"}
                </button>
              ) : null}
            </>
          )}
        </QueryState>
      </Section>

      <Section title="已兑换">
        <QueryState query={exchanged} loadingRows={3}>
          {(items) =>
            items.length ? (
              <div className="surface list">
                {items.map((item) => (
                  <article className="goods-item" key={item.id}>
                    <GoodsImage src={item.goods_cover} alt={item.goods_name} />
                    <div className="min-w-0">
                      <h3>{item.goods_name}</h3>
                      <p className="muted text-sm">{item.goods_description}</p>
                      <p className="muted text-sm">兑换于 {formatDateTime(item.created_at)}</p>
                      <span
                        className={`badge ${item.receive_time ? "badge--success" : "badge--warning"}`}
                      >
                        {item.receive_time
                          ? `已领取 · ${formatDateTime(item.receive_time)}`
                          : "待领取"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有兑换记录" description="兑换成功的奖品会显示在这里。" />
            )
          }
        </QueryState>
      </Section>

      {selectedGoods ? (
        <ConfirmDialog
          title={`兑换${selectedGoods.name}？`}
          description={`将消耗 ${selectedGoods.price} 积分，当前库存 ${selectedGoods.count} 件。`}
          confirmLabel="确认兑换"
          pending={exchange.isPending}
          error={exchange.isError ? exchange.error.message : undefined}
          onCancel={() => setSelectedGoods(null)}
          onConfirm={() => exchange.mutate(selectedGoods.id)}
        />
      ) : null}
    </div>
  );
}
