import { expect, test, type Page } from "@playwright/test";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  const dateHeading = page.getByRole("heading", { name: /^\d{1,2} 月 \d{1,2} 日 星期[一二三四五六日]$/ });
  const notice = page.getByRole("link", { name: /\d+ 条未读通知/ });
  await expect(dateHeading).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveText(/2026 秋季学期 · 第 \d+ 周/);
  await expect(page.locator(".page-header p strong")).toHaveText(/第 \d+ 周/);
  const header = page.locator(".page-header");
  await expect(header).toHaveCSS("position", "sticky");
  expect(await header.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
  const [headingBox, noticeBox] = await Promise.all([dateHeading.boundingBox(), notice.boundingBox()]);
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
  await expect(page.getByRole("article", { name: "算法设计与分析，已结束" })).toHaveClass(/course-card--completed/);
  await expect(page.getByRole("article", { name: "操作系统，即将开始" })).toHaveClass(/course-card--warning/);
  await expect(page.getByRole("article", { name: "移动应用开发实践，未开始" })).toHaveClass(/course-card--upcoming/);
  await expect(page.getByText("编译原理", { exact: true })).toHaveCount(0);
  const warningStatus = page.getByText("即将开始", { exact: true });
  await expect(warningStatus).toBeVisible();
  await expect(page.getByText(/^(已结束|上课中|未开始)$/)).toHaveCount(0);
  await expect(page.getByText("完整课表")).toHaveCount(0);
  await expect(page.locator(".today-courses .timeline")).toHaveCount(0);

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
    Object.fromEntries(cards.map((card) => {
      const status = [...card.classList].find((name) => name.startsWith("course-card--"))?.replace("course-card--", "");
      const style = getComputedStyle(card);
      const stripe = card.querySelector<HTMLElement>(".course-card__stripe")!;
      const content = card.querySelector<HTMLElement>(".course-card__content")!;
      const firstTime = card.querySelector<HTMLElement>(".course-card__time")!;
      const stripeBox = stripe.getBoundingClientRect();
      return [status, {
        background: style.backgroundColor,
        borderLeftWidth: style.borderLeftWidth,
        borderTopWidth: style.borderTopWidth,
        contentBorderTopWidth: getComputedStyle(content).borderTopWidth,
        contentInset: firstTime.getBoundingClientRect().left - stripeBox.right,
        shadow: style.boxShadow,
        stripeColor: getComputedStyle(stripe).backgroundColor,
        stripeWidth: stripeBox.width,
        titleWeight: getComputedStyle(card.querySelector("h3")!).fontWeight,
      }];
    })),
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
    stripeColor: getComputedStyle(card.querySelector<HTMLElement>(".course-card__stripe")!).backgroundColor,
    stripeWidth: card.querySelector<HTMLElement>(".course-card__stripe")!.getBoundingClientRect().width,
  }));
  expect(activeVisual.background).toBe("rgb(234, 244, 239)");
  expect(activeVisual.stripeColor).toBe("rgb(54, 115, 86)");
  expect(activeVisual.stripeWidth).toBe(6);

  await tomorrowTab.click();
  await expect(tomorrowTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("数据库系统", { exact: true })).toBeVisible();
  await expect(page.getByText("计算机组成原理", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ path: `artifacts/${testInfo.project.name}-today-courses.png`, fullPage: true });
});

test("today courses default to tomorrow after the last class", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-09-23T22:00:00"));
  await login(page);
  await expect(page.getByRole("tab", { name: "明日课程" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("数据库系统", { exact: true })).toBeVisible();
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
