import { useQueries } from "@tanstack/react-query";
import { api } from "../api/api";
import type { GradeTerm, Semester } from "../api/types";
import { parseApiDate, termName } from "../utils/format";
import { Modal } from "./ui";

export interface SemesterOption {
  year: number;
  term: GradeTerm;
}

export const scheduleTerms = ["autumn", "spring"] as const satisfies readonly GradeTerm[];
export const gradeTerms = [
  "autumn",
  "winter",
  "spring",
  "summer",
] as const satisfies readonly GradeTerm[];

const semesterDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function semesterOptionValue({ year, term }: SemesterOption) {
  return `${year}:${term}`;
}

export function semesterOptionLabel({ year, term }: SemesterOption) {
  return `${year}-${year + 1} ${termName(term)}`;
}

export function semesterHeadingLabel({ year, term }: SemesterOption) {
  return `${year}-${year + 1} 学年 ${termName(term)}`;
}

function formatSemesterDateRange(semester: Semester) {
  const start = parseApiDate(semester.start);
  if (!start) return "日期范围待定";
  const end = new Date(start);
  end.setDate(end.getDate() + semester.weeks * 7 - 1);
  return `${semesterDateFormatter.format(start)} - ${semesterDateFormatter.format(end)}`;
}

export function buildSemesterOptions(
  current: SemesterOption,
  selected: SemesterOption,
  terms: readonly GradeTerm[],
  count = 6,
) {
  const options: SemesterOption[] = [];
  let year = current.year;
  let term = current.term;

  while (options.length < count) {
    options.push({ year, term });
    const termIndex = terms.indexOf(term);
    if (termIndex > 0) {
      term = terms[termIndex - 1];
    } else {
      year -= 1;
      term = terms.at(-1) ?? term;
    }
  }

  if (!options.some((option) => semesterOptionValue(option) === semesterOptionValue(selected))) {
    options.unshift(selected);
  }
  return options;
}

export function SemesterPickerDialog({
  selected,
  selectedSemester,
  current,
  terms = scheduleTerms,
  onSelect,
  onClose,
}: {
  selected: SemesterOption;
  selectedSemester?: Semester;
  current?: Semester;
  terms?: readonly GradeTerm[];
  onSelect: (option: SemesterOption) => void;
  onClose: () => void;
}) {
  const anchor = current ? { year: current.xn, term: current.xq } : selected;
  const options = buildSemesterOptions(anchor, selected, terms);
  const semesterQueries = useQueries({
    queries: options.map((option) => {
      const knownSemester = [selectedSemester, current].find(
        (item) => item?.xn === option.year && item.xq === option.term,
      );
      return {
        queryKey: ["semester", option.year, option.term],
        queryFn: () => api.semester.get(option.year, option.term),
        initialData: knownSemester,
        staleTime: 5 * 60 * 1000,
      };
    }),
  });

  return (
    <Modal title="选择学期" onClose={onClose}>
      <div className="semester-option-list" aria-label="可选学期">
        {options.map((option, index) => {
          const value = semesterOptionValue(option);
          const isSelected = value === semesterOptionValue(selected);
          const isCurrent = current?.xn === option.year && current.xq === option.term;
          const semesterQuery = semesterQueries[index];
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
                <span>
                  {semesterQuery.data
                    ? formatSemesterDateRange(semesterQuery.data)
                    : semesterQuery.isError
                      ? "日期范围暂不可用"
                      : "正在加载日期…"}
                </span>
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
