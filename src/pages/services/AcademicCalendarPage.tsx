import { useQuery } from "@tanstack/react-query";
import { CalendarSync } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/api";
import type {
  AcademicCalendarList,
  AcademicCalendarPeriod,
  AcademicCalendarPeriodItem,
  AcademicCalendarWeek,
  AcademicCalendarYearItem,
} from "../../api/types";
import { Modal, PageError, PageHeader, QueryState } from "../../components/ui";
import { formatAcademicCalendarRange, parseCalendarDate } from "../../utils/academicCalendar";

const weekdays = [
  { short: "日", label: "星期日" },
  { short: "一", label: "星期一" },
  { short: "二", label: "星期二" },
  { short: "三", label: "星期三" },
  { short: "四", label: "星期四" },
  { short: "五", label: "星期五" },
  { short: "六", label: "星期六" },
] as const;

function localDateKey() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function CalendarDay({
  date,
  dayIndex,
  previousDate,
  period,
  today,
}: {
  date: string;
  dayIndex: number;
  previousDate?: string;
  period: AcademicCalendarPeriod;
  today: string;
}) {
  const parts = parseCalendarDate(date);
  const previousParts = previousDate ? parseCalendarDate(previousDate) : null;
  const todayParts = parseCalendarDate(today);
  if (!parts) return null;

  const showMonth = previousParts?.month !== parts.month;
  const isWeekend = dayIndex === 0 || dayIndex === 6;
  const isReferenceDate = date < period.start || date > period.end;
  const isToday = date === today;
  const isCurrentMonth = todayParts?.year === parts.year && todayParts.month === parts.month;
  const className = [
    "academic-calendar-day",
    isWeekend ? "is-weekend" : "",
    isReferenceDate ? "is-reference-date" : "",
    !isCurrentMonth ? "is-outside-current-month" : "",
    isToday ? "is-today" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="cell"
      aria-label={`${parts.year}年${parts.month}月${parts.day}日，${weekdays[dayIndex].label}${isToday ? "，今天" : ""}`}
    >
      <span className="academic-calendar-day__number" aria-hidden="true">
        {parts.day}
      </span>
      <span className="academic-calendar-day__month" aria-hidden="true">
        {showMonth ? `${parts.month}月` : ""}
      </span>
    </div>
  );
}

function CalendarWeekRow({
  period,
  week,
  rowIndex,
  today,
}: {
  period: AcademicCalendarPeriod;
  week: AcademicCalendarWeek;
  rowIndex: number;
  today: string;
}) {
  const previousWeek = period.weeks[rowIndex - 1];
  const isReferenceWeek = week.dates.every((date) => date < period.start || date > period.end);

  return (
    <div
      className={`academic-calendar-grid__row${isReferenceWeek ? " is-reference-week" : ""}`}
      role="row"
      aria-label={`${week.description}${isReferenceWeek ? "，参考周" : ""}`}
    >
      <div className="academic-calendar-week-number" role="rowheader" title={week.description}>
        <span>{week.week_text}</span>
      </div>
      {week.dates.map((date, dayIndex) => (
        <CalendarDay
          date={date}
          dayIndex={dayIndex}
          key={date}
          period={period}
          previousDate={dayIndex === 0 ? previousWeek?.dates[6] : week.dates[dayIndex - 1]}
          today={today}
        />
      ))}
    </div>
  );
}

function CalendarPeriod({
  id,
  period,
  today,
}: {
  id: number;
  period: AcademicCalendarPeriod;
  today: string;
}) {
  return (
    <article
      className="academic-calendar-period"
      id={`calendar-${id}`}
      aria-label={`${period.name}校历`}
    >
      <div className="academic-calendar-grid" role="table" aria-label={`${period.name}日期与周次`}>
        <div className="academic-calendar-grid__header" role="row">
          <div className="academic-calendar-week-heading" role="columnheader">
            周
          </div>
          {weekdays.map(({ short, label }, index) => (
            <div
              className={index === 0 || index === 6 ? "is-weekend" : undefined}
              key={short}
              role="columnheader"
              aria-label={label}
            >
              <span>{short}</span>
            </div>
          ))}
        </div>
        {period.weeks.map((week, rowIndex) => (
          <CalendarWeekRow
            key={`${week.description}-${week.dates[0]}`}
            period={period}
            rowIndex={rowIndex}
            today={today}
            week={week}
          />
        ))}
      </div>

      {period.notes.length > 0 ? (
        <section className="academic-calendar-notes" aria-labelledby={`calendar-${id}-notes`}>
          <h3 id={`calendar-${id}-notes`}>安排说明</h3>
          <dl>
            {period.notes.map((note) => (
              <div key={`${note.title}-${note.content}`}>
                <dt>{note.title}</dt>
                <dd>{note.content}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </article>
  );
}

function AcademicCalendarPickerDialog({
  items,
  selectedId,
  draftYear,
  onYearSelect,
  onPeriodSelect,
  onClose,
}: {
  items: AcademicCalendarYearItem[];
  selectedId: number;
  draftYear: string;
  onYearSelect: (item: AcademicCalendarYearItem) => void;
  onPeriodSelect: (period: AcademicCalendarPeriodItem) => void;
  onClose: () => void;
}) {
  const draftItem = items.find(({ xn }) => xn === draftYear);

  return (
    <Modal title="切换" bodyLabel="学年和学期选项" onClose={onClose}>
      <div className="academic-calendar-picker">
        <fieldset className="academic-calendar-picker__group" aria-label="学年">
          <div className="academic-calendar-picker__list">
            {items.map((item) => {
              const isSelected = item.xn === draftYear;
              return (
                <button
                  className={`academic-calendar-picker__option${isSelected ? " is-selected" : ""}`}
                  type="button"
                  key={item.xn}
                  aria-pressed={isSelected}
                  onClick={() => onYearSelect(item)}
                >
                  <strong>{item.xn}</strong>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="academic-calendar-picker__group" aria-label="学期">
          <div className="academic-calendar-picker__list">
            {draftItem?.periods.map((period) => {
              const isSelected = period.id === selectedId;
              return (
                <button
                  className={`academic-calendar-picker__option${isSelected ? " is-selected" : ""}`}
                  type="button"
                  key={period.id}
                  aria-pressed={isSelected}
                  onClick={() => onPeriodSelect(period)}
                >
                  <strong>{period.name}</strong>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

function findCalendarSelection(list: AcademicCalendarList, id: number) {
  for (const year of list.items) {
    const period = year.periods.find((item) => item.id === id);
    if (period) return { year, period };
  }
  return undefined;
}

function resolveCalendarSelection(list: AcademicCalendarList, requestedId: number | undefined) {
  return findCalendarSelection(list, requestedId ?? list.now_id);
}

function parseCalendarId(value: string | null) {
  if (value === null) return undefined;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export default function AcademicCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<string>();
  const requestedId = parseCalendarId(searchParams.get("id"));
  const calendarList = useQuery({
    queryKey: ["academic-calendar-list"],
    queryFn: api.calendar.list,
  });
  const selectedItem = calendarList.data
    ? resolveCalendarSelection(calendarList.data, requestedId === null ? undefined : requestedId)
    : undefined;
  const calendar = useQuery({
    queryKey: ["academic-calendar-detail", selectedItem?.period.id ?? "unresolved"],
    queryFn: () => api.calendar.detail(selectedItem!.period),
    enabled: selectedItem !== undefined,
  });
  const today = localDateKey();

  useEffect(() => {
    const pointsToCurrent =
      typeof requestedId === "number" && calendarList.data?.now_id === requestedId;
    if (requestedId !== null && !pointsToCurrent) return;
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [calendarList.data?.now_id, requestedId, searchParams, setSearchParams]);

  function showCurrentCalendar() {
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="page academic-calendar-page">
      <PageHeader title="校历" back />

      {calendarList.data === undefined && calendarList.isError ? (
        <PageError error={calendarList.error} onRetry={() => void calendarList.refetch()} />
      ) : (
        <QueryState query={calendarList} loadingRows={3}>
          {(list) => {
            if (selectedItem === undefined) {
              return (
                <div className="stack gap-12">
                  <PageError error={new Error("未找到该阶段校历。")} />
                  <button
                    className="button button--secondary button--block"
                    type="button"
                    onClick={showCurrentCalendar}
                  >
                    查看当前阶段
                  </button>
                </div>
              );
            }

            const selectedPeriod = calendar.data?.period;
            const selectedTitle =
              calendar.data?.name ?? `${selectedItem.year.xn} ${selectedItem.period.name}`;
            const draftYear = pickerYear ?? selectedItem.year.xn;

            function chooseCalendar(period: AcademicCalendarPeriodItem) {
              const next = new URLSearchParams(searchParams);
              if (period.id === list.now_id) {
                next.delete("id");
              } else {
                next.set("id", String(period.id));
              }
              setPickerOpen(false);
              setSearchParams(next, { replace: true });
            }

            return (
              <>
                <section
                  className="academic-calendar-toolbar"
                  aria-labelledby="calendar-selection-title"
                >
                  <div className="section-heading cluster spread gap-12">
                    <div className="academic-calendar-toolbar__copy">
                      <h2 id="calendar-selection-title">{selectedTitle}</h2>
                      {selectedPeriod ? (
                        <p className="tabular">
                          {formatAcademicCalendarRange(selectedPeriod.start, selectedPeriod.end)} 共{" "}
                          {selectedPeriod.total_weeks} 周
                        </p>
                      ) : null}
                    </div>
                    <button
                      className="button button--text button--small"
                      type="button"
                      aria-label={`切换学年和学期，当前为${selectedTitle}`}
                      aria-haspopup="dialog"
                      aria-expanded={pickerOpen}
                      onClick={() => {
                        setPickerYear(selectedItem.year.xn);
                        setPickerOpen(true);
                      }}
                    >
                      <CalendarSync aria-hidden="true" />
                      切换
                    </button>
                  </div>
                </section>

                <div className="academic-calendar-content" data-pull-to-refresh-panel>
                  {calendar.data === undefined && calendar.isError ? (
                    <div className="stack gap-12">
                      <PageError error={calendar.error} onRetry={() => void calendar.refetch()} />
                      {typeof requestedId === "number" ? (
                        <button
                          className="button button--secondary button--block"
                          type="button"
                          onClick={showCurrentCalendar}
                        >
                          查看当前阶段
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <QueryState query={calendar} loadingRows={8}>
                      {(data) => (
                        <CalendarPeriod
                          id={selectedItem.period.id}
                          period={data.period}
                          today={today}
                        />
                      )}
                    </QueryState>
                  )}
                </div>

                {pickerOpen ? (
                  <AcademicCalendarPickerDialog
                    items={list.items}
                    selectedId={selectedItem.period.id}
                    draftYear={draftYear}
                    onYearSelect={(item) => setPickerYear(item.xn)}
                    onPeriodSelect={chooseCalendar}
                    onClose={() => setPickerOpen(false)}
                  />
                ) : null}
              </>
            );
          }}
        </QueryState>
      )}
    </div>
  );
}
