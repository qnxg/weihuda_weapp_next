import type { SemesterId, SemesterItem } from "../api/types";
import { parseApiDate } from "../utils/format";
import { academicYearLabel } from "../utils/semester";
import { Modal } from "./ui";

export interface SemesterOption {
  year: number;
  term: SemesterId;
  text: string;
}

const semesterDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function semesterOptionValue({ year, term }: SemesterOption) {
  return `${year}:${term}`;
}

export function semesterOptionLabel({ year, text }: SemesterOption) {
  return `${year}-${year + 1} ${text}`;
}

export function semesterHeadingLabel({ year, text }: SemesterOption) {
  return `${year}-${year + 1} 学年 ${text}`;
}

function formatSemesterDateRange(semester: SemesterItem) {
  const start = parseApiDate(semester.start);
  if (!start) return "日期范围待定";
  const end = new Date(start);
  end.setDate(end.getDate() + semester.weeks * 7 - 1);
  return `${semesterDateFormatter.format(start)} - ${semesterDateFormatter.format(end)}`;
}

export function SemesterPickerDialog({
  selected,
  current,
  semesters,
  onSelect,
  onClose,
}: {
  selected: SemesterOption;
  current?: SemesterItem;
  semesters: readonly SemesterItem[];
  onSelect: (option: SemesterOption) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="选择学期" onClose={onClose}>
      <div className="semester-option-list" aria-label="可选学期">
        {semesters.map((semester) => {
          const option = {
            year: semester.xn,
            term: semester.xq,
            text: semester.xq_text,
          };
          const value = semesterOptionValue(option);
          const isSelected = value === semesterOptionValue(selected);
          const isCurrent = current?.xn === option.year && current.xq === option.term;
          return (
            <button
              className={`semester-option${isSelected ? " is-selected" : ""}`}
              type="button"
              key={value}
              aria-label={`${semesterOptionLabel(option)}${isCurrent ? "，当前学期" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(option)}
            >
              <span className="semester-option__copy">
                <strong>{semesterOptionLabel(option)}</strong>
                <span>{formatSemesterDateRange(semester)}</span>
              </span>
              {isCurrent ? (
                <span className="semester-option__status">
                  <span>当前</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function AcademicYearPickerDialog({
  selected,
  current,
  years,
  onSelect,
  onClose,
}: {
  selected: number;
  current: number;
  years: readonly number[];
  onSelect: (year: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="选择学年" onClose={onClose}>
      <div className="semester-option-list" aria-label="可选学年">
        {years.map((year) => {
          const isSelected = year === selected;
          const isCurrent = year === current;
          return (
            <button
              className={`semester-option${isSelected ? " is-selected" : ""}`}
              type="button"
              key={year}
              aria-label={`${academicYearLabel(year)}${isCurrent ? "，当前学年" : ""}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(year)}
            >
              <span className="semester-option__copy">
                <strong>{academicYearLabel(year)}</strong>
              </span>
              {isCurrent ? (
                <span className="semester-option__status">
                  <span>当前</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
