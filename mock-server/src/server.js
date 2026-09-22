import http from "node:http";
import { Buffer } from "node:buffer";
import { fixtures, nextId, ok, state, timestamp } from "./fixtures.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const json = (data, status = 200) => ({ status, data });
const success = () => json(ok());
const publicRouteKeys = new Set([
  "GET /",
  "GET /about",
  "POST /auth/login",
  "POST /auth/refresh",
  "POST /feedback/no_auth",
]);
const DEFAULT_MIN_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 1000;
const MAX_OVERRIDE_DELAY_MS = 10_000;

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
  ["GET", "/about", () => json(ok({ home: "https://qnxg.cn", join: "https://join.qnxg.cn", version: "1.0.0", slogans: ["让校园生活更简单"] }))],
  ["GET", "/auth/tfa", () => success()],
  ["POST", "/auth/tfa", () => success()],
  ["POST", "/auth/login", ({ body }) =>
    body.code && body.stu_id && body.password
      ? json(ok({ access_token: "mock-access-token", refresh_token: "mock-refresh-token" }))
      : json({ code: "INVALID_REQUEST", data: "code、stu_id 和 password 均为必填项" }, 400)],
  ["POST", "/auth/refresh", ({ body }) =>
    body.refresh_token
      ? json(ok({ access_token: "mock-access-token-refreshed", refresh_token: "mock-refresh-token-refreshed" }))
      : json({ code: "TOKEN_INVALID" }, 401)],
  ["POST", "/auth/unbind", () => success()],
  ["GET", "/me", () => json(ok(fixtures.me))],
  ["GET", "/card/info", () => json(ok(fixtures.cardInfo))],
  ["GET", "/card/record", ({ query }) => {
    const year = Number(query.get("year"));
    const month = Number(query.get("month"));
    const type = query.get("type") || "consumption";
    const records = fixtures.cardRecords.records.filter((item) => {
      const date = new Date(item.date_time.replace(" ", "T"));
      const inMonth = (!year || date.getFullYear() === year) && (!month || date.getMonth() + 1 === month);
      const inType = type === "consumption" ? item.amount < 0 : item.amount > 0;
      return inMonth && inType;
    });
    return json(ok({
      total: records.reduce((sum, item) => sum + item.amount, 0),
      count: records.length,
      records,
    }));
  }],
  ["GET", "/rank", () => json(ok(fixtures.rank))],
  ["GET", "/rank/ca", () => json(ok({ updated_at: timestamp(), rank: fixtures.rank }))],
  ["PUT", "/rank/ca", () => success()],
  ["GET", "/course/extra", () => json(ok(fixtures.extraCourses))],
  ["GET", "/semester", ({ query }) => json(ok({ xn: Number(query.get("xn")) || 2026, xq: query.get("xq") || "autumn", start: "2026-09-13", weeks: 16, from_zero: false }))],
  ["GET", "/jifen/goods", () => json(ok(fixtures.goods))],
  ["GET", "/jifen/goods/exchanged", () => json(ok(state.exchangedGoods))],
  ["GET", "/jifen/record", ({ query }) => {
    const page = Math.max(Number(query.get("page")) || 1, 1);
    const size = Math.max(Number(query.get("size")) || 20, 1);
    const start = (page - 1) * size;
    return json(ok({ total: fixtures.pointRecords.length, records: fixtures.pointRecords.slice(start, start + size) }));
  }],
  ["GET", "/jifen/desc", () => json(ok({ description: "每日签到及参与活动可获得积分，积分可兑换奖品。" }))],
  ["GET", "/email", () => json(ok({ count: 3 }))],
  ["GET", "/dorm", () => json(ok({ park: "天马园区", build: "二区6栋", room: "618" }))],
  ["PUT", "/dorm", () => success()],
  ["GET", "/dorm/electricity", () => json(ok({ balance: "186.50度" }))],
  ["PUT", "/dorm/electricity", () => success()],
  ["GET", "/grade", () => json(ok(fixtures.grades))],
  ["GET", "/netflow", () => json(ok({ overdue_payment: 0, total: "12.80GB", upload: "2.10GB", download: "10.70GB", base_amount: "40GB", base_usage: 12.8, base_percentage: 0.32, extend_usage: 0, is_locked: false }))],
  ["GET", "/netflow/order", () => json(ok([{ year: 2026, month: 9, download: "10.70GB", upload: "2.10GB", over: "0GB", amount: 0, updated_at: timestamp() }]))],
  ["GET", "/netflow/detail", () => json(ok({ total: "12.80GB", upload: "2.10GB", download: "10.70GB", items: [{ app: "/基础协议/SSL", total: "8.00GB", download: "7.50GB", upload: "0.50GB", percentage: 0.63 }] }))],
  ["GET", "/announcement", () => json(ok(fixtures.announcements))],
  ["GET", "/gym/grade", () => json(ok(fixtures.gymGrade))],
  ["GET", "/gym/appointment", () => json(ok([{ name: "体质健康测试", description: "携带校园卡参加测试", show_date: "2026年10月15号（周四）", time: "10:00 - 11:30", test_type: "两项以上", status: "已预约" }]))],
  ["POST", "/lab/bind", ({ request, body }) =>
    request.headers["content-type"]?.includes("application/x-www-form-urlencoded") && body.password
      ? success()
      : json({ code: "INVALID_REQUEST" }, 400)],
  ["GET", "/lab/schedule", () => json(ok([{ seat: "12", name: "示波器的使用", course: "大学物理实验", teacher: "周老师", week: 6, day: 3, date_time: "2026-10-21 14:30", place: "物理实验楼205", phone: null, email: "teacher@example.edu.cn" }]))],
  ["GET", "/lab/grade", () => json(ok({ course_name: "大学物理实验", course_score: "92", labs: [{ lab_name: "示波器的使用", score: "94", attendance: "正常", details: [{ name: "实验报告", score: 94 }, { name: "课堂操作", score: 92 }] }] }))],
  ["GET", "/empty_room", () => json(ok([{ room_name: "综101", room_type: "多媒体教室", seat_count: 48, exam_seat_count: 30 }, { room_name: "综203", room_type: "计算机房", seat_count: 40, exam_seat_count: 40 }]))],
];

const statefulRoutes = [
  ["GET", "/me/setting", () => json(ok({ index_card_setting: state.settings.index_card, table_setting: state.settings.table }))],
  ["GET", "/me/setting/{type}", ({ params }) => state.settings[params.type] ? json(ok(state.settings[params.type])) : json({ code: "SETTING_NOT_FOUND" }, 404)],
  ["PUT", "/me/setting/{type}", ({ params, body }) => {
    if (!state.settings[params.type]) return json({ code: "SETTING_NOT_FOUND" }, 404);
    if (params.type === "index_card") {
      const allowed = new Set(["jifen", "course", "tasks", "electricity", "campus", "count_down", "grade", "email"]);
      const cards = body?.setting?.cards;
      if (!Array.isArray(cards) || cards.length < 5 || cards.some((item) => !allowed.has(item))) {
        return json({ code: "SETTING_CONTENT_INVALID" }, 422);
      }
    }
    if (params.type === "table" && typeof body?.setting?.display_not_current_week_courses !== "boolean") {
      return json({ code: "SETTING_CONTENT_INVALID" }, 422);
    }
    state.settings[params.type] = body;
    return json(ok(body));
  }],
  ["GET", "/classtable", () => json(ok([...fixtures.courses, ...state.customCourses.flatMap((course) => course.times.map((time) => ({ ...course, time, times: undefined }))) ]))],
  ["POST", "/course/custom", ({ body }) => {
    const course = { ...body.course, customize_id: nextId(), course_id: null, class_name: null, course_type: null, credit: null, extra: null, area: null, people: null };
    state.customCourses.push(course);
    return success();
  }],
  ["PUT", "/course/custom/{customize_id}", ({ params, body }) => {
    const index = state.customCourses.findIndex((item) => item.customize_id === Number(params.customize_id));
    if (index < 0) return json({ code: "COURSE_NOT_FOUND" }, 404);
    state.customCourses[index] = { ...state.customCourses[index], ...body };
    return success();
  }],
  ["DELETE", "/course/custom/{customize_id}", ({ params }) => {
    const index = state.customCourses.findIndex((item) => item.customize_id === Number(params.customize_id));
    if (index < 0) return json({ code: "COURSE_NOT_FOUND" }, 404);
    state.customCourses.splice(index, 1);
    return success();
  }],
  ["GET", "/jifen", () => json(ok({ jifen: state.points, is_checked: state.checkedIn, combo: state.checkedIn ? 8 : 7 }))],
  ["POST", "/jifen", () => {
    if (state.checkedIn) return json({ code: "REPEATED_CHECK" }, 400);
    state.checkedIn = true;
    state.points += 10;
    fixtures.pointRecords.unshift({ id: nextId(), jifen: 10, description: "每日签到", created_at: timestamp() });
    return json(ok({ delta: 10 }));
  }],
  ["POST", "/jifen/goods/{id}", ({ params }) => {
    const goods = fixtures.goods.find((item) => item.id === Number(params.id));
    if (!goods) return json({ code: "GOODS_NOT_FOUND" }, 404);
    if (goods.count <= 0) return json({ code: "GOODS_COUNT_NOT_ENOUGH" }, 400);
    if (state.points < goods.price) return json({ code: "JIFEN_NOT_ENOUGH" }, 400);
    state.points -= goods.price;
    goods.count -= 1;
    fixtures.pointRecords.unshift({ id: nextId(), jifen: -goods.price, description: `兑换${goods.name}`, created_at: timestamp() });
    state.exchangedGoods.unshift({
      id: nextId(),
      goods_name: goods.name,
      goods_cover: goods.cover,
      goods_description: goods.description || "",
      created_at: timestamp(),
      receive_time: null,
    });
    return success();
  }],
  ["GET", "/grade/{jx0404id}", () => json(ok([{ name: "平时成绩", score: "92", percentage: "40%" }, { name: "期末考试", score: "96", percentage: "60%" }]))],
  ["GET", "/exam", () => json(ok(state.exams))],
  ["POST", "/exam", ({ body }) => {
    state.exams.push({ course_id: null, ...body, customize_id: nextId() });
    return success();
  }],
  ["PUT", "/exam/{customize_id}", ({ params, body }) => {
    const index = state.exams.findIndex((item) => item.customize_id === Number(params.customize_id));
    if (index < 0) return json({ code: "EXAM_SCHEDULE_NOT_FOUND" }, 404);
    state.exams[index] = { ...state.exams[index], ...body };
    return success();
  }],
  ["DELETE", "/exam/{customize_id}", ({ params }) => {
    const index = state.exams.findIndex((item) => item.customize_id === Number(params.customize_id));
    if (index < 0) return json({ code: "EXAM_SCHEDULE_NOT_FOUND" }, 404);
    state.exams.splice(index, 1);
    return success();
  }],
  ["GET", "/feedback", ({ query }) => {
    const page = Math.max(Number(query.get("page")) || 1, 1);
    const size = Math.max(Number(query.get("size")) || 20, 1);
    const start = (page - 1) * size;
    return json(ok({ total: state.feedback.length, items: state.feedback.slice(start, start + size) }));
  }],
  ["POST", "/feedback", ({ body }) => {
    state.feedback.push({ id: nextId(), ...body, status: "pending", replies: [], created_at: timestamp(), updated_at: timestamp() });
    return success();
  }],
  ["POST", "/feedback/no_auth", ({ body }) => {
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
  }],
  ["POST", "/img/{tag}", () => json(ok({ id: `mock-${Date.now().toString(16)}` }))],
  ["GET", "/img/{id}", () => ({ status: 200, data: PNG, contentType: "image/png" })],
  ["GET", "/notice", ({ query }) => {
    const status = query.get("status");
    const notices = !status || status === "all" ? state.notices : state.notices.filter((item) => item.status === status);
    const page = Math.max(Number(query.get("page")) || 1, 1);
    const size = Math.max(Number(query.get("size")) || 20, 1);
    const start = (page - 1) * size;
    return json(ok({ count: notices.length, notices: notices.slice(start, start + size) }));
  }],
  ["PUT", "/notice/{id}", ({ params }) => {
    const notice = state.notices.find((item) => item.id === Number(params.id));
    if (!notice) return json({ code: "NOTICE_NOT_FOUND" }, 404);
    notice.status = "read";
    return success();
  }],
];

function compilePath(path) {
  const keys = [];
  const pattern = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{([^}]+)\\\}/g, (_, key) => {
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
  if (contentType.includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  return { raw };
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Mock-Status, X-Mock-Delay");
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
      const route = routes.find((item) => item.method === request.method && item.regexp.test(url.pathname));
      if (!route) {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ code: "ENDPOINT_NOT_FOUND", data: `${request.method} ${url.pathname}` }));
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
      const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
      const body = await readBody(request);
      let result = route.handler({ request, params, query: url.searchParams, body });

      const forcedStatus = Number(request.headers["x-mock-status"]);
      if (Number.isInteger(forcedStatus) && forcedStatus >= 400 && forcedStatus <= 599) {
        result = json({ code: `MOCK_${forcedStatus}` }, forcedStatus);
      }

      response.writeHead(result.status, {
        "Content-Type": result.contentType || "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(Buffer.isBuffer(result.data) ? result.data : JSON.stringify(result.data));
    } catch (error) {
      const status = error.message === "BODY_TOO_LARGE" ? 413 : 400;
      response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ code: error.message === "BODY_TOO_LARGE" ? "BODY_TOO_LARGE" : "INVALID_REQUEST" }));
    }
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const host = process.env.MOCK_HOST || "127.0.0.1";
  const port = Number(process.env.MOCK_PORT || process.env.PORT || 3000);
  createMockServer().listen(port, host, () => {
    console.log(`Weihuda mock server: http://${host}:${port}`);
    console.log(`Loaded ${routes.length} routes from Apifox project 8872112`);
  });
}
