import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import GymStandardPage from "./GymStandardPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <GymStandardPage />
    </MemoryRouter>,
  );
}

describe("GymStandardPage", () => {
  it("shows the complete standards without placeholder labels", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "体测标准" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "总分构成" })).toBeVisible();
    const scoreComposition = screen.getByRole("group", {
      name: "体测总分等于标准分 100 分加附加分 20 分，满分 120 分",
    });
    expect(within(scoreComposition).getByText("标准分")).toBeVisible();
    expect(within(scoreComposition).getByText("附加分")).toBeVisible();
    expect(within(scoreComposition).getByText("总分")).toBeVisible();
    expect(screen.queryByText("大学生体质健康测试")).not.toBeInTheDocument();
    expect(screen.queryByText("满分 120 分", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText("七项加权")).not.toBeInTheDocument();
    expect(screen.queryByText("加分项目")).not.toBeInTheDocument();
    expect(screen.queryByText("最高得分")).not.toBeInTheDocument();
    expect(screen.getByText("≥ 90")).toBeVisible();
    expect(screen.queryByText("示例数据")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "毕业成绩" })).toBeVisible();
    expect(screen.queryByText("毕业成绩与等级评定")).not.toBeInTheDocument();
    const graduationCalculation = screen.getByRole("group", {
      name: "毕业成绩等于毕业当年学年总分乘以 50%，加其他学年总分平均得分乘以 50%；毕业等级按毕业成绩评定",
    });
    expect(within(graduationCalculation).getByText("毕业当年学年总分")).toBeVisible();
    expect(within(graduationCalculation).getByText("其他学年总分平均得分")).toBeVisible();
    expect(within(graduationCalculation).getAllByText("× 50%")).toHaveLength(2);
    expect(within(graduationCalculation).getByText("同时据此评定毕业等级")).toBeVisible();
    const filterSection = screen.getByRole("heading", { name: "项目评分标准" }).closest("section");
    expect(filterSection).not.toBeNull();
    expect(within(filterSection as HTMLElement).getByRole("radio", { name: "男生" })).toBeVisible();
    expect(within(filterSection as HTMLElement).getAllByRole("radio")).toHaveLength(4);
    expect(
      within(filterSection as HTMLElement).getByRole("tablist", { name: "体测项目" }),
    ).toBeVisible();
    expect(filterSection?.querySelectorAll(".surface")).toHaveLength(2);
    expect(
      within(filterSection as HTMLElement).getByRole("region", {
        name: "测试项目选择",
      }),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "测试项目" })).not.toBeInTheDocument();
    expect(screen.queryByText("共 7 项 · 权重合计 100%")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "适用对象" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "体重指数（BMI）标准" })).toBeVisible();
    const bmiTable = screen.getByRole("table", { name: "体重指数（BMI）分数与成绩要求" });
    expect(bmiTable).toBeVisible();
    expect(within(bmiTable).getAllByRole("rowheader")).toHaveLength(4);
    expect(within(bmiTable).getByRole("rowheader", { name: "100" })).toBeVisible();
    expect(within(bmiTable).getAllByRole("rowheader", { name: "80" })).toHaveLength(2);
    expect(within(bmiTable).getByText("≤ 17.8")).toBeVisible();
    expect(within(bmiTable).getByText("24.0–27.9")).toBeVisible();
    expect(
      ["正常", "低体重", "超重", "肥胖"].map(
        (category) => within(bmiTable).getByText(category).textContent,
      ),
    ).toEqual(["正常", "低体重", "超重", "肥胖"]);
    expect(within(bmiTable).getByText("低体重")).toHaveClass("badge--brand");
    expect(within(bmiTable).getByText("超重")).toHaveClass("badge--warning");
    expect(within(bmiTable).queryByText("优秀")).not.toBeInTheDocument();
    expect(within(bmiTable).queryByText("分", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "成绩要求（kg/m²）" })).toBeVisible();
    expect(
      screen.getByText("占比 15% · BMI 指标 = 体重 / 身高的平方", { exact: true }),
    ).toBeVisible();
    expect(screen.queryByText("权重 15%", { exact: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "BMI",
      "肺活量",
      "50 米",
      "体前屈",
      "跳远",
      "引体向上",
      "1000 米",
    ]);
    expect(screen.queryByRole("heading", { name: "附加分" })).not.toBeInTheDocument();
    const footnotes = screen.getByRole("note", { name: "体测标准说明" });
    expect(footnotes).toHaveTextContent("标准分卡片展示各项目完整分档");
    expect(footnotes).not.toHaveTextContent("正式标准待补充");
  });

  it("updates the table for audience, grade, and project selections", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: "女生" }));
    await user.click(screen.getByRole("radio", { name: "大三 / 大四" }));
    await user.click(screen.getByRole("tab", { name: /肺活量/ }));

    expect(screen.getByRole("radio", { name: "女生" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "大三 / 大四" })).toBeChecked();
    expect(screen.getByRole("tab", { name: /肺活量/ })).toHaveAttribute("aria-selected", "true");
    const table = screen.getByRole("table", { name: "肺活量分数与成绩要求" });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(20);
    expect(within(table).getByText("≥ 3450")).toBeVisible();
    expect(within(table).getByText("≥ 3200")).toBeVisible();
    expect(within(table).getByText("≥ 2050")).toBeVisible();
    expect(within(table).getByText("≥ 1850")).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "成绩要求（毫升）" })).toBeVisible();
    expect(screen.getByText("占比 15%", { exact: true })).toBeVisible();
    expect(screen.queryByText("单位：毫升 · 数值越高，分数越高")).not.toBeInTheDocument();
  });

  it("uses the source score sequences for the gender-specific strength projects", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("tab", { name: "引体向上" }));

    const maleTable = screen.getByRole("table", { name: "引体向上分数与成绩要求" });
    expect(
      within(maleTable)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      "100",
      "95",
      "90",
      "85",
      "80",
      "76",
      "72",
      "68",
      "64",
      "60",
      "50",
      "40",
      "30",
      "20",
      "10",
    ]);
    expect(within(maleTable).getByText("≥ 19")).toBeVisible();
    expect(within(maleTable).getByText("≥ 5")).toBeVisible();

    expect(screen.getByRole("heading", { name: "附加分" })).toBeVisible();
    expect(screen.queryByText("最高 10 分", { exact: true })).not.toBeInTheDocument();
    const maleFirstBonusTable = screen.getByRole("table", {
      name: "引体向上附加分前 5 档成绩要求",
    });
    expect(
      within(maleFirstBonusTable)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual(["+10", "+9", "+8", "+7", "+6"]);
    expect(within(maleFirstBonusTable).getByText("≥ 29")).toBeVisible();
    expect(within(maleFirstBonusTable).getByText("≥ 25")).toBeVisible();
    const maleLastBonusTable = screen.getByRole("table", {
      name: "引体向上附加分后 5 档成绩要求",
    });
    expect(
      within(maleLastBonusTable)
        .getAllByRole("rowheader")
        .map((cell) => cell.textContent),
    ).toEqual(["+5", "+4", "+3", "+2", "+1"]);
    expect(within(maleLastBonusTable).getByText("≥ 24")).toBeVisible();
    expect(within(maleLastBonusTable).getByText("≥ 20")).toBeVisible();

    await user.click(screen.getByRole("radio", { name: "女生" }));
    await user.click(screen.getByRole("radio", { name: "大三 / 大四" }));

    const femaleTable = screen.getByRole("table", {
      name: "一分钟仰卧起坐分数与成绩要求",
    });
    expect(within(femaleTable).getAllByRole("rowheader")).toHaveLength(20);
    expect(within(femaleTable).getByText("≥ 57")).toBeVisible();
    expect(within(femaleTable).getByText("≥ 17")).toBeVisible();
    const femaleFirstBonusTable = screen.getByRole("table", {
      name: "一分钟仰卧起坐附加分前 5 档成绩要求",
    });
    const femaleLastBonusTable = screen.getByRole("table", {
      name: "一分钟仰卧起坐附加分后 5 档成绩要求",
    });
    expect(within(femaleFirstBonusTable).getAllByRole("rowheader")).toHaveLength(5);
    expect(within(femaleFirstBonusTable).getByText("≥ 70")).toBeVisible();
    expect(within(femaleLastBonusTable).getAllByRole("rowheader")).toHaveLength(5);
    expect(within(femaleLastBonusTable).getByText("≥ 59")).toBeVisible();
  });

  it("supports arrow-key navigation between projects", async () => {
    const user = userEvent.setup();
    renderPage();

    const bmiTab = screen.getByRole("tab", { name: /BMI/ });
    bmiTab.focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /肺活量/ })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "肺活量标准" })).toBeVisible();
  });
});
