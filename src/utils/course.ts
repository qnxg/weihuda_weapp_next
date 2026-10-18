import type { Course } from "../api/types";

export type CourseStatus = "completed" | "active" | "warning" | "upcoming";

export interface CourseSession {
  course: Course;
  startPeriod: number;
  endPeriod: number;
}

export interface CourseSessionStack {
  primary: CourseSession;
  sessions: CourseSession[];
}

export interface CoursePeriod {
  start: string;
  end: string;
}

export const coursePeriods: Readonly<Record<number, CoursePeriod>> = {
  1: { start: "08:00", end: "08:45" },
  2: { start: "08:55", end: "09:40" },
  3: { start: "10:00", end: "10:45" },
  4: { start: "10:55", end: "11:40" },
  5: { start: "14:30", end: "15:15" },
  6: { start: "15:25", end: "16:10" },
  7: { start: "16:30", end: "17:15" },
  8: { start: "17:25", end: "18:10" },
  9: { start: "19:00", end: "19:45" },
  10: { start: "19:55", end: "20:40" },
  11: { start: "20:50", end: "21:35" },
  12: { start: "21:45", end: "22:30" },
};

export const courseStatusLabels: Readonly<Record<CourseStatus, string>> = {
  completed: "已结束",
  active: "上课中",
  warning: "即将开始",
  upcoming: "未开始",
};

function courseIdentity(course: Course) {
  const field = (value: unknown) => (value === undefined ? [0] : [1, value]);
  return JSON.stringify(
    [
      course.customize_id,
      course.course_id,
      course.course_name,
      course.class_name,
      course.course_type,
      course.credit,
      course.day,
      course.extra,
      course.area,
      course.place,
      course.people,
      course.teacher,
      course.weeks,
    ].map(field),
  );
}

export function groupCourseSessions(courses: readonly Course[]): CourseSession[] {
  const coursesByIdentity = new Map<string, Course[]>();
  for (const course of courses) {
    const identity = courseIdentity(course);
    const matchingCourses = coursesByIdentity.get(identity);
    if (matchingCourses) matchingCourses.push(course);
    else coursesByIdentity.set(identity, [course]);
  }

  const sessions: CourseSession[] = [];
  for (const matchingCourses of coursesByIdentity.values()) {
    const uniquePeriods = [
      ...new Map(matchingCourses.map((course) => [course.time, course])).values(),
    ].toSorted((left, right) => left.time - right.time);

    let currentSession: CourseSession | undefined;
    for (const course of uniquePeriods) {
      if (currentSession && course.time === currentSession.endPeriod + 1) {
        currentSession.endPeriod = course.time;
        continue;
      }
      currentSession = { course, startPeriod: course.time, endPeriod: course.time };
      sessions.push(currentSession);
    }
  }

  return sessions.toSorted(
    (left, right) =>
      left.startPeriod - right.startPeriod ||
      left.endPeriod - right.endPeriod ||
      left.course.course_name.localeCompare(right.course.course_name, "zh-CN"),
  );
}

export function courseSessionPeriodLabel(session: CourseSession) {
  return session.startPeriod === session.endPeriod
    ? `第 ${session.startPeriod} 节`
    : `第 ${session.startPeriod}-${session.endPeriod} 节`;
}

export function courseSessionKey(session: CourseSession) {
  return `${courseIdentity(session.course)}|${session.startPeriod}-${session.endPeriod}`;
}

export function buildCourseColorMap(courses: readonly Course[], paletteSize: number) {
  if (!Number.isInteger(paletteSize) || paletteSize <= 0) {
    throw new RangeError("paletteSize must be a positive integer");
  }

  const officialNames = new Set(
    courses.filter((course) => course.customize_id === null).map((course) => course.course_name),
  );
  const customNames = new Set(
    courses
      .filter((course) => course.customize_id !== null && !officialNames.has(course.course_name))
      .map((course) => course.course_name),
  );
  const orderedNames = [
    ...[...officialNames].toSorted((left, right) => left.localeCompare(right, "zh-CN")),
    ...[...customNames].toSorted((left, right) => left.localeCompare(right, "zh-CN")),
  ];

  return new Map(orderedNames.map((name, index) => [name, index % paletteSize]));
}

export function stackCourseSessions(
  sessions: readonly CourseSession[],
  selectedWeek: number,
): CourseSessionStack[] {
  const sessionsBySlot = new Map<string, CourseSession[]>();
  for (const session of sessions) {
    const slotKey = `${session.course.day}|${session.startPeriod}-${session.endPeriod}`;
    const matchingSessions = sessionsBySlot.get(slotKey);
    if (matchingSessions) matchingSessions.push(session);
    else sessionsBySlot.set(slotKey, [session]);
  }

  return [...sessionsBySlot.values()].map((matchingSessions) => {
    const orderedSessions = matchingSessions.toSorted((left, right) => {
      const activeDifference =
        Number(right.course.weeks.includes(selectedWeek)) -
        Number(left.course.weeks.includes(selectedWeek));
      return (
        activeDifference || courseSessionKey(left).localeCompare(courseSessionKey(right), "zh-CN")
      );
    });
    return { primary: orderedSessions[0], sessions: orderedSessions };
  });
}

export function courseSessionTimes(session: CourseSession) {
  const first = coursePeriods[session.startPeriod];
  const last = coursePeriods[session.endPeriod];
  return first && last ? { start: first.start, end: last.end } : null;
}

function timeOnDate(date: Date, value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

export function getCourseStatus(
  session: CourseSession,
  courseDate: Date,
  now = new Date(),
): CourseStatus {
  const times = courseSessionTimes(session);
  if (!times) return "upcoming";

  const start = timeOnDate(courseDate, times.start);
  const end = timeOnDate(courseDate, times.end);
  if (now >= end) return "completed";
  if (now >= start) return "active";
  if (start.getTime() - now.getTime() <= 20 * 60 * 1000) return "warning";
  return "upcoming";
}

export function shouldDefaultToTomorrow(
  sessions: readonly CourseSession[],
  today: Date,
  now = new Date(),
) {
  return (
    sessions.length > 0 &&
    sessions.every((session) => getCourseStatus(session, today, now) === "completed")
  );
}
