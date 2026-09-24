import { useQuery } from "@tanstack/react-query";
import { Building2, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../api/api";
import { EmptyState, PageError, PageHeader, PageSkeleton, Section } from "../../components/ui";

interface RoomFilter {
  building: string;
  date: string;
  time: string;
}

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function RoomsPage() {
  const [filter, setFilter] = useState<RoomFilter | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ building: "", time: "" });
  const rooms = useQuery({
    queryKey: ["rooms", filter],
    queryFn: () => api.room.empty(filter!.building, filter!.time, filter!.date),
    enabled: Boolean(filter),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const building = String(data.get("building") || "").trim();
    const date = String(data.get("date") || "");
    const timeParts = String(data.get("time") || "")
      .trim()
      .split(/[,，\s]+/)
      .filter(Boolean);
    const nextErrors = {
      building: building ? "" : "请输入教学楼编号。",
      time:
        timeParts.length > 0 && timeParts.every((item) => /^[1-9]\d*$/.test(item))
          ? ""
          : "请用逗号分隔有效节次，例如 1,2。",
    };
    setFieldErrors(nextErrors);
    if (nextErrors.building || nextErrors.time) {
      window.requestAnimationFrame(() => {
        document.getElementById(nextErrors.building ? "room-building" : "room-time")?.focus();
      });
      return;
    }
    setFilter({
      building,
      date,
      time: timeParts.join(","),
    });
  }

  return (
    <div className="page">
      <PageHeader title="空教室" description="按教学楼、日期和节次查询" back />
      <form className="form surface surface--padded room-filter" onSubmit={submit}>
        <div className="field">
          <label htmlFor="room-building">教学楼编号</label>
          <input
            id="room-building"
            name="building"
            required
            defaultValue="001"
            placeholder="例如 001…"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(fieldErrors.building)}
            aria-describedby={fieldErrors.building ? "room-building-error" : undefined}
            onChange={() => setFieldErrors((value) => ({ ...value, building: "" }))}
          />
          {fieldErrors.building ? (
            <p className="field-error" id="room-building-error">
              {fieldErrors.building}
            </p>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor="room-date">日期</label>
          <input
            id="room-date"
            name="date"
            type="date"
            lang="zh-CN"
            required
            defaultValue={localDateValue()}
          />
        </div>
        <div className="field">
          <label htmlFor="room-time">节次</label>
          <input
            id="room-time"
            name="time"
            required
            inputMode="numeric"
            defaultValue="1,2"
            placeholder="例如 1,2…"
            autoComplete="off"
            aria-invalid={Boolean(fieldErrors.time)}
            aria-describedby={fieldErrors.time ? "room-time-error" : undefined}
            onChange={() => setFieldErrors((value) => ({ ...value, time: "" }))}
          />
          {fieldErrors.time ? (
            <p className="field-error" id="room-time-error">
              {fieldErrors.time}
            </p>
          ) : null}
        </div>
        <button
          className="button button--primary button--block"
          type="submit"
          disabled={rooms.isFetching}
        >
          <Search aria-hidden="true" />
          {rooms.isFetching ? "正在查询…" : "查询空教室"}
        </button>
      </form>

      <Section title="查询结果">
        {!filter ? (
          <EmptyState
            title="设置查询条件"
            description="选择日期与节次后查询可用教室。"
            icon={Building2}
          />
        ) : null}
        {rooms.isPending && filter ? <PageSkeleton rows={4} /> : null}
        {rooms.isError ? (
          <PageError error={rooms.error} onRetry={() => void rooms.refetch()} />
        ) : null}
        {rooms.data?.length ? (
          <div className="surface list">
            {rooms.data.map((room) => (
              <article className="record-item" key={room.room_name}>
                <div className="cluster spread gap-12">
                  <h3>{room.room_name}</h3>
                  <span className="badge">{room.room_type}</span>
                </div>
                <p className="muted text-sm">
                  普通座位 {room.seat_count} · 考试座位 {room.exam_seat_count}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {rooms.data && rooms.data.length === 0 ? (
          <EmptyState title="没有可用教室" description="尝试调整教学楼、日期或节次。" />
        ) : null}
      </Section>
    </div>
  );
}
