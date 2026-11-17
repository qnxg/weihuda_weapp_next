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
  await expect(header).toHaveCSS("background-color", "rgb(245, 248, 250)");
  await expect(header).not.toHaveClass(/is-scrolled/);
  await expect(header).toHaveCSS("box-shadow", "none");
  const noticeBadge = notice.locator(".today-notice-button__badge");
  await expect(noticeBadge).toHaveText("1");
  await expect(noticeBadge).toHaveCSS("background-color", "rgb(194, 77, 93)");
  await expect(noticeBadge).toHaveCSS("color", "rgb(255, 255, 255)");
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

function contrastRatio(foreground: string, background: string) {
  const luminance = (color: string) => {
    const channels = color
      .match(/\d+(?:\.\d+)?/g)
      ?.slice(0, 3)
      .map(Number);
    if (!channels || channels.length !== 3) throw new Error(`Unsupported CSS color: ${color}`);
    return channels
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const values = [luminance(foreground), luminance(background)].toSorted(
    (left, right) => right - left,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function swipe(page: Page, start: { x: number; y: number }, delta: { x: number; y: number }) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [start],
    });
    for (let step = 1; step <= 4; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: start.x + (delta.x * step) / 4,
            y: start.y + (delta.y * step) / 4,
          },
        ],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
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
  await expect(page.getByRole("heading", { name: "校园账户", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录后查看校园账户" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "课程成绩", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "登录后查看课程成绩" })).toBeVisible();
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
  await expect(loginLink).toHaveCSS("color", "rgb(49, 140, 202)");
  await expect(loginLink).toHaveCSS("text-decoration-line", "underline");
  expect((await loginLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(apiRequests.toSorted()).toEqual(["/api/countdown", "/api/semester"]);

  const mainContent = page.locator("#main-content");
  const pageHeader = page.locator(".page-header");
  await expect(pageHeader).not.toHaveClass(/is-scrolled/);
  await expect(pageHeader).toHaveCSS("box-shadow", "none");
  await mainContent.evaluate((main) => {
    main.scrollTop = 1;
  });
  await expect(pageHeader).toHaveClass(/is-scrolled/);
  await expect
    .poll(() => pageHeader.evaluate((header) => getComputedStyle(header).boxShadow))
    .not.toBe("none");
  await mainContent.evaluate((main) => {
    main.scrollTop = 0;
  });
  await expect(pageHeader).not.toHaveClass(/is-scrolled/);
  await expect(pageHeader).toHaveCSS("box-shadow", "none");

  await page.screenshot({ path: `artifacts/${testInfo.project.name}-guest.png`, fullPage: true });
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "服务", exact: true }).click();
  await expect(page.getByRole("heading", { name: "服务" })).toBeVisible();
  await expect(page.locator('.services-page [aria-label="需要登录"]')).toHaveCount(0);
  const serviceIconColors = await page
    .locator(".service-item__icon")
    .evaluateAll((icons) => [...new Set(icons.map((icon) => getComputedStyle(icon).color))]);
  expect(serviceIconColors).toEqual(["rgb(45, 99, 138)"]);
  await expect(page.getByRole("link", { name: /课程成绩/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /成绩排名/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /体测成绩/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /体测预约/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /体测标准/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /实验安排/ })).toHaveAttribute(
    "href",
    "/services/lab/schedule",
  );
  await expect(page.getByRole("link", { name: /实验成绩/ })).toHaveAttribute(
    "href",
    "/services/lab/grade",
  );
  await expect(page.getByRole("link", { name: /大物实验/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /校园公告/ })).toHaveCount(0);
  await page.getByRole("link", { name: /课程成绩/ }).click();
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: "登录校园账号" })).toBeVisible();
});

test("gym standards switch complete source data by audience, grade, and project", async ({
  page,
}, testInfo) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) apiRequests.push(url.pathname);
  });

  await page.goto("/services/gym/standard");
  await expect(page.getByRole("heading", { name: "体测标准", exact: true })).toBeVisible();
  await expect(
    page.getByRole("group", {
      name: "体测总分等于标准分 100 分加附加分 20 分，满分 120 分",
    }),
  ).toBeVisible();
  await expect(page.locator(".gym-standard-score-part > strong")).toHaveText([
    "100分",
    "20分",
    "120分",
  ]);
  expect(
    await page
      .locator(".gym-standard-score-part")
      .evaluateAll((parts) =>
        parts.map((part) => Array.from(part.children).map((child) => child.tagName)),
      ),
  ).toEqual([
    ["STRONG", "SPAN"],
    ["STRONG", "SPAN"],
    ["STRONG", "SPAN"],
  ]);
  await expect(page.getByText("大学生体质健康测试")).toHaveCount(0);
  await expect(page.getByText("满分 120 分", { exact: true })).toHaveCount(0);
  await expect(page.getByText("七项加权")).toHaveCount(0);
  await expect(page.getByText("加分项目")).toHaveCount(0);
  await expect(page.getByText("最高得分")).toHaveCount(0);
  const overviewHeadingStyles = await page
    .locator(
      ".gym-standard-overview__heading h2, .gym-standard-level-heading h3, .gym-standard-graduation__heading h2, .gym-standard-filters > .section-heading h2",
    )
    .evaluateAll((headings) =>
      headings.map((heading) => {
        const style = getComputedStyle(heading);
        return [style.fontFamily, style.fontSize, style.fontWeight];
      }),
    );
  overviewHeadingStyles
    .slice(1)
    .forEach((headingStyle) => expect(headingStyle).toEqual(overviewHeadingStyles[0]));
  const overviewHeadingHeights = await page
    .locator(
      ".gym-standard-overview__heading, .gym-standard-level-heading, .gym-standard-graduation__heading",
    )
    .evaluateAll((headings) => headings.map((heading) => heading.getBoundingClientRect().height));
  overviewHeadingHeights
    .slice(1)
    .forEach((headingHeight) => expect(headingHeight).toBeCloseTo(overviewHeadingHeights[0], 3));
  const levelHeadingRightInset = await page
    .locator(".gym-standard-level-heading")
    .evaluate((row) => {
      const rowBounds = row.getBoundingClientRect();
      const descriptionBounds = row.querySelector("span")!.getBoundingClientRect();
      return rowBounds.right - descriptionBounds.right;
    });
  expect(levelHeadingRightInset).toBeCloseTo(16, 3);
  await expect(page.getByText("≥ 90", { exact: true })).toBeVisible();
  await expect(page.getByText("示例数据", { exact: true })).toHaveCount(0);
  await expect(page.getByText("正式标准待补充", { exact: false })).toHaveCount(0);
  const graduationCalculation = page.getByRole("group", {
    name: "毕业成绩等于毕业当年学年总分乘以 50%，加其他学年总分平均得分乘以 50%；毕业等级按毕业成绩评定",
  });
  await expect(page.getByRole("heading", { name: "毕业成绩" })).toBeVisible();
  await expect(graduationCalculation.getByText("毕业当年学年总分")).toBeVisible();
  await expect(graduationCalculation.getByText("其他学年总分平均得分")).toBeVisible();
  await expect(graduationCalculation.getByText("× 50%")).toHaveCount(2);
  await expect(graduationCalculation.getByText("同时据此评定毕业等级")).toBeVisible();
  const filterSection = page
    .getByRole("heading", { name: "项目评分标准" })
    .locator("xpath=ancestor::section");
  await expect(filterSection.getByRole("radio", { name: "男生" })).toBeChecked();
  await expect(filterSection.getByRole("tablist", { name: "体测项目" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "适用对象" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "测试项目" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "体重指数（BMI）标准" })).toBeVisible();
  await expect(
    page.getByText("占比 15% · BMI 指标 = 体重 / 身高的平方", { exact: true }),
  ).toBeVisible();
  const bmiTable = page.getByRole("table", { name: "体重指数（BMI）分数与成绩要求" });
  await expect(bmiTable.getByRole("rowheader")).toHaveCount(4);
  await expect(bmiTable.getByRole("rowheader", { name: "80" })).toHaveCount(2);
  await expect(bmiTable.getByText("正常", { exact: true })).toBeVisible();
  await expect(bmiTable.getByText("低体重", { exact: true })).toHaveClass(/badge--brand/);
  await expect(bmiTable.getByText("超重", { exact: true })).toHaveClass(/badge--warning/);
  await expect(bmiTable.getByText("肥胖", { exact: true })).toBeVisible();
  await expect(bmiTable.getByText("优秀", { exact: true })).toHaveCount(0);
  await bmiTable.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-standard-bmi.png`,
    fullPage: false,
  });
  await expect(page.getByText("共 7 项 · 权重合计 100%")).toHaveCount(0);
  await expect(page.locator(".gym-standard-projects small")).toHaveCount(0);
  const projectScroll = page.getByRole("region", { name: "测试项目选择" });
  const projectScrollMetrics = await projectScroll.evaluate((container) => {
    const card = container.querySelector<HTMLElement>(".gym-standard-project-card");
    return {
      clientWidth: container.clientWidth,
      scrollWidth: container.scrollWidth,
      cardWidth: card?.getBoundingClientRect().width ?? 0,
    };
  });
  expect(projectScrollMetrics.scrollWidth).toBeGreaterThan(projectScrollMetrics.clientWidth);
  expect(projectScrollMetrics.cardWidth).toBeGreaterThan(projectScrollMetrics.clientWidth);
  const projectCard = page.locator(".gym-standard-project-card");
  await expect(projectCard).toHaveCSS("padding", "0px");
  await expect(projectCard).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".gym-standard-projects")).toHaveCSS("padding", "0px");
  const projectCardInsets = await projectCard.evaluate((card) => {
    const cardBounds = card.getBoundingClientRect();
    const tabs = card.querySelectorAll<HTMLElement>('[role="tab"]');
    return {
      left: tabs[0].getBoundingClientRect().left - cardBounds.left,
      right: cardBounds.right - tabs[tabs.length - 1].getBoundingClientRect().right,
    };
  });
  expect(projectCardInsets.left).toBeCloseTo(projectCardInsets.right, 3);
  const selectedProjectTab = page.getByRole("tab", { name: "BMI" });
  await expect(selectedProjectTab).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(selectedProjectTab).toHaveCSS("border-radius", "0px");
  const selectedIndicator = await selectedProjectTab.evaluate((tab) => {
    const style = getComputedStyle(tab, "::after");
    return {
      backgroundColor: style.backgroundColor,
      height: style.height,
      opacity: style.opacity,
      width: style.width,
    };
  });
  expect(selectedIndicator).toEqual({
    backgroundColor: "rgb(49, 140, 202)",
    height: "3px",
    opacity: "1",
    width: "40px",
  });
  const cardXBeforeScroll = (await projectCard.boundingBox())?.x ?? 0;
  await projectScroll.evaluate((container) => {
    container.scrollLeft = container.scrollWidth;
  });
  await expect
    .poll(async () => (await projectCard.boundingBox())?.x ?? 0)
    .toBeLessThan(cardXBeforeScroll);

  await page.getByRole("radio", { name: "女生" }).click();
  await page.getByRole("radio", { name: "大三 / 大四" }).click();
  await page.getByRole("tab", { name: "800 米" }).click();

  await expect(page.getByRole("heading", { name: "800 米跑标准" })).toBeVisible();
  await expect(page.getByText("单位：分秒 · 用时越短，分数越高")).toHaveCount(0);
  await expect(page.getByText("占比 20%", { exact: true })).toBeVisible();
  await expect(page.getByText("权重 20%", { exact: true })).toHaveCount(0);
  await expect(page.locator(".gym-standard-result > .section-heading .badge")).toHaveCount(0);
  const standardTable = page.getByRole("table", { name: "800 米跑分数与成绩要求" });
  await expect(standardTable.getByRole("columnheader", { name: "成绩要求（分秒）" })).toBeVisible();
  await expect(standardTable.getByRole("columnheader", { name: "等级" })).toHaveCSS(
    "text-align",
    "right",
  );
  await expect(standardTable.getByRole("rowheader")).toHaveCount(20);
  await expect(standardTable.getByRole("rowheader", { name: "100", exact: true })).toBeVisible();
  await expect(standardTable.getByText("≤ 3′16″", { exact: true })).toBeVisible();
  await expect(standardTable.getByText("≤ 3′22″", { exact: true })).toBeVisible();
  await expect(standardTable.getByText("≤ 3′28″", { exact: true })).toBeVisible();
  await expect(standardTable.getByText("≤ 4′32″", { exact: true })).toBeVisible();
  await expect(standardTable.getByText("≤ 5′22″", { exact: true })).toBeVisible();
  await expect(standardTable.getByText("分", { exact: true })).toHaveCount(0);
  const bonusHeading = page.getByRole("heading", { name: "附加分" });
  await expect(bonusHeading).toBeVisible();
  await expect(page.getByText("最高 10 分", { exact: true })).toHaveCount(0);
  const firstBonusTable = page.getByRole("table", {
    name: "800 米跑附加分前 5 档成绩要求",
  });
  const lastBonusTable = page.getByRole("table", {
    name: "800 米跑附加分后 5 档成绩要求",
  });
  await expect(firstBonusTable.getByRole("columnheader", { name: "分值" })).toBeVisible();
  await expect(
    firstBonusTable.getByRole("columnheader", { name: "成绩要求（分秒）" }),
  ).toBeVisible();
  expect(await firstBonusTable.getByRole("rowheader").allTextContents()).toEqual([
    "+10",
    "+9",
    "+8",
    "+7",
    "+6",
  ]);
  await expect(firstBonusTable.getByText("≤ 2′26″", { exact: true })).toBeVisible();
  await expect(lastBonusTable.getByRole("columnheader", { name: "分值" })).toBeVisible();
  await expect(
    lastBonusTable.getByRole("columnheader", { name: "成绩要求（分秒）" }),
  ).toBeVisible();
  expect(await lastBonusTable.getByRole("rowheader").allTextContents()).toEqual([
    "+5",
    "+4",
    "+3",
    "+2",
    "+1",
  ]);
  await expect(lastBonusTable.getByText("≤ 3′11″", { exact: true })).toBeVisible();
  await expect(firstBonusTable.getByText(/比 100 分标准/)).toHaveCount(0);
  await expect(lastBonusTable.getByText(/比 100 分标准/)).toHaveCount(0);
  await expect(page.locator(".gym-standard-table.surface")).toHaveCount(3);
  const standardCard = standardTable.locator("..");
  const bonusSection = page.locator(".gym-standard-bonus");
  const bonusCards = bonusSection.locator(".gym-standard-bonus-table");
  await expect(standardCard).toHaveClass(/surface/);
  await expect(bonusCards).toHaveCount(2);
  await expect(bonusCards.first()).toHaveClass(/surface/);
  await expect(bonusCards.last()).toHaveClass(/surface/);
  const standardOuterPaddings = await standardTable.evaluate((table) => {
    const firstCell = table.querySelector<HTMLElement>("tbody th:first-child")!;
    const lastCell = table.querySelector<HTMLElement>("tbody td:last-child")!;
    return {
      left: getComputedStyle(firstCell).paddingLeft,
      right: getComputedStyle(lastCell).paddingRight,
    };
  });
  const bonusOuterPaddings = await bonusCards.evaluateAll((cards) =>
    cards.map((card) => {
      const firstCell = card.querySelector<HTMLElement>("tbody th:first-child")!;
      const lastCell = card.querySelector<HTMLElement>("tbody td:last-child")!;
      return {
        left: getComputedStyle(firstCell).paddingLeft,
        right: getComputedStyle(lastCell).paddingRight,
      };
    }),
  );
  expect(standardOuterPaddings).toEqual({ left: "14px", right: "14px" });
  expect(bonusOuterPaddings).toEqual([standardOuterPaddings, standardOuterPaddings]);
  const [standardCardBox, bonusSectionBox, firstBonusCardBox, lastBonusCardBox] = await Promise.all(
    [
      standardCard.boundingBox(),
      bonusSection.boundingBox(),
      bonusCards.first().boundingBox(),
      bonusCards.last().boundingBox(),
    ],
  );
  expect(
    standardCardBox && bonusSectionBox && firstBonusCardBox && lastBonusCardBox,
  ).not.toBeNull();
  const bonusTopGap = bonusSectionBox!.y - (standardCardBox!.y + standardCardBox!.height);
  expect(bonusTopGap).toBeGreaterThanOrEqual(15);
  expect(bonusTopGap).toBeLessThanOrEqual(17);
  expect(firstBonusCardBox!.y).toBeGreaterThan(standardCardBox!.y + standardCardBox!.height);
  expect(Math.abs(firstBonusCardBox!.y - lastBonusCardBox!.y)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(firstBonusCardBox!.width - lastBonusCardBox!.width)).toBeLessThanOrEqual(0.5);
  const bonusCardGap = lastBonusCardBox!.x - (firstBonusCardBox!.x + firstBonusCardBox!.width);
  expect(bonusCardGap).toBeGreaterThanOrEqual(7);
  expect(bonusCardGap).toBeLessThanOrEqual(9);
  await bonusHeading.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-standard-bonus.png`,
    fullPage: false,
  });
  await standardTable.scrollIntoViewIfNeeded();
  const levelColumnAlignment = await standardTable.evaluate((table) => {
    const heading = table.querySelector<HTMLElement>("thead th:last-child")!;
    const headingText = document.createRange();
    headingText.selectNodeContents(heading);
    return {
      headingRight: headingText.getBoundingClientRect().right,
      badgeRights: [...table.querySelectorAll<HTMLElement>("tbody td:last-child .badge")].map(
        (badge) => badge.getBoundingClientRect().right,
      ),
    };
  });
  levelColumnAlignment.badgeRights.forEach((badgeRight) =>
    expect(badgeRight).toBeCloseTo(levelColumnAlignment.headingRight, 3),
  );
  await expect(page.getByRole("radio", { name: "女生" })).toBeChecked();
  await expect(page.getByRole("tab", { name: "800 米" })).toHaveAttribute("aria-selected", "true");
  expect(apiRequests).toEqual([]);

  const filterOptionHeights = await page
    .locator(".gym-standard-filter .radio-group-option")
    .evaluateAll((options) => options.map((option) => option.getBoundingClientRect().height));
  expect(Math.min(...filterOptionHeights)).toBeGreaterThanOrEqual(44);
  await expect(
    page.locator('.gym-standard-filter .radio-group-option input[type="radio"]'),
  ).toHaveCount(4);
  const filterRows = await page.locator(".gym-standard-filter__group").evaluateAll((rows) =>
    rows.map((row) => {
      const rowBounds = row.getBoundingClientRect();
      const lastOptionBounds = row
        .querySelector<HTMLElement>(".radio-group-option:last-child")!
        .getBoundingClientRect();
      return {
        height: rowBounds.height,
        minHeight: getComputedStyle(row).minHeight,
        rightOffset: rowBounds.right - lastOptionBounds.right,
      };
    }),
  );
  expect(filterRows.map((row) => row.minHeight)).toEqual(["52px", "52px"]);
  filterRows.forEach((row) => expect(row.height).toBeCloseTo(52, 3));
  filterRows.forEach((row) => expect(row.rightOffset).toBeCloseTo(12, 3));
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-standard.png`,
    fullPage: true,
  });

  const standardFootnotes = page.getByRole("note", { name: "体测标准说明" });
  await standardFootnotes.scrollIntoViewIfNeeded();
  await expect(standardFootnotes).toBeInViewport();
  const [footnotesBox, navigationBox] = await Promise.all([
    standardFootnotes.boundingBox(),
    page.getByRole("navigation", { name: "主导航" }).boundingBox(),
  ]);
  expect(footnotesBox && navigationBox).not.toBeNull();
  expect(footnotesBox!.y + footnotesBox!.height).toBeLessThanOrEqual(navigationBox!.y);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-standard-bottom.png`,
    fullPage: false,
  });
});

test("academic calendar switches years and periods from a compact selector", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  const calendarAuthorizations: Array<string | undefined> = [];
  let calendarRequests = 0;
  await page.route(/\/api\/calendar(?:\/[^/?]+)?(?:\?.*)?$/, async (route) => {
    calendarRequests += 1;
    if (calendarRequests > 2) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/calendar")) {
      calendarAuthorizations.push(request.headers().authorization);
    }
  });

  await page.goto("/services/calendar");
  await expect(page.getByRole("heading", { name: "校历", exact: true })).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveCount(0);

  const selectionHeading = page.getByRole("heading", {
    name: "2026 - 2027 学年 秋季学期",
  });
  const switchCalendar = page.getByRole("button", {
    name: "切换学年和学期，当前为2026 - 2027 学年 秋季学期",
  });
  const toolbar = page.locator(".academic-calendar-toolbar");
  await expect(selectionHeading).toBeVisible();
  await expect(toolbar.getByText("2026.9.13 到 2027.1.16 共 18 周")).toBeVisible();
  expect(calendarAuthorizations).toHaveLength(2);
  expect(calendarAuthorizations.every((authorization) => authorization === undefined)).toBe(true);
  await expect(switchCalendar).toBeVisible();
  await expect(page.getByRole("tablist", { name: "校历阶段" })).toHaveCount(0);
  await expect(page.locator(".academic-calendar-period__header")).toHaveCount(0);

  const fall = page.getByRole("article", { name: "秋季学期校历" });
  await expect(fall.getByRole("row")).toHaveCount(21);
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("cell")).toHaveCount(140);
  await expect(fall.getByRole("row", { name: "夏9，参考周", exact: true })).toBeVisible();
  const referenceWeeks = fall.locator(".academic-calendar-grid__row.is-reference-week");
  await expect(referenceWeeks).toHaveCount(2);
  await expect(referenceWeeks.first()).toHaveCSS("background-color", "rgb(234, 240, 244)");
  await expect(fall.getByText("Fall Semester", { exact: true })).toHaveCount(0);
  await expect(fall.getByText("18 周", { exact: true })).toHaveCount(0);
  await expect(fall.getByText("2026年10月12日至10月25日。")).toBeVisible();
  const notes = fall.locator(".academic-calendar-notes");
  await expect(notes).toHaveCSS("background-color", "rgb(49, 140, 202)");
  await expect(notes).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(notes.locator("ul.sr-only[lang='en']")).toHaveCount(0);
  await notes.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath(`academic-calendar-notes-${testInfo.project.name}.png`),
  });
  await page.locator("#main-content").evaluate((main) => {
    main.scrollTop = 0;
  });
  await expect(fall.getByRole("cell", { name: "2026年9月23日，星期三，今天" })).toHaveClass(
    /is-today/,
  );
  await expect(fall.locator(".academic-calendar-week-number small")).toHaveCount(0);
  await expect
    .poll(() =>
      fall
        .locator(".academic-calendar-week-number")
        .first()
        .evaluate((week) => getComputedStyle(week, "::after").content),
    )
    .toBe("none");

  const calendarLayout = await page.locator(".academic-calendar-grid").evaluateAll((grids) =>
    grids.map((grid) => {
      const firstRow = grid.querySelector<HTMLElement>('[role="row"]')!;
      const cells = [...firstRow.children].map((cell) => cell.getBoundingClientRect());
      return {
        clientWidth: grid.clientWidth,
        scrollWidth: grid.scrollWidth,
        columnCount: cells.length,
        minColumnWidth: Math.min(...cells.map(({ width }) => width)),
      };
    }),
  );
  expect(
    calendarLayout.every(
      ({ clientWidth, scrollWidth, columnCount, minColumnWidth }) =>
        scrollWidth <= clientWidth && columnCount === 8 && minColumnWidth >= 30,
    ),
  ).toBe(true);
  await expect(fall.locator(".academic-calendar-grid__header small")).toHaveCount(0);
  const weekdayHeaderColors = await fall
    .locator(".academic-calendar-grid__header > div")
    .evaluateAll((cells) => [...new Set(cells.map((cell) => getComputedStyle(cell).color))]);
  expect(weekdayHeaderColors).toEqual(["rgb(31, 43, 52)"]);
  await expect(fall.locator(".academic-calendar-grid__header > div").nth(1)).toHaveCSS(
    "border-left-width",
    "0px",
  );
  await expect(fall.locator(".academic-calendar-grid__header")).toHaveCSS(
    "border-bottom-width",
    "1px",
  );
  const calendarGrid = fall.locator(".academic-calendar-grid");
  await expect(calendarGrid).toHaveCSS("padding-top", "0px");
  await expect(calendarGrid).toHaveCSS("padding-right", "0px");
  await expect(calendarGrid).toHaveCSS("padding-bottom", "0px");
  await expect(calendarGrid).toHaveCSS("padding-left", "0px");
  const weekHeading = fall.locator(".academic-calendar-week-heading");
  const firstWeekNumber = fall.locator(".academic-calendar-week-number").first();
  const saturdayHeading = fall.getByRole("columnheader", { name: "星期六" });
  await expect(weekHeading).toHaveCSS("border-right-width", "1px");
  await expect(firstWeekNumber).toHaveCSS("border-right-width", "1px");
  const [weekHeadingBox, firstWeekNumberBox] = await Promise.all([
    weekHeading.boundingBox(),
    firstWeekNumber.boundingBox(),
  ]);
  expect(weekHeadingBox && firstWeekNumberBox).not.toBeNull();
  expect(
    Math.abs(
      weekHeadingBox!.x +
        weekHeadingBox!.width -
        (firstWeekNumberBox!.x + firstWeekNumberBox!.width),
    ),
  ).toBeLessThanOrEqual(0.5);
  const [periodBox, weekdaysBox] = await Promise.all([
    fall.boundingBox(),
    fall.locator(".academic-calendar-grid__header").boundingBox(),
  ]);
  expect(periodBox && weekdaysBox).not.toBeNull();
  expect(Math.abs(weekdaysBox!.x - periodBox!.x)).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(weekdaysBox!.x + weekdaysBox!.width - (periodBox!.x + periodBox!.width)),
  ).toBeLessThanOrEqual(0.5);
  const saturdayHeadingBox = await saturdayHeading.boundingBox();
  expect(saturdayHeadingBox).not.toBeNull();
  expect(Math.abs(weekHeadingBox!.x - periodBox!.x)).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(saturdayHeadingBox!.x + saturdayHeadingBox!.width - (periodBox!.x + periodBox!.width)),
  ).toBeLessThanOrEqual(0.5);
  await expect(fall.locator(".academic-calendar-grid__row").nth(1)).toHaveCSS(
    "border-top-width",
    "0px",
  );
  const firstDayBorders = await fall
    .locator(".academic-calendar-day")
    .first()
    .evaluate((day) => {
      const style = getComputedStyle(day);
      return [
        style.borderTopWidth,
        style.borderRightWidth,
        style.borderBottomWidth,
        style.borderLeftWidth,
      ];
    });
  expect(firstDayBorders).toEqual(["0px", "0px", "0px", "0px"]);
  const septemberSunday = fall
    .getByRole("cell", { name: "2026年9月13日，星期日" })
    .locator(".academic-calendar-day__number");
  const septemberWednesday = fall
    .getByRole("cell", { name: "2026年9月30日，星期三" })
    .locator(".academic-calendar-day__number");
  const octoberThursday = fall.getByRole("cell", { name: "2026年10月1日，星期四" });
  const octoberNumber = octoberThursday.locator(".academic-calendar-day__number");
  const octoberLabel = octoberThursday.locator(".academic-calendar-day__month");
  await expect(septemberSunday).toHaveCSS("color", "rgb(31, 43, 52)");
  await expect(septemberWednesday).toHaveCSS("color", "rgb(31, 43, 52)");
  await expect(octoberNumber).toHaveCSS("color", "rgb(106, 120, 131)");
  const [octoberNumberBox, octoberLabelBox] = await Promise.all([
    octoberNumber.boundingBox(),
    octoberLabel.boundingBox(),
  ]);
  expect(octoberNumberBox && octoberLabelBox).not.toBeNull();
  expect(octoberLabelBox!.y).toBeGreaterThan(octoberNumberBox!.y + octoberNumberBox!.height / 2);
  expect(octoberLabelBox!.y - (octoberNumberBox!.y + octoberNumberBox!.height)).toBeLessThanOrEqual(
    1,
  );
  const firstOfficialWeek = fall.getByRole("row", {
    name: "秋季学期第1周",
    exact: true,
  });
  const [weekNumberBox, firstDateNumberBox] = await Promise.all([
    firstOfficialWeek.getByRole("rowheader").locator("span").boundingBox(),
    septemberSunday.boundingBox(),
  ]);
  expect(weekNumberBox && firstDateNumberBox).not.toBeNull();
  expect(
    Math.abs(
      weekNumberBox!.y +
        weekNumberBox!.height / 2 -
        (firstDateNumberBox!.y + firstDateNumberBox!.height / 2),
    ),
  ).toBeLessThanOrEqual(0.5);
  const todayNumber = fall
    .getByRole("cell", { name: "2026年9月23日，星期三，今天" })
    .locator(".academic-calendar-day__number");
  await expect(todayNumber).toHaveCSS("background-color", "rgb(49, 140, 202)");
  await expect(todayNumber).toHaveCSS("border-radius", "50%");
  await expect(fall).toHaveCSS("border-radius", "8px");
  await expect
    .poll(() => fall.evaluate((card) => getComputedStyle(card).boxShadow))
    .not.toBe("none");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-academic-calendar-top.png`,
    fullPage: false,
  });

  const mainContent = page.locator("#main-content");
  const calendarContent = page.locator(".academic-calendar-content");
  await mainContent.evaluate((main) => {
    main.scrollTop = 0;
  });
  const [headerBeforeRefresh, toolbarBeforeRefresh, contentBeforeRefresh] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    toolbar.boundingBox(),
    calendarContent.boundingBox(),
  ]);
  expect(contentBeforeRefresh).not.toBeNull();
  await swipe(
    page,
    {
      x: contentBeforeRefresh!.x + contentBeforeRefresh!.width / 2,
      y: contentBeforeRefresh!.y + 96,
    },
    { x: 0, y: 160 },
  );

  await expect(mainContent).toHaveAttribute("data-pull-state", "refreshing");
  await expect(mainContent).toHaveAttribute("data-pull-target", "panel");
  await expect(calendarContent).toBeHidden();
  await expect(page.locator(".pull-to-refresh__skeleton")).toBeVisible();
  const [headerDuringRefresh, toolbarDuringRefresh] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    toolbar.boundingBox(),
  ]);
  expect(
    Math.abs((headerDuringRefresh?.y ?? 0) - (headerBeforeRefresh?.y ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs((toolbarDuringRefresh?.y ?? 0) - (toolbarBeforeRefresh?.y ?? 0)),
  ).toBeLessThanOrEqual(0.5);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-academic-calendar-refresh.png`,
    fullPage: false,
  });
  await expect.poll(() => calendarRequests).toBe(4);
  await expect(mainContent).toHaveAttribute("data-pull-state", "success");
  await expect(mainContent).toHaveAttribute("data-pull-state", "idle");
  await expect(calendarContent).toBeVisible();

  await switchCalendar.click();
  let calendarDialog = page.getByRole("dialog", { name: "切换" });
  await expect(calendarDialog).toHaveCSS("opacity", "1");
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeHidden();
  await expect(calendarDialog.getByRole("group", { name: "学年" })).toBeVisible();
  await expect(calendarDialog.getByRole("group", { name: "学期" })).toBeVisible();
  const selectedYear = calendarDialog.getByRole("button", { name: "2026 - 2027 学年" });
  await expect(selectedYear).toHaveClass(/is-selected/);
  await expect(selectedYear).toHaveAttribute("aria-pressed", "true");
  await expect(calendarDialog.locator("legend")).toHaveCount(0);
  await expect(calendarDialog.getByText("当前", { exact: true })).toHaveCount(0);
  const fallOption = calendarDialog.getByRole("button", { name: "秋季学期" });
  await expect(fallOption).toHaveClass(/is-selected/);
  await expect(fallOption).toHaveAttribute("aria-pressed", "true");
  await expect(fallOption).not.toContainText("18 周");

  const winterRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/calendar/2",
  );
  await calendarDialog.getByRole("button", { name: "寒假" }).click();
  await winterRequest;
  await expect(page).toHaveURL(/\?id=2$/);
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026 - 2027 学年 寒假" })).toBeVisible();
  await expect(toolbar.getByText("2027.1.17 到 2027.2.20 共 5 周")).toBeVisible();
  const winter = page.getByRole("article", { name: "寒假校历" });
  await expect(winter.getByRole("row")).toHaveCount(6);
  await expect(page.getByRole("cell")).toHaveCount(35);
  await expect(winter.getByText("2027年2月6日。")).toBeVisible();
  await expect(page.getByRole("article", { name: "秋季学期校历" })).toHaveCount(0);

  await page
    .getByRole("button", {
      name: "切换学年和学期，当前为2026 - 2027 学年 寒假",
    })
    .click();
  calendarDialog = page.getByRole("dialog", { name: "切换" });
  await calendarDialog.getByRole("button", { name: "2025 - 2026 学年" }).click();
  const summerOption = calendarDialog.getByRole("button", { name: "暑假" });
  await expect(summerOption).toBeVisible();
  await expect(summerOption).not.toContainText("6 周");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-academic-calendar-year-picker.png`,
    fullPage: false,
  });
  const historicalRequest = page.waitForRequest(
    (request) => new URL(request.url()).pathname === "/api/calendar/8",
  );
  await summerOption.click();
  await historicalRequest;
  await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2025 - 2026 学年 暑假" })).toBeVisible();
  await expect(toolbar.getByText("2026.7.12 到 2026.8.22 共 6 周")).toBeVisible();
  await expect(page).toHaveURL(/\?id=8$/);
  const historicalDate = page.getByRole("cell", { name: "2026年7月12日，星期日" });
  await expect(historicalDate).toBeVisible();
  await expect(historicalDate.locator(".academic-calendar-day__number")).toHaveCSS(
    "color",
    "rgb(106, 120, 131)",
  );
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-academic-calendar-history.png`,
    fullPage: false,
  });
});

test("pull to refresh updates live pages without attaching to the static service directory", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  let countdownRequests = 0;
  let aboutRequests = 0;
  await page.route("**/api/countdown", async (route) => {
    countdownRequests += 1;
    if (countdownRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });
  await page.route("**/api/about", async (route) => {
    aboutRequests += 1;
    if (aboutRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
  const mainContent = page.locator("#main-content");
  await mainContent.evaluate((main) => {
    main.scrollTop = 0;
  });
  const [headerBeforeRefresh, courseTabsBeforeRefresh] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    page.locator(".course-day-tabs").boundingBox(),
  ]);

  await swipe(page, { x: 188, y: 260 }, { x: 0, y: 160 });

  await expect(mainContent).toHaveAttribute("data-pull-state", "refreshing");
  await expect(mainContent).toHaveAttribute("data-pull-target", "panel");
  await expect(page.getByRole("status")).toHaveText("正在刷新当前页面");
  await expect(page.locator(".pull-to-refresh__skeleton")).toBeVisible();
  const [
    headerDuringRefresh,
    courseTabsDuringRefresh,
    indicatorDuringRefresh,
    skeletonDuringRefresh,
  ] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    page.locator(".course-day-tabs").boundingBox(),
    page.locator(".pull-to-refresh__indicator").boundingBox(),
    page.locator(".pull-to-refresh__skeleton").boundingBox(),
  ]);
  expect(headerDuringRefresh?.y).toBe(headerBeforeRefresh?.y);
  expect(courseTabsDuringRefresh?.y).toBe(courseTabsBeforeRefresh?.y);
  expect(indicatorDuringRefresh && courseTabsDuringRefresh).not.toBeNull();
  expect(indicatorDuringRefresh!.y).toBeGreaterThanOrEqual(
    courseTabsDuringRefresh!.y + courseTabsDuringRefresh!.height,
  );
  expect(skeletonDuringRefresh && indicatorDuringRefresh).not.toBeNull();
  expect(skeletonDuringRefresh!.y).toBeGreaterThanOrEqual(
    indicatorDuringRefresh!.y + indicatorDuringRefresh!.height,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-pull-to-refresh.png`,
    fullPage: false,
  });
  await expect.poll(() => countdownRequests).toBe(2);
  await expect(mainContent).toHaveAttribute("data-pull-state", "success");
  await expect(page.getByRole("status")).toHaveText("刷新完成");
  await expect(mainContent).toHaveAttribute("data-pull-state", "idle");
  await expect(page.getByRole("heading", { name: "9 月 23 日 星期三" })).toBeVisible();

  await page.getByRole("link", { name: "服务", exact: true }).click();
  await expect(page.getByRole("heading", { name: "服务", exact: true })).toBeVisible();
  await swipe(page, { x: 188, y: 180 }, { x: 0, y: 160 });
  await expect(page.locator("#main-content")).toHaveAttribute("data-pull-state", "idle");

  await page.getByRole("link", { name: "我的", exact: true }).click();
  await page.getByRole("link", { name: /关于微生活/ }).click();
  await expect(page.getByRole("heading", { name: "关于微生活", exact: true })).toBeVisible();
  await expect
    .poll(() => page.locator(".page").evaluate((element) => getComputedStyle(element).transform))
    .toBe("none");
  const aboutHeaderBeforeRefresh = await page.locator(".page-header").boundingBox();
  await swipe(page, { x: 188, y: 180 }, { x: 0, y: 160 });
  await expect(page.locator("#main-content")).toHaveAttribute("data-pull-state", "refreshing");
  await expect(page.locator("#main-content")).toHaveAttribute("data-pull-target", "page");
  await expect(page.locator(".pull-to-refresh__skeleton")).toBeVisible();
  const aboutHeaderDuringRefresh = await page.locator(".page-header").boundingBox();
  expect(aboutHeaderDuringRefresh?.y).toBe(aboutHeaderBeforeRefresh?.y);
  await expect.poll(() => aboutRequests).toBe(2);
  await expect(page.locator("#main-content")).toHaveAttribute("data-pull-state", "success");
  await expect(page.locator("#main-content")).toHaveAttribute("data-pull-state", "idle");
});

test("tabbed pull to refresh stays below the tabs and shows a panel skeleton", async ({
  page,
}, testInfo) => {
  let recentRequests = 0;
  await page.route("**/api/exam?type=recent", async (route) => {
    recentRequests += 1;
    if (recentRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    await route.continue();
  });
  await login(page);
  await page.goto("/services/exams");
  const firstExam = page.locator(".exam-card").first();
  await expect(firstExam).toBeVisible();
  const [headerBeforeRefresh, tabsBeforeRefresh, examBounds] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    page.locator(".exam-tabs").boundingBox(),
    firstExam.boundingBox(),
  ]);
  expect(examBounds).not.toBeNull();
  const requestsBeforeRefresh = recentRequests;

  await swipe(
    page,
    { x: examBounds!.x + examBounds!.width / 2, y: examBounds!.y + 24 },
    { x: 0, y: 160 },
  );

  const mainContent = page.locator("#main-content");
  await expect(mainContent).toHaveAttribute("data-pull-state", "refreshing");
  await expect(mainContent).toHaveAttribute("data-pull-target", "panel");
  await expect(page.locator(".pull-to-refresh__skeleton")).toBeVisible();
  const [headerDuringRefresh, tabsDuringRefresh, indicatorDuringRefresh, skeletonDuringRefresh] =
    await Promise.all([
      page.locator(".page-header").boundingBox(),
      page.locator(".exam-tabs").boundingBox(),
      page.locator(".pull-to-refresh__indicator").boundingBox(),
      page.locator(".pull-to-refresh__skeleton").boundingBox(),
    ]);
  expect(headerDuringRefresh?.y).toBe(headerBeforeRefresh?.y);
  expect(tabsDuringRefresh?.y).toBe(tabsBeforeRefresh?.y);
  expect(indicatorDuringRefresh && tabsDuringRefresh).not.toBeNull();
  expect(indicatorDuringRefresh!.y).toBeGreaterThanOrEqual(
    tabsDuringRefresh!.y + tabsDuringRefresh!.height,
  );
  expect(skeletonDuringRefresh && indicatorDuringRefresh).not.toBeNull();
  expect(skeletonDuringRefresh!.y).toBeGreaterThanOrEqual(
    indicatorDuringRefresh!.y + indicatorDuringRefresh!.height,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-exam-tab-pull-to-refresh.png`,
    fullPage: false,
  });
  await expect.poll(() => recentRequests).toBe(requestsBeforeRefresh + 1);
  await expect(mainContent).toHaveAttribute("data-pull-state", "success");
  await expect(firstExam).toBeVisible();
  await expect(mainContent).toHaveAttribute("data-pull-state", "idle");
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
  await expect(page.getByRole("heading", { name: "校园账户", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();

  shouldFail = false;
  await countdownSection.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
});

test("anonymous homepage retries public semester loading below the header", async ({ page }) => {
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
  await expect(page.locator(".page-header").getByRole("button")).toHaveCount(0);
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
    .getByRole("heading", { name: "校园账户", exact: true })
    .locator("xpath=ancestor::section");
  await expect(networkSection.getByRole("alert")).toContainText("校园网暂不可用");
  await expect(page.locator(".countdown-list > .countdown-item")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "近期事项", exact: true })).toBeVisible();

  shouldFail = false;
  await networkSection.getByRole("button", { name: "重新加载校园网" }).click();
  await expect(
    networkSection.getByRole("link", {
      name: "校园网本月已用 50GB，超额流量 10 GB，账号已锁定，欠费 ¥123,456.78",
    }),
  ).toBeVisible();
  await expect(networkSection.getByText("超额 10 GB")).toBeVisible();
  await expect(networkSection.getByText("已锁定")).toBeVisible();
  await expect(networkSection.getByText("¥123,456.78")).toBeVisible();
  await expect(networkSection.getByRole("progressbar")).toHaveCSS(
    "--progress-bar-color",
    "#318cca",
  );
  await expectNoHorizontalOverflow(page);
});

test("network pages isolate requests and expose selectable traffic details", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  let shouldFailDetail = true;
  let detailRequestCount = 0;
  await page.route("**/api/netflow/detail**", async (route) => {
    detailRequestCount += 1;
    if (!shouldFailDetail) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: { ...route.request().headers(), "X-Mock-Status": "503" },
    });
  });

  await login(page);
  await page.goto("/services/network");

  const historyLink = page.getByRole("link", { name: /历史账单/ });
  const detailLink = page.getByRole("link", { name: /流量明细/ });
  await expect(historyLink).toHaveAttribute("href", "/services/network/orders");
  await expect(detailLink).toHaveAttribute("href", "/services/network/details");
  await expect(page.locator(".page > .network-history-link")).toHaveCount(0);
  await expect(page.locator(".page-header p")).toHaveCount(0);
  expect(detailRequestCount).toBe(0);
  await expect(page.getByText("校园网状态正常", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "本月用量", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "账号信息", exact: true })).toHaveCount(0);
  const usageSection = page.getByRole("region", { name: "本月用量" });
  await expect(usageSection.getByText("本月已用", { exact: true })).toBeVisible();
  await expect(usageSection.locator(".network-overview__percentage")).toHaveText("32%");
  await expect(usageSection.locator(".network-overview__percentage")).not.toHaveClass(/badge/);
  const usageProgress = usageSection.getByRole("progressbar");
  await expect(usageProgress).toHaveCSS("--progress-bar-color", "#408c67");
  const usageProgressVisual = await usageProgress.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      height: style.height,
    };
  });
  await expect(usageSection.locator(".metric__label")).toHaveText([
    "上传流量",
    "下载流量",
    "免费流量",
    "超出流量",
  ]);
  await expect(usageSection.locator(".metric__value")).toHaveText([
    "2.10GB",
    "10.70GB",
    "40GB",
    "0 GB",
  ]);
  const accountSection = page.getByRole("region", { name: "账号信息" });
  await expect(accountSection.getByRole("list", { name: "账号信息列表" })).toBeVisible();
  await expect(accountSection.getByRole("listitem")).toHaveCount(4);
  await expect(accountSection.locator(".network-account-item .menu-link__copy strong")).toHaveText([
    "欠费金额",
    "锁定状态",
  ]);
  await expect(accountSection.locator(".network-account-item .menu-link__copy > span")).toHaveText([
    "当前待缴费用",
    "当前校园网账号状态",
  ]);
  await expect(accountSection.locator(".network-account-item__value")).toHaveText([
    "¥0.00",
    "未锁定",
  ]);
  await expect(accountSection.getByRole("link", { name: /历史账单/ })).toContainText(
    "查看每月流量与费用记录",
  );
  await expect(accountSection.getByRole("link", { name: /流量明细/ })).toContainText(
    "查看本月流量使用明细",
  );
  const accountRowHeights = await accountSection
    .locator(".network-account-item, .menu-link")
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(Math.min(...accountRowHeights)).toBeGreaterThanOrEqual(54);
  expect(Math.max(...accountRowHeights) - Math.min(...accountRowHeights)).toBeLessThanOrEqual(1);
  expect((await historyLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect((await detailLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(page.getByRole("heading", { name: "历史账单", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "本月流量明细", exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.locator(".page").screenshot({
    path: `artifacts/${testInfo.project.name}-network.png`,
  });

  await detailLink.click();
  await expect(page).toHaveURL(/\/services\/network\/details$/);
  await expect(page).toHaveTitle("流量明细 - 微生活");
  await expect(page.getByRole("heading", { name: "流量明细", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "2026 年 9 月", exact: true })).toBeVisible();
  await expect(page.locator(".page-header p")).toHaveCount(0);
  const detailSection = page
    .getByRole("heading", { name: "2026 年 9 月", exact: true })
    .locator("xpath=ancestor::section");
  await expect(detailSection.getByRole("alert")).toContainText("服务暂时不可用");
  expect(detailRequestCount).toBeGreaterThan(0);
  const detailRetry = detailSection.getByRole("button", { name: "重新加载" });
  await detailRetry.scrollIntoViewIfNeeded();
  await expect(detailRetry).toBeVisible();
  const [retryBounds, navBounds] = await Promise.all([
    detailRetry.boundingBox(),
    page.getByRole("navigation", { name: "主导航" }).boundingBox(),
  ]);
  expect(retryBounds && navBounds).not.toBeNull();
  expect(retryBounds!.y + retryBounds!.height).toBeLessThanOrEqual(navBounds!.y);
  shouldFailDetail = false;
  await detailRetry.click();
  const currentMonthList = page.getByRole("list", { name: "2026 年 9 月流量明细列表" });
  await expect(currentMonthList).toBeVisible();
  await expect(currentMonthList.getByRole("listitem")).toHaveCount(5);
  const firstCategoryHeading = currentMonthList.getByRole("heading", {
    name: "基础协议/SSL",
  });
  await expect(firstCategoryHeading).toBeVisible();
  const categorySeparator = firstCategoryHeading.locator(".network-detail-category__separator");
  await expect(categorySeparator).toHaveText("/");
  await expect(categorySeparator).toHaveCSS("color", "rgb(190, 203, 212)");
  await expect(categorySeparator).toHaveCSS("margin-left", "4px");
  await expect(categorySeparator).toHaveCSS("margin-right", "4px");
  await expect(currentMonthList.getByRole("heading", { name: "其他流量" })).toBeVisible();
  await expect(currentMonthList.getByRole("heading", { name: /^\/.+/ })).toHaveCount(0);
  await expect(currentMonthList.getByRole("listitem").first()).toHaveCSS("padding-left", "16px");
  await expect(currentMonthList.getByRole("listitem").nth(1)).toHaveCSS(
    "border-top-color",
    "rgb(223, 231, 236)",
  );
  await expect(detailSection.locator(".section-heading")).toContainText("总流量 12.80GB");
  await expect(detailSection.locator(".section-heading")).not.toContainText("上传");
  await expect(detailSection.locator(".section-heading")).not.toContainText("下载");
  const detailProgress = detailSection.getByRole("progressbar").first();
  await expect(detailProgress).toBeVisible();
  await expect(detailProgress).toHaveCSS("--progress-bar-color", "#318cca");
  const detailProgressVisual = await detailProgress.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      height: style.height,
    };
  });
  expect(detailProgressVisual).toEqual(usageProgressVisual);

  await page.getByRole("button", { name: "切换日期，当前为2026年9月全月" }).click();
  const dateDialog = page.getByRole("dialog", { name: "选择日期" });
  await dateDialog.getByLabel("年份").fill("2025");
  await dateDialog.getByLabel("月份").selectOption("2");
  await dateDialog.getByLabel("日期").selectOption("14");
  await expect(dateDialog.getByLabel("年份")).toHaveValue("2025");
  await expect(dateDialog.getByLabel("月份")).toHaveValue("2");
  await expect(dateDialog.getByLabel("日期")).toHaveValue("14");
  await expect(dateDialog.getByLabel("日期").getByRole("option")).toHaveCount(29);
  const pickerControlHeights = await dateDialog
    .locator("input, select, .modal__actions .button")
    .evaluateAll((controls) => controls.map((control) => control.getBoundingClientRect().height));
  expect(Math.min(...pickerControlHeights)).toBeGreaterThanOrEqual(44);
  await dateDialog.screenshot({
    path: `artifacts/${testInfo.project.name}-network-date-picker.png`,
  });
  const dailyResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/netflow/detail") &&
      url.searchParams.get("year") === "2025" &&
      url.searchParams.get("month") === "2" &&
      url.searchParams.get("day") === "14"
    );
  });
  await dateDialog.getByRole("button", { name: "确定" }).click();
  expect((await dailyResponse).ok()).toBe(true);
  const dailySection = page
    .getByRole("heading", { name: "2025 年 2 月 14 日", exact: true })
    .locator("xpath=ancestor::section");
  await expect(dailySection.locator(".section-heading")).toContainText("总流量 640MB");
  const dailyList = page.getByRole("list", { name: "2025 年 2 月 14 日流量明细列表" });
  await expect(dailyList).toBeVisible();
  await expect(dailyList.getByRole("listitem")).toHaveCount(5);
  await dailyList.getByRole("heading", { name: "其他流量" }).scrollIntoViewIfNeeded();
  await expect(dailyList.getByRole("heading", { name: "其他流量" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.locator(".page").screenshot({
    path: `artifacts/${testInfo.project.name}-network-details-day.png`,
  });

  await page.getByRole("button", { name: "切换日期，当前为2025年2月14日" }).click();
  const monthDialog = page.getByRole("dialog", { name: "选择日期" });
  await monthDialog.getByLabel("日期").selectOption("");
  const monthlyResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/netflow/detail") &&
      url.searchParams.get("year") === "2025" &&
      url.searchParams.get("month") === "2" &&
      !url.searchParams.has("day")
    );
  });
  await monthDialog.getByRole("button", { name: "确定" }).click();
  expect((await monthlyResponse).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "2025 年 2 月", exact: true })).toBeVisible();
  await expect(page.getByText("总流量 12.80GB", { exact: true })).toBeVisible();
  await page.locator(".page").screenshot({
    path: `artifacts/${testInfo.project.name}-network-details-month.png`,
  });

  await page.getByRole("button", { name: "返回" }).click();
  await expect(page).toHaveURL(/\/services\/network$/);
  await historyLink.click();
  await expect(page).toHaveURL(/\/services\/network\/orders$/);
  await expect(page).toHaveTitle("历史账单 - 微生活");
  await expect(page.getByRole("heading", { name: "历史账单", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "账单记录", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "历史账单列表" })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "2026 年 9 月", exact: true })).toBeVisible();
  await expect(page.getByText("下载 10.70GB · 上传 2.10GB · 超额 0GB")).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.locator(".page").screenshot({
    path: `artifacts/${testInfo.project.name}-network-orders.png`,
  });
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

test("exam cards use the material layout and keep add at the list top", async ({
  page,
}, testInfo) => {
  await login(page);
  await page.goto("/services/exams");
  await expect(page.getByRole("heading", { name: "考试安排", exact: true })).toBeVisible();

  const pageHeader = page.locator(".page-header");
  const examCards = page.locator(".exam-card");
  const addCard = page.getByRole("button", { name: "添加考试安排" });
  const unfinishedTab = page.getByRole("tab", { name: "未结束", exact: true });
  const finishedTab = page.getByRole("tab", { name: "已结束", exact: true });
  await expect(pageHeader.locator(":scope > *")).toHaveCount(1);
  await expect(pageHeader.getByText(/共 \d+ 场考试安排/)).toHaveCount(0);
  await expect(unfinishedTab).toHaveAttribute("aria-selected", "true");
  await expect(examCards).toHaveCount(3);
  await expect(examCards.first().getByRole("heading", { name: "计算机网络" })).toBeVisible();
  await expect(examCards.first().getByText("考试中", { exact: true })).toBeVisible();
  await expect(examCards.first().getByText("研究生楼B301 · 07")).toBeVisible();
  await expect(examCards.first().getByText("COMP2003", { exact: true })).toBeVisible();
  await expect(examCards.first().getByText("南校区", { exact: true })).toHaveCount(0);
  await expect(
    page
      .getByRole("article", { name: "竞赛选拔模拟考试，未开始" })
      .getByRole("button", { name: "编辑" }),
  ).toBeVisible();
  await expect(examCards.first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(examCards.nth(1)).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(examCards.first().locator(".exam-card__status")).toHaveCSS(
    "background-color",
    "rgb(235, 244, 239)",
  );
  await expect(examCards.nth(1).locator(".exam-card__status")).toHaveCSS(
    "background-color",
    "rgb(233, 243, 252)",
  );
  await expect(examCards.first()).toHaveCSS("border-radius", "8px");
  await expect
    .poll(() => examCards.first().evaluate((card) => getComputedStyle(card).boxShadow))
    .not.toBe("none");
  const cardLayout = await examCards.first().evaluate((card) => {
    const box = (selector: string) =>
      card.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    const date = box(".exam-card__date");
    const status = box(".exam-card__status");
    const title = box(".exam-card__title");
    const venue = box(".exam-card__venue");
    const meta = box(".exam-card__meta");
    const time = box(".exam-card__time");
    return {
      leftOffsets: [date.left - title.left, title.left - meta.left],
      rightOffsets: [status.right - venue.right, venue.right - time.right],
      rowCenters: [
        Math.abs(date.top + date.height / 2 - (status.top + status.height / 2)),
        Math.abs(title.top + title.height / 2 - (venue.top + venue.height / 2)),
        Math.abs(meta.top + meta.height / 2 - (time.top + time.height / 2)),
      ],
    };
  });
  expect(cardLayout.leftOffsets.every((offset) => Math.abs(offset) <= 0.5)).toBe(true);
  expect(cardLayout.rightOffsets.every((offset) => Math.abs(offset) <= 0.5)).toBe(true);
  expect(cardLayout.rowCenters.every((offset) => offset <= 4)).toBe(true);
  await expect(addCard).toHaveText("添加");
  expect(
    await page
      .locator(".exam-list")
      .evaluate((list) => list.firstElementChild?.classList.contains("exam-add-card")),
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-exams-top.png`,
    fullPage: false,
  });

  await addCard.scrollIntoViewIfNeeded();
  const addCardLayout = await addCard.evaluate((button) => {
    const icon = button.querySelector("svg")!;
    const label = button.querySelector("span")!;
    const buttonBox = button.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    return {
      height: buttonBox.height,
      horizontalOffset: Math.abs(
        buttonBox.left + buttonBox.width / 2 - (iconBox.left + (labelBox.right - iconBox.left) / 2),
      ),
      verticalOffsets: [
        Math.abs(buttonBox.top + buttonBox.height / 2 - (iconBox.top + iconBox.height / 2)),
        Math.abs(buttonBox.top + buttonBox.height / 2 - (labelBox.top + labelBox.height / 2)),
      ],
      labelGap: labelBox.left - iconBox.right,
    };
  });
  expect(addCardLayout.height).toBeGreaterThanOrEqual(44);
  expect(addCardLayout.height).toBeLessThanOrEqual(45);
  expect(addCardLayout.horizontalOffset).toBeLessThanOrEqual(0.5);
  expect(addCardLayout.verticalOffsets.every((offset) => offset <= 0.5)).toBe(true);
  expect(addCardLayout.labelGap).toBeGreaterThanOrEqual(6);
  const unfinishedFootnotes = page.getByRole("note", { name: "未结束考试安排说明" });
  await expect(unfinishedFootnotes.getByRole("listitem")).toHaveText([
    "*非自定义考试安排数据来源于教务系统。",
  ]);
  await expect(unfinishedFootnotes).toHaveCSS("margin-top", "12px");
  await unfinishedFootnotes.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-exams-unfinished-end.png`,
    fullPage: false,
  });

  await unfinishedTab.focus();
  await page.keyboard.press("End");
  await expect(finishedTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("已结束");
  await expect(examCards).toHaveCount(10);
  await expect(examCards.getByRole("heading")).toHaveText([
    "数据结构",
    "专业能力模拟考试",
    "编译原理",
    "人工智能导论与机器学习模型设计综合考试",
    "历史考试安排 1",
    "历史考试安排 2",
    "历史考试安排 3",
    "历史考试安排 4",
    "历史考试安排 5",
    "历史考试安排 6",
  ]);
  const completedExam = page.getByRole("article", { name: "数据结构，已结束" });
  await expect(completedExam).toBeVisible();
  await expect(completedExam).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(completedExam.locator(".exam-card__status")).toHaveCSS(
    "background-color",
    "rgb(234, 240, 244)",
  );
  await expect(
    page
      .getByRole("article", { name: "专业能力模拟考试，已结束" })
      .getByRole("button", { name: "编辑" }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("article", { name: "专业能力模拟考试，已结束" })
      .getByRole("button", { name: "删除" }),
  ).toBeEnabled();
  const longVenueExam = page.getByRole("article", { name: "编译原理，已结束" });
  await expect(
    longVenueExam.getByText("信息科学与工程学院实验中心东区综合楼208 · 26"),
  ).toBeVisible();
  const longTitleExam = page.getByRole("article", {
    name: "人工智能导论与机器学习模型设计综合考试，已结束",
  });
  await expect(longTitleExam).toBeVisible();
  for (const card of [longVenueExam, longTitleExam]) {
    await expect
      .poll(() =>
        card.evaluate((element) => {
          const title = element.querySelector(".exam-card__title")!.getBoundingClientRect();
          const venue = element.querySelector(".exam-card__venue")!.getBoundingClientRect();
          return Math.abs(title.top + title.height / 2 - (venue.top + venue.height / 2));
        }),
      )
      .toBeLessThanOrEqual(1);
  }
  const loadMore = page.getByRole("button", { name: "加载更多" });
  await expect(loadMore).toBeVisible();
  await expect(page.getByRole("button", { name: "添加考试安排" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-exams-finished-initial.png`,
    fullPage: false,
  });

  const nextPageResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/exam") &&
      url.searchParams.get("type") === "end" &&
      url.searchParams.get("offset") === "10"
    );
  });
  await loadMore.click();
  expect((await nextPageResponse).ok()).toBe(true);
  await expect(examCards).toHaveCount(14);
  await expect(loadMore).toHaveCount(0);
  const invalidExam = page.getByRole("article", { name: "操作系统，已失效" });
  await expect(invalidExam.getByText("已失效", { exact: true })).toBeVisible();
  await expect(invalidExam.getByText("信息可能已调整", { exact: true })).toHaveCount(0);
  await expect(invalidExam).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(invalidExam.locator(".exam-card__status")).toHaveCSS(
    "background-color",
    "rgb(255, 243, 224)",
  );
  await expect(page.getByRole("article", { name: "数据库系统，已失效" })).toBeVisible();
  const longExam = page.getByRole("article", {
    name: "跨平台软件工程与云原生分布式系统设计综合考试，已失效",
  });
  await expect(longExam).toBeVisible();
  await expect(longExam.getByText("新校区第二教学实验综合楼北区302考场 · 24")).toBeVisible();
  const finishedFootnotes = page.getByRole("note", { name: "已结束考试安排说明" });
  await expect(finishedFootnotes.getByRole("listitem")).toHaveText([
    "*非自定义考试安排数据来源于教务系统。",
    "*已失效的考试安排是原来出现于教务系统，但是可能由于考试安排信息发生更改或是到了新的学期，之前的考试安排已经不存在，微生活将其标记为“已失效”。",
  ]);
  await expect(finishedFootnotes).toHaveCSS("margin-top", "12px");
  await finishedFootnotes.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-exams-finished.png`,
    fullPage: false,
  });

  await unfinishedTab.click();
  await addCard.click();
  await expect(page.getByRole("dialog", { name: "添加考试安排" })).toBeVisible();
});

test("login opens a populated schedule and service pages", async ({ page }, testInfo) => {
  test.slow();
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
  const discreteMath = page.getByRole("button", {
    name: /离散数学，周五，第 1-2 节.*非本周/,
  });
  await expect(discreteMath).toBeVisible();
  await expect(discreteMath).toHaveClass(/is-inactive/);
  const concurrentCourse = page.getByRole("button", {
    name: /程序设计方法，周三，第 3-4 节.*此时段共有 2 门课程/,
  });
  await expect(concurrentCourse).toBeVisible();
  await expect(concurrentCourse).toHaveClass(/has-course-stack/);
  await expect(concurrentCourse).not.toHaveClass(/has-conflicts/);
  await expect(concurrentCourse.locator(".schedule-course__conflict-count")).toHaveCount(0);
  const actualConflictCourse = page.getByRole("button", {
    name: /数据库系统，周四，第 3-4 节.*此时段共有 2 门课程/,
  });
  await expect(actualConflictCourse).toHaveClass(/has-course-stack/);
  await expect(actualConflictCourse).toHaveClass(/has-conflicts/);
  const conflictCount = actualConflictCourse.locator(".schedule-course__conflict-count");
  await expect(conflictCount).toHaveText("+1");
  await expect(conflictCount).toHaveAttribute("aria-hidden", "true");
  const conflictCountLayout = await actualConflictCourse.evaluate((course) => {
    const marker = course.querySelector<HTMLElement>(".schedule-course__conflict-count")!;
    const place = course.querySelector<HTMLElement>(".schedule-course__place")!;
    const courseBox = course.getBoundingClientRect();
    const markerBox = marker.getBoundingClientRect();
    const placeBox = place.getBoundingClientRect();
    return {
      bottomInset: courseBox.bottom - markerBox.bottom,
      fontSize: Number.parseFloat(getComputedStyle(marker).fontSize),
      height: markerBox.height,
      leftInset: markerBox.left - courseBox.left,
      markerTop: markerBox.top,
      placeBottom: placeBox.bottom,
    };
  });
  expect(conflictCountLayout.fontSize).toBe(9);
  expect(conflictCountLayout.height).toBe(16);
  expect(conflictCountLayout.leftInset).toBeGreaterThanOrEqual(3);
  expect(conflictCountLayout.leftInset).toBeLessThanOrEqual(5);
  expect(conflictCountLayout.bottomInset).toBeGreaterThanOrEqual(1);
  expect(conflictCountLayout.bottomInset).toBeLessThanOrEqual(3);
  expect(conflictCountLayout.markerTop).toBeGreaterThanOrEqual(conflictCountLayout.placeBottom);
  const threeCourseStack = page.getByRole("button", {
    name: /分布式系统，周一，第 5-6 节.*此时段共有 3 门课程/,
  });
  await expect(threeCourseStack).toHaveClass(/has-course-stack/);
  await expect(threeCourseStack).not.toHaveClass(/has-conflicts/);
  await expect(threeCourseStack.locator(".schedule-course__conflict-count")).toHaveCount(0);
  const foldedCorner = await concurrentCourse.evaluate((course) => {
    const marker = getComputedStyle(course, "::after");
    return {
      width: marker.width,
      height: marker.height,
      background: marker.backgroundImage,
    };
  });
  expect(foldedCorner).toMatchObject({ width: "16px", height: "16px" });
  expect(foldedCorner.background).toContain("linear-gradient");
  expect(foldedCorner.background).toContain("rgb(234, 240, 244)");
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
  expect(scheduleVisual.headerShadow).toBe("none");
  expect(scheduleVisual.weekdaysBorder).toBe("1px");
  expect(scheduleVisual.dayBorder).toBe("0px");
  expect(scheduleVisual.periodBorder).toBe("0px");
  expect(scheduleVisual.slotBackground).toBe("rgb(255, 255, 255)");
  expect(scheduleVisual.slotHeight).toBeCloseTo(74, 2);
  expect(scheduleVisual.todayIndicatorColor).toBe("rgb(49, 140, 202)");
  expect(scheduleVisual.todayIndicatorHeight).toBe("3px");
  expect(scheduleVisual.courseShadow).toBe("none");
  await page.getByRole("button", { name: "下一周" }).click();
  await expect(page.locator(".schedule-grid__day.is-today")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /编译原理，周三，第 3-4 节.*此时段共有 2 门课程/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "上一周" }).click();
  await expect(page.locator(".schedule-grid__day.is-today")).toHaveCount(1);
  await expect(concurrentCourse).toBeVisible();
  await page.locator("#main-content").evaluate((main) => {
    const header = main.querySelector<HTMLElement>(".page-header")!;
    const weekdays = main.querySelector<HTMLElement>(".schedule-weekdays")!;
    main.scrollTop +=
      weekdays.getBoundingClientRect().top - header.getBoundingClientRect().bottom + 2;
  });
  await expect(page.locator(".schedule-page")).toHaveClass(/is-weekdays-pinned/);
  await expect(page.locator(".page-header")).toHaveClass(/is-scrolled/);
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
  await expect(page.locator(".page-header")).not.toHaveClass(/is-scrolled/);
  await expect(page.locator(".schedule-header-week")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".page-header")).toHaveCSS("box-shadow", "none");
  await concurrentCourse.click();
  const concurrentDetails = page.getByRole("dialog", { name: "程序设计方法" });
  await expect(concurrentDetails).toHaveClass(/modal--course-detail/);
  await expect(concurrentDetails.locator(".schedule-detail-card")).toHaveCount(2);
  const activeDetailCard = concurrentDetails.getByRole("article", {
    name: "程序设计方法，本周上课",
  });
  const inactiveDetailCard = concurrentDetails.getByRole("article", {
    name: "编译原理，第 2 周不上课",
  });
  await expect
    .poll(() =>
      concurrentDetails.evaluate(
        (dialog) =>
          document.activeElement === dialog ||
          (document.activeElement !== null && dialog.contains(document.activeElement)),
      ),
    )
    .toBe(true);
  const activeCourseColorClass = await concurrentCourse.evaluate((course) =>
    [...course.classList].find((name) => name.startsWith("schedule-course--color-")),
  );
  expect(activeCourseColorClass).toBeDefined();
  expect(
    await activeDetailCard.evaluate((card) =>
      [...card.classList].find((name) => name.startsWith("schedule-course--color-")),
    ),
  ).toBe(activeCourseColorClass);
  const compactDetailStyle = await activeDetailCard.evaluate((card) => {
    const cardStyle = getComputedStyle(card);
    const metadata = card.querySelector<HTMLElement>("header > p")!;
    const facts = card.querySelector<HTMLElement>(".schedule-detail-card__facts")!;
    return {
      factsMarginTop: getComputedStyle(facts).marginTop,
      metadataFontSize: getComputedStyle(metadata).fontSize,
      padding: [
        cardStyle.paddingTop,
        cardStyle.paddingRight,
        cardStyle.paddingBottom,
        cardStyle.paddingLeft,
      ],
    };
  });
  expect(compactDetailStyle).toEqual({
    factsMarginTop: "20px",
    metadataFontSize: "12px",
    padding: ["24px", "24px", "20px", "24px"],
  });
  await expect(inactiveDetailCard).toHaveCSS("background-color", "rgb(112, 112, 112)");
  await expect(inactiveDetailCard).not.toContainText(/第 2 周不上(?:这门)?课/);
  await expect(concurrentDetails.getByRole("button", { name: "关闭" })).toHaveCount(0);
  const longRemark = activeDetailCard.getByText(/^备注：请在课前完成课程平台中的预习任务/);
  await expect(longRemark).toContainText("下一次上课前补齐全部课堂任务。");
  const longContentLayout = await activeDetailCard.evaluate((card) => ({
    backgroundAttachment: getComputedStyle(card).backgroundAttachment,
    clientHeight: card.clientHeight,
    scrollHeight: card.scrollHeight,
    scrollbarWidth: getComputedStyle(card, "::-webkit-scrollbar").width,
  }));
  expect(longContentLayout.backgroundAttachment).toBe("local, local, scroll, scroll");
  expect(longContentLayout.scrollHeight).toBeGreaterThan(longContentLayout.clientHeight);
  expect(longContentLayout.scrollbarWidth).toBe("4px");
  const detailTrack = concurrentDetails.locator(".modal__body");
  await expect(detailTrack).toHaveCSS("overflow-x", "auto");
  const detailLayout = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(".schedule-detail-card")].map(
      (card) => {
        const box = card.getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          left: box.left,
          right: box.right,
          width: box.width,
          height: box.height,
        };
      },
    );
    const bodyBox = document
      .querySelector<HTMLElement>(".modal--course-detail .modal__body")!
      .getBoundingClientRect();
    const dialogBox = document
      .querySelector<HTMLElement>(".modal--course-detail")!
      .getBoundingClientRect();
    const backdropPoint = {
      x: 4,
      y: (cards[0].top + cards[0].bottom) / 2,
    };
    const hitTarget = document.elementFromPoint(backdropPoint.x, backdropPoint.y);
    return {
      first: cards[0],
      second: cards[1],
      topClearance: cards[0].top - bodyBox.top,
      bottomClearance: bodyBox.bottom - cards[0].bottom,
      cardShadow: getComputedStyle(document.querySelector<HTMLElement>(".schedule-detail-card")!)
        .boxShadow,
      backdropPoint,
      backdropHitClass: hitTarget instanceof HTMLElement ? hitTarget.className : "",
      backdropPointInsideDialog:
        backdropPoint.x >= dialogBox.left &&
        backdropPoint.x <= dialogBox.right &&
        backdropPoint.y >= dialogBox.top &&
        backdropPoint.y <= dialogBox.bottom,
      viewportWidth: window.innerWidth,
    };
  });
  expect(detailLayout.first.width).toBeGreaterThan(240);
  expect(detailLayout.first.width).toBeLessThan(270);
  expect(detailLayout.first.height).toBeGreaterThan(520);
  expect(detailLayout.topClearance).toBeGreaterThanOrEqual(11);
  expect(detailLayout.bottomClearance).toBeGreaterThanOrEqual(23);
  expect(detailLayout.cardShadow).not.toBe("none");
  expect(detailLayout.second.left).toBeLessThan(detailLayout.viewportWidth);
  expect(detailLayout.second.right).toBeGreaterThan(detailLayout.viewportWidth);
  expect(detailLayout.backdropPointInsideDialog).toBe(true);
  expect(detailLayout.backdropHitClass).toContain("modal__body");
  await expect(concurrentDetails).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-course-details.png`,
    fullPage: false,
  });
  const initialTrackScrollLeft = await detailTrack.evaluate((track) => track.scrollLeft);
  await swipe(
    page,
    {
      x: detailLayout.first.left + detailLayout.first.width / 2,
      y: detailLayout.first.bottom - 48,
    },
    { x: 0, y: -360 },
  );
  await expect.poll(() => activeDetailCard.evaluate((card) => card.scrollTop)).toBeGreaterThan(0);
  await expect
    .poll(() =>
      activeDetailCard.evaluate((card) => card.scrollHeight - card.clientHeight - card.scrollTop),
    )
    .toBeLessThanOrEqual(1);
  expect(await detailTrack.evaluate((track) => track.scrollLeft)).toBeCloseTo(
    initialTrackScrollLeft,
    0,
  );
  await expect(longRemark).toBeInViewport();
  const [scrolledCardBox, longRemarkBox] = await Promise.all([
    activeDetailCard.boundingBox(),
    longRemark.boundingBox(),
  ]);
  expect(scrolledCardBox).not.toBeNull();
  expect(longRemarkBox).not.toBeNull();
  expect(longRemarkBox!.y + longRemarkBox!.height).toBeLessThanOrEqual(
    scrolledCardBox!.y + scrolledCardBox!.height - 19,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-course-details-long-remark.png`,
    fullPage: false,
  });
  await swipe(
    page,
    {
      x: detailLayout.first.left + detailLayout.first.width / 2,
      y: (detailLayout.first.top + detailLayout.first.bottom) / 2,
    },
    { x: -190, y: 0 },
  );
  await expect
    .poll(async () => {
      const box = await inactiveDetailCard.boundingBox();
      return box ? Math.abs(box.x + box.width / 2 - detailLayout.viewportWidth / 2) : Infinity;
    })
    .toBeLessThanOrEqual(2);
  await expect(concurrentDetails).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-course-details-inactive.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(concurrentDetails).toBeHidden();
  await expect(concurrentCourse).toBeFocused();
  await concurrentCourse.click();
  await expect(concurrentDetails).toBeVisible();
  await page.mouse.click(detailLayout.backdropPoint.x, detailLayout.backdropPoint.y);
  await expect(concurrentDetails).toBeHidden();
  await expect(concurrentCourse).toBeFocused();
  await networkCourse.click();
  const courseDetails = page.getByRole("dialog", { name: "计算机网络" });
  await expect(courseDetails).toContainText("信科楼 201");
  await expect(courseDetails).toContainText("陈老师");
  await expect(courseDetails.getByRole("button", { name: "关闭" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(courseDetails).toBeHidden();
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
  await expect(page).toHaveURL(/\/schedule\?xn=2025&xq=3$/);
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
    ["/services/dorm", "宿舍与电量"],
    ["/services/network", "校园网"],
    ["/services/exams", "考试安排"],
    ["/services/gym/grade", "体测成绩"],
    ["/services/gym/appointment", "体测预约"],
    ["/services/gym/standard", "体测标准"],
    ["/services/lab/schedule", "实验安排"],
    ["/services/lab/grade", "实验成绩"],
    ["/services/rooms", "空教室"],
    ["/services/calendar", "校历"],
  ] as const;

  for (const [url, title] of services) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
  await page.goto("/services/lab");
  await expect(page.getByRole("heading", { name: "页面不存在", exact: true })).toBeVisible();

  await page.goto("/services/lab/schedule");
  await expect(page.getByRole("heading", { name: "实验安排", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "安排列表", exact: true })).toBeVisible();
  await expect(page.getByText("示波器的使用", { exact: true })).toBeVisible();
  await expect(page.getByLabel("实验平台密码")).toBeVisible();
  await expect(page.getByText("实验报告", { exact: true })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-lab-schedule.png`,
    fullPage: true,
    animations: "disabled",
  });

  await page.goto("/services/lab/grade");
  await expect(page.getByRole("heading", { name: "实验成绩", exact: true })).toBeVisible();
  await expect(page.getByRole("banner").locator("p")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "2026-2027 学年 秋季学期", exact: true }),
  ).toBeVisible();
  const labSummary = page.locator(".lab-course-summary");
  await expect(labSummary).toContainText("大学物理实验");
  await expect(labSummary).toContainText("92");
  await expect(labSummary).toContainText("总评");
  await expect(page.getByText("出勤 正常", { exact: true })).toBeVisible();
  await expect(page.getByText("实验报告", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("实验平台密码")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "切换学期，当前为2026-2027 秋季学期" }).click();
  const labSemesterDialog = page.getByRole("dialog", { name: "选择学期" });
  await expect(
    labSemesterDialog.getByRole("button", { name: "2026-2027 秋季学期，当前学期" }),
  ).toHaveAttribute("aria-pressed", "true");
  await labSemesterDialog.getByRole("button", { name: "2025-2026 春季学期" }).click();
  await expect(page).toHaveURL(/\/services\/lab\/grade\?xn=2025&xq=3$/);
  await expect(
    page.getByRole("heading", { name: "2025-2026 学年 春季学期", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("电子电路实验", { exact: true })).toBeVisible();
  await expect(page.getByText("出勤 请假", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "切换学期，当前为2025-2026 春季学期" }).click();
  await page
    .getByRole("dialog", { name: "选择学期" })
    .getByRole("button", { name: "2026-2027 秋季学期，当前学期" })
    .click();
  await expect(page).toHaveURL(/\/services\/lab\/grade$/);
  await page.getByRole("button", { name: "查看示波器的使用评分组成" }).click();
  const labDetailDialog = page.getByRole("dialog", { name: "示波器的使用" });
  await expect(labDetailDialog.getByText("出勤 正常", { exact: true })).toBeVisible();
  await expect(labDetailDialog.getByText("实验报告", { exact: true })).toBeVisible();
  await expect(labDetailDialog.getByText("94", { exact: true })).toBeVisible();
  await labDetailDialog.getByRole("button", { name: "关闭" }).click();
  await expect(labDetailDialog).toBeHidden();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-lab-grade.png`,
    fullPage: true,
    animations: "disabled",
  });

  await page.goto("/services/gym/grade");
  await expect(page.getByRole("banner").locator("p")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "2026-2027 学年", exact: true })).toBeVisible();
  const gymSummary = page.locator(".gym-grade-summary");
  await expect(gymSummary.locator(".gym-grade-summary__score-value strong")).toHaveText("88");
  await expect(gymSummary.getByText("年度体质健康测试")).toHaveCount(0);
  await expect(gymSummary.getByText("已完成", { exact: true })).toHaveCount(0);
  await expect(gymSummary.getByText("本学年体质测试已完成，耐力项目仍有提升空间。")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "单项成绩" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "视力情况" })).toHaveCount(0);
  const gymMetrics = page.locator(".gym-grade-metrics");
  await expect
    .poll(() => gymMetrics.evaluate((grid) => getComputedStyle(grid).boxShadow))
    .not.toBe("none");
  const sprintMetric = page.getByRole("group", {
    name: "50 米跑，成绩 7.1 秒，90 分，占比 20%，优秀",
  });
  await expect(sprintMetric.locator(".metric__value")).toHaveText("7.1 秒");
  await expect(sprintMetric.getByText("90 分 / 占比 20%", { exact: true })).toBeVisible();
  const successBadge = sprintMetric.getByText("优秀", { exact: true });
  await expect(successBadge).toHaveClass(/(?:^| )badge--success(?: |$)/);
  await expect(successBadge).toHaveCSS("color", "rgb(39, 109, 76)");
  await expect(successBadge).toHaveCSS("margin-top", "4px");
  const enduranceMetric = page.getByRole("group", {
    name: "耐力跑，成绩 4 分 05 秒，72 分，占比 20%，及格",
  });
  const dangerBadge = enduranceMetric.getByText("及格", { exact: true });
  await expect(dangerBadge).toHaveClass(/(?:^| )badge--danger(?: |$)/);
  await expect(dangerBadge).toHaveCSS("color", "rgb(156, 52, 68)");
  await expect(page.getByText(/^前 \d+%$/)).toHaveCount(0);
  const gymReport = page.getByRole("region", { name: "体测报告信息" });
  await expect(page.locator(".gym-grade-metrics + .gym-grade-report")).toHaveCount(1);
  await expect(gymReport.locator(".data-row")).toHaveCount(3);
  await expect(gymReport.getByText("成绩状态", { exact: true })).toBeVisible();
  await expect(gymReport.getByText("已完成", { exact: true })).toHaveClass(/data-row__value/);
  await expect(gymReport.getByText("已完成", { exact: true })).not.toHaveClass(/badge/);
  await expect(gymReport.getByText("成绩类型", { exact: true })).toBeVisible();
  await expect(gymReport.getByText("年度体质健康测试", { exact: true })).toBeVisible();
  await expect(gymReport.getByText("成绩描述", { exact: true })).toBeVisible();
  await expect(
    gymReport.getByText("本学年体质测试已完成，耐力项目仍有提升空间。", { exact: true }),
  ).toBeVisible();
  await gymReport.scrollIntoViewIfNeeded();
  await expect(gymReport).toBeInViewport();
  const [gymReportBox, mainContentBox, mainNavigationBox] = await Promise.all([
    gymReport.boundingBox(),
    page.locator("#main-content").boundingBox(),
    page.getByRole("navigation", { name: "主导航" }).boundingBox(),
  ]);
  expect(gymReportBox && mainContentBox && mainNavigationBox).not.toBeNull();
  expect(gymReportBox!.y).toBeGreaterThanOrEqual(mainContentBox!.y);
  expect(gymReportBox!.y + gymReportBox!.height).toBeLessThanOrEqual(mainNavigationBox!.y);
  const reportRowsFit = await gymReport.evaluate((report) => {
    const reportBox = report.getBoundingClientRect();
    return [...report.querySelectorAll<HTMLElement>(".data-row")].every((row) => {
      const rowBox = row.getBoundingClientRect();
      return (
        rowBox.left >= reportBox.left &&
        rowBox.right <= reportBox.right &&
        [...row.querySelectorAll<HTMLElement>("dt, dd")].every((item) => {
          const itemBox = item.getBoundingClientRect();
          return (
            itemBox.left >= rowBox.left &&
            itemBox.right <= rowBox.right &&
            itemBox.top >= rowBox.top &&
            itemBox.bottom <= rowBox.bottom
          );
        })
      );
    });
  });
  expect(reportRowsFit).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-grade-report.png`,
    fullPage: false,
    animations: "disabled",
  });
  const eyeMetric = page.getByRole("button", {
    name: "查看视力详情，裸眼视力左眼 4.9，右眼 5.0",
  });
  await eyeMetric.click();
  const eyeDialog = page.getByRole("dialog", { name: "视力详情" });
  await expect(eyeDialog.getByText("裸眼视力")).toBeVisible();
  await expect(eyeDialog.getByText("戴镜视力")).toBeVisible();
  await expect(eyeDialog.getByText("屈光状态")).toBeVisible();
  await expect(eyeDialog.getByText("-1.25D")).toBeVisible();
  await expect(eyeDialog).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-grade-eye-detail.png`,
    fullPage: false,
  });
  await eyeDialog.getByRole("button", { name: "关闭" }).click();
  await expect(eyeMetric).toBeFocused();
  await page.locator("#main-content").evaluate((main) => {
    main.scrollTop = 0;
  });
  await expect.poll(() => page.locator("#main-content").evaluate((main) => main.scrollTop)).toBe(0);
  await expect(page.getByRole("heading", { name: "2026-2027 学年", exact: true })).toBeVisible();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-gym-grade.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "切换学年，当前为2026-2027 学年" }).click();
  await page
    .getByRole("dialog", { name: "选择学年" })
    .getByRole("button", { name: "2025-2026 学年" })
    .click();
  await expect(page).toHaveURL(/\/services\/gym\/grade\?xn=2025$/);
  await expect(page.getByRole("heading", { name: "2025-2026 学年", exact: true })).toBeVisible();
  await expect(page.locator(".gym-grade-summary__score-value strong")).toHaveText("85");
  await expectNoHorizontalOverflow(page);
  await page.goto("/services");
  await expect(page.getByRole("heading", { name: "服务", exact: true })).toBeVisible();
  await expect(page.getByText("校内邮箱")).toHaveCount(0);
  await expect(page.getByText("积分中心")).toHaveCount(0);
  await expect(page.getByText("问题反馈")).toHaveCount(0);
  await expect(page.getByText("关于微生活")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /校园公告/ })).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-services.png`,
    fullPage: true,
  });

  await page.goto("/services/announcements");
  await expect(page.getByRole("heading", { name: "页面不存在", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "我的", exact: true }).click();
  await expect(page.getByRole("heading", { name: "我的", exact: true })).toBeVisible();
  const profileCard = page.locator(".profile-account-card");
  const profileHeader = page.locator(".profile-page .page-header");
  await expect(profileHeader.locator("p")).toHaveCount(0);
  await expect(profileCard.getByRole("heading", { name: "张同学" })).toBeVisible();
  const profileCollege = profileCard.getByText("信息科学与工程学院");
  const profileStudentId = profileCard.getByText("202208010101", { exact: true });
  await expect(profileCollege).toBeVisible();
  await expect(profileStudentId).toBeVisible();
  await expect(profileCard.getByText("学号", { exact: true })).toHaveCount(0);
  await expect(profileCollege).toHaveCSS("font-size", "14px");
  await expect(profileStudentId).toHaveCSS("font-size", "11px");
  await expect(page.getByText("校园账号已绑定")).toHaveCount(0);
  await expect(profileHeader).toHaveCSS("background-color", "rgb(45, 99, 138)");
  await expect(profileCard).toHaveCSS("border-radius", "0px");
  await expect(profileCard).toHaveCSS("box-shadow", "none");
  await expect(profileCard.locator(".profile-account-card__top")).toHaveCSS(
    "background-color",
    "rgb(45, 99, 138)",
  );
  await expect(profileCard.locator(".profile-account-card__bottom")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const profileAvatar = profileCard.locator(".profile-account-card__avatar");
  await expect(profileAvatar).toHaveCSS("width", "72px");
  await expect(profileAvatar).toHaveCSS("height", "72px");
  await expect(profileAvatar).toHaveCSS("border-top-width", "2px");
  const profileLayout = await profileCard.evaluate((card) => {
    const top = card.querySelector<HTMLElement>(".profile-account-card__top")!;
    const avatar = card.querySelector<HTMLElement>(".profile-account-card__avatar")!;
    const name = top.querySelector<HTMLElement>("h2")!;
    const studentId = top.querySelector<HTMLElement>(".profile-account-card__student-id")!;
    const college = card.querySelector<HTMLElement>(".profile-account-card__college")!;
    const header = card.previousElementSibling as HTMLElement;
    const appShell = card.closest<HTMLElement>(".app-shell")!;
    const cardBounds = card.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const appBounds = appShell.getBoundingClientRect();
    const dividerY = top.getBoundingClientRect().bottom;
    const avatarBounds = avatar.getBoundingClientRect();
    return {
      avatarCenterY: avatarBounds.top + avatarBounds.height / 2,
      avatarRight: avatarBounds.right,
      cardLeftInset: cardBounds.left - appBounds.left,
      cardRightInset: appBounds.right - cardBounds.right,
      collegeLeft: college.getBoundingClientRect().left,
      collegeTop: college.getBoundingClientRect().top,
      dividerY,
      headerGap: cardBounds.top - headerBounds.bottom,
      nameBottom: name.getBoundingClientRect().bottom,
      nameLeft: name.getBoundingClientRect().left,
      studentIdBottom: studentId.getBoundingClientRect().bottom,
      studentIdTop: studentId.getBoundingClientRect().top,
    };
  });
  expect(profileLayout.dividerY - profileLayout.avatarCenterY).toBeCloseTo(4, 1);
  expect(profileLayout.cardLeftInset).toBeCloseTo(0, 1);
  expect(profileLayout.cardRightInset).toBeCloseTo(0, 1);
  expect(profileLayout.headerGap).toBeCloseTo(0, 1);
  expect(profileLayout.studentIdTop).toBeGreaterThanOrEqual(profileLayout.nameBottom);
  expect(profileLayout.dividerY - profileLayout.studentIdBottom).toBeCloseTo(6, 1);
  expect(profileLayout.collegeTop - profileLayout.dividerY).toBeCloseTo(6, 1);
  expect(profileLayout.nameLeft - profileLayout.avatarRight).toBeCloseTo(24, 1);
  expect(profileLayout.collegeLeft - profileLayout.avatarRight).toBeCloseTo(24, 1);
  await expect(page.getByRole("heading", { name: "更多应用" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "账号与应用" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /积分中心/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /问题反馈/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /关于微生活/ })).toBeVisible();
  const supportSection = page
    .getByRole("heading", { name: "支持与信息" })
    .locator("xpath=ancestor::section");
  const logoutButton = supportSection.getByRole("button", { name: /退出登录/ });
  await expect(logoutButton).toBeVisible();
  await expect(logoutButton).toHaveCSS("border-top-width", "1px");
  await expect(logoutButton).toHaveCSS("border-top-color", "rgb(223, 231, 236)");
  await expect(page.getByRole("button", { name: "解除绑定并退出" })).toHaveCount(0);
  await expect(page.getByText("学籍信息")).toHaveCount(0);
  await expect(page.getByText("计算机2201班")).toHaveCount(0);
  await expect(page.locator(".page")).toHaveCSS("opacity", "1");
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-profile.png`,
    fullPage: true,
  });

  const profileMain = page.locator("#main-content");
  await expect(profileHeader).not.toHaveClass(/is-scrolled/);
  await expect(profileHeader).toHaveCSS("box-shadow", "none");
  await profileMain.evaluate((main) => {
    main.scrollTop = 20;
  });
  await expect(profileHeader).toHaveClass(/is-scrolled/);
  await expect(profileHeader).toHaveCSS(
    "box-shadow",
    "rgba(25, 30, 38, 0.18) 0px 3px 8px 0px, rgba(25, 30, 38, 0.1) 0px 1px 3px 0px",
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-profile-scrolled.png`,
    fullPage: false,
  });

  await page.getByRole("link", { name: /积分中心/ }).click();
  await expect(page.getByRole("heading", { name: "积分中心", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("schedule clamps long names and keeps locations visible at every cell height", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  await page.route("**/api/semester", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: {
          items: [
            {
              xn: 2026,
              xq: 1,
              xq_text: "秋季学期",
              start: "2026-09-13",
              weeks: 16,
              from_zero: false,
            },
          ],
          now_xn: 2026,
          now_xq: 1,
        },
      }),
    });
  });
  await page.goto("/login");
  await page.getByLabel("学号").fill("202208010101");
  await page.getByLabel("密码").fill("mock-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/schedule?week=2");

  const twoCourseStack = page.getByRole("button", {
    name: /程序设计方法，周三，第 3-4 节.*此时段共有 2 门课程/,
  });
  const threeCourseStack = page.getByRole("button", {
    name: /分布式系统，周一，第 5-6 节.*此时段共有 3 门课程/,
  });
  for (const courseStack of [twoCourseStack, threeCourseStack]) {
    await expect(courseStack).toHaveClass(/has-course-stack/);
    await expect(courseStack).not.toHaveClass(/has-conflicts/);
    await expect(courseStack.locator(".schedule-course__conflict-count")).toHaveCount(0);
  }
  const alternateWeekCourse = page.getByRole("button", {
    name: /设计思维，周日，第 9-10 节.*此时段共有 2 门课程/,
  });
  await expect(alternateWeekCourse).toHaveClass(/has-course-stack/);
  await expect(alternateWeekCourse).not.toHaveClass(/has-conflicts/);
  await expect(alternateWeekCourse.locator(".schedule-course__conflict-count")).toHaveCount(0);
  const repeatedCourseCells = page.getByRole("button", { name: /人工智能导论/ });
  await expect(repeatedCourseCells).toHaveCount(2);
  const repeatedCourseColors = await repeatedCourseCells.evaluateAll((cells) =>
    cells.map((cell) =>
      [...cell.classList].find((name) => name.startsWith("schedule-course--color-")),
    ),
  );
  expect(new Set(repeatedCourseColors).size).toBe(1);
  const actualConflictCourse = page.getByRole("button", {
    name: /数据库系统，周四，第 3-4 节.*此时段共有 2 门课程/,
  });
  await expect(actualConflictCourse).toHaveClass(/has-conflicts/);
  await expect(actualConflictCourse.locator(".schedule-course__conflict-count")).toHaveText("+1");

  const splitLocationCourses = page.getByRole("button", {
    name: /创新创业实践/,
  });
  const firstLocationCourse = page.getByRole("button", {
    name: /创新创业实践，周六，第 3-4 节.*综203/,
  });
  const secondLocationCourse = page.getByRole("button", {
    name: /创新创业实践，周六，第 5 节.*综405/,
  });
  await expect(splitLocationCourses).toHaveCount(2);
  await expect(firstLocationCourse).toContainText("@综203");
  await expect(secondLocationCourse).toContainText("@综405");
  await expect
    .poll(() => firstLocationCourse.evaluate((course) => course.style.gridRow))
    .toBe("3 / span 2");
  await expect
    .poll(() => secondLocationCourse.evaluate((course) => course.style.gridRow))
    .toBe("5 / span 1");

  const singlePeriod = page.getByRole("button", {
    name: /跨学科软件工程综合创新实践与复杂系统设计，周二，第 11 节/,
  });
  const doublePeriod = page.getByRole("button", {
    name: /面向复杂业务场景的软件架构设计与工程实践，周五，第 11-12 节/,
  });
  await expect(singlePeriod).toHaveClass(/is-single/);
  await expect(doublePeriod).not.toHaveClass(/is-single/);
  await singlePeriod.scrollIntoViewIfNeeded();

  const coursePalette = await page.evaluate(() => {
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "-9999px";
    document.body.append(host);
    const colors = Array.from({ length: 10 }, (_, index) => {
      const swatch = document.createElement("button");
      swatch.className = `schedule-course schedule-course--color-${index}`;
      host.append(swatch);
      const style = getComputedStyle(swatch);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        filter: style.filter,
      };
    });
    host.remove();
    return colors;
  });
  expect(coursePalette).toHaveLength(10);
  for (const color of coursePalette) {
    expect(contrastRatio(color.color, color.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(color.filter).toBe("none");
  }

  const readLayout = (course: typeof singlePeriod) =>
    course.evaluate((element) => {
      const name = element.querySelector<HTMLElement>(".schedule-course__name")!;
      const place = element.querySelector<HTMLElement>(".schedule-course__place")!;
      const cardBox = element.getBoundingClientRect();
      const nameBox = name.getBoundingClientRect();
      const placeBox = place.getBoundingClientRect();
      const nameStyle = getComputedStyle(name);
      const placeStyle = getComputedStyle(place);
      const cardStyle = getComputedStyle(element);
      return {
        backgroundColor: cardStyle.backgroundColor,
        cardTop: cardBox.top,
        cardHeight: cardBox.height,
        nameColor: nameStyle.color,
        nameBottom: nameBox.bottom,
        nameFontSize: Number.parseFloat(nameStyle.fontSize),
        nameTop: nameBox.top,
        nameClamp: nameStyle.webkitLineClamp,
        nameClientHeight: name.clientHeight,
        nameOverflow: nameStyle.overflow,
        nameScrollHeight: name.scrollHeight,
        nameTextOverflow: nameStyle.textOverflow,
        placeBottom: placeBox.bottom,
        placeClamp: placeStyle.webkitLineClamp,
        placeClientHeight: place.clientHeight,
        placeLines: place.clientHeight / Number.parseFloat(placeStyle.lineHeight),
        placeFontSize: Number.parseFloat(placeStyle.fontSize),
        placeOverflow: placeStyle.overflow,
        placeScrollHeight: place.scrollHeight,
        placeTextOverflow: placeStyle.textOverflow,
        placeTop: placeBox.top,
        cardBottom: cardBox.bottom,
      };
    });

  const [singleLayout, doubleLayout] = await Promise.all([
    readLayout(singlePeriod),
    readLayout(doublePeriod),
  ]);
  await expect(singlePeriod.locator(".schedule-course__place")).toBeVisible();
  await expect(doublePeriod.locator(".schedule-course__place")).toBeVisible();

  expect(singleLayout.cardHeight).toBeCloseTo(70, 1);
  expect(singleLayout.nameTop - singleLayout.cardTop).toBeCloseTo(
    doubleLayout.nameTop - doubleLayout.cardTop,
    1,
  );
  expect(singleLayout.nameClamp).toBe("2");
  expect(singleLayout.nameFontSize).toBe(11);
  expect(singleLayout.placeClamp).toBe("1");
  expect(singleLayout.placeFontSize).toBe(9);
  expect(doubleLayout.cardHeight).toBeCloseTo(144, 1);
  expect(doubleLayout.nameClamp).toBe("5");
  expect(doubleLayout.nameFontSize).toBe(11);
  expect(doubleLayout.placeClamp).toBe("2");
  expect(doubleLayout.placeFontSize).toBe(9);
  for (const layout of [singleLayout, doubleLayout]) {
    expect(contrastRatio(layout.nameColor, layout.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(layout.nameOverflow).toBe("hidden");
    expect(layout.nameTextOverflow).toBe("ellipsis");
    expect(layout.nameScrollHeight).toBeGreaterThan(layout.nameClientHeight);
    expect(layout.placeOverflow).toBe("hidden");
    expect(layout.placeTextOverflow).toBe("ellipsis");
    expect(layout.placeScrollHeight).toBeGreaterThan(layout.placeClientHeight);
    expect(layout.placeLines).toBeGreaterThanOrEqual(0.9);
    expect(layout.placeLines).toBeLessThanOrEqual(2.05);
    expect(layout.placeTop).toBeGreaterThanOrEqual(layout.nameBottom);
    expect(layout.placeBottom).toBeLessThanOrEqual(layout.cardBottom - 2);
  }
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-long-course-cells.png`,
    fullPage: false,
  });

  await page.getByRole("button", { name: "下一周" }).click();
  const inactiveSinglePeriod = page.getByRole("button", {
    name: /跨学科软件工程综合创新实践与复杂系统设计，周二，第 11 节.*非本周/,
  });
  await inactiveSinglePeriod.scrollIntoViewIfNeeded();
  await expect(inactiveSinglePeriod).toHaveClass(/is-single.*is-inactive|is-inactive.*is-single/);
  await expect(inactiveSinglePeriod.locator(".schedule-course__place")).toBeVisible();
  await expect(inactiveSinglePeriod.locator(".schedule-course__inactive")).toHaveText("非本周");
  const inactiveSingleLayout = await readLayout(inactiveSinglePeriod);
  const inactiveStatusLayout = await inactiveSinglePeriod.evaluate((element) => {
    const place = element.querySelector<HTMLElement>(".schedule-course__place")!;
    const status = element.querySelector<HTMLElement>(".schedule-course__inactive")!;
    const card = element.getBoundingClientRect();
    const placeBox = place.getBoundingClientRect();
    const statusBox = status.getBoundingClientRect();
    return {
      backgroundColor: getComputedStyle(element).backgroundColor,
      cardBottom: card.bottom,
      placeBottom: placeBox.bottom,
      statusColor: getComputedStyle(status).color,
      statusBottom: statusBox.bottom,
      statusFontSize: Number.parseFloat(getComputedStyle(status).fontSize),
      statusTop: statusBox.top,
    };
  });
  expect(inactiveSingleLayout.nameClamp).toBe("1");
  expect(
    contrastRatio(inactiveStatusLayout.statusColor, inactiveStatusLayout.backgroundColor),
  ).toBeGreaterThanOrEqual(4.5);
  expect(inactiveStatusLayout.statusFontSize).toBe(9);
  expect(inactiveSingleLayout.placeLines).toBeGreaterThanOrEqual(0.9);
  expect(inactiveSingleLayout.placeLines).toBeLessThanOrEqual(2.05);
  expect(inactiveSingleLayout.placeTop).toBeGreaterThanOrEqual(inactiveSingleLayout.nameBottom);
  expect(inactiveStatusLayout.statusTop).toBeGreaterThanOrEqual(inactiveStatusLayout.placeBottom);
  expect(inactiveStatusLayout.statusBottom).toBeLessThanOrEqual(
    inactiveStatusLayout.cardBottom - 2,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-long-course-inactive.png`,
    fullPage: false,
  });
  const lastFootnote = page.getByRole("note", { name: "课表说明" }).getByRole("listitem").last();
  await lastFootnote.scrollIntoViewIfNeeded();
  const [lastFootnoteBounds, navigationBounds] = await Promise.all([
    lastFootnote.boundingBox(),
    page.getByRole("navigation", { name: "主导航" }).boundingBox(),
  ]);
  expect(lastFootnoteBounds).not.toBeNull();
  expect(navigationBounds).not.toBeNull();
  expect(lastFootnoteBounds!.y + lastFootnoteBounds!.height).toBeLessThanOrEqual(
    navigationBounds!.y,
  );
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

test("schedule switches weeks with horizontal swipes", async ({ page }) => {
  await login(page);
  await page.goto("/schedule?week=2");

  const swipeCalendar = async (delta: { x: number; y: number }) => {
    const calendar = page.locator(".schedule-calendar");
    await expect(calendar).toBeVisible();
    const box = await calendar.boundingBox();
    expect(box).not.toBeNull();
    const viewportHeight = page.viewportSize()?.height ?? 800;
    await swipe(
      page,
      {
        x: box!.x + (delta.x < 0 ? box!.width * 0.78 : box!.width * 0.22),
        y: Math.min(box!.y + 140, viewportHeight - 80),
      },
      delta,
    );
  };

  const courseAtSwipeStart = page.getByRole("button", { name: /计算机网络，周二/ });
  await expect(courseAtSwipeStart).toBeVisible();
  const courseBox = await courseAtSwipeStart.boundingBox();
  expect(courseBox).not.toBeNull();
  await swipe(
    page,
    {
      x: courseBox!.x + courseBox!.width / 2,
      y: courseBox!.y + Math.min(courseBox!.height / 2, 48),
    },
    { x: -100, y: 4 },
  );
  await expect(page).toHaveURL(/week=3/);
  await expect(page.getByRole("heading", { name: "第 3 周", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await swipeCalendar({ x: 4, y: 100 });
  await expect(page.getByRole("heading", { name: "第 3 周", exact: true })).toBeVisible();

  await swipeCalendar({ x: 100, y: 4 });
  await expect(page).toHaveURL(/week=2/);
  await expect(page.getByRole("heading", { name: "第 2 周", exact: true })).toBeVisible();

  await page.goto("/schedule?week=1");
  await swipeCalendar({ x: 100, y: 4 });
  await expect(page.getByRole("heading", { name: "第 1 周", exact: true })).toBeVisible();

  await page.goto("/schedule?week=16");
  await swipeCalendar({ x: -100, y: 4 });
  await expect(page.getByRole("heading", { name: "第 16 周", exact: true })).toBeVisible();
});

test("schedule labels courses without timetable entries and shows their total", async ({
  page,
}, testInfo) => {
  const longExtraCourseRemark =
    "本课程暂无固定上课时间，请加入课程通知群并持续关注课程平台公告。任课教师会根据专题进度安排线上阅读、分组讨论、资料检索、校外访谈和集中研讨，具体日期、教室、参与方式及所需材料将至少提前三天通知。每次活动前请完成指定文献阅读并提交问题清单，活动结束后还需在规定时间内上传讨论记录、阶段报告和个人反思。如遇时间或地点临时调整，请以课程平台最新公告为准；未收到通知时不要自行前往教室，并及时联系任课教师确认后续安排。课程平台会保留历史通知，但请不要只依赖截图或同学转发的消息，以免遗漏后续修订内容。若因课程冲突无法参加集中研讨，应提前提交请假说明，并按照教师要求完成替代任务；多次未查看公告或未按时反馈可能影响过程性评价，请合理安排学习时间。";
  await page.route("**/api/course/extra?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: [
          {
            course_id: "COMP2002",
            course_name: "工程实践",
            class_name: "计科2201",
            course_type: "专业选修",
            credit: 1,
            extra: null,
            area: "南校区",
            people: 30,
            teacher: "王老师",
          },
          {
            course_id: "GENERAL2003",
            course_name: "学术写作专题",
            class_name: "全校选修班",
            course_type: "通识选修",
            credit: 2,
            extra: longExtraCourseRemark,
            area: "南校区",
            people: 45,
            teacher: "赵老师",
          },
        ],
      }),
    });
  });
  await login(page);
  await page.goto("/schedule?week=2");

  await expect(page.getByRole("heading", { name: "无课表课程" })).toBeVisible();
  await expect(page.getByText("共 2 门课程")).toBeVisible();
  await expect(page.getByText("工程实践", { exact: true })).toBeVisible();
  await expect(page.getByText("学术写作专题", { exact: true })).toBeVisible();
  const extraCourseList = page.getByRole("list", { name: "无课表课程列表" });
  const extraCourseItems = extraCourseList.getByRole("listitem");
  await expect(extraCourseItems).toHaveCount(2);
  await expect(extraCourseItems.first()).toHaveCSS("border-top-width", "0px");
  await expect(extraCourseItems.nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(extraCourseItems.nth(1)).toContainText("通识选修 · 南校区 · 赵老师");
  await expect(extraCourseItems.nth(1)).not.toContainText("GENERAL2003");
  await expect(extraCourseItems.nth(1)).not.toContainText("全校选修班");
  await expect(extraCourseItems.nth(1)).not.toContainText("2 学分");
  await expect(extraCourseItems.nth(1)).not.toContainText("45 人");
  await expect(extraCourseItems.nth(1)).not.toContainText(longExtraCourseRemark);

  const footnotes = page.getByRole("note", { name: "课表说明" });
  await expect(footnotes.getByRole("listitem")).toHaveCount(6);
  await expect(footnotes).toContainText("彩色格子表示本周上课，灰色格子表示本周不上课");
  await expect(footnotes).toContainText("“我的” > “设置” > “课表设置”中开启“仅显示本周课程”");

  await extraCourseItems
    .nth(1)
    .getByRole("button", {
      name: "学术写作专题，通识选修，南校区，赵老师，查看课程详情",
    })
    .click();
  const detail = page.getByRole("dialog", { name: "学术写作专题" });
  await expect(detail).toContainText("GENERAL2003");
  await expect(detail).toContainText("全校选修班");
  await expect(detail).toContainText(longExtraCourseRemark);
  const detailRows = detail.locator(".schedule-extra-detail > .data-row");
  await expect(detailRows).toHaveCount(8);
  await expect(detailRows.first()).toHaveCSS("border-top-width", "0px");
  await expect(detailRows.nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(detailRows.last()).toHaveCSS("border-top-width", "1px");
  const remarkValue = detailRows.last().getByText(longExtraCourseRemark);
  await expect(remarkValue).toHaveCSS("text-align", "left");
  await expect(remarkValue).toHaveCSS("font-weight", "500");
  const detailBody = detail.getByRole("region", { name: "课程详细信息" });
  await expect
    .poll(() => detailBody.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-extra-detail.png`,
    fullPage: false,
    animations: "disabled",
  });
  await expect(detail.getByRole("button", { name: "关闭" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(detailBody).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect.poll(() => detailBody.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press("End");
  await expect
    .poll(() =>
      detailBody.evaluate(
        (element) => element.scrollTop + element.clientHeight >= element.scrollHeight - 1,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      remarkValue.evaluate((element) => {
        const body = element.closest<HTMLElement>(".modal__body");
        if (!body) return false;
        const elementBounds = element.getBoundingClientRect();
        const bodyBounds = body.getBoundingClientRect();
        return (
          elementBounds.bottom <= bodyBounds.bottom + 1 && elementBounds.bottom > bodyBounds.top
        );
      }),
    )
    .toBe(true);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-extra-detail-bottom.png`,
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");

  await extraCourseItems
    .first()
    .getByRole("button", {
      name: "工程实践，专业选修，南校区，王老师，查看课程详情",
    })
    .click();
  const noRemarkDetail = page.getByRole("dialog", { name: "工程实践" });
  const noRemarkRows = noRemarkDetail.locator(".schedule-extra-detail > .data-row");
  await expect(noRemarkRows).toHaveCount(7);
  await expect(noRemarkDetail.locator("dt").filter({ hasText: /^备注$/ })).toHaveCount(0);
  await expect(noRemarkDetail.getByText("无备注", { exact: true })).toHaveCount(0);
  await expect(noRemarkRows.first()).toHaveCSS("border-top-width", "0px");
  await expect(noRemarkRows.nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(noRemarkRows.last()).toHaveCSS("border-top-width", "1px");
  const noRemarkBody = noRemarkDetail.getByRole("region", { name: "课程详细信息" });
  await expect
    .poll(() =>
      noRemarkBody.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
    )
    .toBe(true);
  await noRemarkDetail.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations({ subtree: true }).map((animation) => animation.finished),
    );
  });
  const [dialogBounds, viewport, bottomSpacing] = await Promise.all([
    noRemarkDetail.boundingBox(),
    page.evaluate(() => ({ height: window.innerHeight, width: window.innerWidth })),
    noRemarkRows.last().evaluate((element) => {
      const body = element.closest<HTMLElement>(".modal__body");
      return body
        ? Math.round(body.getBoundingClientRect().bottom - element.getBoundingClientRect().bottom)
        : Number.POSITIVE_INFINITY;
    }),
  ]);
  expect(dialogBounds).not.toBeNull();
  expect(dialogBounds!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.x + dialogBounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(dialogBounds!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBounds!.y + dialogBounds!.height).toBeLessThanOrEqual(viewport.height);
  expect(bottomSpacing).toBeGreaterThanOrEqual(19);
  expect(bottomSpacing).toBeLessThanOrEqual(21);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-extra-detail-no-remark.png`,
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");

  await footnotes.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-footnotes.png`,
    fullPage: false,
  });
});

test("schedule omits the extra-course section when the response is empty", async ({
  page,
}, testInfo) => {
  await page.route("**/api/course/extra?*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: "OK", data: [] }),
    });
  });
  await login(page);
  const extraResponse = page.waitForResponse("**/api/course/extra?*");
  await page.goto("/schedule?week=2");
  await extraResponse;

  await expect(page.getByRole("heading", { name: "无课表课程" })).toHaveCount(0);
  await expect(page.getByText("没有待排课程")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "无课表课程列表" })).toHaveCount(0);
  await expect(page.locator(".schedule-extra-courses")).toHaveCount(0);
  await expect(page.locator(".schedule-calendar + .page-footnotes")).toHaveCount(1);
  const footnotes = page.getByRole("note", { name: "课表说明" });
  await expect(footnotes).toBeVisible();
  await footnotes.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-schedule-no-extra-courses.png`,
    fullPage: false,
    animations: "disabled",
  });
});

test("schedule scopes extra-course loading and errors to its section", async ({ page }) => {
  let releaseExtraCourses!: () => void;
  const extraCoursesRelease = new Promise<void>((resolve) => {
    releaseExtraCourses = resolve;
  });
  await page.route("**/api/course/extra?*", async (route) => {
    await extraCoursesRelease;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "MOCK_503" }),
    });
  });

  await login(page);
  await page.goto("/schedule?week=2");
  const extraSection = page.locator(".schedule-extra-courses");
  try {
    await expect(page.locator(".schedule-calendar")).toBeVisible();
    await expect(extraSection.getByRole("heading", { name: "无课表课程" })).toBeVisible();
    await expect(extraSection.getByRole("status", { name: "正在加载" })).toBeVisible();
    await expect(page.getByRole("note", { name: "课表说明" })).toBeVisible();
  } finally {
    releaseExtraCourses();
  }

  await expect(extraSection.getByRole("alert")).toBeVisible();
  await expect(page.locator(".schedule-calendar")).toBeVisible();
  await expect(page.getByRole("note", { name: "课表说明" })).toBeVisible();
});

test("homepage announcement loading keeps only its heading on the brand surface", async ({
  page,
}) => {
  let releaseAnnouncement!: () => void;
  const announcementRelease = new Promise<void>((resolve) => {
    releaseAnnouncement = resolve;
  });
  await page.route("**/api/announcement", async (route) => {
    await announcementRelease;
    await route.continue();
  });

  try {
    await login(page);
    const loading = page.getByRole("status", { name: "正在加载公告" });
    await expect(loading).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(loading.locator(".today-announcements__heading")).toHaveCSS(
      "background-color",
      "rgb(49, 140, 202)",
    );
    await expect(loading.locator(".skeleton").first()).toHaveCSS(
      "background-color",
      "rgb(225, 232, 237)",
    );
    await expect(loading.locator(".today-announcement-skeleton").nth(1)).toHaveCSS(
      "border-top-color",
      "rgb(223, 231, 236)",
    );
    await expect(page.getByRole("tab", { name: "今日课程" })).toBeVisible();
  } finally {
    releaseAnnouncement();
  }

  await expect(page.getByRole("region", { name: "公告" })).toBeVisible();
});

test("homepage announcement failure uses the error color scale", async ({ page }) => {
  await page.route("**/api/announcement", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "UPSTREAM_ERROR" }),
    });
  });

  await login(page);
  const announcementError = page.getByRole("alert").filter({ hasText: "公告暂时无法加载" });
  await expect(announcementError).toHaveCSS("background-color", "rgb(255, 237, 238)");
  await expect(announcementError.locator(":scope > svg")).toHaveCSS("color", "rgb(194, 77, 93)");
  await expect(announcementError.getByRole("button", { name: "重新加载公告" })).toHaveCSS(
    "color",
    "rgb(194, 77, 93)",
  );
  await expect(page.getByRole("tab", { name: "今日课程" })).toBeVisible();
});

test("today courses switch days and expose time-based card states", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-23T14:15:00"));
  await page.route("**/api/exam?type=recent", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: [
          {
            course_id: "COMP9001",
            course_name: "竞赛选拔模拟考试",
            area: "南校区",
            classroom: "研讨室201",
            date: "2026-09-25",
            start_time: "14:30",
            end_time: "16:30",
            seat: "08",
            customize_id: null,
            invalid: false,
          },
        ],
      }),
    });
  });
  await page.route("**/api/lab/schedule", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: [
          {
            seat: "12",
            name: "示波器的使用",
            course: "大学物理实验",
            teacher: "周老师",
            week: 2,
            day: 6,
            date_time: "2026-09-26 14:30",
            place: "物理实验楼205",
            phone: null,
            email: "teacher@example.edu.cn",
          },
        ],
      }),
    });
  });
  await page.route("**/api/gym/appointment", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: [
          {
            name: "体质健康测试",
            description: "携带校园卡参加测试",
            show_date: "2026年9月28日（周一）",
            time: "10:00 - 11:30",
            test_type: "两项以上",
            status: "已预约",
          },
        ],
      }),
    });
  });
  await login(page);

  const todayTab = page.getByRole("tab", { name: "今日课程" });
  const tomorrowTab = page.getByRole("tab", { name: "明日课程" });
  await expect(todayTab).toHaveAttribute("aria-selected", "true");
  const announcementRegion = page.getByRole("region", { name: "公告" });
  await expect(announcementRegion.getByRole("heading", { level: 2, name: "公告" })).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(todayTab).toHaveCSS("font-size", "16px");
  await expect(page.getByRole("heading", { name: "倒计时", exact: true })).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(announcementRegion.locator(".today-announcement")).toHaveCount(3);
  await expect(announcementRegion.locator(".today-announcement-list")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(announcementRegion.locator(".today-announcements__heading")).toHaveCSS(
    "background-color",
    "rgb(49, 140, 202)",
  );
  await expect(announcementRegion.locator(".today-announcement").first()).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(announcementRegion.locator(".today-announcement__heading h3").first()).toHaveCSS(
    "color",
    "rgb(31, 43, 52)",
  );
  await expect(announcementRegion.locator(".today-announcement__heading time").first()).toHaveCSS(
    "color",
    "rgb(100, 114, 125)",
  );
  await expect(announcementRegion.locator(".today-announcement__content").first()).toHaveCSS(
    "color",
    "rgb(31, 43, 52)",
  );
  await expect(announcementRegion.locator(".today-announcements__heading > svg")).toHaveCSS(
    "color",
    "rgb(233, 243, 252)",
  );
  await expect(announcementRegion.locator(".today-announcements__heading > svg")).toHaveCount(1);
  await expect(announcementRegion.locator(".today-announcement > svg")).toHaveCount(0);
  const announcementActions = announcementRegion.locator(".today-announcement__action");
  await expect(announcementActions).toHaveCount(2);
  await expect(announcementActions.first()).toHaveCSS("color", "rgb(45, 99, 138)");
  await expect(announcementRegion.locator(".today-announcement").nth(1)).toHaveCSS(
    "border-top-color",
    "rgb(223, 231, 236)",
  );
  await expect(announcementRegion.getByRole("heading", { level: 3 })).toHaveText([
    "服务通知",
    "校园网维护安排",
    "使用指南",
  ]);
  await expect(announcementRegion.locator(".today-announcement__heading time")).toHaveText([
    /9月22日.*08:00/,
    /9月20日.*18:00/,
    /9月18日.*10:00/,
  ]);
  const timeRightEdges = await announcementRegion
    .locator(".today-announcement__heading time")
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().right));
  expect(timeRightEdges).toHaveLength(3);
  expect(Math.max(...timeRightEdges) - Math.min(...timeRightEdges)).toBeLessThan(1);
  const multilineAnnouncement = announcementRegion.locator(".today-announcement__content").nth(1);
  await expect(multilineAnnouncement).toHaveCSS("white-space", "pre-wrap");
  await expect(multilineAnnouncement).not.toHaveClass(/text-clamp/);
  const multilineLayout = await multilineAnnouncement.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    lines: element.textContent?.split("\n").length ?? 0,
  }));
  expect(multilineLayout.lines).toBe(3);
  expect(multilineLayout.scrollHeight).toBeLessThanOrEqual(multilineLayout.clientHeight + 1);
  const shortLinkedAnnouncement = announcementRegion.locator(".today-announcement").nth(2);
  await expect(shortLinkedAnnouncement.getByText("查看详情。", { exact: true })).toBeVisible();
  const [contentBox, actionBox] = await Promise.all([
    shortLinkedAnnouncement.locator(".today-announcement__content").boundingBox(),
    shortLinkedAnnouncement.locator(".today-announcement__action").boundingBox(),
  ]);
  expect(actionBox?.width).toBeGreaterThanOrEqual(44);
  expect(actionBox?.height).toBeGreaterThanOrEqual(44);
  expect((contentBox?.x || 0) + (contentBox?.width || 0)).toBeLessThanOrEqual(actionBox?.x || 0);
  const [headerBox, announcementBox, courseSectionBox] = await Promise.all([
    page.locator(".page-header").boundingBox(),
    announcementRegion.boundingBox(),
    page.locator(".today-courses").boundingBox(),
  ]);
  const headerToAnnouncementGap =
    (announcementBox?.y || 0) - (headerBox?.y || 0) - (headerBox?.height || 0);
  expect(headerToAnnouncementGap).toBeGreaterThanOrEqual(15);
  expect(headerToAnnouncementGap).toBeLessThanOrEqual(17);
  const announcementToCourseGap =
    (courseSectionBox?.y || 0) - (announcementBox?.y || 0) - (announcementBox?.height || 0);
  expect(announcementToCourseGap).toBeGreaterThanOrEqual(15);
  expect(announcementToCourseGap).toBeLessThanOrEqual(17);
  expect((announcementBox?.y || 0) + (announcementBox?.height || 0)).toBeLessThanOrEqual(
    courseSectionBox?.y || 0,
  );
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
  const accountSection = page
    .getByRole("heading", { name: "校园账户", exact: true })
    .locator("xpath=ancestor::section");
  await expect(accountSection.getByRole("article", { name: "未读邮件，3 封" })).toBeVisible();
  await expect(
    accountSection.getByRole("link", { name: "宿舍剩余电量，186.50度" }),
  ).toHaveAttribute("href", "/services/dorm");
  await expect(accountSection.getByRole("link", { name: "校园卡金额，¥86.50" })).toHaveAttribute(
    "href",
    "/services/card",
  );
  const accountCardLayout = await accountSection
    .locator(".campus-account-card")
    .evaluateAll((cards) =>
      cards.map((card) => {
        const bounds = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return {
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
        };
      }),
    );
  expect(accountCardLayout).toHaveLength(3);
  expect(
    accountCardLayout.every(
      ({ width, height }) => Math.abs(Math.min(120, Math.max(96, width)) - height) <= 1,
    ),
  ).toBe(true);
  expect(
    accountCardLayout.every(
      ({ minHeight, maxHeight }) => minHeight === "96px" && maxHeight === "120px",
    ),
  ).toBe(true);
  expect(accountCardLayout.every(({ y }) => Math.abs(y - accountCardLayout[0].y) <= 1)).toBe(true);
  await accountSection.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-today-campus-accounts.png`,
    fullPage: false,
  });
  const recentSection = page
    .getByRole("heading", { name: "近期事项", exact: true })
    .locator("xpath=ancestor::section");
  await expect(recentSection.locator(".today-recent-row__label")).toHaveText([
    "考试",
    "实验",
    "体测预约",
  ]);
  await expect(recentSection.locator(".today-recent-row__stripe").nth(0)).toHaveCSS(
    "background-color",
    "rgb(160, 111, 41)",
  );
  await expect(recentSection.locator(".today-recent-row__stripe").nth(1)).toHaveCSS(
    "background-color",
    "rgb(64, 140, 103)",
  );
  await expect(recentSection.locator(".today-recent-row__stripe").nth(2)).toHaveCSS(
    "background-color",
    "rgb(190, 203, 212)",
  );
  await expect(recentSection.locator(".today-recent-row").nth(0)).toHaveCSS(
    "background-color",
    "rgb(255, 243, 224)",
  );
  await expect(recentSection.locator(".today-recent-row").nth(1)).toHaveCSS(
    "background-color",
    "rgb(235, 244, 239)",
  );
  await expect(recentSection.locator(".today-recent-row").nth(2)).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  const recentDividerInset = await recentSection
    .locator(".today-recent-row")
    .nth(1)
    .evaluate((row) => getComputedStyle(row, "::before").left);
  expect(recentDividerInset).toBe("6px");
  await expect(recentSection.getByRole("link", { name: /实验，示波器的使用/ })).toHaveAttribute(
    "href",
    "/services/lab/schedule",
  );
  await expect(recentSection.getByRole("link", { name: /体测预约，体质健康测试/ })).toHaveAttribute(
    "href",
    "/services/gym/appointment",
  );
  await expect(
    recentSection.getByText("9月25日(星期五) ｜ 14:30–16:30 ｜ 研讨室201"),
  ).toBeVisible();
  await expect(recentSection.getByText("9月26日(星期六) ｜ 14:30 ｜ 物理实验楼205")).toBeVisible();
  await expect(recentSection.getByText("9月28日(星期一) ｜ 10:00–11:30")).toBeVisible();
  await expect(recentSection.getByText("未读通知", { exact: true })).toHaveCount(0);
  await recentSection.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-today-recent-matters.png`,
    fullPage: false,
  });
  const gradeSection = page
    .getByRole("heading", { name: "课程成绩", exact: true })
    .locator("xpath=ancestor::section");
  const gradeList = gradeSection.getByRole("list", {
    name: "2026 秋季学期课程成绩，共 6 门",
  });
  const gradeCards = gradeList.locator(".today-grade-card");
  await expect(gradeCards).toHaveCount(6);
  await expect(
    gradeList.getByRole("link", { name: "数据结构，成绩 95，查看课程成绩" }),
  ).toHaveAttribute("href", "/services/grades");
  await expect(gradeList.getByText("数据结构", { exact: true })).toBeVisible();
  await expect(gradeSection.getByText("2026 秋季学期", { exact: true })).toHaveCount(0);
  await expect(gradeSection.getByText(/绩点|学分|必修|选修/)).toHaveCount(0);
  const firstGradeCardBox = await gradeCards.first().boundingBox();
  expect(firstGradeCardBox?.width).toBe(104);
  expect(firstGradeCardBox?.height).toBe(104);
  await expect(gradeList).toHaveCSS("scroll-snap-type", "none");
  const [mainContentBox, initialGradeTrackBox] = await Promise.all([
    page.locator("#main-content").boundingBox(),
    gradeList.boundingBox(),
  ]);
  expect(initialGradeTrackBox?.x).toBeCloseTo(mainContentBox?.x || 0, 1);
  expect((initialGradeTrackBox?.x || 0) + (initialGradeTrackBox?.width || 0)).toBeCloseTo(
    (mainContentBox?.x || 0) + (mainContentBox?.width || 0),
    1,
  );
  expect((firstGradeCardBox?.x || 0) - (initialGradeTrackBox?.x || 0)).toBeCloseTo(16, 1);
  const gradeTrackDimensions = await gradeList.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(gradeTrackDimensions.scrollWidth).toBeGreaterThan(gradeTrackDimensions.clientWidth);
  await gradeList.evaluate((element) => {
    element.scrollLeft = 37;
  });
  await expect.poll(() => gradeList.evaluate((element) => element.scrollLeft)).toBe(37);
  await gradeList.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect.poll(() => gradeList.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const [gradeTrackBox, lastGradeCardBox] = await Promise.all([
    gradeList.boundingBox(),
    gradeCards.last().boundingBox(),
  ]);
  expect(
    (gradeTrackBox?.x || 0) +
      (gradeTrackBox?.width || 0) -
      (lastGradeCardBox?.x || 0) -
      (lastGradeCardBox?.width || 0),
  ).toBeCloseTo(16, 1);
  await gradeList.evaluate((element) => element.scrollTo({ left: 0 }));
  await expect.poll(() => gradeList.evaluate((element) => element.scrollLeft)).toBe(0);
  await expect(page.getByRole("heading", { name: "校园速览", exact: true })).toHaveCount(0);
  await gradeSection.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-today-semester-grades.png`,
    fullPage: false,
  });
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
  expect(listVisual.itemCount).toBe(5);
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
  expect(visualStates.completed.stripeColor).toBe("rgb(223, 231, 236)");
  expect(visualStates.upcoming.background).toBe("rgb(255, 255, 255)");
  expect(visualStates.upcoming.borderLeftWidth).toBe("0px");
  expect(visualStates.upcoming.contentInset).toBeGreaterThanOrEqual(12);
  expect(visualStates.upcoming.shadow).toBe("none");
  expect(visualStates.upcoming.stripeWidth).toBe(6);
  expect(visualStates.upcoming.stripeColor).toBe("rgb(190, 203, 212)");
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
  expect(activeVisual.background).toBe("rgb(235, 244, 239)");
  expect(activeVisual.stripeColor).toBe("rgb(64, 140, 103)");
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

test("course grades use the shared semester picker", async ({ page }, testInfo) => {
  await page.route("**/api/grade/GRADE001", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: "OK",
        data: [
          { name: "期末考试 B", score: "94", percentage: "20%" },
          { name: "平时作业 B", score: "90", percentage: "10%" },
          {
            name: "课程论文 CourseworkPortfolioAssessmentWithExtendedIdentifier",
            score: "92",
            percentage: "20%",
          },
          { name: "期中考试", score: "91", percentage: "20%" },
          { name: "期末考试 A", score: "95", percentage: "20%" },
          { name: "平时作业 A", score: "96", percentage: "10%" },
        ],
      }),
    });
  });
  await login(page);
  await page.goto("/services/grades");

  await expect(page.locator(".page-header p")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "2026-2027 学年 秋季学期" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "学年" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "学期" })).toHaveCount(0);
  await expect(page.locator(".grade-list .grade-row")).toHaveCount(6);
  await expect(page.locator(".grade-list .grade-row").nth(1)).toHaveCSS("border-top-width", "1px");

  const tagBackgrounds = {
    neutral: "rgb(234, 240, 244)",
    primary: "rgb(233, 243, 252)",
    success: "rgb(235, 244, 239)",
    warning: "rgb(255, 243, 224)",
  } as const;
  const tagToneClasses = {
    primary: "badge--brand",
    success: "badge--success",
    warning: "badge--warning",
  } as const;
  async function expectGradeTags(
    courseName: string,
    labels: string[],
    tones: Array<keyof typeof tagBackgrounds>,
  ) {
    const gradeRow = page.getByRole("button", { name: `查看${courseName}成绩组成` }).locator("..");
    const tags = gradeRow.getByRole("list", { name: "课程属性" }).getByRole("listitem");
    await expect(tags).toHaveText(labels);
    for (const [index, tone] of tones.entries()) {
      if (tone === "neutral") {
        await expect(tags.nth(index)).not.toHaveClass(/badge--/);
      } else {
        await expect(tags.nth(index)).toHaveClass(new RegExp(tagToneClasses[tone]));
      }
      await expect(tags.nth(index)).toHaveCSS("background-color", tagBackgrounds[tone]);
    }
  }

  await expectGradeTags("数据结构", ["必修", "专业核心"], ["primary", "primary"]);
  await expectGradeTags(
    "高等数学",
    ["辅修", "选修", "公共基础"],
    ["success", "neutral", "neutral"],
  );
  await expectGradeTags(
    "大学物理",
    ["补考", "必修", "专业基础"],
    ["warning", "primary", "primary"],
  );
  await expectGradeTags(
    "离散数学",
    ["重修", "辅修", "选修", "专业课"],
    ["warning", "success", "neutral", "primary"],
  );
  await expectGradeTags("计算机导论", ["限选", "学类核心"], ["neutral", "primary"]);
  await expectGradeTags("工程伦理", ["学门核心"], ["primary"]);

  const gradeItem = page.getByRole("button", { name: "查看数据结构成绩组成" });
  const gradeRow = gradeItem.locator("..");
  await expect(gradeRow.getByText("COMP1001 · 3 学分")).toBeVisible();
  await expect(gradeRow.getByText("主修")).toHaveCount(0);
  await expect(gradeRow.getByLabel("绩点 4.0")).toHaveText("4.0");
  await expect(gradeRow.getByText(/GPA/)).toHaveCount(0);
  const pageFootnotes = page.getByRole("note", { name: "页面说明" });
  await expect(pageFootnotes.getByText("数据来源于教务系统。", { exact: true })).toBeVisible();
  await expect(
    pageFootnotes.getByText("点击可查看课程成绩的具体组成。", { exact: true }),
  ).toBeVisible();
  await expect(
    pageFootnotes.getByText("课程分数下方的小数为该门课程的绩点。", { exact: true }),
  ).toBeVisible();
  await expect(pageFootnotes).toHaveCSS("font-size", "12px");
  await pageFootnotes.getByRole("listitem").last().scrollIntoViewIfNeeded();
  const [footnotesBox, navigationBox] = await Promise.all([
    pageFootnotes.boundingBox(),
    page.getByRole("navigation", { name: "主导航" }).boundingBox(),
  ]);
  expect(
    footnotesBox && navigationBox ? footnotesBox.y + footnotesBox.height : Infinity,
  ).toBeLessThanOrEqual(navigationBox?.y ?? 0);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-course-grades.png`,
    fullPage: true,
  });

  await gradeItem.click();
  const detailDialog = page.getByRole("dialog", { name: "数据结构" });
  await expect(detailDialog).not.toContainText("课程号");
  await expect(detailDialog).not.toContainText("COMP1001");
  const detailList = detailDialog.locator(".grade-detail-list");
  await expect(detailList).not.toHaveClass(/surface/);
  await expect(detailList).toHaveJSProperty("tagName", "UL");
  await expect(detailList.locator(".data-row strong")).toHaveText([
    "课程论文 CourseworkPortfolioAssessmentWithExtendedIdentifier",
    "平时作业 A",
    "平时作业 B",
    "期中考试",
    "期末考试 A",
    "期末考试 B",
  ]);
  await expect(detailList.locator(".data-row").nth(1)).toHaveCSS("border-top-width", "1px");
  await expect(detailList.locator(".data-row").first()).toHaveCSS("padding-left", "0px");
  await expect
    .poll(() =>
      detailList
        .locator(".grade-detail-list__label")
        .first()
        .evaluate((label) => label.scrollWidth <= label.clientWidth),
    )
    .toBe(true);
  await expectNoHorizontalOverflow(page);
  await detailDialog.screenshot({
    path: `artifacts/${testInfo.project.name}-grade-detail-dialog.png`,
  });
  await detailDialog.getByRole("button", { name: "关闭" }).click();

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
      url.searchParams.get("xq") === "4"
    );
  });
  await semesterDialog.getByRole("button", { name: "2025-2026 夏季学期" }).click();
  await gradeRequest;
  await expect(page).toHaveURL(/\/services\/grades\?xn=2025&xq=4$/);
  await expect(page.getByRole("heading", { name: "2025-2026 学年 夏季学期" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("school ranking exposes its complete filters", async ({ page }, testInfo) => {
  await login(page);
  await page.goto("/services/rank");
  const filterCard = page.locator(".rank-filter-card");
  await expect(filterCard.locator(".rank-filter-row")).toHaveCount(1);
  await expect(filterCard.locator(".radio-group-row")).toHaveCount(3);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "学年学期，当前选择：2026-2027 学年 秋季学期",
    }),
  ).toBeVisible();
  for (const row of await filterCard.locator(".radio-group-row").all()) {
    const [rowBox, lastOptionBox] = await Promise.all([
      row.boundingBox(),
      row.locator(".radio-group-option").last().boundingBox(),
    ]);
    expect(rowBox).not.toBeNull();
    expect(lastOptionBox).not.toBeNull();
    expect(
      Math.abs(rowBox!.x + rowBox!.width - 14 - (lastOptionBox!.x + lastOptionBox!.width)),
    ).toBeLessThan(1);
  }
  await filterCard.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-filter-card.png`,
  });
  await page.locator(".rank-filter").screenshot({
    path: `artifacts/${testInfo.project.name}-rank-filter-form.png`,
  });

  await page.getByRole("button", { name: /学年学期，当前选择/ }).click();
  const semesterDialog = page.getByRole("dialog", { name: "选择学年学期" });
  await expect(semesterDialog.getByRole("radio")).toHaveCount(0);
  await expect(semesterDialog.getByRole("button", { name: "完成" })).toHaveCount(0);
  await expect(semesterDialog.locator(".rank-filter-choice").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );
  const [yearGroupBox, termGroupBox] = await Promise.all([
    semesterDialog.getByRole("group", { name: "学年" }).boundingBox(),
    semesterDialog.getByRole("group", { name: "学期" }).boundingBox(),
  ]);
  expect(yearGroupBox).not.toBeNull();
  expect(termGroupBox).not.toBeNull();
  expect(termGroupBox!.x).toBeGreaterThan(yearGroupBox!.x + yearGroupBox!.width);
  expect(Math.abs(termGroupBox!.y - yearGroupBox!.y)).toBeLessThan(1);
  const initiallySelectedTerm = semesterDialog.getByRole("button", { name: "秋季学期" });
  await expect(initiallySelectedTerm).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(1, 1);
  await expect(initiallySelectedTerm).toHaveCSS("background-color", "rgb(233, 243, 252)");
  await expect(semesterDialog.getByRole("button", { name: "全部学期" })).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await semesterDialog.getByRole("button", { name: "2025-2026 学年" }).click();
  for (const semesterName of ["秋季学期", "冬季学期", "春季学期", "夏季学期"]) {
    await expect(semesterDialog.getByRole("button", { name: semesterName })).toBeEnabled();
  }
  expect(
    await semesterDialog.locator(".modal__body").evaluate((element) => element.scrollTop),
  ).toBe(0);
  await semesterDialog.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-semester-filter.png`,
  });
  await semesterDialog.getByRole("button", { name: "春季学期" }).click();
  await expect(semesterDialog).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "学年学期，当前选择：2025-2026 学年 春季学期",
    }),
  ).toBeVisible();

  const rangeGroup = page.getByRole("radiogroup", { name: "课程范围" });
  await expect(rangeGroup.getByRole("radio", { name: "主修" })).toBeChecked();
  await rangeGroup.getByRole("radio", { name: "辅修" }).click();

  const dataSourceGroup = page.getByRole("radiogroup", { name: "数据来源" });
  await expect(dataSourceGroup.getByRole("radio", { name: "成绩主库" })).toBeChecked();
  await dataSourceGroup.getByRole("radio", { name: "执行方案" }).click();

  const displayGroup = page.getByRole("radiogroup", { name: "成绩取值" });
  await expect(displayGroup.getByRole("radio", { name: "最大成绩" })).toBeChecked();
  await displayGroup.getByRole("radio", { name: "初修成绩" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const rankRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/rank" &&
      url.searchParams.get("xn") === "2025" &&
      url.searchParams.get("xq") === "3" &&
      url.searchParams.get("range") === "minor" &&
      url.searchParams.get("data_source") === "execution" &&
      url.searchParams.get("display") === "initial"
    );
  });
  const submitButton = page.getByRole("button", { name: "查询" });
  const [filterCardBox, submitButtonBox] = await Promise.all([
    filterCard.boundingBox(),
    submitButton.boundingBox(),
  ]);
  expect(filterCardBox).not.toBeNull();
  expect(submitButtonBox).not.toBeNull();
  expect(submitButtonBox!.y).toBeGreaterThanOrEqual(filterCardBox!.y + filterCardBox!.height + 8);
  await submitButton.click();
  await rankRequest;
  await expect(page).toHaveURL(
    /\/services\/rank\?source=school&xn=2025&xq=3&range=minor&data_source=execution&display=initial$/,
  );
  await expect(submitButton).toBeEnabled();
  await expect(submitButton).toBeFocused();
  const resultSection = page.locator(".rank-result-section");
  const resultHeading = resultSection.getByRole("heading", {
    name: "2025-2026 学年 春季学期",
    level: 2,
  });
  const resultDescription = resultSection.locator(".section-heading .muted");
  await expect(resultHeading).toBeVisible();
  await expect(resultDescription).toHaveText("辅修 / 执行方案 / 初修成绩");
  await expect(resultSection.getByText("排名结果", { exact: true })).toHaveCount(0);
  const [resultHeadingBox, resultDescriptionBox] = await Promise.all([
    resultHeading.boundingBox(),
    resultDescription.boundingBox(),
  ]);
  expect(resultHeadingBox).not.toBeNull();
  expect(resultDescriptionBox).not.toBeNull();
  expect(resultDescriptionBox!.y).toBeGreaterThan(resultHeadingBox!.y);
  await resultSection.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-result-section.png`,
  });
  const schoolRankFootnotes = page.getByRole("note", { name: "页面说明" });
  await expect(schoolRankFootnotes.getByRole("listitem")).toHaveText(["*数据来源于教务系统。"]);
  await schoolRankFootnotes.screenshot({
    path: `artifacts/${testInfo.project.name}-school-rank-footnotes.png`,
  });
  await expectNoHorizontalOverflow(page);

  const allYearsRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/rank" && !url.searchParams.has("xn");
  });
  await page.getByRole("button", { name: /学年学期，当前选择/ }).click();
  const allYearsDialog = page.getByRole("dialog", { name: "选择学年学期" });
  await allYearsDialog.getByRole("button", { name: "全部学年" }).click();
  await expect(allYearsDialog).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "学年学期，当前选择：全部学年 全部学期",
    }),
  ).toBeVisible();
  await submitButton.click();
  await allYearsRequest;
  await expect(page).toHaveURL(
    /\/services\/rank\?source=school&xn=all&xq=all&range=minor&data_source=execution&display=initial$/,
  );
  await expect(
    resultSection.getByRole("heading", {
      name: "全部学年 全部学期",
      level: 2,
    }),
  ).toBeVisible();
  await expect(resultDescription).toHaveText("辅修 / 执行方案 / 初修成绩");
  await expectNoHorizontalOverflow(page);
});

test("ranking results adapt to every data availability state", async ({ page }, testInfo) => {
  let showEmptyGroups = false;
  let rankRequestCount = 0;
  await page.route("**/api/rank?*", async (route) => {
    rankRequestCount += 1;
    const both = {
      arithmetic: "88.2",
      arithmetic_rank: "8/120",
      weighted: "100.00",
      weighted_rank: "6/120",
      gpa: "3.84",
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
  await page.goto("/services/rank?xn=2026&xq=1");

  await expect(page.locator(".page-header p")).toHaveCount(0);
  const allTab = page.getByRole("tab", { name: "全部课程" });
  const compulsoryTab = page.getByRole("tab", { name: "必修课程" });
  const coreTab = page.getByRole("tab", { name: "核心课程" });
  const panel = page.getByRole("tabpanel");
  const report = page.locator(".rank-report");
  const allCourses = page.getByRole("group", { name: "全部课程成绩与排名" });
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  await expect(panel).toHaveAccessibleName("全部课程");
  await expect(report).toHaveClass(/surface/);
  await expect(report.locator(":scope > .rank-scope-tabs")).toHaveCount(1);
  await expect(report.locator(".rank-report__header")).toHaveCount(0);
  await expect(page.getByText("成绩与排名", { exact: true })).toHaveCount(0);
  await expect(allCourses.locator(".rank-stat")).toHaveCount(3);
  await expect(allCourses.getByText("88.20")).toBeVisible();
  await expect(allCourses.getByText("100")).toBeVisible();
  await expect(allCourses.getByText("3.8")).toBeVisible();
  await expect(allCourses.getByText("绩点")).toBeVisible();
  const firstRank = allCourses.getByLabel("第 8 名，共 120 人，排名百分比 6.7%");
  await expect(firstRank).toBeVisible();
  await expect(firstRank.locator(".rank-stat__rank-position")).toHaveText("8");
  await expect(firstRank.locator(".rank-stat__rank-total")).toHaveText("/120");
  await expect(firstRank.locator(".rank-stat__rank-percent")).toHaveText("(6.7%)");
  const [tabsBox, firstTabBox] = await Promise.all([
    page.locator(".rank-scope-tabs").boundingBox(),
    allTab.boundingBox(),
  ]);
  expect(tabsBox).not.toBeNull();
  expect(firstTabBox).not.toBeNull();
  expect(tabsBox!.height).toBeLessThanOrEqual(44);
  expect(firstTabBox!.height).toBeGreaterThanOrEqual(44);
  const [scoreStyle, rankStyle] = await Promise.all([
    allCourses
      .locator(".rank-stat__score")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight };
      }),
    allCourses
      .locator(".rank-stat__rank-position")
      .first()
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight };
      }),
  ]);
  expect(rankStyle).toEqual(scoreStyle);
  const completePanelHeight = (await panel.boundingBox())?.height ?? 0;
  await expectNoHorizontalOverflow(page);
  await panel.scrollIntoViewIfNeeded();
  await report.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability.png`,
  });

  await compulsoryTab.click();
  await expect(compulsoryTab).toHaveAttribute("aria-selected", "true");
  const compulsory = page.getByRole("group", { name: "必修课程成绩" });
  await expect(compulsory.getByText("100")).toBeVisible();
  await expect(compulsory.getByText("排名", { exact: true })).toHaveCount(0);
  await expect(compulsory.getByText("成绩", { exact: true })).toHaveCount(3);
  await expect(page.getByText("仅成绩", { exact: true })).toHaveCount(0);
  await expect(compulsory).toHaveCSS("opacity", "1");
  const [scoreOnlyValuesBox, scoreOnlyDatumBox] = await Promise.all([
    compulsory.locator(".rank-stat__values").first().boundingBox(),
    compulsory.locator(".rank-stat__datum").first().boundingBox(),
  ]);
  expect(scoreOnlyValuesBox).not.toBeNull();
  expect(scoreOnlyDatumBox).not.toBeNull();
  expect(Math.abs(scoreOnlyDatumBox!.x - scoreOnlyValuesBox!.x)).toBeLessThan(1);
  const scoreOnlyStyle = await compulsory
    .locator(".rank-stat__score")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight };
    });
  expect(scoreOnlyStyle).toEqual(scoreStyle);
  expect(Math.abs(((await panel.boundingBox())?.height ?? 0) - completePanelHeight)).toBeLessThan(
    1,
  );
  await panel.scrollIntoViewIfNeeded();
  await report.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability-score-only.png`,
  });

  await coreTab.click();
  await expect(coreTab).toHaveAttribute("aria-selected", "true");
  const core = page.getByRole("group", { name: "核心课程排名" });
  await expect(core.getByLabel("第 8 名，共 120 人，排名百分比 6.7%")).toBeVisible();
  await expect(core.locator(".rank-stat__score")).toHaveCount(0);
  await expect(core.locator(".rank-stat__rank")).toHaveCount(3);
  await expect(core.getByText("排名", { exact: true })).toHaveCount(3);
  await expect(page.getByText("仅排名", { exact: true })).toHaveCount(0);
  await expect(core).toHaveCSS("opacity", "1");
  const [rankOnlyValuesBox, rankOnlyDatumBox] = await Promise.all([
    core.locator(".rank-stat__values").first().boundingBox(),
    core.locator(".rank-stat__datum").first().boundingBox(),
  ]);
  expect(rankOnlyValuesBox).not.toBeNull();
  expect(rankOnlyDatumBox).not.toBeNull();
  expect(Math.abs(rankOnlyDatumBox!.x - rankOnlyValuesBox!.x)).toBeLessThan(1);
  const rankOnlyStyle = await core
    .locator(".rank-stat__rank-position")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, fontSize: style.fontSize, fontWeight: style.fontWeight };
    });
  expect(rankOnlyStyle).toEqual(scoreStyle);
  expect(Math.abs(((await panel.boundingBox())?.height ?? 0) - completePanelHeight)).toBeLessThan(
    1,
  );
  await expect(page.getByText("—")).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
  await panel.scrollIntoViewIfNeeded();
  await report.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability-lower.png`,
  });
  await coreTab.focus();
  await page.keyboard.press("Home");
  await expect(allTab).toBeFocused();
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(coreTab).toBeFocused();
  await expect(coreTab).toHaveAttribute("aria-selected", "true");
  expect(rankRequestCount).toBe(1);

  showEmptyGroups = true;
  await page.getByRole("button", { name: "查询" }).click();
  await expect(page.getByText("暂无成绩与排名数据")).toHaveCount(1);
  await expect(page.locator(".rank-stat-list")).toHaveCount(0);
  await allTab.click();
  await expect(page.getByText("暂无成绩与排名数据")).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await report.screenshot({
    path: `artifacts/${testInfo.project.name}-rank-availability-empty.png`,
  });
});

test("trusted ranking has an independent empty state", async ({ page }, testInfo) => {
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
  await expect(page.getByRole("button", { name: "可信电子凭证", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("heading", { name: "可信电子凭证排名" })).toHaveCount(0);
  const updateCard = page.getByRole("button", {
    name: "更新可信电子凭证排名，当前数据更新时间：暂无",
  });
  await expect(updateCard).toBeVisible();
  await expect(updateCard.getByText("更新", { exact: true })).toBeVisible();
  await expect(updateCard.getByText("当前数据更新时间：暂无")).toBeVisible();
  expect((await updateCard.boundingBox())?.height).toBeGreaterThanOrEqual(68);
  await expect(page.getByText("数据结构", { exact: true })).toHaveCount(0);
  const trustedRankFootnotes = page.getByRole("note", { name: "页面说明" });
  await expect(trustedRankFootnotes.getByRole("listitem")).toHaveText([
    "*数据来源于可信电子凭证。数据并非实时更新。",
  ]);
  await trustedRankFootnotes.screenshot({
    path: `artifacts/${testInfo.project.name}-trusted-rank-footnotes.png`,
  });
  await expectNoHorizontalOverflow(page);
});

test("room search loads and selects a described building", async ({ page }, testInfo) => {
  await page.request.put("/api/building/106/favorite", {
    headers: { Authorization: "Bearer mock-access-token", "X-Mock-Delay": "0" },
    data: { favorite: true },
  });
  for (const buildingId of ["W1343cab0000WH", "W13415380000WI", "105"]) {
    const response = await page.request.get(
      `/api/empty_room?building_id=${buildingId}&date=2026-10-08&times=1,2`,
      {
        headers: { Authorization: "Bearer mock-access-token", "X-Mock-Delay": "0" },
      },
    );
    expect(response.ok()).toBe(true);
    await page.waitForTimeout(2);
  }
  await login(page);
  let buildingRequestCount = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/building") buildingRequestCount += 1;
  });
  await page.goto("/services/rooms");
  await expect.poll(() => buildingRequestCount).toBe(1);

  const filterCard = page.locator(".room-filter-card");
  const submitButton = page.getByRole("button", { name: "查询", exact: true });
  await expect(page.getByRole("heading", { name: "筛选条件", level: 2 })).toBeVisible();
  await expect(page.getByRole("form", { name: "空教室筛选条件" })).toBeVisible();
  await expect(filterCard.locator(".room-filter-row")).toHaveCount(2);
  await expect(filterCard.locator(".room-filter-row__label")).toHaveText(["教学楼", "日期"]);
  await expect(page.getByLabel("节次")).toHaveCount(0);
  expect(await submitButton.evaluate((button) => button.closest(".room-filter-card"))).toBeNull();
  const [filterCardBox, submitButtonBox] = await Promise.all([
    filterCard.boundingBox(),
    submitButton.boundingBox(),
  ]);
  expect(filterCardBox).not.toBeNull();
  expect(submitButtonBox).not.toBeNull();
  expect(submitButtonBox!.y).toBeGreaterThanOrEqual(filterCardBox!.y + filterCardBox!.height + 8);
  const filterRowHeights = await filterCard
    .locator(".room-filter-row")
    .evaluateAll((rows) => rows.map((row) => row.getBoundingClientRect().height));
  expect(filterRowHeights.every((height) => height >= 59)).toBe(true);

  const buildingField = page.getByRole("button", { name: /教学楼，当前选择/ });
  const recentBuildings = page.getByRole("group", { name: "最近查询的教学楼" });
  const recentButtons = recentBuildings.getByRole("button");
  await expect(recentButtons).toHaveCount(3);
  const recentLabels = await recentButtons.allTextContents();
  expect(recentLabels.every((label) => label.trim().length > 0)).toBe(true);
  expect(new Set(recentLabels).size).toBe(3);
  expect(
    await recentBuildings.evaluate((element) => Boolean(element.closest(".room-filter-field"))),
  ).toBe(true);
  expect(
    await recentBuildings.evaluate((element) => Boolean(element.closest(".room-filter-card"))),
  ).toBe(true);
  const recentTagHeights = await recentBuildings
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(recentTagHeights.every((height) => height >= 44)).toBe(true);
  const recentChipBoxes = await recentBuildings
    .locator(".room-filter-recent-tag__surface")
    .evaluateAll((chips) =>
      chips.map((chip) => {
        const { height, width, x, y } = chip.getBoundingClientRect();
        return { height, width, x, y };
      }),
    );
  expect(recentChipBoxes.every(({ height }) => height >= 27 && height <= 29)).toBe(true);
  await expect(recentBuildings.locator(".room-filter-recent-tag__surface").first()).toHaveClass(
    /badge/,
  );
  await expect(recentBuildings.locator(".room-filter-recent-tag__surface").first()).toHaveCSS(
    "border-radius",
    "999px",
  );
  expect(
    Math.max(...recentChipBoxes.map(({ y }) => y)) - Math.min(...recentChipBoxes.map(({ y }) => y)),
  ).toBeLessThanOrEqual(1);
  const recentChipTextOverflows = await recentBuildings
    .locator(".room-filter-recent-tag__surface > span")
    .evaluateAll((labels) => labels.map((label) => label.scrollWidth > label.clientWidth));
  expect(recentChipTextOverflows.some(Boolean)).toBe(true);
  const recentGroupBox = await recentBuildings.boundingBox();
  expect(recentGroupBox).not.toBeNull();
  const lastRecentChip = recentChipBoxes.at(-1)!;
  expect(
    Math.abs(recentGroupBox!.x + recentGroupBox!.width - (lastRecentChip.x + lastRecentChip.width)),
  ).toBeLessThanOrEqual(1);
  const recentBuilding = recentBuildings.getByRole("button").first();
  const recentBuildingName = await recentBuilding.textContent();
  expect(recentBuildingName).not.toBeNull();
  await expect(buildingField).toContainText(recentBuildingName!);
  await expect(recentBuilding).toHaveAttribute("aria-pressed", "true");
  await recentBuilding.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(recentBuilding).toHaveAttribute("aria-pressed", "true");
  await expect(recentBuilding.locator("svg")).toHaveCount(1);

  await buildingField.click();
  const dialog = page.getByRole("dialog", { name: "选择教学楼" });
  await expect(dialog.getByText("53 个可用楼栋")).toHaveCount(0);
  await expect(dialog.getByRole("searchbox")).toHaveCount(0);
  expect(buildingRequestCount).toBe(1);
  await expect(dialog.locator(".building-option-group > h3")).toHaveText(["已收藏", "其他楼栋"]);
  const selectedBuildingOption = dialog.locator(
    ".building-option.is-selected .building-option__select",
  );
  await expect(selectedBuildingOption).toHaveCount(1);
  await expect(selectedBuildingOption).toHaveAttribute("aria-pressed", "true");
  await expect(selectedBuildingOption.locator("svg")).toHaveCount(0);
  const northBuilding = dialog.getByRole("button", { name: "选择梯教，北校区" });
  await expect(northBuilding).toContainText("梯教");
  await expect(northBuilding).toContainText("北校区");
  await expect(dialog.getByText("梯教(北校区)")).toHaveCount(0);
  await dialog.screenshot({
    path: `artifacts/${testInfo.project.name}-room-building-favorites.png`,
  });
  const buildingOption = dialog.getByRole("button", {
    name: "选择综合楼机房，可能无法查询到数据",
  });
  await expect(buildingOption).toBeVisible();
  await expect(buildingOption).toContainText("可能无法查询到数据");
  await expect(dialog.getByText("W134b2a60000WH")).toHaveCount(0);
  const favoriteButton = dialog.getByRole("button", {
    name: /^(?:收藏|取消收藏)综合楼机房$/,
  });
  const wasFavorite = (await favoriteButton.getAttribute("aria-pressed")) === "true";
  const favoriteRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return request.method() === "PUT" && url.pathname === "/api/building/W134b2a60000WH/favorite";
  });
  await favoriteButton.click();
  expect((await favoriteRequest).postDataJSON()).toEqual({ favorite: !wasFavorite });
  await expect(favoriteButton).toHaveAttribute("aria-pressed", String(!wasFavorite));

  await buildingOption.click();
  await expect(dialog).toBeHidden();
  await expect(buildingField).toContainText("综合楼机房");
  await expect(buildingField).not.toContainText("W134b2a60000WH");
  await expect(buildingField).toHaveAccessibleName("教学楼，当前选择：综合楼机房");

  await page.getByLabel("日期").fill("2026-10-08");
  const roomRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/empty_room" &&
      url.searchParams.get("building_id") === "W134b2a60000WH" &&
      url.searchParams.get("date") === "2026-10-08" &&
      url.searchParams.get("times") === "1,2"
    );
  });
  await page.getByRole("button", { name: "查询", exact: true }).click();
  await roomRequest;
  await expect(page.getByText("综合楼机房 101")).toBeVisible();
  const roomResultHeading = page.getByRole("heading", { name: "综合楼机房", level: 2 });
  await expect(roomResultHeading).toBeVisible();
  await expect(
    roomResultHeading.locator("..").getByText("2026-10-08 星期四", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "查询结果" })).toHaveCount(0);

  const timeSelector = page.getByRole("group", { name: "选择节次" });
  const roomPanel = page.getByRole("region", { name: "空教室列表" });
  const timeOptions = timeSelector.getByRole("button");
  await expect(timeOptions).toHaveCount(6);
  await expect(timeSelector).toHaveClass(/surface/);
  await expect(roomPanel).toHaveClass(/surface/);
  await expect(roomPanel.locator(".room-results__summary")).toHaveCount(0);
  await expect(roomPanel.locator(".room-results__list")).toHaveJSProperty("tagName", "UL");
  await expect(roomPanel.getByRole("listitem")).toHaveCount(9);
  const firstPeriod = timeSelector.getByRole("button", { name: "1-2 节，08:00-09:40" });
  const secondPeriod = timeSelector.getByRole("button", { name: "3-4 节，10:00-11:40" });
  await expect(firstPeriod).toHaveAttribute("aria-pressed", "true");
  await expect(firstPeriod).toHaveAttribute("aria-disabled", "true");
  await expect(secondPeriod).toHaveAttribute("aria-pressed", "false");
  const timeOptionBoxes = await timeSelector.locator(".room-time-option").evaluateAll((options) =>
    options.map((option) => {
      const { height, width } = option.getBoundingClientRect();
      return { height, width };
    }),
  );
  expect(
    timeOptionBoxes.every(({ height, width }) => height >= 60 && width >= 79 && width <= 81),
  ).toBe(true);
  const [selectorBox, panelBox] = await Promise.all([
    timeSelector.boundingBox(),
    roomPanel.boundingBox(),
  ]);
  expect(selectorBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x - (selectorBox!.x + selectorBox!.width)).toBeGreaterThanOrEqual(7);
  expect(panelBox!.x - (selectorBox!.x + selectorBox!.width)).toBeLessThanOrEqual(9);
  expect(selectorBox!.width).toBeGreaterThanOrEqual(79);
  expect(selectorBox!.width).toBeLessThanOrEqual(81);

  const updatedRoomRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/empty_room" && url.searchParams.get("times") === "1,2,3,4";
  });
  await secondPeriod.click();
  await updatedRoomRequest;
  await expect(secondPeriod).toHaveAttribute("aria-pressed", "true");
  await expect(roomPanel.getByRole("listitem")).toHaveCount(6);
  const roomItemHeights = await roomPanel
    .getByRole("listitem")
    .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
  expect(roomItemHeights.every((height) => height >= 56 && height <= 68)).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-room-times.png`,
    fullPage: true,
  });

  const allTimesRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/empty_room" &&
      url.searchParams.get("times") === "1,2,3,4,5,6,7,8,9,10,11,12"
    );
  });
  for (const option of await timeOptions.all()) {
    if ((await option.getAttribute("aria-pressed")) !== "true") await option.click();
  }
  await allTimesRequest;
  for (const option of await timeOptions.all()) {
    await expect(option).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByText("所选节次没有可用教室")).toBeVisible();
  await expect(page.getByText("可调整左侧节次重新查询。")).toBeVisible();
  await expect(timeSelector).toBeVisible();
  const [emptyPanelBox, fixedSelectorBox] = await Promise.all([
    roomPanel.boundingBox(),
    timeSelector.boundingBox(),
  ]);
  expect(emptyPanelBox).not.toBeNull();
  expect(fixedSelectorBox).not.toBeNull();
  expect(emptyPanelBox!.height).toBeLessThan(fixedSelectorBox!.height);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-room-empty-times.png`,
    fullPage: false,
  });
});

test("confirmation dialog presents balanced primary and secondary actions", async ({ page }) => {
  await login(page);
  await page.goto("/me");
  await page.getByRole("button", { name: /退出登录/ }).click();
  const dialog = page.getByRole("dialog", { name: "退出登录？" });
  const cancel = dialog.getByRole("button", { name: "取消" });
  const confirm = dialog.getByRole("button", { name: "退出登录", exact: true });
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
  await page.getByRole("button", { name: /退出登录/ }).click();
  const dialog = page.getByRole("dialog", { name: "退出登录？" });
  await dialog.getByRole("button", { name: "退出登录", exact: true }).click();
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

test.describe("dark appearance follows the system", () => {
  test.use({ colorScheme: "dark" });

  test("shell, schedule and course detail keep readable tokens", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveCSS("background-color", "rgb(10, 14, 18)");
    await expect(html).toHaveCSS("color", "rgb(230, 237, 243)");
    await expect(page.locator(".page-header").first()).toHaveCSS(
      "background-color",
      "rgb(16, 22, 27)",
    );
    await expect(page.locator(".bottom-nav")).toHaveCSS("background-color", "rgb(23, 30, 36)");

    await page.goto("/login");
    await page.getByLabel("学号").fill("202208010101");
    await page.getByLabel("密码").fill("mock-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /^\d{1,2} 月 \d{1,2} 日 星期[一二三四五六日]$/ }),
    ).toBeVisible();

    await page.goto("/schedule");
    const cell = page.locator(".schedule-course").first();
    await expect(cell).toBeVisible();
    const cellColors = await cell.evaluate((element) => {
      const card = getComputedStyle(element);
      const name = element.querySelector(".schedule-course__name");
      return {
        background: card.backgroundColor,
        text: name ? getComputedStyle(name).color : card.color,
      };
    });
    expect(contrastRatio(cellColors.text, cellColors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("rgb(230, 237, 243)", "rgb(23, 30, 36)")).toBeGreaterThanOrEqual(7);

    await cell.click();
    const detail = page.locator(".schedule-detail-card").first();
    await expect(detail).toBeVisible();
    const detailColors = await detail.evaluate((element) => {
      const card = getComputedStyle(element);
      return { background: card.backgroundColor, text: card.color };
    });
    expect(contrastRatio(detailColors.text, detailColors.background)).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.goto("/me");
    await expect(page.locator(".profile-page .page-header")).toHaveCSS(
      "background-color",
      "rgb(27, 61, 83)",
    );
    await expect(page.locator(".profile-account-card__student-id")).toHaveCSS(
      "color",
      "rgb(168, 207, 228)",
    );
    await expectNoHorizontalOverflow(page);
  });
});
