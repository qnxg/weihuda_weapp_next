import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BatteryCharging, RefreshCw } from "lucide-react";
import { api } from "../../api/api";
import { DataRow, PageHeader, QueryState, Section, StatusMessage } from "../../components/ui";

export default function DormPage() {
  const queryClient = useQueryClient();
  const dorm = useQuery({ queryKey: ["dorm"], queryFn: api.dorm.info });
  const electricity = useQuery({
    queryKey: ["dorm", "electricity"],
    queryFn: api.dorm.electricity,
  });
  const refreshDorm = useMutation({
    mutationFn: api.dorm.refresh,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dorm"] }),
  });
  const refreshElectricity = useMutation({
    mutationFn: api.dorm.refreshElectricity,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dorm", "electricity"] }),
  });

  return (
    <div className="page">
      <PageHeader
        title="宿舍与电量"
        description={dorm.data ? `${dorm.data.park} · ${dorm.data.build}` : undefined}
        back
      />

      <QueryState query={electricity} loadingRows={2}>
        {(power) => (
          <div className="summary-band surface">
            <div>
              <p className="muted text-sm">当前剩余电量</p>
              <p className="summary-band__value">{power.balance}</p>
              {dorm.data ? <p className="muted text-sm">{dorm.data.room} 室</p> : null}
            </div>
            <BatteryCharging aria-hidden="true" />
          </div>
        )}
      </QueryState>

      <Section title="宿舍信息">
        <QueryState query={dorm} loadingRows={3}>
          {(room) => (
            <div className="surface list">
              <DataRow label="园区" value={room.park} />
              <DataRow label="楼栋" value={room.build} />
              <DataRow label="房间" value={room.room} />
            </div>
          )}
        </QueryState>
        <div className="cluster gap-8">
          <button
            className="button button--secondary flex-1"
            type="button"
            disabled={refreshDorm.isPending}
            onClick={() => refreshDorm.mutate()}
          >
            <RefreshCw aria-hidden="true" />
            {refreshDorm.isPending ? "同步中…" : "同步宿舍"}
          </button>
          <button
            className="button button--secondary flex-1"
            type="button"
            disabled={refreshElectricity.isPending}
            onClick={() => refreshElectricity.mutate()}
          >
            <RefreshCw aria-hidden="true" />
            {refreshElectricity.isPending ? "刷新中…" : "刷新电量"}
          </button>
        </div>
        {refreshDorm.isSuccess ? (
          <StatusMessage tone="success">宿舍信息已同步。</StatusMessage>
        ) : null}
        {refreshElectricity.isSuccess ? (
          <StatusMessage tone="success">电量已刷新。</StatusMessage>
        ) : null}
        {refreshDorm.isError ? (
          <StatusMessage tone="danger">{refreshDorm.error.message}</StatusMessage>
        ) : null}
        {refreshElectricity.isError ? (
          <StatusMessage tone="danger">{refreshElectricity.error.message}</StatusMessage>
        ) : null}
      </Section>
    </div>
  );
}
