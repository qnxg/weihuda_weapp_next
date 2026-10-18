import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, test } from "node:test";
import { createRandomRank, fixtures } from "../src/fixtures.js";
import { createMockServer, publicRouteKeys, resolveDelay, routes } from "../src/server.js";

let server;
let baseUrl;
const authHeaders = { Authorization: "Bearer mock-access-token" };
const rankScoreKeys = ["arithmetic", "weighted", "gpa"];
const rankPositionKeys = ["arithmetic_rank", "weighted_rank", "gpa_rank"];
const rankDetailKeys = [...rankScoreKeys, ...rankPositionKeys];
const shanghaiDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function shanghaiDateTimeKey(date = new Date()) {
  const parts = Object.fromEntries(
    shanghaiDateTimeFormatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function rankAvailability(detail) {
  if (detail === null) return "none";
  rankDetailKeys.forEach((key) => {
    assert.ok(Object.hasOwn(detail, key));
    assert.ok(detail[key] === null || typeof detail[key] === "string");
  });
  const scorePresence = rankScoreKeys.map((key) => detail[key] !== null);
  const rankPresence = rankPositionKeys.map((key) => detail[key] !== null);
  assert.ok(scorePresence.every((present) => present === scorePresence[0]));
  assert.ok(rankPresence.every((present) => present === rankPresence[0]));
  if (scorePresence[0] && rankPresence[0]) return "both";
  if (scorePresence[0]) return "score-only";
  if (rankPresence[0]) return "rank-only";
  return "none";
}

before(async () => {
  server = createMockServer({ minDelayMs: 0, maxDelayMs: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test("registers every catalog endpoint", () => {
  assert.equal(routes.length, 62);
  assert.equal(new Set(routes.map(({ method, path }) => `${method} ${path}`)).size, 62);
});

test("applies 500ms to 1000ms jitter with an explicit override", () => {
  assert.equal(
    resolveDelay({}, () => 0),
    500,
  );
  assert.equal(
    resolveDelay({}, () => 0.999999),
    1000,
  );
  assert.equal(resolveDelay({ "x-mock-delay": "750" }), 750);
  assert.equal(resolveDelay({ "x-mock-delay": "0" }), 0);
});

test("returns documented hello response", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: "OK", data: { hello: "world" } });
});

test("keeps homepage lab and gym fixtures within the controlled six-day window", async () => {
  const headers = { ...authHeaders, "X-Mock-Date": "2026-09-23" };
  const [labResponse, gymResponse] = await Promise.all([
    fetch(`${baseUrl}/lab/schedule`, { headers }),
    fetch(`${baseUrl}/gym/appointment`, { headers }),
  ]);
  assert.equal(labResponse.status, 200);
  assert.equal(gymResponse.status, 200);
  assert.equal((await labResponse.json()).data[0].date_time, "2026-09-26 14:30");
  assert.equal((await gymResponse.json()).data[0].show_date, "2026年9月28日（周一）");
});

test("returns monthly or daily network details and validates the selected date", async () => {
  const monthlyResponse = await fetch(`${baseUrl}/netflow/detail?year=2025&month=2`, {
    headers: authHeaders,
  });
  assert.equal(monthlyResponse.status, 200);
  const monthlyPayload = await monthlyResponse.json();
  assert.equal(monthlyPayload.data.total, "12.80GB");
  assert.deepEqual(
    monthlyPayload.data.items.map(({ app }) => app),
    ["/基础协议/SSL", "/视频服务/在线视频", "/云服务/文件同步", "/学习平台/在线课堂", "/其他流量"],
  );

  const dailyResponse = await fetch(`${baseUrl}/netflow/detail?year=2025&month=2&day=14`, {
    headers: authHeaders,
  });
  assert.equal(dailyResponse.status, 200);
  const dailyPayload = await dailyResponse.json();
  assert.equal(dailyPayload.data.total, "640MB");
  assert.equal(dailyPayload.data.items.length, 5);
  assert.equal(
    dailyPayload.data.items.reduce((sum, { percentage }) => sum + percentage, 0),
    1,
  );

  const invalidDateResponse = await fetch(`${baseUrl}/netflow/detail?year=2025&month=2&day=29`, {
    headers: authHeaders,
  });
  assert.equal(invalidDateResponse.status, 400);

  const missingPeriodResponse = await fetch(`${baseUrl}/netflow/detail`, {
    headers: authHeaders,
  });
  assert.equal(missingPeriodResponse.status, 400);
});

test("returns the server-designated semester table without authentication", async () => {
  const response = await fetch(`${baseUrl}/semester`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.deepEqual(payload, { code: "OK", data: fixtures.semesterTable });
  assert.ok(payload.data.items.every(({ xq }) => Number.isInteger(xq)));
  assert.ok(payload.data.items.every(({ xq_text }) => xq_text.length > 0));
  assert.ok(
    payload.data.items.some(
      ({ xn, xq }) => xn === payload.data.now_xn && xq === payload.data.now_xq,
    ),
  );
});

test("returns the public academic calendar list", async () => {
  const response = await fetch(`${baseUrl}/calendar`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.deepEqual(payload.data, {
    items: [
      {
        xn: "2026 - 2027 学年",
        periods: [
          { id: 1, name: "秋季学期" },
          { id: 2, name: "寒假" },
          { id: 3, name: "春季学期" },
          { id: 4, name: "暑假" },
        ],
      },
      {
        xn: "2025 - 2026 学年",
        periods: [
          { id: 5, name: "秋季学期" },
          { id: 6, name: "寒假" },
          { id: 7, name: "春季学期" },
          { id: 8, name: "暑假" },
        ],
      },
    ],
    now_id: 1,
  });
});

test("returns a slim public academic calendar detail by ID", async () => {
  const response = await fetch(`${baseUrl}/calendar/1`);
  const payload = await response.json();
  const calendar = payload.data;

  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.deepEqual(Object.keys(calendar), ["from", "to", "name", "prev", "notes"]);
  assert.equal(calendar.from, "2026-09-13");
  assert.equal(calendar.to, "2027-01-16");
  assert.equal(calendar.name, "2026 - 2027 学年 秋季学期");
  assert.deepEqual(calendar.prev, [
    { index: -2, name: "夏9" },
    { index: -1, name: "夏10" },
  ]);
  assert.deepEqual(
    calendar.notes.map(({ key }) => key),
    ["学期安排", "期末考试", "选课安排", "开课安排", "新生军训"],
  );

  const historicalResponse = await fetch(`${baseUrl}/calendar/8`);
  const historicalPayload = await historicalResponse.json();
  const historicalCalendar = historicalPayload.data;
  assert.equal(historicalResponse.status, 200);
  assert.deepEqual(historicalCalendar, {
    from: "2026-07-12",
    to: "2026-08-22",
    name: "2025 - 2026 学年 暑假",
    prev: [],
    notes: [{ key: "放假安排", value: "2026年7月12日至8月22日为暑假。" }],
  });

  const invalidResponse = await fetch(`${baseUrl}/calendar/unknown`);
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { code: "INVALID_REQUEST" });

  const missingResponse = await fetch(`${baseUrl}/calendar/999`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { code: "CALENDAR_NOT_FOUND" });
});

test("returns three published announcements for the homepage", async () => {
  const response = await fetch(`${baseUrl}/announcement`, { headers: authHeaders });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.equal(payload.data.length, 3);
  assert.deepEqual(
    payload.data.map(({ title }) => title),
    ["服务通知", "校园网维护安排", "使用指南"],
  );
  assert.deepEqual(payload.data[1].content.split("\n"), [
    "本周五 23:00 至次日 02:00 将进行校园网例行维护。",
    "维护期间校园网可能短暂中断。",
    "请提前保存在线任务并合理安排使用。",
  ]);
  assert.deepEqual(payload.data[2], {
    id: 3,
    title: "使用指南",
    url: "https://qnxg.cn/guide",
    content: "查看详情。",
    created_at: "2026-09-18 10:00:00",
  });
});

test("returns the complete building list and uses it for empty-room validation", async () => {
  const buildingResponse = await fetch(`${baseUrl}/building`, { headers: authHeaders });
  const buildingPayload = await buildingResponse.json();
  assert.equal(buildingResponse.status, 200);
  assert.equal(buildingPayload.code, "OK");
  assert.equal(buildingPayload.data.length, 53);
  assert.equal(
    createHash("sha256")
      .update(
        JSON.stringify(
          buildingPayload.data.map(({ building_id, building_name, description }) => ({
            building_id,
            building_name,
            description,
          })),
        ),
      )
      .digest("hex"),
    "ba28b358001338afff30bb28021c31a43bef6bd4537a1295141200e873112c4f",
  );
  assert.deepEqual(buildingPayload.data[0], {
    building_id: "106",
    building_name: "综合楼",
    description: "可能无法查询到数据",
    favorite: true,
    last_query_at: null,
  });
  assert.deepEqual(
    buildingPayload.data.slice(0, 2).map(({ building_id }) => building_id),
    ["106", "W134b2a60000WH"],
  );
  assert.ok(
    buildingPayload.data.some(
      (building) =>
        building.building_id === "126" &&
        building.building_name === "南校区体育馆" &&
        building.description === "可能无法查询到数据" &&
        building.favorite === false &&
        building.last_query_at === null,
    ),
  );
  const reliableDescriptions = new Map([
    ["302", null],
    ["102", null],
    ["123", null],
    ["122", null],
    ["201", "北校区"],
    ["202", "北校区"],
    ["203", "北校区"],
    ["204", "北校区"],
  ]);
  buildingPayload.data.forEach((building) => {
    assert.ok(!building.building_name.includes("北校区"));
    if (reliableDescriptions.has(building.building_id)) {
      assert.equal(building.description, reliableDescriptions.get(building.building_id));
    } else {
      assert.match(building.description, /可能无法查询到数据/);
    }
  });
  assert.equal(
    buildingPayload.data.find(({ building_id }) => building_id === "W1348a6d0000WH").description,
    "北校区 · 可能无法查询到数据",
  );
  const longestBuildingIds = buildingPayload.data
    .toSorted(
      (left, right) =>
        [...right.building_name].length - [...left.building_name].length ||
        left.building_name.localeCompare(right.building_name, "zh-CN"),
    )
    .slice(0, 3)
    .map(({ building_id }) => building_id);
  const recentBuildingIds = buildingPayload.data
    .filter(({ last_query_at }) => last_query_at !== null)
    .toSorted((left, right) => Date.parse(right.last_query_at) - Date.parse(left.last_query_at))
    .map(({ building_id }) => building_id);
  assert.deepEqual(recentBuildingIds, longestBuildingIds);

  const favoriteResponse = await fetch(`${baseUrl}/building/302/favorite`, {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ favorite: true }),
  });
  assert.equal(favoriteResponse.status, 200);
  assert.deepEqual((await favoriteResponse.json()).data, {
    building_id: "302",
    building_name: "研究生楼",
    description: null,
    favorite: true,
    last_query_at: null,
  });

  const updatedBuildingResponse = await fetch(`${baseUrl}/building`, { headers: authHeaders });
  const updatedBuildings = (await updatedBuildingResponse.json()).data;
  assert.deepEqual(
    updatedBuildings.slice(0, 3).map(({ building_id, favorite }) => ({
      building_id,
      favorite,
    })),
    [
      { building_id: "106", favorite: true },
      { building_id: "302", favorite: true },
      { building_id: "W134b2a60000WH", favorite: true },
    ],
  );

  const invalidFavoriteResponse = await fetch(`${baseUrl}/building/106/favorite`, {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ favorite: "yes" }),
  });
  assert.equal(invalidFavoriteResponse.status, 400);
  assert.equal((await invalidFavoriteResponse.json()).code, "INVALID_REQUEST");

  const unknownFavoriteResponse = await fetch(`${baseUrl}/building/unknown/favorite`, {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ favorite: true }),
  });
  assert.equal(unknownFavoriteResponse.status, 404);
  assert.equal((await unknownFavoriteResponse.json()).code, "BUILDING_NOT_FOUND");

  const roomResponse = await fetch(
    `${baseUrl}/empty_room?building_id=126&date=2026-10-08&times=1,2`,
    {
      headers: authHeaders,
    },
  );
  const roomPayload = await roomResponse.json();
  assert.equal(roomResponse.status, 200);
  assert.equal(roomPayload.code, "OK");
  assert.equal(roomPayload.data.time, 1);
  assert.equal(roomPayload.data.items.length, 9);
  assert.ok(roomPayload.data.items.every((room) => room.room_name.startsWith("南校区体育馆 ")));
  roomPayload.data.items.forEach((room) => {
    assert.deepEqual(Object.keys(room).sort(), [
      "exam_seat_count",
      "room_name",
      "room_type",
      "seat_count",
    ]);
    assert.equal(typeof room.room_name, "string");
    assert.equal(typeof room.room_type, "string");
    assert.equal(typeof room.seat_count, "number");
    assert.equal(typeof room.exam_seat_count, "number");
  });

  const allPeriodsResponse = await fetch(
    `${baseUrl}/empty_room?building_id=126&date=2026-10-08&times=1,2,3,4,5,6,7,8,9,10,11,12`,
    { headers: authHeaders },
  );
  const allPeriodsPayload = await allPeriodsResponse.json();
  assert.equal(allPeriodsResponse.status, 200);
  assert.deepEqual(allPeriodsPayload.data, { time: 1, items: [] });

  const duplicatePeriodsResponse = await fetch(
    `${baseUrl}/empty_room?building_id=126&date=2026-10-08&times=1,1`,
    { headers: authHeaders },
  );
  assert.equal(duplicatePeriodsResponse.status, 200);

  const queriedBuildingResponse = await fetch(`${baseUrl}/building`, { headers: authHeaders });
  const queriedBuildings = (await queriedBuildingResponse.json()).data;
  const queriedBuilding = queriedBuildings.find(({ building_id }) => building_id === "126");
  assert.equal(queriedBuilding.favorite, false);
  assert.match(queriedBuilding.last_query_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  const beforeForcedError = queriedBuildings.find(({ building_id }) => building_id === "106");
  const forcedErrorResponse = await fetch(
    `${baseUrl}/empty_room?building_id=106&date=2026-10-08&times=1,2`,
    {
      headers: { ...authHeaders, "X-Mock-Status": "503" },
    },
  );
  assert.equal(forcedErrorResponse.status, 503);
  const afterForcedErrorResponse = await fetch(`${baseUrl}/building`, { headers: authHeaders });
  const afterForcedError = (await afterForcedErrorResponse.json()).data.find(
    ({ building_id }) => building_id === "106",
  );
  assert.equal(afterForcedError.last_query_at, beforeForcedError.last_query_at);

  const invalidQueries = [
    "building_id=unknown&date=2026-10-08&times=1,2",
    "building_id=106&date=2026-02-30&times=1,2",
    "building_id=106",
    "building_id=106&date=2026-10-08",
    "building_id=106&date=2026-10-08&times=0",
    "building_id=106&date=2026-10-08&times=13",
    "building_id=106&date=2026-10-08&times=1,,2",
  ];
  for (const query of invalidQueries) {
    const invalidResponse = await fetch(`${baseUrl}/empty_room?${query}`, {
      headers: authHeaders,
    });
    assert.equal(invalidResponse.status, 400);
    assert.equal((await invalidResponse.json()).code, "INVALID_REQUEST");
  }
});

test("validates every ranking filter", async () => {
  const validResponse = await fetch(
    `${baseUrl}/rank?xn=2025&xq=4&range=minor&data_source=execution&display=initial`,
    { headers: authHeaders },
  );
  assert.equal(validResponse.status, 200);
  const validPayload = await validResponse.json();
  assert.equal(validPayload.code, "OK");
  Object.values(validPayload.data).forEach(rankAvailability);

  const invalidResponse = await fetch(
    `${baseUrl}/rank?range=major&data_source=unknown&display=max`,
    { headers: authHeaders },
  );
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { code: "INVALID_REQUEST" });

  const unknownSemesterResponse = await fetch(
    `${baseUrl}/rank?xn=2025&xq=99&range=major&data_source=total&display=max`,
    { headers: authHeaders },
  );
  assert.equal(unknownSemesterResponse.status, 400);
  assert.deepEqual(await unknownSemesterResponse.json(), { code: "INVALID_REQUEST" });
});

test("randomizes complete rank availability modes without partial metric groups", () => {
  const cases = [
    [0, "both"],
    [0.25, "score-only"],
    [0.5, "rank-only"],
    [0.75, "none"],
  ];
  cases.forEach(([value, expected]) => {
    const generated = createRandomRank(() => value);
    assert.deepEqual(Object.values(generated).map(rankAvailability), [
      expected,
      expected,
      expected,
    ]);
  });

  const values = [0, 0.25, 0.5];
  let index = 0;
  const mixed = createRandomRank(() => values[index++]);
  assert.deepEqual(Object.values(mixed).map(rankAvailability), ["both", "score-only", "rank-only"]);
});

test("both ranking routes preserve all four availability modes", () => {
  const cases = [
    [0, "both"],
    [0.25, "score-only"],
    [0.5, "rank-only"],
    [0.75, "none"],
  ];
  const rankRoute = routes.find(({ method, path }) => method === "GET" && path === "/rank");
  const trustedRoute = routes.find(({ method, path }) => method === "GET" && path === "/rank/ca");
  assert.ok(rankRoute);
  assert.ok(trustedRoute);

  [rankRoute, trustedRoute].forEach((route) => {
    cases.forEach(([value, expected]) => {
      const result = route.handler({
        query: new URLSearchParams("range=major&data_source=total&display=max"),
        random: () => value,
      });
      assert.equal(result.status, 200);
      const rank = route.path === "/rank/ca" ? result.data.data.rank : result.data.data;
      assert.deepEqual(Object.values(rank).map(rankAvailability), [expected, expected, expected]);
    });
  });
});

test("returns consistent randomized trusted ranking data", async () => {
  const response = await fetch(`${baseUrl}/rank/ca`, { headers: authHeaders });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.equal(typeof payload.data.updated_at, "string");
  Object.values(payload.data.rank).forEach(rankAvailability);
});

test("requires a valid semester for course grades", async () => {
  const validResponse = await fetch(`${baseUrl}/grade?xn=2025&xq=2`, {
    headers: authHeaders,
  });
  assert.equal(validResponse.status, 200);
  assert.deepEqual(await validResponse.json(), { code: "OK", data: fixtures.grades });

  const invalidResponse = await fetch(`${baseUrl}/grade?xn=2025&xq=99`, {
    headers: authHeaders,
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { code: "INVALID_REQUEST" });
});

test("covers every course-grade tag presentation branch", async () => {
  const response = await fetch(`${baseUrl}/grade?xn=2026&xq=1`, {
    headers: authHeaders,
  });
  const payload = await response.json();
  const grades = payload.data;

  assert.equal(response.status, 200);
  assert.ok(
    grades.some(({ grade_type, grade_tag }) => grade_type === "主修" && grade_tag === null),
  );
  assert.ok(grades.some(({ grade_type }) => grade_type === "辅修"));
  assert.ok(grades.some(({ grade_tag }) => grade_tag !== null));
  assert.ok(grades.some(({ course_type1 }) => course_type1 === "必修"));
  assert.ok(grades.some(({ course_type1 }) => course_type1 && course_type1 !== "必修"));
  assert.ok(grades.some(({ course_type2 }) => course_type2 === "公共基础"));
  assert.deepEqual(
    new Set(grades.map(({ course_type2 }) => course_type2)),
    new Set(["专业课", "专业基础", "学类核心", "学门核心", "专业核心", "公共基础"]),
  );
});

test("returns countdown data without authentication", async () => {
  const response = await fetch(`${baseUrl}/countdown`, {
    headers: { "X-Mock-Date": "2026-09-23" },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.deepEqual(payload.data.holiday, {
    name: "中秋节",
    start: "2026-09-25",
    end: "2026-09-27",
    status: "upcoming",
    days: 2,
    duration: 3,
  });
  assert.deepEqual(payload.data.semester, {
    xn: 2026,
    xq: 1,
    xq_text: "秋季学期",
    target_date: "2027-01-03",
    weeks: 16,
    status: "active",
    days: 102,
  });
});

test("returns public countdown states for a controlled calendar date", async () => {
  const activePayload = await (
    await fetch(`${baseUrl}/countdown`, { headers: { "X-Mock-Date": "2026-09-25" } })
  ).json();
  assert.equal(activePayload.data.holiday.status, "active");
  assert.equal(activePayload.data.holiday.days, 3);
  assert.equal(activePayload.data.semester.days, 100);

  const completedPayload = await (
    await fetch(`${baseUrl}/countdown`, { headers: { "X-Mock-Date": "2027-01-03" } })
  ).json();
  assert.equal(completedPayload.data.holiday, null);
  assert.equal(completedPayload.data.semester.status, "completed");
  assert.equal(completedPayload.data.semester.days, 0);
});

test("rejects an invalid mock calendar date", async () => {
  const response = await fetch(`${baseUrl}/countdown`, {
    headers: { "X-Mock-Date": "2026-02-30" },
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { code: "INVALID_REQUEST" });
});

test("provides full-week course fixtures for schedule composition scenarios", async () => {
  const response = await fetch(`${baseUrl}/classtable?xn=2026&xq=1`, {
    headers: authHeaders,
  });
  const payload = await response.json();
  const coursesById = (courseId) => payload.data.filter((course) => course.course_id === courseId);
  const periodsById = (courseId) =>
    coursesById(courseId)
      .map((course) => course.time)
      .sort((left, right) => left - right);
  const courseKeys = [
    "area",
    "class_name",
    "course_id",
    "course_name",
    "course_type",
    "credit",
    "customize_id",
    "day",
    "extra",
    "people",
    "place",
    "teacher",
    "time",
    "weeks",
  ];

  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.ok(payload.data.length >= 20);
  for (const course of payload.data) {
    assert.deepEqual(Object.keys(course).sort(), courseKeys);
    assert.equal(typeof course.course_name, "string");
    for (const field of [
      "course_id",
      "class_name",
      "course_type",
      "extra",
      "area",
      "place",
      "teacher",
    ]) {
      assert.equal(course[field] === null || typeof course[field] === "string", true);
    }
    assert.equal(course.credit === null || Number.isFinite(course.credit), true);
    assert.equal(course.people === null || Number.isInteger(course.people), true);
    assert.equal(course.customize_id === null || Number.isInteger(course.customize_id), true);
    assert.ok(Array.isArray(course.weeks) && course.weeks.length > 0);
    assert.equal(new Set(course.weeks).size, course.weeks.length);
    assert.ok(course.weeks.every((week) => Number.isInteger(week) && week >= 1 && week <= 16));
    assert.ok(Number.isInteger(course.day) && course.day >= 0 && course.day <= 6);
    assert.ok(Number.isInteger(course.time) && course.time >= 1 && course.time <= 12);
  }
  assert.deepEqual(
    [...new Set(payload.data.map((course) => course.day))].sort((left, right) => left - right),
    [0, 1, 2, 3, 4, 5, 6],
  );

  assert.deepEqual(
    coursesById("COMP1001").map(({ day, time, place }) => ({ day, time, place })),
    [
      { day: 1, time: 1, place: "综101" },
      { day: 1, time: 2, place: "综101" },
      { day: 1, time: 3, place: "综101" },
    ],
  );
  assert.deepEqual(
    coursesById("COMP2010").map(({ day, time, place }) => ({ day, time, place })),
    [{ day: 2, time: 5, place: "复临舍 305" }],
  );
  assert.deepEqual(
    coursesById("LONG1001").map(({ day, time, course_name, place, weeks }) => ({
      day,
      time,
      course_name,
      place,
      weeks,
    })),
    [
      {
        day: 2,
        time: 11,
        course_name: "跨学科软件工程综合创新实践与复杂系统设计",
        place: "信息科学与工程学院实验中心东区超长名称教学机房A204",
        weeks: [2],
      },
    ],
  );
  assert.deepEqual(
    coursesById("LONG1002").map(({ day, time, course_name, place }) => ({
      day,
      time,
      course_name,
      place,
    })),
    [
      {
        day: 5,
        time: 11,
        course_name: "面向复杂业务场景的软件架构设计与工程实践",
        place: "综合教学楼南栋智慧教室与远程协作实验中心B区405",
      },
      {
        day: 5,
        time: 12,
        course_name: "面向复杂业务场景的软件架构设计与工程实践",
        place: "综合教学楼南栋智慧教室与远程协作实验中心B区405",
      },
    ],
  );

  const splitLocationCourse = coursesById("INNO1001").sort((left, right) => left.time - right.time);
  assert.deepEqual(
    splitLocationCourse.map(({ day, time, place }) => ({ day, time, place })),
    [
      { day: 6, time: 3, place: "综203" },
      { day: 6, time: 4, place: "综203" },
      { day: 6, time: 5, place: "综405" },
    ],
  );

  const phasedCourse = coursesById("COMP3101");
  assert.equal(phasedCourse.length, 4);
  for (const [place, weeks] of [
    ["综101", [1, 2]],
    ["综102", [3, 4]],
  ]) {
    const phase = phasedCourse.filter((course) => course.place === place);
    assert.deepEqual(
      phase.map((course) => course.time),
      [5, 6],
    );
    assert.ok(phase.every((course) => course.day === 1));
    phase.forEach((course) => assert.deepEqual(course.weeks, weeks));
  }
  const replacementCourse = coursesById("COMP3102");
  assert.deepEqual(
    replacementCourse.map((course) => course.time),
    [5, 6],
  );
  assert.ok(replacementCourse.every((course) => course.day === 1 && course.place === "综103"));
  replacementCourse.forEach((course) => assert.deepEqual(course.weeks, [5, 6]));
  const phasedSlot = payload.data.filter(
    (course) =>
      course.day === 1 &&
      [5, 6].includes(course.time) &&
      ["COMP3101", "COMP3102"].includes(course.course_id),
  );
  assert.equal(
    phasedSlot.some((course) => course.weeks.includes(7)),
    false,
  );

  for (const [courseId, weeks] of [
    ["GENERAL1001", [2, 4, 6, 8, 10, 12, 14, 16]],
    ["GENERAL1002", [1, 3, 5, 7, 9, 11, 13, 15]],
  ]) {
    const alternatingCourse = coursesById(courseId);
    assert.equal(alternatingCourse.length, 2);
    assert.deepEqual(
      alternatingCourse.map((course) => course.time),
      [9, 10],
    );
    assert.ok(alternatingCourse.every((course) => course.day === 0));
    alternatingCourse.forEach((course) => assert.deepEqual(course.weeks, weeks));
  }
  assert.deepEqual(
    payload.data
      .filter((course) => course.day === 0 && course.time === 9 && course.weeks.includes(2))
      .map((course) => course.course_id)
      .sort(),
    ["GENERAL1001"],
  );
  assert.deepEqual(
    payload.data
      .filter((course) => course.day === 4 && course.time === 3 && course.weeks.includes(2))
      .map((course) => course.course_id)
      .sort(),
    ["COMP2004", "COMP2006"],
  );

  const repeatedWeekdayCourse = coursesById("COMP3012");
  assert.equal(repeatedWeekdayCourse.length, 4);
  assert.deepEqual([...new Set(repeatedWeekdayCourse.map((course) => course.day))].sort(), [3, 5]);
  for (const day of [3, 5]) {
    assert.deepEqual(
      repeatedWeekdayCourse.filter((course) => course.day === day).map((course) => course.time),
      [9, 10],
    );
  }

  const oddWeeks = [1, 3, 5, 7, 9, 11, 13, 15];
  const evenWeeks = [2, 4, 6, 8, 10, 12, 14, 16];
  const oddWeekCourse = coursesById("COMP3013");
  const evenWeekCourse = coursesById("COMP3014");
  assert.deepEqual(periodsById("COMP3013"), [3, 4]);
  assert.deepEqual(periodsById("COMP3014"), [3, 4]);
  assert.ok(oddWeekCourse.every((course) => course.day === 3));
  assert.ok(evenWeekCourse.every((course) => course.day === 3));
  oddWeekCourse.forEach((course) => assert.deepEqual(course.weeks, oddWeeks));
  evenWeekCourse.forEach((course) => assert.deepEqual(course.weeks, evenWeeks));
  assert.deepEqual(
    [...new Set([...oddWeeks, ...evenWeeks])].sort((left, right) => left - right),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  );
  assert.equal(
    oddWeeks.some((week) => evenWeeks.includes(week)),
    false,
  );
  assert.deepEqual(
    payload.data.find((course) => course.course_id === "MATH2001").weeks,
    [1, 3, 5, 7, 9, 11, 13, 15],
  );
  evenWeekCourse.forEach(({ extra }) => {
    assert.ok(extra.length >= 150);
    assert.match(extra, /^请在课前完成课程平台中的预习任务/);
    assert.match(extra, /下一次上课前补齐全部课堂任务。$/);
  });

  const wednesdayPeriods = payload.data
    .filter((course) => course.day === 3)
    .map((course) => course.time)
    .sort((left, right) => left - right);
  assert.deepEqual(wednesdayPeriods, [1, 2, 3, 3, 4, 4, 5, 6, 7, 8, 9, 10]);
});

test("returns extra-course fixtures for half of the random range and an empty list otherwise", () => {
  const extraCourseRoute = routes.find(
    ({ method, path }) => method === "GET" && path === "/course/extra",
  );
  assert.ok(extraCourseRoute);
  const request = (randomValue, query = "xn=2026&xq=1") => {
    let randomCalls = 0;
    const result = extraCourseRoute.handler({
      query: new URLSearchParams(query),
      random: () => {
        randomCalls += 1;
        return randomValue;
      },
    });
    return { randomCalls, result };
  };

  for (const randomValue of [0, 0.499999]) {
    const { randomCalls, result } = request(randomValue);
    assert.equal(result.status, 200);
    assert.equal(randomCalls, 1);
    assert.deepEqual(result.data.data, fixtures.extraCourses);
    assert.deepEqual(
      result.data.data.map((course) => course.course_name),
      ["工程实践", "学术写作专题"],
    );
    assert.ok(
      result.data.data.every((course) =>
        [
          "course_id",
          "course_name",
          "class_name",
          "course_type",
          "credit",
          "extra",
          "area",
          "people",
          "teacher",
        ].every((field) => Object.hasOwn(course, field)),
      ),
    );
    assert.equal(typeof result.data.data[1].extra, "string");
    assert.ok(result.data.data[1].extra.length > 300);
    assert.match(result.data.data[1].extra, /^本课程暂无固定上课时间/);
    assert.match(result.data.data[1].extra, /请合理安排学习时间。$/);
  }

  for (const randomValue of [0.5, 0.999999]) {
    const { randomCalls, result } = request(randomValue);
    assert.equal(result.status, 200);
    assert.equal(randomCalls, 1);
    assert.deepEqual(result.data.data, []);
  }

  const invalid = request(0, "xn=2026&xq=99");
  assert.equal(invalid.result.status, 400);
  assert.equal(invalid.randomCalls, 0);
});

test("uses SemesterItem integer IDs across semester-scoped endpoints", async () => {
  for (const path of ["/course/extra", "/lab/grade"]) {
    const valid = await fetch(`${baseUrl}${path}?xn=2025&xq=3`, { headers: authHeaders });
    assert.equal(valid.status, 200);

    const invalid = await fetch(`${baseUrl}${path}?xn=2025&xq=99`, { headers: authHeaders });
    assert.equal(invalid.status, 400);
  }

  const emptyLabGrade = await fetch(`${baseUrl}/lab/grade?xn=2025&xq=4`, {
    headers: authHeaders,
  });
  assert.deepEqual(await emptyLabGrade.json(), { code: "OK", data: null });

  const course = {
    course_name: "学期契约测试课程",
    weeks: [1],
    day: 1,
    times: [1],
    place: null,
    teacher: null,
  };
  const stringSemester = await fetch(`${baseUrl}/course/custom`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ xn: 2025, xq: "3", course }),
  });
  assert.equal(stringSemester.status, 400);

  const integerSemester = await fetch(`${baseUrl}/course/custom`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ xn: 2025, xq: 3, course }),
  });
  assert.equal(integerSemester.status, 200);
});

test("supports a stateful settings update", async () => {
  const value = { version: 2, setting: { display_not_current_week_courses: false } };
  const update = await fetch(`${baseUrl}/me/setting/table`, {
    method: "PUT",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  assert.equal(update.status, 200);

  const read = await fetch(`${baseUrl}/me/setting/table`, { headers: authHeaders });
  assert.deepEqual(await read.json(), { code: "OK", data: value });
});

test("filters recent exams and paginates ended exams with a stable offset", async () => {
  const recentPayload = await (await fetch(`${baseUrl}/exam`, { headers: authHeaders })).json();
  const firstEndedPage = await (
    await fetch(`${baseUrl}/exam?type=end&offset=0`, { headers: authHeaders })
  ).json();
  const secondEndedPage = await (
    await fetch(`${baseUrl}/exam?type=end&offset=10`, { headers: authHeaders })
  ).json();
  const nowKey = shanghaiDateTimeKey();
  const endedExams = [...firstEndedPage.data, ...secondEndedPage.data];
  const allExams = [...recentPayload.data, ...endedExams];
  const officialExams = allExams.filter((exam) => exam.customize_id === null);
  const customExams = allExams.filter((exam) => exam.customize_id !== null);
  const scenarios = new Set(
    allExams.map((exam) => {
      const startKey = `${exam.date} ${exam.start_time}`;
      const endKey = `${exam.date} ${exam.end_time}`;
      const phase = endKey < nowKey ? "completed" : startKey <= nowKey ? "active" : "future";
      assert.equal(typeof exam.invalid, "boolean");
      return `${phase}:${exam.invalid ? "invalid" : "valid"}`;
    }),
  );
  const customPhases = new Set(
    customExams.map((exam) => (`${exam.date} ${exam.end_time}` < nowKey ? "completed" : "future")),
  );

  assert.equal(recentPayload.code, "OK");
  assert.equal(firstEndedPage.code, "OK");
  assert.equal(secondEndedPage.code, "OK");
  assert.equal(recentPayload.data.length, 3);
  assert.equal(firstEndedPage.data.length, 10);
  assert.equal(secondEndedPage.data.length, 4);
  assert.equal(endedExams.length, 14);
  assert.equal(officialExams.length, 15);
  assert.equal(customExams.length, 2);
  assert.ok(
    recentPayload.data.every(
      (exam) =>
        !exam.invalid && (!exam.date || !exam.end_time || `${exam.date} ${exam.end_time}` > nowKey),
    ),
  );
  assert.ok(
    endedExams.every(
      (exam) =>
        exam.invalid || (exam.date && exam.end_time && `${exam.date} ${exam.end_time}` <= nowKey),
    ),
  );
  assert.deepEqual(
    secondEndedPage.data.map((exam) => exam.course_name),
    ["历史考试安排 7", "操作系统", "数据库系统", "跨平台软件工程与云原生分布式系统设计综合考试"],
  );
  assert.deepEqual(
    scenarios,
    new Set([
      "completed:valid",
      "completed:invalid",
      "active:valid",
      "active:invalid",
      "future:valid",
      "future:invalid",
    ]),
  );
  assert.deepEqual(customPhases, new Set(["completed", "future"]));
  customExams.forEach((exam) => {
    assert.equal(exam.course_id, null);
    assert.equal(exam.invalid, false);
    assert.equal(typeof exam.customize_id, "number");
  });
  assert.ok(
    allExams.some(
      (exam) =>
        exam.course_name === "编译原理" &&
        exam.classroom === "信息科学与工程学院实验中心东区综合楼208",
    ),
  );
  assert.ok(
    allExams.some(
      (exam) =>
        exam.course_name === "人工智能导论与机器学习模型设计综合考试" &&
        exam.classroom === "综合楼210",
    ),
  );
  assert.ok(
    allExams.some(
      (exam) =>
        exam.course_name === "跨平台软件工程与云原生分布式系统设计综合考试" &&
        exam.classroom === "新校区第二教学实验综合楼北区302考场",
    ),
  );
});

test("validates exam list query parameters", async () => {
  for (const path of [
    "/exam?type=unknown",
    "/exam?type=recent&offset=0",
    "/exam?type=end&offset=-1",
    "/exam?type=end&offset=1.5",
  ]) {
    assert.equal((await fetch(`${baseUrl}${path}`, { headers: authHeaders })).status, 400);
  }
});

test("supports creating and reading a custom exam", async () => {
  const exam = {
    course_name: "Mock 测试",
    area: "南校区",
    classroom: "综202",
    seat: "8",
    date: "2026-11-01",
    start_time: "14:00",
    end_time: "16:00",
  };
  assert.equal(
    (
      await fetch(`${baseUrl}/exam`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(exam),
      })
    ).status,
    200,
  );

  const payload = await (await fetch(`${baseUrl}/exam`, { headers: authHeaders })).json();
  assert.equal(payload.code, "OK");
  assert.equal(payload.data.at(-1).course_name, exam.course_name);
  assert.equal(payload.data.at(-1).course_id, null);
  assert.equal(payload.data.at(-1).invalid, false);
  assert.equal(typeof payload.data.at(-1).customize_id, "number");
});

test("returns binary content for image endpoint", async () => {
  const response = await fetch(`${baseUrl}/img/mock-image`, { headers: authHeaders });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.ok((await response.arrayBuffer()).byteLength > 0);
});

test("can force error responses for client testing", async () => {
  const response = await fetch(`${baseUrl}/me`, {
    headers: { ...authHeaders, "X-Mock-Status": "503" },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code: "MOCK_503" });
});

test("validates the gym grade year and returns year-specific data", async () => {
  const [currentResponse, historyResponse, missingYearResponse, unknownYearResponse] =
    await Promise.all([
      fetch(`${baseUrl}/gym/grade?xn=2026`, { headers: authHeaders }),
      fetch(`${baseUrl}/gym/grade?xn=2025`, { headers: authHeaders }),
      fetch(`${baseUrl}/gym/grade`, { headers: authHeaders }),
      fetch(`${baseUrl}/gym/grade?xn=2099`, { headers: authHeaders }),
    ]);
  const currentPayload = await currentResponse.json();
  const historyPayload = await historyResponse.json();

  assert.equal(currentResponse.status, 200);
  assert.equal(historyResponse.status, 200);
  assert.equal(currentPayload.data.score, 88);
  assert.equal(historyPayload.data.score, 85);
  assert.equal(currentPayload.data.short_run.rank, "优秀");
  assert.equal(currentPayload.data.short_run.color, "green");
  assert.equal(currentPayload.data.run.rank, "及格");
  assert.equal(currentPayload.data.run.color, "red");
  assert.equal(missingYearResponse.status, 400);
  assert.equal(unknownYearResponse.status, 400);
  assert.deepEqual(await missingYearResponse.json(), { code: "INVALID_REQUEST" });
  assert.deepEqual(await unknownYearResponse.json(), { code: "INVALID_REQUEST" });
  assert.equal(historyPayload.code, "OK");
  assert.deepEqual(
    Object.keys(historyPayload.data).sort(),
    [
      "bmi",
      "eye",
      "grade",
      "jump",
      "pull_and_sit",
      "report_description",
      "report_status",
      "report_type",
      "run",
      "score",
      "short_run",
      "sit_and_reach",
      "vc",
    ].sort(),
  );
  assert.equal(historyPayload.data.eye.sight.left.description, "正常");
});

test("keeps points and exchanged goods consistent", async () => {
  const before = (await (await fetch(`${baseUrl}/jifen`, { headers: authHeaders })).json()).data;
  const exchange = await fetch(`${baseUrl}/jifen/goods/1`, {
    method: "POST",
    headers: authHeaders,
  });
  assert.equal(exchange.status, 200);
  const after = (await (await fetch(`${baseUrl}/jifen`, { headers: authHeaders })).json()).data;
  const exchanged = (
    await (await fetch(`${baseUrl}/jifen/goods/exchanged`, { headers: authHeaders })).json()
  ).data;
  assert.equal(after.jifen, before.jifen - 200);
  assert.equal(exchanged[0].goods_name, "校园文创笔记本");
});

test("stores anonymous feedback for a complete preview flow", async () => {
  const create = await fetch(`${baseUrl}/feedback/no_auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      stu_id: "202208010101",
      contact: "student@example.edu.cn",
      description: "匿名反馈测试",
    }),
  });
  assert.equal(create.status, 200);
  const feedback = (await (await fetch(`${baseUrl}/feedback`, { headers: authHeaders })).json())
    .data;
  assert.ok(feedback.items.some((item) => item.description === "匿名反馈测试"));
});

test("protects every endpoint not declared public", async () => {
  for (const route of routes) {
    const routeKey = `${route.method} ${route.path}`;
    if (publicRouteKeys.has(routeKey)) continue;

    const requestPath = route.path.replaceAll(/\{[^}]+\}/g, "1");
    const response = await fetch(`${baseUrl}${requestPath}`, { method: route.method });
    assert.equal(response.status, 401, routeKey);
    assert.deepEqual(await response.json(), { code: "AUTH_TOKEN_INVALID" }, routeKey);
  }
});

test("validates required login parameters", async () => {
  const response = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stu_id: "202208010101", password: "encoded" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "INVALID_REQUEST");
});

test("filters campus card records with documented enum values", async () => {
  const consumption = await fetch(`${baseUrl}/card/record?year=2026&month=9&type=consumption`, {
    headers: authHeaders,
  });
  const recharge = await fetch(`${baseUrl}/card/record?year=2026&month=9&type=recharge`, {
    headers: authHeaders,
  });
  assert.equal((await consumption.json()).data.count, 2);
  assert.equal((await recharge.json()).data.count, 0);
});

test("accepts the documented lab binding form body", async () => {
  const response = await fetch(`${baseUrl}/lab/bind`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: "mock-password" }),
  });
  assert.equal(response.status, 200);
});
