import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { Buffer } from "node:buffer";
import { createRandomRank, fixtures, nextId, ok, state, timestamp } from "./fixtures.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const json = (data, status = 200) => ({ status, data });
const success = () => json(ok());
export const publicRouteKeys = new Set([
  "GET /",
  "GET /about",
  "GET /calendar",
  "GET /calendar/{id}",
  "GET /countdown",
  "GET /semester",
  "POST /auth/login",
  "POST /auth/refresh",
  "POST /feedback/no_auth",
]);
const DEFAULT_MIN_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1000;
const MAX_OVERRIDE_DELAY_MS = 10_000;
const DAY_MS = 86_400_000;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const shanghaiDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const shanghaiDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function shanghaiDateKey(date = new Date()) {
  const parts = Object.fromEntries(
    shanghaiDateFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shanghaiDateTimeKey(date = new Date()) {
  const parts = Object.fromEntries(
    shanghaiDateTimeFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function examHasEnded(exam, currentDateTime = shanghaiDateTimeKey()) {
  if (exam.invalid) return true;
  if (!exam.date || !exam.end_time) return false;
  return `${exam.date} ${exam.end_time}` <= currentDateTime;
}

function calendarDayValue(value) {
  if (!DATE_ONLY_PATTERN.test(value)) throw new Error("INVALID_MOCK_DATE");
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("INVALID_MOCK_DATE");
  }
  return timestamp;
}

function calendarDaysBetween(from, to) {
  return Math.round((calendarDayValue(to) - calendarDayValue(from)) / DAY_MS);
}

function addCalendarDays(value, days) {
  const date = new Date(calendarDayValue(value) + days * DAY_MS);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function chineseCalendarDate(value) {
  const date = new Date(calendarDayValue(value));
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月${date.getUTCDate()}日（周${weekdays[date.getUTCDay()]}）`;
}

function isCalendarDate(value) {
  try {
    calendarDayValue(value);
    return true;
  } catch {
    return false;
  }
}

function findSemester(year, semesterId) {
  if (!/^\d{4}$/.test(year || "") || !/^-?\d+$/.test(semesterId || "")) return undefined;
  return fixtures.semesterTable.items.find(
    (semester) => semester.xn === Number(year) && semester.xq === Number(semesterId),
  );
}

function currentSemester() {
  const { now_xn: year, now_xq: semesterId } = fixtures.semesterTable;
  return fixtures.semesterTable.items.find(
    (semester) => semester.xn === year && semester.xq === semesterId,
  );
}

function buildingView(building) {
  const preference = state.buildingPreferences[building.building_id];
  return {
    ...building,
    favorite: preference?.favorite ?? false,
    last_query_at: preference?.last_query_at ?? null,
  };
}

function buildingCatalog() {
  return fixtures.buildings
    .map(buildingView)
    .toSorted((left, right) => Number(right.favorite) - Number(left.favorite));
}

export function buildCountdown(
  currentDate,
  semester = currentSemester(),
  holidays = fixtures.holidays,
) {
  const holiday = holidays.find((item) => calendarDaysBetween(currentDate, item.end) >= 0);
  let holidayCountdown = null;
  if (holiday) {
    const daysUntilHoliday = calendarDaysBetween(currentDate, holiday.start);
    holidayCountdown = {
      ...holiday,
      status: daysUntilHoliday > 0 ? "upcoming" : "active",
      days:
        daysUntilHoliday > 0 ? daysUntilHoliday : calendarDaysBetween(currentDate, holiday.end) + 1,
      duration: calendarDaysBetween(holiday.start, holiday.end) + 1,
    };
  }

  const semesterEnd = addCalendarDays(semester.start, semester.weeks * 7);
  const daysUntilStart = calendarDaysBetween(currentDate, semester.start);
  const daysUntilEnd = calendarDaysBetween(currentDate, semesterEnd);
  const semesterStatus =
    daysUntilStart > 0 ? "upcoming" : daysUntilEnd > 0 ? "active" : "completed";
  const semesterCountdown = {
    xn: semester.xn,
    xq: semester.xq,
    xq_text: semester.xq_text,
    target_date: semesterStatus === "upcoming" ? semester.start : semesterEnd,
    weeks: semester.weeks,
    status: semesterStatus,
    days: semesterStatus === "upcoming" ? daysUntilStart : Math.max(0, daysUntilEnd),
  };

  return { holiday: holidayCountdown, semester: semesterCountdown };
}

export function resolveDelay(
  headers,
  random = Math.random,
  minDelayMs = DEFAULT_MIN_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
) {
  const override = headers["x-mock-delay"];
  if (override !== undefined) {
    const delay = Number(override);
    if (Number.isFinite(delay) && delay >= 0) {
      return Math.min(Math.round(delay), MAX_OVERRIDE_DELAY_MS);
    }
  }

  const min = Math.max(0, Math.round(minDelayMs));
  const max = Math.max(min, Math.round(maxDelayMs));
  return min + Math.floor(random() * (max - min + 1));
}

const simpleRoutes = [
  ["GET", "/", () => json(ok({ hello: "world" }))],
  [
    "GET",
    "/about",
    () =>
      json(
        ok({
          home: "https://qnxg.cn",
          join: "https://join.qnxg.cn",
          version: "1.0.0",
          slogans: ["让校园生活更简单"],
        }),
      ),
  ],
  [
    "GET",
    "/countdown",
    ({ request }) => json(ok(buildCountdown(request.headers["x-mock-date"] || shanghaiDateKey()))),
  ],
  [
    "GET",
    "/calendar",
    () =>
      json(
        ok({
          items: fixtures.academicCalendars.map(({ xn, periods }) => ({
            xn,
            periods: periods.map(({ id, name }) => ({ id, name })),
          })),
          now_id: fixtures.academicCalendars[0].periods[0].id,
        }),
      ),
  ],
  [
    "GET",
    "/calendar/{id}",
    ({ params }) => {
      if (!/^[1-9]\d*$/.test(params.id)) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }
      for (const { periods } of fixtures.academicCalendars) {
        const matchedPeriod = periods.find(({ id }) => id === Number(params.id));
        if (!matchedPeriod) continue;
        return json(ok(matchedPeriod.detail));
      }
      return json({ code: "CALENDAR_NOT_FOUND" }, 404);
    },
  ],
  ["GET", "/auth/tfa", () => success()],
  ["POST", "/auth/tfa", () => success()],
  [
    "POST",
    "/auth/login",
    ({ body }) =>
      body.code && body.stu_id && body.password
        ? json(ok({ access_token: "mock-access-token", refresh_token: "mock-refresh-token" }))
        : json({ code: "INVALID_REQUEST", data: "code、stu_id 和 password 均为必填项" }, 400),
  ],
  [
    "POST",
    "/auth/refresh",
    ({ body }) =>
      body.refresh_token
        ? json(
            ok({
              access_token: "mock-access-token-refreshed",
              refresh_token: "mock-refresh-token-refreshed",
            }),
          )
        : json({ code: "TOKEN_INVALID" }, 401),
  ],
  ["POST", "/auth/unbind", () => success()],
  ["GET", "/me", () => json(ok(fixtures.me))],
  ["GET", "/card/info", () => json(ok(fixtures.cardInfo))],
  [
    "GET",
    "/card/record",
    ({ query }) => {
      const year = Number(query.get("year"));
      const month = Number(query.get("month"));
      const type = query.get("type") || "consumption";
      const records = fixtures.cardRecords.records.filter((item) => {
        const date = new Date(item.date_time.replace(" ", "T"));
        const inMonth =
          (!year || date.getFullYear() === year) && (!month || date.getMonth() + 1 === month);
        const inType = type === "consumption" ? item.amount < 0 : item.amount > 0;
        return inMonth && inType;
      });
      return json(
        ok({
          total: records.reduce((sum, item) => sum + item.amount, 0),
          count: records.length,
          records,
        }),
      );
    },
  ],
  [
    "GET",
    "/rank",
    ({ query, random }) => {
      const year = query.get("xn");
      const term = query.get("xq");
      const range = query.get("range");
      const dataSource = query.get("data_source");
      const display = query.get("display");
      const validSemester =
        year === null
          ? true
          : term === null
            ? fixtures.semesterTable.items.some((semester) => semester.xn === Number(year))
            : findSemester(year, term) !== undefined;
      const validRange = ["major", "minor"].includes(range);
      const validDataSource = ["total", "execution"].includes(dataSource);
      const validDisplay = ["max", "initial"].includes(display);
      return validSemester && validRange && validDataSource && validDisplay
        ? json(ok(createRandomRank(random)))
        : json({ code: "INVALID_REQUEST" }, 400);
    },
  ],
  [
    "GET",
    "/rank/ca",
    ({ random }) => json(ok({ updated_at: timestamp(), rank: createRandomRank(random) })),
  ],
  ["PUT", "/rank/ca", () => success()],
  [
    "GET",
    "/course/extra",
    ({ query, random }) =>
      findSemester(query.get("xn"), query.get("xq"))
        ? json(ok(random() < 0.5 ? fixtures.extraCourses : []))
        : json({ code: "INVALID_REQUEST" }, 400),
  ],
  ["GET", "/semester", () => json(ok(fixtures.semesterTable))],
  ["GET", "/jifen/goods", () => json(ok(fixtures.goods))],
  ["GET", "/jifen/goods/exchanged", () => json(ok(state.exchangedGoods))],
  [
    "GET",
    "/jifen/record",
    ({ query }) => {
      const page = Math.max(Number(query.get("page")) || 1, 1);
      const size = Math.max(Number(query.get("size")) || 20, 1);
      const start = (page - 1) * size;
      return json(
        ok({
          total: fixtures.pointRecords.length,
          records: fixtures.pointRecords.slice(start, start + size),
        }),
      );
    },
  ],
  [
    "GET",
    "/jifen/desc",
    () => json(ok({ description: "每日签到及参与活动可获得积分，积分可兑换奖品。" })),
  ],
  ["GET", "/email", () => json(ok({ count: 3 }))],
  ["GET", "/dorm", () => json(ok({ park: "天马园区", build: "二区6栋", room: "618" }))],
  ["PUT", "/dorm", () => success()],
  ["GET", "/dorm/electricity", () => json(ok({ balance: "186.50度" }))],
  ["PUT", "/dorm/electricity", () => success()],
  [
    "GET",
    "/grade",
    ({ query }) => {
      const year = query.get("xn");
      const term = query.get("xq");
      return findSemester(year, term)
        ? json(ok(fixtures.grades))
        : json({ code: "INVALID_REQUEST" }, 400);
    },
  ],
  [
    "GET",
    "/netflow",
    () =>
      json(
        ok({
          overdue_payment: 0,
          total: "12.80GB",
          upload: "2.10GB",
          download: "10.70GB",
          base_amount: "40GB",
          base_usage: 12.8,
          base_percentage: 0.32,
          extend_usage: 0,
          is_locked: false,
        }),
      ),
  ],
  [
    "GET",
    "/netflow/order",
    () =>
      json(
        ok([
          {
            year: 2026,
            month: 9,
            download: "10.70GB",
            upload: "2.10GB",
            over: "0GB",
            amount: 0,
            updated_at: timestamp(),
          },
        ]),
      ),
  ],
  [
    "GET",
    "/netflow/detail",
    ({ query }) => {
      const year = Number(query.get("year"));
      const month = Number(query.get("month"));
      const dayValue = query.get("day");
      const day = dayValue === null ? undefined : Number(dayValue);
      const daysInMonth =
        Number.isInteger(year) && Number.isInteger(month) ? new Date(year, month, 0).getDate() : 0;
      if (
        !Number.isInteger(year) ||
        year <= 0 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12 ||
        (day !== undefined && (!Number.isInteger(day) || day < 1 || day > daysInMonth))
      ) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }

      const isDaily = day !== undefined;
      const items = isDaily
        ? [
            {
              app: "/基础协议/SSL",
              total: "400MB",
              download: "360MB",
              upload: "40MB",
              percentage: 0.63,
            },
            {
              app: "/视频服务/在线视频",
              total: "100MB",
              download: "90MB",
              upload: "10MB",
              percentage: 0.16,
            },
            {
              app: "/云服务/文件同步",
              total: "70MB",
              download: "50MB",
              upload: "20MB",
              percentage: 0.11,
            },
            {
              app: "/学习平台/在线课堂",
              total: "45MB",
              download: "15MB",
              upload: "30MB",
              percentage: 0.07,
            },
            {
              app: "/其他流量",
              total: "25MB",
              download: "5MB",
              upload: "20MB",
              percentage: 0.03,
            },
          ]
        : [
            {
              app: "/基础协议/SSL",
              total: "8.00GB",
              download: "7.50GB",
              upload: "0.50GB",
              percentage: 0.63,
            },
            {
              app: "/视频服务/在线视频",
              total: "2.10GB",
              download: "2.00GB",
              upload: "0.10GB",
              percentage: 0.16,
            },
            {
              app: "/云服务/文件同步",
              total: "1.35GB",
              download: "0.80GB",
              upload: "0.55GB",
              percentage: 0.11,
            },
            {
              app: "/学习平台/在线课堂",
              total: "0.85GB",
              download: "0.30GB",
              upload: "0.55GB",
              percentage: 0.07,
            },
            {
              app: "/其他流量",
              total: "0.50GB",
              download: "0.10GB",
              upload: "0.40GB",
              percentage: 0.03,
            },
          ];
      return json(
        ok({
          total: isDaily ? "640MB" : "12.80GB",
          upload: isDaily ? "120MB" : "2.10GB",
          download: isDaily ? "520MB" : "10.70GB",
          items,
        }),
      );
    },
  ],
  ["GET", "/announcement", () => json(ok(fixtures.announcements))],
  [
    "GET",
    "/gym/grade",
    ({ query }) => {
      const year = query.get("xn");
      const yearNumber = Number(year);
      const isVisibleYear =
        /^\d{4}$/.test(year || "") &&
        fixtures.semesterTable.items.some((semester) => semester.xn === yearNumber);
      return isVisibleYear
        ? json(ok({ ...fixtures.gymGrade, ...fixtures.gymGradeByYear[yearNumber] }))
        : json({ code: "INVALID_REQUEST" }, 400);
    },
  ],
  [
    "GET",
    "/gym/appointment",
    ({ request }) => {
      const referenceDate = request.headers["x-mock-date"] || shanghaiDateKey();
      const appointmentDate = addCalendarDays(referenceDate, 5);
      return json(
        ok([
          {
            name: "体质健康测试",
            description: "携带校园卡参加测试",
            show_date: chineseCalendarDate(appointmentDate),
            time: "10:00 - 11:30",
            test_type: "两项以上",
            status: "已预约",
          },
        ]),
      );
    },
  ],
  [
    "POST",
    "/lab/bind",
    ({ request, body }) =>
      request.headers["content-type"]?.includes("application/x-www-form-urlencoded") &&
      body.password
        ? success()
        : json({ code: "INVALID_REQUEST" }, 400),
  ],
  [
    "GET",
    "/lab/schedule",
    ({ request }) => {
      const referenceDate = request.headers["x-mock-date"] || shanghaiDateKey();
      const scheduleDate = addCalendarDays(referenceDate, 3);
      return json(
        ok([
          {
            seat: "12",
            name: "示波器的使用",
            course: "大学物理实验",
            teacher: "周老师",
            week: 6,
            day: 3,
            date_time: `${scheduleDate} 14:30`,
            place: "物理实验楼205",
            phone: null,
            email: "teacher@example.edu.cn",
          },
        ]),
      );
    },
  ],
  [
    "GET",
    "/lab/grade",
    ({ query }) => {
      const semester = findSemester(query.get("xn"), query.get("xq"));
      if (!semester) return json({ code: "INVALID_REQUEST" }, 400);
      if (semester.xq === 4) return json(ok(null));
      return json(
        ok({
          course_name: "大学物理实验",
          course_score: "92",
          labs: [
            {
              lab_name: "示波器的使用",
              score: "94",
              attendance: "正常",
              details: [
                { name: "实验报告", score: 94 },
                { name: "课堂操作", score: 92 },
              ],
            },
          ],
        }),
      );
    },
  ],
  ["GET", "/building", () => json(ok(buildingCatalog()))],
  [
    "GET",
    "/empty_room",
    ({ query }) => {
      const building = fixtures.buildings.find(
        (item) => item.building_id === query.get("building_id"),
      );
      const date = query.get("date") || "";
      const rawTimes = query.get("times") || "";
      const times = rawTimes.split(",").map(Number);
      const hasValidTimes =
        rawTimes.length > 0 &&
        times.every((time) => Number.isInteger(time) && time >= 1 && time <= 12);
      if (!building || !isCalendarDate(date) || !hasValidTimes) {
        return json(
          {
            code: "INVALID_REQUEST",
            data: "building_id、date 和 times 必须是有效的楼栋、日期和小节次。",
          },
          400,
        );
      }
      state.buildingPreferences[building.building_id] = {
        favorite: state.buildingPreferences[building.building_id]?.favorite ?? false,
        last_query_at: new Date().toISOString(),
      };
      const room = (suffix, roomType, seatCount, examSeatCount, unavailableTimes) => ({
        room_name: `${building.building_name} ${suffix}`,
        room_type: roomType,
        seat_count: seatCount,
        exam_seat_count: examSeatCount,
        unavailableTimes,
      });
      const rooms = [
        room("101", "多媒体教室", 48, 30, [12]),
        room("103", "普通教室", 54, 40, [1]),
        room("105", "阶梯教室", 96, 72, [3, 4]),
        room("201", "智慧教室", 40, 36, [5, 6]),
        room("203", "研讨教室", 24, 20, [2]),
        room("205", "制图教室", 36, 30, [7, 8]),
        room("305", "普通教室", 60, 45, [9, 10, 11]),
        room("307", "多媒体教室", 48, 36, [4, 12]),
        room("309", "智慧教室", 40, 36, [1, 12]),
        room("401", "阶梯教室", 90, 68, [6, 7]),
        room("403", "研讨教室", 28, 24, [3, 5]),
        room("B101", "计算机房", 70, 51, [8, 9]),
      ]
        .filter(({ unavailableTimes }) => times.every((time) => !unavailableTimes.includes(time)))
        .map((availableRoom) => ({
          room_name: availableRoom.room_name,
          room_type: availableRoom.room_type,
          seat_count: availableRoom.seat_count,
          exam_seat_count: availableRoom.exam_seat_count,
        }));
      const firstTime = times[0];
      const period = firstTime <= 8 ? Math.ceil(firstTime / 2) : firstTime <= 11 ? 5 : 6;
      return json(
        ok({
          time: period,
          items: rooms,
        }),
      );
    },
  ],
];

const statefulRoutes = [
  [
    "PUT",
    "/building/{building_id}/favorite",
    ({ params, body }) => {
      const building = fixtures.buildings.find((item) => item.building_id === params.building_id);
      if (!building) return json({ code: "BUILDING_NOT_FOUND" }, 404);
      if (typeof body?.favorite !== "boolean") {
        return json({ code: "INVALID_REQUEST", data: "favorite 必须是布尔值。" }, 400);
      }
      state.buildingPreferences[building.building_id] = {
        favorite: body.favorite,
        last_query_at: state.buildingPreferences[building.building_id]?.last_query_at ?? null,
      };
      return json(ok(buildingView(building)));
    },
  ],
  [
    "GET",
    "/me/setting",
    () =>
      json(
        ok({ index_card_setting: state.settings.index_card, table_setting: state.settings.table }),
      ),
  ],
  [
    "GET",
    "/me/setting/{type}",
    ({ params }) =>
      state.settings[params.type]
        ? json(ok(state.settings[params.type]))
        : json({ code: "SETTING_NOT_FOUND" }, 404),
  ],
  [
    "PUT",
    "/me/setting/{type}",
    ({ params, body }) => {
      if (!state.settings[params.type]) return json({ code: "SETTING_NOT_FOUND" }, 404);
      if (params.type === "index_card") {
        const allowed = new Set([
          "jifen",
          "course",
          "tasks",
          "electricity",
          "campus",
          "count_down",
          "grade",
          "email",
        ]);
        const cards = body?.setting?.cards;
        if (!Array.isArray(cards) || cards.length < 5 || cards.some((item) => !allowed.has(item))) {
          return json({ code: "SETTING_CONTENT_INVALID" }, 422);
        }
      }
      if (
        params.type === "table" &&
        typeof body?.setting?.display_not_current_week_courses !== "boolean"
      ) {
        return json({ code: "SETTING_CONTENT_INVALID" }, 422);
      }
      state.settings[params.type] = body;
      return json(ok(body));
    },
  ],
  [
    "GET",
    "/classtable",
    ({ query }) =>
      findSemester(query.get("xn"), query.get("xq"))
        ? json(
            ok([
              ...fixtures.courses,
              ...state.customCourses.flatMap((course) =>
                course.times.map((time) => ({ ...course, time, times: undefined })),
              ),
            ]),
          )
        : json({ code: "INVALID_REQUEST" }, 400),
  ],
  [
    "POST",
    "/course/custom",
    ({ body }) => {
      if (
        !Number.isInteger(body?.xn) ||
        !Number.isInteger(body?.xq) ||
        !findSemester(String(body.xn), String(body.xq))
      ) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }
      const course = {
        ...body.course,
        customize_id: nextId(),
        course_id: null,
        class_name: null,
        course_type: null,
        credit: null,
        extra: null,
        area: null,
        people: null,
      };
      state.customCourses.push(course);
      return success();
    },
  ],
  [
    "PUT",
    "/course/custom/{customize_id}",
    ({ params, body }) => {
      const index = state.customCourses.findIndex(
        (item) => item.customize_id === Number(params.customize_id),
      );
      if (index < 0) return json({ code: "COURSE_NOT_FOUND" }, 404);
      state.customCourses[index] = { ...state.customCourses[index], ...body };
      return success();
    },
  ],
  [
    "DELETE",
    "/course/custom/{customize_id}",
    ({ params }) => {
      const index = state.customCourses.findIndex(
        (item) => item.customize_id === Number(params.customize_id),
      );
      if (index < 0) return json({ code: "COURSE_NOT_FOUND" }, 404);
      state.customCourses.splice(index, 1);
      return success();
    },
  ],
  [
    "GET",
    "/jifen",
    () =>
      json(
        ok({ jifen: state.points, is_checked: state.checkedIn, combo: state.checkedIn ? 8 : 7 }),
      ),
  ],
  [
    "POST",
    "/jifen",
    () => {
      if (state.checkedIn) return json({ code: "REPEATED_CHECK" }, 400);
      state.checkedIn = true;
      state.points += 10;
      fixtures.pointRecords.unshift({
        id: nextId(),
        jifen: 10,
        description: "每日签到",
        created_at: timestamp(),
      });
      return json(ok({ delta: 10 }));
    },
  ],
  [
    "POST",
    "/jifen/goods/{id}",
    ({ params }) => {
      const goods = fixtures.goods.find((item) => item.id === Number(params.id));
      if (!goods) return json({ code: "GOODS_NOT_FOUND" }, 404);
      if (goods.count <= 0) return json({ code: "GOODS_COUNT_NOT_ENOUGH" }, 400);
      if (state.points < goods.price) return json({ code: "JIFEN_NOT_ENOUGH" }, 400);
      state.points -= goods.price;
      goods.count -= 1;
      fixtures.pointRecords.unshift({
        id: nextId(),
        jifen: -goods.price,
        description: `兑换${goods.name}`,
        created_at: timestamp(),
      });
      state.exchangedGoods.unshift({
        id: nextId(),
        goods_name: goods.name,
        goods_cover: goods.cover,
        goods_description: goods.description || "",
        created_at: timestamp(),
        receive_time: null,
      });
      return success();
    },
  ],
  [
    "GET",
    "/grade/{jx0404id}",
    () =>
      json(
        ok([
          { name: "平时成绩", score: "92", percentage: "40%" },
          { name: "期末考试", score: "96", percentage: "60%" },
        ]),
      ),
  ],
  [
    "GET",
    "/exam",
    ({ query }) => {
      const type = query.get("type") || "recent";
      const offsetValue = query.get("offset");
      if (!["recent", "end"].includes(type)) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }
      if (type !== "end" && offsetValue !== null) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }

      const offset = offsetValue === null ? 0 : Number(offsetValue);
      if (!Number.isInteger(offset) || offset < 0) {
        return json({ code: "INVALID_REQUEST" }, 400);
      }

      const currentDateTime = shanghaiDateTimeKey();
      const exams = state.exams.filter((exam) =>
        type === "end" ? examHasEnded(exam, currentDateTime) : !examHasEnded(exam, currentDateTime),
      );
      return json(ok(type === "end" ? exams.slice(offset, offset + 10) : exams.slice(0, 10)));
    },
  ],
  [
    "POST",
    "/exam",
    ({ body }) => {
      state.exams.push({
        course_id: null,
        ...body,
        customize_id: nextId(),
        invalid: false,
      });
      return success();
    },
  ],
  [
    "PUT",
    "/exam/{customize_id}",
    ({ params, body }) => {
      const index = state.exams.findIndex(
        (item) => item.customize_id === Number(params.customize_id),
      );
      if (index < 0) return json({ code: "EXAM_SCHEDULE_NOT_FOUND" }, 404);
      state.exams[index] = { ...state.exams[index], ...body };
      return success();
    },
  ],
  [
    "DELETE",
    "/exam/{customize_id}",
    ({ params }) => {
      const index = state.exams.findIndex(
        (item) => item.customize_id === Number(params.customize_id),
      );
      if (index < 0) return json({ code: "EXAM_SCHEDULE_NOT_FOUND" }, 404);
      state.exams.splice(index, 1);
      return success();
    },
  ],
  [
    "GET",
    "/feedback",
    ({ query }) => {
      const page = Math.max(Number(query.get("page")) || 1, 1);
      const size = Math.max(Number(query.get("size")) || 20, 1);
      const start = (page - 1) * size;
      return json(
        ok({ total: state.feedback.length, items: state.feedback.slice(start, start + size) }),
      );
    },
  ],
  [
    "POST",
    "/feedback",
    ({ body }) => {
      state.feedback.push({
        id: nextId(),
        ...body,
        status: "pending",
        replies: [],
        created_at: timestamp(),
        updated_at: timestamp(),
      });
      return success();
    },
  ],
  [
    "POST",
    "/feedback/no_auth",
    ({ body }) => {
      state.feedback.push({
        id: nextId(),
        contact: body.contact,
        description: body.description,
        stu_id: body.stu_id,
        img: null,
        status: "pending",
        replies: [],
        created_at: timestamp(),
        updated_at: timestamp(),
      });
      return success();
    },
  ],
  ["POST", "/img/{tag}", () => json(ok({ id: `mock-${Date.now().toString(16)}` }))],
  ["GET", "/img/{id}", () => ({ status: 200, data: PNG, contentType: "image/png" })],
  [
    "GET",
    "/notice",
    ({ query }) => {
      const status = query.get("status");
      const notices =
        !status || status === "all"
          ? state.notices
          : state.notices.filter((item) => item.status === status);
      const page = Math.max(Number(query.get("page")) || 1, 1);
      const size = Math.max(Number(query.get("size")) || 20, 1);
      const start = (page - 1) * size;
      return json(ok({ count: notices.length, notices: notices.slice(start, start + size) }));
    },
  ],
  [
    "PUT",
    "/notice/{id}",
    ({ params }) => {
      const notice = state.notices.find((item) => item.id === Number(params.id));
      if (!notice) return json({ code: "NOTICE_NOT_FOUND" }, 404);
      notice.status = "read";
      return success();
    },
  ],
];

function compilePath(path) {
  const keys = [];
  const pattern = path
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\{([^}]+)\\\}/g, (_, key) => {
      keys.push(key);
      return "([^/]+)";
    });
  return { keys, regexp: new RegExp(`^${pattern}/?$`) };
}

export const routes = [...simpleRoutes, ...statefulRoutes].map(([method, path, handler]) => ({
  method,
  path,
  handler,
  ...compilePath(path),
}));

async function readBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";
  if (contentType.includes("application/json")) return JSON.parse(raw);
  if (contentType.includes("application/x-www-form-urlencoded"))
    return Object.fromEntries(new URLSearchParams(raw));
  return { raw };
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Mock-Status, X-Mock-Delay, X-Mock-Date",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
}

export function createMockServer({
  minDelayMs = DEFAULT_MIN_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  random = Math.random,
} = {}) {
  return http.createServer(async (request, response) => {
    setCors(response);
    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    const delay = resolveDelay(request.headers, random, minDelayMs, maxDelayMs);
    response.setHeader("X-Mock-Delay", String(delay));
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      const url = new URL(request.url, "http://mock.local");
      const route = routes.find(
        (item) => item.method === request.method && item.regexp.test(url.pathname),
      );
      if (!route) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(
          JSON.stringify({ code: "ENDPOINT_NOT_FOUND", data: `${request.method} ${url.pathname}` }),
        );
        return;
      }

      const routeKey = `${request.method} ${route.path}`;
      const authorization = request.headers.authorization || "";
      if (!publicRouteKeys.has(routeKey) && !authorization.startsWith("Bearer ")) {
        response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ code: "AUTH_TOKEN_INVALID" }));
        return;
      }

      const match = route.regexp.exec(url.pathname);
      const params = Object.fromEntries(
        route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]),
      );
      const body = await readBody(request);
      const forcedStatus = Number(request.headers["x-mock-status"]);
      const result =
        Number.isInteger(forcedStatus) && forcedStatus >= 400 && forcedStatus <= 599
          ? json({ code: `MOCK_${forcedStatus}` }, forcedStatus)
          : route.handler({ request, params, query: url.searchParams, body, random });

      response.writeHead(result.status, {
        "Content-Type": result.contentType || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(Buffer.isBuffer(result.data) ? result.data : JSON.stringify(result.data));
    } catch (error) {
      const status = error.message === "BODY_TOO_LARGE" ? 413 : 400;
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          code: error.message === "BODY_TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST",
        }),
      );
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.MOCK_HOST || "127.0.0.1";
  const port = Number(process.env.MOCK_PORT || process.env.PORT || 3100);
  createMockServer().listen(port, host, () => {
    console.log(`Weihuda mock server: http://${host}:${port}`);
    console.log(`Loaded ${routes.length} routes from Apifox project 8872112`);
  });
}
