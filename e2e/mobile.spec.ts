import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const dateHeading = page.getByRole("heading", {
    name: /^\d{1,2} 月 \d{1,2} 日 星期[一二三四五六日]$/,
  });
  const notice = page.getByRole("link", { name: /\d+ 条未读通知/ });
  await expect(dateHeading).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveText(/2026 秋季学期 · 第 \d+ 周/);
  await expect(page.locator(".page-header p strong")).toHaveText(/第 \d+ 周/);
  const header = page.locator(".page-header");
  await expect(header).toHaveCSS("position", "sticky");
  await expect(header).toHaveCSS("background-color", "rgb(247, 248, 250)");
  expect(await header.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  const [headingBox, noticeBox] = await Promise.all([
    dateHeading.boundingBox(),
    notice.boundingBox(),
  ]);
  expect(noticeBox?.x).toBeLessThan(headingBox?.x || 0);
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

test("anonymous shell remains useful and routes protected services to login", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "9 月 23 日 星期三", exact: true })).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveText("2026 秋季学期 · 第 2 周");
  await expect(page.locator(".page-header p strong")).toHaveText("第 2 周");
  await expect(page.getByRole("link", { name: "登录后查看通知" })).toHaveAttribute(
    "href",
    "/notices",
  );
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  const todayTab = page.getByRole("tab", { name: "今日课程" });
  const tomorrowTab = page.getByRole("tab", { name: "明日课程" });
  await expect(todayTab).toHaveAttribute("aria-selected", "true");
  await tomorrowTab.click();
  await expect(tomorrowTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "登录后查看明日课程" })).toBeVisible();
  await todayTab.click();
  await expect(todayTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "倒计时", exact: true })).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "距离中秋节还有 2 天，9 月 25 日至 27 日，共 3 天",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "校园网", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录后查看校园网" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "校园速览", exact: true })).toBeVisible();
  await expect(page.locator(".auth-prompt")).toHaveCount(4);
  await expect(page.getByRole("link", { name: "去登录", exact: true })).toHaveCount(4);
  const promptVisual = await page
    .locator(".auth-prompt")
    .first()
    .evaluate((prompt) => ({
      background: getComputedStyle(prompt).backgroundColor,
      shadow: getComputedStyle(prompt).boxShadow,
    }));
  expect(promptVisual).toEqual({ background: "rgba(0, 0, 0, 0)", shadow: "none" });
  const loginLink = page.getByRole("link", { name: "去登录", exact: true }).first();
  await expect(loginLink).toHaveCSS("color", "rgb(193, 52, 50)");
  await expect(loginLink).toHaveCSS("text-decoration-line", "underline");
  expect((await loginLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(apiRequests.toSorted()).toEqual(["/api/countdown", "/api/semester"]);

  await page.screenshot({ path: `artifacts/${testInfo.project.name}-guest.png`, fullPage: true });
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "服务", exact: true }).click();
  await expect(page.getByRole("heading", { name: "服务" })).toBeVisible();
  await expect(page.locator('.services-page [aria-label="需要登录"]')).toHaveCount(0);
  const serviceIconColors = await page
    .locator(".service-item__icon")
    .evaluateAll((icons) => [...new Set(icons.map((icon) => getComputedStyle(icon).color))]);
  expect(serviceIconColors).toEqual(["rgb(151, 40, 38)"]);
  await expect(page.getByRole("link", { name: /课程成绩/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /成绩排名/ })).toBeVisible();
  await page.getByRole("link", { name: /课程成绩/ }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "登录校园账号" })).toBeVisible();
});

test("anonymous homepage keeps its gates when the public countdown fails", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  let shouldFail = true;
  await page.route("**/api/countdown", async (route) => {
    const headers = { ...route.request().headers() };
    if (shouldFail) headers["X-Mock-Status"] = "503";
    await route.continue({ headers });
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(page.locator(".page-header p")).toHaveText("2026 秋季学期 · 第 2 周");
  await expect(page.getByRole("heading", { name: "登录后查看今日课程" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录后查看近期事项" })).toBeVisible();

  shouldFail = false;
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
});

test("logged-in homepage keeps independent content when countdown fails", async ({ page }) => {
  let shouldFail = true;
  await page.route("**/api/countdown", async (route) => {
    const headers = { ...route.request().headers() };
    if (shouldFail) headers["X-Mock-Status"] = "503";
    await route.continue({ headers });
  });

  await login(page);
  const countdownSection = page
    .getByRole("heading", { name: "倒计时", exact: true })
    .locator("xpath=ancestor::section");
  await expect(countdownSection.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(page.getByRole("tab", { name: "今日课程" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "校园网", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();

  shouldFail = false;
  await countdownSection.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
});

test("anonymous header retries public semester loading", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  let shouldFail = true;
  await page.route("**/api/semester", async (route) => {
    const headers = { ...route.request().headers() };
    if (shouldFail) headers["X-Mock-Status"] = "503";
    await route.continue({ headers });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /^\d{1,2} 月 \d{1,2} 日 星期/ })).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "登录后查看今日课程" })).toBeVisible();

  const retrySemester = page.getByRole("button", { name: "重新加载学期信息" });
  await expect(retrySemester).toBeVisible();
  shouldFail = false;
  await retrySemester.click();
  await expect(page.locator(".page-header p")).toHaveText("2026 秋季学期 · 第 2 周");
});

test("homepage keeps a network failure local and supports retry", async ({ page }) => {
  let shouldFail = true;
  await page.route("**/api/netflow", async (route) => {
    const headers = { ...route.request().headers() };
    if (shouldFail) {
      headers["X-Mock-Status"] = "503";
      await route.continue({ headers });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          overdue_payment: 123456.78,
          total: "50GB",
          upload: "10GB",
          download: "40GB",
          base_amount: "40GB",
          base_usage: 40,
          base_percentage: 1,
          extend_usage: 10,
          is_locked: true,
        },
      }),
    });
  });

  await login(page);
  const networkSection = page
    .getByRole("heading", { name: "校园网", exact: true })
    .locator("xpath=ancestor::section");
  await expect(networkSection.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();

  shouldFail = false;
  await networkSection.getByRole("button", { name: "重新加载" }).click();
  await expect(
    networkSection.getByRole("link", {
      name: "校园网本月已用 50GB，超额流量 10 GB，账号已锁定，欠费 ¥123,456.78",
    }),
  ).toBeVisible();
  await expect(networkSection.getByText("超额 10 GB")).toBeVisible();
  await expect(networkSection.getByText("已锁定")).toBeVisible();
  await expect(networkSection.getByText("¥123,456.78")).toBeVisible();
  await expect(networkSection.getByRole("progressbar")).toHaveCSS(
    "--network-progress-color",
    "#c13432",
  );
  await expectNoHorizontalOverflow(page);
});

test("network detail failure does not hide usage or billing data", async ({ page }) => {
  await page.route("**/api/netflow/detail**", async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), "X-Mock-Status": "503" },
    });
  });

  await login(page);
  await page.goto("/services/network");

  const detailSection = page
    .getByRole("heading", { name: "应用明细", exact: true })
    .locator("xpath=ancestor::section");
  const billingSection = page
    .getByRole("heading", { name: "历史账单", exact: true })
    .locator("xpath=ancestor::section");
  await expect(detailSection.getByRole("alert")).toContainText("服务暂时不可用");
  await expect(page.getByRole("heading", { name: "本月用量", exact: true })).toBeVisible();
  await expect(page.getByText("已使用", { exact: true })).toBeVisible();
  await expect(billingSection.locator(".record-item").first()).toBeVisible();
});

test("auth prompt returns to the originating page after login", async ({ page }) => {
  await page.goto("/schedule");
  await page.getByRole("link", { name: "去登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fschedule$/);
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { name: "课表", exact: true })).toBeVisible();
});

test("login opens a populated schedule and service pages", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  await login(page);
  await page.getByRole("link", { name: "课表", exact: true }).click();
  await expect(page.getByRole("heading", { name: "课表", exact: true })).toBeFocused();
  await expect(page).toHaveTitle("课表 - 微生活");
  await expect(page.locator(".schedule-header-term")).toHaveText("2026-2027 学年 秋季学期");
  await expect(page.locator(".schedule-header-week")).toHaveAttribute("aria-hidden", "true");
  const headerLayout = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(".schedule-page h1")!.getBoundingClientRect();
    const actions = [
      ...document.querySelectorAll<HTMLElement>(".schedule-header-actions .icon-button"),
    ].map((button) => button.getBoundingClientRect());
    return {
      titleLeft: title.left,
      actionRights: actions.map((button) => button.right),
    };
  });
  expect(headerLayout.actionRights).toHaveLength(2);
  expect(headerLayout.actionRights.every((right) => right <= headerLayout.titleLeft)).toBe(true);
  const semesterTrigger = page.getByRole("button", {
    name: "切换学期，当前为2026-2027 秋季学期",
  });
  await expect(semesterTrigger.locator("svg")).toHaveClass(/lucide-calendar-sync/);
  await expect(page.getByRole("heading", { name: /第 \d+ 周课程表/ })).toBeVisible();
  const weekHeading = page.locator(".schedule-week-heading");
  await expect(weekHeading.getByRole("heading", { name: "第 2 周", exact: true })).toBeVisible();
  await expect(weekHeading.getByText("共 16 周", { exact: true })).toBeVisible();
  const weekHeadingLayout = await weekHeading.evaluate((element) => {
    const header = document.querySelector<HTMLElement>(".page-header")!.getBoundingClientRect();
    const weekdays = document
      .querySelector<HTMLElement>(".schedule-weekdays")!
      .getBoundingClientRect();
    const container = element.getBoundingClientRect();
    const title = element.querySelector("h2")!.getBoundingClientRect();
    const buttons = [...element.querySelectorAll("button")].map((button) =>
      button.getBoundingClientRect(),
    );
    return {
      titleRight: title.right,
      buttonLefts: buttons.map((button) => button.left),
      topGap: container.top - header.bottom,
      bottomGap: weekdays.top - container.bottom,
    };
  });
  expect(weekHeadingLayout.buttonLefts.every((left) => left >= weekHeadingLayout.titleRight)).toBe(
    true,
  );
  expect(weekHeadingLayout.topGap).toBeGreaterThanOrEqual(7);
  expect(weekHeadingLayout.topGap).toBeLessThanOrEqual(9);
  expect(weekHeadingLayout.bottomGap).toBeGreaterThanOrEqual(7);
  expect(weekHeadingLayout.bottomGap).toBeLessThanOrEqual(9);
  await expect(page.locator(".schedule-grid__period")).toHaveCount(12);
  await expect(page.locator(".schedule-grid__day.is-today")).toContainText("三");
  const networkCourse = page.getByRole("button", { name: /计算机网络，周二/ });
  await expect(networkCourse).toBeVisible();
  expect((await networkCourse.boundingBox())?.width).toBeGreaterThanOrEqual(44);
  const scheduleVisual = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".schedule-page .page-header")!;
    const weekdays = document.querySelector<HTMLElement>(".schedule-weekdays")!;
    const day = document.querySelector<HTMLElement>(".schedule-grid__day:not(.is-today)")!;
    const todayDay = document.querySelector<HTMLElement>(".schedule-grid__day.is-today")!;
    const period = document.querySelector<HTMLElement>(".schedule-grid__period")!;
    const slot = document.querySelector<HTMLElement>(".schedule-grid__slot")!;
    const course = document.querySelector<HTMLElement>(".schedule-course")!;
    return {
      headerShadow: getComputedStyle(header).boxShadow,
      weekdaysBorder: getComputedStyle(weekdays).borderBottomWidth,
      dayBorder: getComputedStyle(day).borderBottomWidth,
      periodBorder: getComputedStyle(period).borderBottomWidth,
      slotBackground: getComputedStyle(slot).backgroundColor,
      slotHeight: slot.getBoundingClientRect().height,
      todayIndicatorColor: getComputedStyle(todayDay, "::after").backgroundColor,
      todayIndicatorHeight: getComputedStyle(todayDay, "::after").height,
      courseShadow: getComputedStyle(course).boxShadow,
    };
  });
  expect(scheduleVisual.headerShadow).not.toBe("none");
  expect(scheduleVisual.weekdaysBorder).toBe("1px");
  expect(scheduleVisual.dayBorder).toBe("0px");
  expect(scheduleVisual.periodBorder).toBe("0px");
  expect(scheduleVisual.slotBackground).toBe("rgb(255, 255, 255)");
  expect(scheduleVisual.slotHeight).toBeCloseTo(74, 2);
  expect(scheduleVisual.todayIndicatorColor).toBe("rgb(193, 52, 50)");
  expect(scheduleVisual.todayIndicatorHeight).toBe("3px");
  expect(scheduleVisual.courseShadow).not.toBe("none");
  await page.getByRole("button", { name: "下一周" }).click();
  await expect(page.locator(".schedule-grid__day.is-today")).toHaveCount(0);
  await page.getByRole("button", { name: "上一周" }).click();
  await expect(page.locator(".schedule-grid__day.is-today")).toHaveCount(1);
  await page.locator("#main-content").evaluate((main) => {
    const header = main.querySelector<HTMLElement>(".page-header")!;
    const weekdays = main.querySelector<HTMLElement>(".schedule-weekdays")!;
    main.scrollTop +=
      weekdays.getBoundingClientRect().top - header.getBoundingClientRect().bottom + 2;
  });
  await expect(page.locator(".schedule-page")).toHaveClass(/is-weekdays-pinned/);
  await expect(page.locator(".schedule-header-week")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator(".schedule-header-week")).toHaveClass(/is-visible/);
  await expect(page.locator(".page-header")).toHaveCSS("box-shadow", "none");
  await expect
    .poll(() =>
      page
        .locator(".schedule-weekdays")
        .evaluate((weekdays) => getComputedStyle(weekdays).boxShadow),
    )
    .not.toBe("none");
  await expect(page.locator(".schedule-header-week")).toHaveCSS("opacity", "1");
  const pinnedLayout = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".page-header")!;
    const weekdays = document.querySelector<HTMLElement>(".schedule-weekdays")!;
    const headerBox = header.getBoundingClientRect();
    const weekdaysBox = weekdays.getBoundingClientRect();
    return { gap: weekdaysBox.top - headerBox.bottom };
  });
  expect(pinnedLayout.gap).toBeLessThanOrEqual(0);
  expect(pinnedLayout.gap).toBeGreaterThanOrEqual(-1.5);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-pinned.png`,
    fullPage: false,
  });
  await page.locator("#main-content").evaluate((main) => {
    main.scrollTop = 0;
  });
  await expect(page.locator(".schedule-page")).not.toHaveClass(/is-weekdays-pinned/);
  await expect(page.locator(".schedule-header-week")).toHaveAttribute("aria-hidden", "true");
  await expect
    .poll(() =>
      page.locator(".page-header").evaluate((header) => getComputedStyle(header).boxShadow),
    )
    .not.toBe("none");
  await networkCourse.click();
  const courseDetails = page.getByRole("dialog", { name: "计算机网络" });
  await expect(courseDetails).toContainText("信科楼 201");
  await expect(courseDetails).toContainText("陈老师");
  await courseDetails.getByRole("button", { name: "关闭" }).click();
  await semesterTrigger.click();
  const semesterDialog = page.getByRole("dialog", { name: "选择学期" });
  const currentSemesterOption = semesterDialog.getByRole("button", {
    name: "2026-2027 秋季学期，当前学期",
  });
  await expect(currentSemesterOption).toHaveAttribute("aria-pressed", "true");
  await expect(currentSemesterOption).toContainText("2026-2027 秋季学期");
  await expect(currentSemesterOption).toContainText("2026年9月13日 - 2027年1月2日");
  await expect(currentSemesterOption).not.toContainText("已选");
  await expect(currentSemesterOption.locator("svg")).toHaveCount(0);
  await expect(semesterDialog.getByRole("button", { name: "关闭" })).toBeFocused();
  await expect(semesterDialog.locator(".modal__body")).toHaveCSS("overflow-y", "auto");
  const modalHeight = await semesterDialog.evaluate((dialog) => ({
    height: dialog.getBoundingClientRect().height,
    viewportHeight: window.innerHeight,
  }));
  expect(modalHeight.height).toBeLessThanOrEqual(modalHeight.viewportHeight * 0.88 + 1);
  await expect(semesterDialog).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-semester-picker.png`,
    fullPage: false,
  });
  await page.mouse.click(5, 5);
  await expect(semesterDialog).toBeHidden();
  await expect(semesterTrigger).toBeFocused();
  await semesterTrigger.click();
  await page
    .getByRole("dialog", { name: "选择学期" })
    .getByRole("button", { name: "2025-2026 春季学期" })
    .click();
  await expect(page).toHaveURL(/\/schedule\?xn=2025&xq=spring$/);
  await expect(page.locator(".schedule-header-term")).toHaveText("2025-2026 学年 春季学期");
  await expect(page.getByText("第 1 周", { exact: true })).toBeVisible();
  await expect(page.locator(".schedule-grid__day.is-today")).toHaveCount(0);
  await page.getByRole("button", { name: "切换学期，当前为2025-2026 春季学期" }).click();
  await page
    .getByRole("dialog", { name: "选择学期" })
    .getByRole("button", { name: "2026-2027 秋季学期，当前学期" })
    .click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByText("计算机网络", { exact: true })).toBeVisible();
  await expect(page.getByText("软件工程", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule.png`,
    fullPage: true,
  });

  const services = [
    ["/services/card", "校园卡"],
    ["/services/grades", "课程成绩"],
    ["/services/rank", "成绩排名"],
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
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-services.png`,
    fullPage: true,
  });
});

test("schedule disables week navigation at semester boundaries", async ({ page }) => {
  await login(page);

  await page.goto("/schedule?week=1");
  const previousWeek = page.getByRole("button", { name: "上一周" });
  await expect(previousWeek).toBeDisabled();
  await expect(previousWeek).toHaveCSS("opacity", "0.35");
  await expect(page.getByRole("button", { name: "下一周" })).toBeEnabled();

  await page.goto("/schedule?week=16");
  const nextWeek = page.getByRole("button", { name: "下一周" });
  await expect(nextWeek).toBeDisabled();
  await expect(nextWeek).toHaveCSS("opacity", "0.35");
  await expect(page.getByRole("button", { name: "上一周" })).toBeEnabled();
});

test("today courses switch days and expose time-based card states", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  await login(page);

  const todayTab = page.getByRole("tab", { name: "今日课程" });
  const tomorrowTab = page.getByRole("tab", { name: "明日课程" });
  await expect(todayTab).toHaveAttribute("aria-selected", "true");
  const headerToTabsGap = await page.evaluate(() => {
    const header = document.querySelector(".page-header")!.getBoundingClientRect();
    const tabs = document.querySelector(".course-day-tabs")!.getBoundingClientRect();
    return tabs.top - header.bottom;
  });
  expect(headerToTabsGap).toBeGreaterThanOrEqual(7);
  expect(headerToTabsGap).toBeLessThanOrEqual(9);
  await expect(page.getByRole("article", { name: "算法设计与分析，已结束" })).toHaveClass(
    /course-card--completed/,
  );
  await expect(page.getByRole("article", { name: "操作系统，即将开始" })).toHaveClass(
    /course-card--warning/,
  );
  await expect(page.getByRole("article", { name: "移动应用开发实践，未开始" })).toHaveClass(
    /course-card--upcoming/,
  );
  await expect(page.getByText("编译原理", { exact: true })).toHaveCount(0);
  const warningStatus = page.getByText("即将开始", { exact: true });
  await expect(warningStatus).toBeVisible();
  await expect(page.getByText(/^(已结束|上课中|未开始)$/)).toHaveCount(0);
  await expect(page.getByText("完整课表")).toHaveCount(0);
  await expect(page.locator(".today-courses .timeline")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "倒计时", exact: true })).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "距离中秋节还有 2 天，9 月 25 日至 27 日，共 3 天",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", {
      name: "距离2026 秋季学期结束还有 102 天，1 月 3 日结束，共 16 周",
    }),
  ).toBeVisible();
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
  const networkOverview = page.getByRole("link", {
    name: "校园网本月已用 12.80GB，账号正常，无欠费",
  });
  await expect(networkOverview).toBeVisible();
  await expect(networkOverview.getByRole("progressbar")).toHaveAttribute("value", "0.32");
  await expect(networkOverview.getByText("免费流量").locator("..")).toContainText("40GB");
  await expect(networkOverview.getByText("账号状态").locator("..")).toContainText("正常");
  await expect(networkOverview.getByText("欠费", { exact: true }).locator("..")).toContainText(
    "无欠费",
  );
  const statusColumns = await networkOverview.locator(".network-overview__status > div").all();
  await expect(statusColumns[0]).toBeVisible();
  expect((await statusColumns[0].boundingBox())?.width).toBeGreaterThanOrEqual(80);

  const [panelBox, cardBox] = await Promise.all([
    page.locator(".course-day-panel").boundingBox(),
    page.locator(".course-card").first().boundingBox(),
  ]);
  expect(Math.abs((panelBox?.x || 0) - (cardBox?.x || 0))).toBeLessThan(1);
  expect(Math.abs((panelBox?.width || 0) - (cardBox?.width || 0))).toBeLessThan(1);
  expect(cardBox?.height).toBeLessThan(80);

  const listVisual = await page.locator(".course-card-list").evaluate((list) => {
    const style = getComputedStyle(list);
    return {
      itemCount: list.children.length,
      overflow: style.overflow,
      radius: style.borderRadius,
      shadow: style.boxShadow,
    };
  });
  expect(listVisual.itemCount).toBe(4);
  expect(listVisual.overflow).toBe("hidden");
  expect(listVisual.radius).toBe("6px");
  expect(listVisual.shadow).not.toBe("none");

  const visualStates = await page.locator(".course-card").evaluateAll((cards) =>
    Object.fromEntries(
      cards.map((card) => {
        const status = [...card.classList]
          .find((name) => name.startsWith("course-card--"))
          ?.replace("course-card--", "");
        const style = getComputedStyle(card);
        const stripe = card.querySelector<HTMLElement>(".course-card__stripe")!;
        const content = card.querySelector<HTMLElement>(".course-card__content")!;
        const firstTime = card.querySelector<HTMLElement>(".course-card__time")!;
        const stripeBox = stripe.getBoundingClientRect();
        return [
          status,
          {
            background: style.backgroundColor,
            borderLeftWidth: style.borderLeftWidth,
            borderTopWidth: style.borderTopWidth,
            contentBorderTopWidth: getComputedStyle(content).borderTopWidth,
            contentInset: firstTime.getBoundingClientRect().left - stripeBox.right,
            shadow: style.boxShadow,
            stripeColor: getComputedStyle(stripe).backgroundColor,
            stripeWidth: stripeBox.width,
            titleWeight: getComputedStyle(card.querySelector("h3")!).fontWeight,
          },
        ];
      }),
    ),
  );
  expect(visualStates.completed.shadow).toBe("none");
  expect(visualStates.completed.stripeWidth).toBe(6);
  expect(visualStates.completed.stripeColor).toBe("rgb(232, 234, 238)");
  expect(visualStates.upcoming.background).toBe("rgb(255, 255, 255)");
  expect(visualStates.upcoming.borderLeftWidth).toBe("0px");
  expect(visualStates.upcoming.contentInset).toBeGreaterThanOrEqual(12);
  expect(visualStates.upcoming.shadow).toBe("none");
  expect(visualStates.upcoming.stripeWidth).toBe(6);
  expect(visualStates.upcoming.stripeColor).toBe("rgb(207, 211, 218)");
  expect(visualStates.upcoming.titleWeight).toBe("400");
  expect(visualStates.warning.background).not.toBe(visualStates.upcoming.background);
  expect(visualStates.warning.borderTopWidth).toBe("0px");
  expect(visualStates.warning.contentBorderTopWidth).toBe("1px");
  expect(visualStates.warning.stripeWidth).toBe(6);

  await page.clock.setFixedTime(new Date("2026-09-23T14:40:00"));
  await page.reload();
  const activeCard = page.getByRole("article", { name: "操作系统，上课中" });
  await expect(activeCard).toHaveClass(/course-card--active/);
  await expect(page.getByText("上课中", { exact: true })).toBeVisible();
  await expect(page.getByText("即将开始", { exact: true })).toHaveCount(0);
  const activeVisual = await activeCard.evaluate((card) => ({
    background: getComputedStyle(card).backgroundColor,
    stripeColor: getComputedStyle(card.querySelector<HTMLElement>(".course-card__stripe")!)
      .backgroundColor,
    stripeWidth: card.querySelector<HTMLElement>(".course-card__stripe")!.getBoundingClientRect()
      .width,
  }));
  expect(activeVisual.background).toBe("rgb(234, 244, 239)");
  expect(activeVisual.stripeColor).toBe("rgb(54, 115, 86)");
  expect(activeVisual.stripeWidth).toBe(6);

  await tomorrowTab.click();
  await expect(tomorrowTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("数据库系统", { exact: true })).toBeVisible();
  await expect(page.getByText("计算机组成原理", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-today-courses.png`,
    fullPage: true,
  });
});

test("today courses default to tomorrow after the last class", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T22:00:00"));
  await login(page);
  await expect(page.getByRole("tab", { name: "明日课程" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("数据库系统", { exact: true })).toBeVisible();
});

test("course grades use the shared semester picker", async ({ page }) => {
  await login(page);
  await page.goto("/services/grades");

  await expect(page.locator(".page-header p")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "2026-2027 学年 秋季学期" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "学年" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "学期" })).toHaveCount(0);
  await expect(page.locator(".grade-list .grade-row")).toHaveCount(2);
  await expect(page.locator(".grade-list .grade-row").nth(1)).toHaveCSS("border-top-width", "1px");

  await page.getByRole("button", { name: "切换学期，当前为2026-2027 秋季学期" }).click();
  const semesterDialog = page.getByRole("dialog", { name: "选择学期" });
  await expect(
    semesterDialog.getByRole("button", {
      name: "2026-2027 秋季学期，当前学期",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(semesterDialog.locator(".modal__body")).toHaveCSS("overflow-y", "auto");
  const gradeRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/grade" &&
      url.searchParams.get("xn") === "2025" &&
      url.searchParams.get("xq") === "summer"
    );
  });
  await semesterDialog.getByRole("button", { name: "2025-2026 夏季学期" }).click();
  await gradeRequest;
  await expect(page).toHaveURL(/\/services\/grades\?xn=2025&xq=summer$/);
  await expect(page.getByRole("heading", { name: "2025-2026 学年 夏季学期" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("school ranking exposes its complete filters", async ({ page }) => {
  await login(page);
  await page.goto("/services/rank");
  await page.getByRole("combobox", { name: "学年" }).selectOption("2025");
  await page.getByRole("combobox", { name: "学期" }).selectOption("spring");
  await page.getByRole("combobox", { name: "课程范围" }).selectOption("minor");
  await page.getByRole("combobox", { name: "数据来源" }).selectOption("execution");
  await page.getByRole("combobox", { name: "成绩取值" }).selectOption("initial");
  const rankRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/rank" &&
      url.searchParams.get("xn") === "2025" &&
      url.searchParams.get("xq") === "spring" &&
      url.searchParams.get("range") === "minor" &&
      url.searchParams.get("data_source") === "execution" &&
      url.searchParams.get("display") === "initial"
    );
  });
  await page.getByRole("button", { name: "查询排名" }).click();
  await rankRequest;
  await expect(page.getByText(/2025-2026 学年 · 春季学期 · 辅修/)).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const allYearsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/rank" && !url.searchParams.has("xn");
  });
  await page.getByRole("combobox", { name: "学年" }).selectOption("all");
  await expect(page.getByRole("combobox", { name: "学期" })).toBeDisabled();
  await page.getByRole("button", { name: "查询排名" }).click();
  await allYearsRequest;
});

test("ranking results adapt to every data availability state", async ({ page }, testInfo) => {
  let showEmptyGroups = false;
  await page.route("**/api/rank?*", async (route) => {
    const both = {
      arithmetic: "88.20",
      arithmetic_rank: "8/120",
      weighted: "89.10",
      weighted_rank: "6/120",
      gpa: "3.8",
      gpa_rank: "5/120",
    };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: showEmptyGroups
          ? { all: null, compulsory: null, core: null }
          : {
              all: both,
              compulsory: {
                ...both,
                arithmetic_rank: null,
                weighted_rank: null,
                gpa_rank: null,
              },
              core: {
                ...both,
                arithmetic: null,
                weighted: null,
                gpa: null,
              },
            },
      }),
    });
  });

  await login(page);
  await page.goto("/services/rank?xn=2026&xq=autumn");

  const allCourses = page.getByRole("table", { name: "全部课程成绩与排名" });
  const compulsory = page.getByRole("table", { name: "必修课程成绩" });
  const core = page.getByRole("table", { name: "核心课程排名" });
  await expect(allCourses.locator("tbody tr")).toHaveCount(2);
  await expect(compulsory.locator("tbody tr")).toHaveCount(1);
  await expect(compulsory.getByRole("rowheader", { name: "成绩" })).toBeVisible();
  await expect(core.locator("tbody tr")).toHaveCount(1);
  await expect(core.getByRole("rowheader", { name: "排名" })).toBeVisible();
  await expect(page.getByText("—")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability.png`,
    fullPage: true,
  });
  await core.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability-lower.png`,
    fullPage: false,
  });

  showEmptyGroups = true;
  await page.getByRole("button", { name: "查询排名" }).click();
  await expect(page.getByText("暂无成绩与排名数据")).toHaveCount(3);
  await expect(page.getByRole("table")).toHaveCount(0);
  await page.locator(".rank-group").last().scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability-empty.png`,
    fullPage: false,
  });
});

test("trusted ranking has an independent empty state", async ({ page }) => {
  await login(page);
  await page.route("**/api/rank/ca", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", data: null }),
    });
  });
  await page.goto("/services/rank?source=ca");
  await expect(page.getByRole("heading", { name: "排名生成中" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "成绩排名" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "可信凭证排名" })).toHaveCount(0);
  const updateCard = page.getByRole("button", {
    name: "更新可信凭证排名，当前数据更新时间：暂无",
  });
  await expect(updateCard).toBeVisible();
  await expect(updateCard.getByText("更新", { exact: true })).toBeVisible();
  await expect(updateCard.getByText("当前数据更新时间：暂无")).toBeVisible();
  expect((await updateCard.boundingBox())?.height).toBeGreaterThanOrEqual(68);
  await expect(page.getByText("数据结构", { exact: true })).toHaveCount(0);
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
  await expect(dialog).toHaveAccessibleDescription(
    "本机登录信息会被清除，下次查看个人数据需要重新登录。",
  );
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
