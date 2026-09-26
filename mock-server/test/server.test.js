import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createRandomRank, fixtures } from "../src/fixtures.js";
import { createMockServer, publicRouteKeys, resolveDelay, routes } from "../src/server.js";

let server;
let baseUrl;
const authHeaders = { Authorization: "Bearer mock-access-token" };
const rankScoreKeys = ["arithmetic", "weighted", "gpa"];
const rankPositionKeys = ["arithmetic_rank", "weighted_rank", "gpa_rank"];
const rankDetailKeys = [...rankScoreKeys, ...rankPositionKeys];

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

test("registers every Apifox endpoint", () => {
  assert.equal(routes.length, 58);
  assert.equal(new Set(routes.map(({ method, path }) => `${method} ${path}`)).size, 58);
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

test("returns semester data without authentication", async () => {
  const response = await fetch(`${baseUrl}/semester`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: "OK", data: fixtures.semester });
});

test("returns the requested semester calendar", async () => {
  const response = await fetch(`${baseUrl}/semester?xn=2025&xq=spring`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    code: "OK",
    data: {
      ...fixtures.semester,
      xn: 2025,
      xq: "spring",
      start: "2026-02-22",
    },
  });
});

test("validates every ranking filter", async () => {
  const validResponse = await fetch(
    `${baseUrl}/rank?xn=2025&xq=summer&range=minor&data_source=execution&display=initial`,
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

  const winterResponse = await fetch(
    `${baseUrl}/rank?xn=2025&xq=winter&range=major&data_source=total&display=max`,
    { headers: authHeaders },
  );
  assert.equal(winterResponse.status, 400);
  assert.deepEqual(await winterResponse.json(), { code: "INVALID_REQUEST" });
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
  const validResponse = await fetch(`${baseUrl}/grade?xn=2025&xq=winter`, {
    headers: authHeaders,
  });
  assert.equal(validResponse.status, 200);
  assert.deepEqual(await validResponse.json(), { code: "OK", data: fixtures.grades });

  const invalidResponse = await fetch(`${baseUrl}/grade?xn=2025&xq=invalid`, {
    headers: authHeaders,
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), { code: "INVALID_REQUEST" });
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
    xq: "autumn",
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

test("provides full-week course fixtures with contiguous time-state scenarios", async () => {
  const response = await fetch(`${baseUrl}/classtable?xn=2026&xq=autumn`, { headers: authHeaders });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.ok(payload.data.length >= 20);
  assert.deepEqual(
    [...new Set(payload.data.map((course) => course.day))].sort((left, right) => left - right),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.ok(payload.data.every((course) => course.day >= 0 && course.day <= 6));
  assert.ok(payload.data.every((course) => course.time >= 1 && course.time <= 12));
  assert.deepEqual(
    payload.data.filter((course) => course.course_id === "COMP3022").map((course) => course.time),
    [11, 12],
  );
  assert.deepEqual(
    payload.data.find((course) => course.course_id === "COMP3013").weeks,
    [1, 3, 5, 7, 9, 11, 13, 15],
  );

  const wednesdayPeriods = payload.data
    .filter((course) => course.day === 3)
    .map((course) => course.time)
    .sort((left, right) => left - right);
  assert.deepEqual(wednesdayPeriods, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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

test("returns the complete Apifox gym grade shape", async () => {
  const response = await fetch(`${baseUrl}/gym/grade?xn=2025`, { headers: authHeaders });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.code, "OK");
  assert.deepEqual(
    Object.keys(payload.data).sort(),
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
  assert.equal(payload.data.eye.sight.left.description, "正常");
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
