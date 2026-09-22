import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "张同学，今天好" })).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
  const main = await page.locator("#main-content").boundingBox();
  const nav = await page.getByRole("navigation", { name: "主导航" }).boundingBox();
  expect(main && nav ? main.y + main.height : 0).toBeLessThanOrEqual(nav?.y || 0);
}

test("anonymous shell remains useful and routes protected services to login", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "微生活" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  const campusImage = page.getByRole("img", { name: "清晨的湖南大学校园" });
  await expect.poll(() => campusImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await campusImage.evaluate((image: HTMLImageElement) => image.decode());
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-guest.png`, fullPage: true });
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "服务", exact: true }).click();
  await expect(page.getByRole("heading", { name: "服务" })).toBeVisible();
  await page.getByRole("link", { name: /成绩与排名/ }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "登录校园账号" })).toBeVisible();
});

test("auth prompt returns to the originating page after login", async ({ page }) => {
  await page.goto("/schedule");
  await page.getByRole("link", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fschedule$/);
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "课表", exact: true })).toBeVisible();
});

test("login opens a populated schedule and service pages", async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "课表", exact: true }).click();
  await expect(page.getByRole("heading", { name: "课表", exact: true })).toBeFocused();
  await expect(page).toHaveTitle("课表 - 微生活");
  await page.locator(".day-button").nth(1).click();
  await expect(page.getByText("计算机网络", { exact: true })).toBeVisible();
  await expect(page.getByText("软件工程", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-schedule.png`, fullPage: true });

  const services = [
    ["/services/card", "校园卡"],
    ["/services/grades", "成绩与排名"],
    ["/services/points", "积分中心"],
    ["/services/dorm", "宿舍与电量"],
    ["/services/network", "校园网"],
    ["/services/exams", "考试安排"],
    ["/services/gym", "体测"],
    ["/services/lab", "大物实验"],
    ["/services/rooms", "空教室"],
    ["/services/announcements", "校园公告"],
  ] as const;

  for (const [url, title] of services) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "服务", exact: true })).toBeVisible();
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-services.png`, fullPage: true });
});

test("grades remain usable while trusted ranking is being generated", async ({ page }) => {
  await login(page);
  await page.route("**/api/rank/ca", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", data: null }),
    });
  });
  await page.goto("/services/grades?source=ca");
  await expect(page.getByRole("heading", { name: "排名生成中" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "课程成绩" })).toBeVisible();
  await expect(page.getByText("数据结构", { exact: true })).toBeVisible();
});

test("room search reports invalid fields inline", async ({ page }) => {
  await login(page);
  await page.goto("/services/rooms");
  await page.getByLabel("教学楼编号").fill("   ");
  await page.getByLabel("节次").fill("not-a-period");
  await page.getByRole("button", { name: "查询空教室" }).click();
  await expect(page.getByText("请输入教学楼编号。")).toBeVisible();
  await expect(page.getByText("请用逗号分隔有效节次，例如 1,2。")).toBeVisible();
  await expect(page.getByLabel("教学楼编号")).toBeFocused();
});

test("confirmation dialog presents balanced primary and secondary actions", async ({ page }) => {
  await login(page);
  await page.goto("/me");
  await page.getByRole("button", { name: "解除绑定并退出" }).click();
  const dialog = page.getByRole("dialog", { name: "解除账号绑定？" });
  const cancel = dialog.getByRole("button", { name: "取消" });
  const confirm = dialog.getByRole("button", { name: "解除绑定" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleDescription("本机登录信息会被清除，下次查看个人数据需要重新登录。");
  await expect(cancel).toBeFocused();
  await expect(dialog.getByRole("button", { name: "关闭" })).toHaveCount(0);
  await page.keyboard.press("Shift+Tab");
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  const [cancelBox, confirmBox] = await Promise.all([cancel.boundingBox(), confirm.boundingBox()]);
  expect(Math.abs((cancelBox?.width || 0) - (confirmBox?.width || 0))).toBeLessThan(1);
  expect(cancelBox?.height).toBeGreaterThanOrEqual(52);
  await cancel.click();
  await expect(dialog).toBeHidden();
});

test("pending destructive confirmation cannot be dismissed", async ({ page }) => {
  await login(page);
  let releaseRequest: (() => void) | undefined;
  await page.route("**/api/auth/unbind", async (route) => {
    await new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", data: null }),
    });
  });
  await page.goto("/me");
  await page.getByRole("button", { name: "解除绑定并退出" }).click();
  const dialog = page.getByRole("dialog", { name: "解除账号绑定？" });
  await dialog.getByRole("button", { name: "解除绑定" }).click();
  await expect.poll(() => Boolean(releaseRequest)).toBe(true);
  await expect(dialog.getByRole("button", { name: "取消" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  releaseRequest?.();
  await expect(dialog).toBeHidden();
});

test("course editor is modal and restores focus when closed", async ({ page }) => {
  await login(page);
  await page.goto("/schedule");
  const addButton = page.getByRole("button", { name: "添加自定义课程" });
  await addButton.click();
  await expect(page.getByRole("dialog", { name: "添加自定义课程" })).toBeVisible();
  await expect(page.getByRole("button", { name: "关闭" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(addButton).toBeFocused();
});

test("schedule exposes loading and recoverable error states", async ({ page }) => {
  await login(page);
  await page.route("**/api/classtable*", async (route) => {
    await route.continue({ headers: { ...route.request().headers(), "X-Mock-Status": "503" } });
  });
  await page.goto("/schedule");
  await expect(page.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
});
