import type { ExamScheduleItem } from "../api/types";
import { parseApiDate } from "./format";

export type ExamStatus = "scheduled" | "active" | "completed" | "invalid";

export interface ExamDisplayItem {
  exam: ExamScheduleItem;
  status: ExamStatus;
}

function examDateTime(date: string | null, time: string | null) {
  if (!date || !time) return null;
  return parseApiDate(`${date}T${time}:00`);
}

export function getExamStatus(exam: ExamScheduleItem, now = new Date()): ExamStatus {
  if (exam.invalid) return "invalid";

  const end = examDateTime(exam.date, exam.end_time);
  if (end && now >= end) return "completed";

  const start = examDateTime(exam.date, exam.start_time);
  if (start && end && now >= start && now < end) return "active";

  return "scheduled";
}
