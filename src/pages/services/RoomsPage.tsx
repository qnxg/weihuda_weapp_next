import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, ChevronRight, Search, Star } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../../api/api";
import type { Building, EmptyRoomResult } from "../../api/types";
import {
  EmptyState,
  Modal,
  PageError,
  PageHeader,
  PageSkeleton,
  Section,
  StatusMessage,
  Tag,
} from "../../components/ui";
import { formatDateWithWeekday } from "../../utils/format";

interface RoomFilter {
  buildingId: string;
  buildingName: string;
  date: string;
  times: number[];
}

const DEFAULT_ROOM_TIMES = [1, 2];

const ROOM_TIME_OPTIONS = [
  { times: [1, 2], label: "1-2 节", range: "08:00-09:40" },
  { times: [3, 4], label: "3-4 节", range: "10:00-11:40" },
  { times: [5, 6], label: "5-6 节", range: "14:30-16:00" },
  { times: [7, 8], label: "7-8 节", range: "16:10-17:40" },
  { times: [9, 10, 11], label: "9-11 节", range: "19:00-21:35" },
  { times: [12], label: "12 节", range: "21:35-22:20" },
] as const;

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function byFavorite(left: Building, right: Building) {
  return Number(right.favorite) - Number(left.favorite);
}

function recentBuildings(buildings: readonly Building[]) {
  return buildings
    .filter(
      (building): building is Building & { last_query_at: string } =>
        building.last_query_at !== null,
    )
    .toSorted((left, right) => Date.parse(right.last_query_at) - Date.parse(left.last_query_at))
    .slice(0, 3);
}

function mergeBuildingMetadata(current: Building, updated: Building) {
  const lastQueryAt =
    !updated.last_query_at ||
    (current.last_query_at && Date.parse(current.last_query_at) > Date.parse(updated.last_query_at))
      ? current.last_query_at
      : updated.last_query_at;
  return { ...current, ...updated, last_query_at: lastQueryAt };
}

function RoomTimeSelector({
  selectedTimes,
  onChange,
}: {
  selectedTimes: readonly number[];
  onChange: (times: number[]) => void;
}) {
  const selected = new Set(selectedTimes);

  function toggleOption(times: readonly number[], isSelected: boolean) {
    if (isSelected && selectedTimes.length === times.length) return;
    const nextTimes = isSelected
      ? selectedTimes.filter((selectedTime) => !times.includes(selectedTime))
      : [...new Set([...selectedTimes, ...times])].toSorted((left, right) => left - right);
    onChange(nextTimes);
  }

  return (
    <div
      className="surface room-time-selector"
      role="group"
      aria-label="选择节次"
      aria-describedby="room-time-selector-hint"
    >
      <p className="sr-only" id="room-time-selector-hint">
        可多选节次范围，至少保留一项。
      </p>
      {ROOM_TIME_OPTIONS.map((option) => {
        const isSelected = option.times.every((time) => selected.has(time));
        const isOnlySelection = isSelected && selectedTimes.length === option.times.length;
        return (
          <button
            className={`room-time-option${isSelected ? " is-selected" : ""}`}
            type="button"
            aria-label={`${option.label}，${option.range}`}
            aria-pressed={isSelected}
            aria-disabled={isOnlySelection}
            onClick={() => toggleOption(option.times, isSelected)}
            key={option.label}
          >
            <strong>{option.label}</strong>
            <span>{option.range}</span>
          </button>
        );
      })}
    </div>
  );
}

function RoomResults({
  result,
  selectedTimes,
  isFetching,
  error,
  onTimesChange,
  onRetry,
}: {
  result?: EmptyRoomResult;
  selectedTimes: readonly number[];
  isFetching: boolean;
  error: unknown;
  onTimesChange: (times: number[]) => void;
  onRetry: () => void;
}) {
  return (
    <div className="room-results">
      <RoomTimeSelector selectedTimes={selectedTimes} onChange={onTimesChange} />
      <div className="surface room-results__panel" role="region" aria-label="空教室列表">
        {isFetching ? <PageSkeleton rows={4} /> : null}
        {!isFetching && error ? <PageError error={error} onRetry={onRetry} /> : null}
        {!isFetching && !error && result ? (
          result.items.length ? (
            <ul className="room-results__list">
              {result.items.map((room) => (
                <li className="room-result-item" key={room.room_name}>
                  <div className="room-result-item__heading">
                    <h4>{room.room_name}</h4>
                    <span className="badge">{room.room_type}</span>
                  </div>
                  <p>
                    普通座位 {room.seat_count} / 考试座位 {room.exam_seat_count}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="room-results__empty" role="status">
              <strong>所选节次没有可用教室</strong>
              <span>可调整左侧节次重新查询。</span>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}

function BuildingOption({
  building,
  selected,
  favoritePending,
  favoriteDisabled,
  favoriteButtonRef,
  onSelect,
  onToggleFavorite,
}: {
  building: Building;
  selected: boolean;
  favoritePending: boolean;
  favoriteDisabled: boolean;
  favoriteButtonRef: (node: HTMLButtonElement | null) => void;
  onSelect: (building: Building) => void;
  onToggleFavorite: (building: Building) => void;
}) {
  const favoriteAction = building.favorite ? "取消收藏" : "收藏";
  const optionDescription = building.description ? `，${building.description}` : "";
  return (
    <div className={`building-option${selected ? " is-selected" : ""}`}>
      <button
        className="building-option__select"
        type="button"
        aria-label={`选择${building.building_name}${optionDescription}`}
        aria-pressed={selected}
        onClick={() => onSelect(building)}
      >
        <span className="building-option__copy">
          <strong>{building.building_name}</strong>
          {building.description ? <span>{building.description}</span> : null}
        </span>
      </button>
      <button
        className={`icon-button building-option__favorite${
          building.favorite ? " is-favorite" : ""
        }`}
        ref={favoriteButtonRef}
        type="button"
        aria-label={`${favoriteAction}${building.building_name}`}
        aria-pressed={building.favorite}
        aria-busy={favoritePending}
        title={favoriteAction}
        disabled={favoriteDisabled}
        onClick={() => onToggleFavorite(building)}
      >
        <Star aria-hidden="true" />
      </button>
    </div>
  );
}

function BuildingOptionGroup({
  title,
  buildings,
  selected,
  favoritePendingId,
  favoriteButtonRef,
  onSelect,
  onToggleFavorite,
}: {
  title: string;
  buildings: readonly Building[];
  selected: Building | null;
  favoritePendingId?: string;
  favoriteButtonRef: (buildingId: string, node: HTMLButtonElement | null) => void;
  onSelect: (building: Building) => void;
  onToggleFavorite: (building: Building) => void;
}) {
  return (
    <section className="building-option-group" aria-label={title}>
      <h3>{title}</h3>
      <div className="building-option-list">
        {buildings.map((building) => (
          <BuildingOption
            building={building}
            selected={building.building_id === selected?.building_id}
            favoritePending={building.building_id === favoritePendingId}
            favoriteDisabled={favoritePendingId !== undefined}
            favoriteButtonRef={(node) => favoriteButtonRef(building.building_id, node)}
            onSelect={onSelect}
            onToggleFavorite={onToggleFavorite}
            key={building.building_id}
          />
        ))}
      </div>
    </section>
  );
}

function BuildingPickerDialog({
  buildings,
  selected,
  isPending,
  error,
  favoritePendingId,
  favoriteError,
  onRetry,
  onSelect,
  onToggleFavorite,
  onClose,
}: {
  buildings?: Building[];
  selected: Building | null;
  isPending: boolean;
  error: unknown;
  favoritePendingId?: string;
  favoriteError: unknown;
  onRetry: () => void;
  onSelect: (building: Building) => void;
  onToggleFavorite: (building: Building) => void;
  onClose: () => void;
}) {
  const favoriteButtonRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFavoriteFocus = useRef<string | undefined>(undefined);
  const sortedBuildings = buildings?.toSorted(byFavorite);
  const favoriteBuildings = sortedBuildings?.filter((building) => building.favorite) ?? [];
  const otherBuildings = sortedBuildings?.filter((building) => !building.favorite) ?? [];

  useEffect(() => {
    if (favoritePendingId) {
      restoreFavoriteFocus.current = favoritePendingId;
      return;
    }
    const buildingId = restoreFavoriteFocus.current;
    if (!buildingId) return;
    restoreFavoriteFocus.current = undefined;
    window.requestAnimationFrame(() => favoriteButtonRefs.current.get(buildingId)?.focus());
  }, [buildings, favoritePendingId]);

  function registerFavoriteButton(buildingId: string, node: HTMLButtonElement | null) {
    if (node) {
      favoriteButtonRefs.current.set(buildingId, node);
    } else {
      favoriteButtonRefs.current.delete(buildingId);
    }
  }

  return (
    <Modal title="选择教学楼" onClose={onClose}>
      {isPending ? <PageSkeleton rows={6} /> : null}
      {error ? <PageError error={error} onRetry={onRetry} /> : null}
      {buildings ? (
        <div className="building-picker">
          {favoriteError ? (
            <StatusMessage tone="danger">
              {favoriteError instanceof Error
                ? favoriteError.message
                : "收藏状态更新失败，请重试。"}
            </StatusMessage>
          ) : null}
          {sortedBuildings?.length ? (
            <div className="building-option-groups">
              {favoriteBuildings.length ? (
                <BuildingOptionGroup
                  title="已收藏"
                  buildings={favoriteBuildings}
                  selected={selected}
                  favoritePendingId={favoritePendingId}
                  favoriteButtonRef={registerFavoriteButton}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ) : null}
              {otherBuildings.length ? (
                <BuildingOptionGroup
                  title={favoriteBuildings.length ? "其他楼栋" : "全部楼栋"}
                  buildings={otherBuildings}
                  selected={selected}
                  favoritePendingId={favoritePendingId}
                  favoriteButtonRef={registerFavoriteButton}
                  onSelect={onSelect}
                  onToggleFavorite={onToggleFavorite}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState title="暂无教学楼" description="暂时没有可选择的教学楼。" />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<RoomFilter | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<number[]>(DEFAULT_ROOM_TIMES);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [buildingPickerOpen, setBuildingPickerOpen] = useState(false);
  const [buildingError, setBuildingError] = useState("");
  const buildings = useQuery({
    queryKey: ["buildings"],
    queryFn: api.room.buildings,
    staleTime: 30 * 60 * 1000,
  });
  const favoriteBuilding = useMutation({
    mutationFn: ({ buildingId, favorite }: { buildingId: string; favorite: boolean }) =>
      api.room.updateFavorite(buildingId, favorite),
    onSuccess: async (updatedBuilding) => {
      await queryClient.cancelQueries({ queryKey: ["buildings"] });
      queryClient.setQueryData<Building[]>(["buildings"], (current) =>
        current?.map((building) =>
          building.building_id === updatedBuilding.building_id
            ? mergeBuildingMetadata(building, updatedBuilding)
            : building,
        ),
      );
      setSelectedBuilding((current) =>
        current?.building_id === updatedBuilding.building_id
          ? mergeBuildingMetadata(current, updatedBuilding)
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["buildings"] });
    },
  });
  const rooms = useQuery({
    queryKey: ["rooms", filter],
    queryFn: async () => {
      const result = await api.room.empty(filter!.buildingId, filter!.date, filter!.times);
      void queryClient.invalidateQueries({ queryKey: ["buildings"] });
      return result;
    },
    enabled: Boolean(filter),
  });
  const recent = buildings.data ? recentBuildings(buildings.data) : [];
  const currentBuilding = selectedBuilding ?? recent[0] ?? buildings.data?.[0] ?? null;
  const roomCount = rooms.data?.items.length ?? 0;

  function selectBuilding(building: Building) {
    setSelectedBuilding(building);
    setBuildingError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = String(data.get("date") || "");
    const nextBuildingError = currentBuilding ? "" : "请选择教学楼。";
    setBuildingError(nextBuildingError);
    if (nextBuildingError) {
      window.requestAnimationFrame(() => {
        document.getElementById("room-building")?.focus();
      });
      return;
    }
    const nextFilter = {
      buildingId: currentBuilding!.building_id,
      buildingName: currentBuilding!.building_name,
      date,
      times: selectedTimes,
    };
    if (
      filter?.buildingId === nextFilter.buildingId &&
      filter.date === nextFilter.date &&
      filter.times.join(",") === nextFilter.times.join(",")
    ) {
      void rooms.refetch();
      return;
    }
    setFilter(nextFilter);
  }

  function changeTimes(times: number[]) {
    setSelectedTimes(times);
    setFilter((current) => (current ? { ...current, times } : current));
  }

  return (
    <div className="page">
      <PageHeader title="空教室" back />
      <Section title="筛选条件">
        <form className="room-filter" aria-label="空教室筛选条件" onSubmit={submit}>
          <div className="surface room-filter-card">
            <div className="room-filter-list">
              <div className={`room-filter-field${buildingError ? " is-invalid" : ""}`}>
                <button
                  className="room-filter-row"
                  type="button"
                  id="room-building"
                  aria-label={`教学楼，当前选择：${
                    currentBuilding ? currentBuilding.building_name : "未选择"
                  }`}
                  aria-haspopup="dialog"
                  aria-invalid={Boolean(buildingError)}
                  aria-describedby={buildingError ? "room-building-error" : undefined}
                  onClick={() => {
                    setBuildingError("");
                    setBuildingPickerOpen(true);
                  }}
                >
                  <span className="room-filter-row__label">教学楼</span>
                  <span className="room-filter-row__value">
                    <span>{currentBuilding?.building_name || "请选择"}</span>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
                {buildingError ? (
                  <p className="field-error" id="room-building-error">
                    {buildingError}
                  </p>
                ) : null}
                {buildings.isPending ? (
                  <div
                    className="room-filter-recents room-filter-recent-loading"
                    role="status"
                    aria-label="正在加载最近查询"
                  >
                    <span className="room-filter-recents__label">最近</span>
                    <span className="skeleton" />
                  </div>
                ) : null}
                {recent.length ? (
                  <div className="room-filter-recents">
                    <span className="room-filter-recents__label">最近</span>
                    <div
                      className="room-filter-recent-tags"
                      role="group"
                      aria-label="最近查询的教学楼"
                    >
                      {recent.map((building) => {
                        const isSelected = building.building_id === currentBuilding?.building_id;
                        return (
                          <button
                            className={`room-filter-recent-tag${isSelected ? " is-selected" : ""}`}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => selectBuilding(building)}
                            key={building.building_id}
                          >
                            <Tag
                              className="room-filter-recent-tag__surface"
                              tone={isSelected ? "primary" : "neutral"}
                            >
                              {isSelected ? <Check aria-hidden="true" /> : null}
                              <span>{building.building_name}</span>
                            </Tag>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="room-filter-field">
                <label className="room-filter-row room-filter-input-row" htmlFor="room-date">
                  <span className="room-filter-row__label">日期</span>
                  <input
                    id="room-date"
                    name="date"
                    type="date"
                    lang="zh-CN"
                    required
                    defaultValue={localDateValue()}
                  />
                </label>
              </div>
            </div>
          </div>
          <button
            className="button button--primary room-filter__submit"
            type="submit"
            disabled={rooms.isFetching || buildings.isPending}
          >
            <Search aria-hidden="true" />
            {buildings.isPending ? "正在准备…" : rooms.isFetching ? "正在查询…" : "查询"}
          </button>
        </form>
      </Section>

      <Section
        title={filter?.buildingName ?? "查询结果"}
        description={filter ? formatDateWithWeekday(filter.date) : undefined}
      >
        {!filter ? (
          <EmptyState
            title="设置查询条件"
            description="选择教学楼和日期后查询各节次的可用教室。"
            icon={Building2}
          />
        ) : null}
        {!rooms.isFetching && !rooms.isError && rooms.data ? (
          <p className="sr-only" role="status">
            查询完成，已选第 {filter?.times.join("、")} 节，共 {roomCount} 间空教室。
          </p>
        ) : null}
        {filter ? (
          <RoomResults
            result={rooms.data}
            selectedTimes={selectedTimes}
            isFetching={rooms.isFetching}
            error={rooms.isError ? rooms.error : null}
            onTimesChange={changeTimes}
            onRetry={() => void rooms.refetch()}
          />
        ) : null}
      </Section>

      {buildingPickerOpen ? (
        <BuildingPickerDialog
          buildings={buildings.data}
          selected={currentBuilding}
          isPending={buildings.isPending}
          error={buildings.isError ? buildings.error : null}
          favoritePendingId={
            favoriteBuilding.isPending ? favoriteBuilding.variables.buildingId : undefined
          }
          favoriteError={favoriteBuilding.isError ? favoriteBuilding.error : null}
          onRetry={() => void buildings.refetch()}
          onSelect={(building) => {
            selectBuilding(building);
            setBuildingPickerOpen(false);
          }}
          onToggleFavorite={(building) =>
            favoriteBuilding.mutate({
              buildingId: building.building_id,
              favorite: !building.favorite,
            })
          }
          onClose={() => setBuildingPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
