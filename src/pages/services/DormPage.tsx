import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "../../api/api";
import { PageHeader, QueryState } from "../../components/ui";

function splitElectricityBalance(balance: string) {
  const normalizedBalance = balance.trim();
  const match = normalizedBalance.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(.*)$/);

  return {
    value: match?.[1] ?? normalizedBalance,
    unit: match?.[2] ?? "",
  };
}

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

  return (
    <div className="page">
      <PageHeader title="宿舍与电量" back />

      <div className="dorm-page__cards stack gap-12">
        <QueryState query={electricity} loadingRows={2}>
          {(power) => {
            const balance = splitElectricityBalance(power.balance);

            return (
              <div className="summary-band surface">
                <div className="min-w-0">
                  <p className="muted text-sm">当前剩余电量</p>
                  <p className="summary-band__value">
                    <span>{balance.value}</span>
                    {balance.unit ? (
                      <span className="summary-band__unit">{balance.unit}</span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
          }}
        </QueryState>
        <QueryState query={dorm} loadingRows={1}>
          {(room) => (
            <section className="dorm-info-card surface" aria-labelledby="dorm-info-heading">
              <div className="dorm-info-card__content">
                <h2 id="dorm-info-heading" className="muted text-sm">
                  宿舍信息
                </h2>
                <p className="dorm-info-card__location">
                  {room.park} {room.build} {room.room}
                </p>
              </div>
              <button
                className="data-update-button dorm-info-card__action"
                type="button"
                disabled={refreshDorm.isPending}
                aria-busy={refreshDorm.isPending}
                onClick={() => refreshDorm.mutate()}
              >
                <RefreshCw
                  className={`data-update-button__icon${refreshDorm.isPending ? " is-spinning" : ""}`}
                  aria-hidden="true"
                />
                <span className="data-update-button__copy">
                  <strong>{refreshDorm.isPending ? "更新中…" : "更新宿舍信息"}</strong>
                  <span
                    className={`dorm-info-card__action-status${
                      refreshDorm.isError ? " is-error" : refreshDorm.isSuccess ? " is-success" : ""
                    }`}
                    aria-live="polite"
                  >
                    {refreshDorm.isError
                      ? refreshDorm.error.message
                      : refreshDorm.isSuccess
                        ? "宿舍信息已更新。"
                        : "重新同步园区、楼栋和房间信息"}
                  </span>
                </span>
              </button>
            </section>
          )}
        </QueryState>
      </div>
    </div>
  );
}
