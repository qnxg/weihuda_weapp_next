import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createMockServer, resolveDelay, routes } from "../src/server.js";

let server;
let baseUrl;
const authHeaders = { Authorization: "Bearer mock-access-token" };

before(async () => {
  server = createMockServer({ minDelayMs: 0, maxDelayMs: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("registers every Apifox endpoint", () => {
  assert.equal(routes.length, 57);
  assert.equal(new Set(routes.map(({ method, path }) => `${method} ${path}`)).size, 57);
});

test("applies 500ms to 1000ms jitter with an explicit override", () => {
  assert.equal(resolveDelay({}, () => 0), 500);
  assert.equal(resolveDelay({}, () => 0.999999), 1000);
  assert.equal(resolveDelay({ "x-mock-delay": "750" }), 750);
  assert.equal(resolveDelay({ "x-mock-delay": "0" }), 0);
});

test("returns documented hello response", async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: "OK", data: { hello: "world" } });
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
    payload.data
      .filter((course) => course.course_id === "COMP3022")
      .map((course) => course.time),
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
  assert.equal((await fetch(`${baseUrl}/exam`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(exam),
  })).status, 200);

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
  const response = await fetch(`${baseUrl}/me`, { headers: { ...authHeaders, "X-Mock-Status": "503" } });
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
  const exchange = await fetch(`${baseUrl}/jifen/goods/1`, { method: "POST", headers: authHeaders });
  assert.equal(exchange.status, 200);
  const after = (await (await fetch(`${baseUrl}/jifen`, { headers: authHeaders })).json()).data;
  const exchanged = (await (await fetch(`${baseUrl}/jifen/goods/exchanged`, { headers: authHeaders })).json()).data;
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
  const feedback = (await (await fetch(`${baseUrl}/feedback`, { headers: authHeaders })).json()).data;
  assert.ok(feedback.items.some((item) => item.description === "匿名反馈测试"));
});

test("protects authenticated endpoints", async () => {
  const response = await fetch(`${baseUrl}/me`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { code: "AUTH_TOKEN_INVALID" });
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
  const consumption = await fetch(`${baseUrl}/card/record?year=2026&month=9&type=consumption`, { headers: authHeaders });
  const recharge = await fetch(`${baseUrl}/card/record?year=2026&month=9&type=recharge`, { headers: authHeaders });
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
