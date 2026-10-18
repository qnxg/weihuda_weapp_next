import { describe, expect, it } from "vitest";
import {
  gymStandardProjects,
  type Audience,
  type StandardProjectId,
  type StandardRow,
} from "./gymStandards";

const audiences: readonly Audience[] = ["male", "female"];
const commonScores = [
  100, 95, 90, 85, 80, 78, 76, 74, 72, 70, 68, 66, 64, 62, 60, 50, 40, 30, 20, 10,
] as const;
const maleStrengthScores = [100, 95, 90, 85, 80, 76, 72, 68, 64, 60, 50, 40, 30, 20, 10] as const;
const bonusScores = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function project(id: StandardProjectId) {
  const value = gymStandardProjects.find((item) => item.id === id);
  if (!value) throw new Error(`Missing gym standard project: ${id}`);
  return value;
}

function rows(id: StandardProjectId, audience: Audience, kind: StandardRow["kind"]) {
  return project(id).standards[audience].filter((row) => row.kind === kind);
}

describe("gymStandardProjects", () => {
  it("keeps project metadata and score sequences internally consistent", () => {
    expect(gymStandardProjects.map(({ id }) => id)).toEqual([
      "bmi",
      "vital-capacity",
      "sprint",
      "sit-reach",
      "standing-jump",
      "strength",
      "endurance",
    ]);
    expect(new Set(gymStandardProjects.map(({ id }) => id)).size).toBe(gymStandardProjects.length);
    expect(gymStandardProjects.reduce((total, item) => total + item.weight, 0)).toBe(100);

    for (const item of gymStandardProjects) {
      for (const audience of audiences) {
        const standards = item.standards[audience];
        expect(
          new Set(standards.map((row) => `${row.kind}-${row.score}-${row.category ?? ""}`)).size,
        ).toBe(standards.length);
        expect(
          standards.every((row) => row.thresholds.length === 2 && row.thresholds.every(Boolean)),
        ).toBe(true);

        const standardScores = standards
          .filter((row) => row.kind === "standard")
          .map((row) => row.score);
        if (item.id === "bmi") {
          expect(standardScores).toEqual([100, 80, 80, 60]);
          expect(standards.map((row) => row.category)).toEqual(["正常", "低体重", "超重", "肥胖"]);
        } else if (item.id === "strength" && audience === "male") {
          expect(standardScores).toEqual(maleStrengthScores);
        } else {
          expect(standardScores).toEqual(commonScores);
        }

        const projectBonusScores = standards
          .filter((row) => row.kind === "bonus")
          .map((row) => row.score);
        expect(projectBonusScores).toEqual(
          item.id === "strength" || item.id === "endurance" ? bonusScores : [],
        );
      }
    }
  });

  it("preserves the source-table boundary values for every standard project", () => {
    const expected = {
      bmi: {
        male: ["17.9–23.9", "≥ 28.0"],
        female: ["17.2–23.9", "≥ 28.0"],
      },
      "vital-capacity": {
        male: ["≥ 5040", "≥ 2350"],
        female: ["≥ 3400", "≥ 1850"],
      },
      sprint: {
        male: ["≤ 6.7", "≤ 10.0"],
        female: ["≤ 7.5", "≤ 11.2"],
      },
      "sit-reach": {
        male: ["≥ 24.9", "≥ -0.8"],
        female: ["≥ 25.8", "≥ 2.5"],
      },
      "standing-jump": {
        male: ["≥ 273", "≥ 185"],
        female: ["≥ 207", "≥ 127"],
      },
      strength: {
        male: ["≥ 19", "≥ 6"],
        female: ["≥ 56", "≥ 17"],
      },
      endurance: {
        male: ["≤ 3′17″", "≤ 6′10″"],
        female: ["≤ 3′18″", "≤ 5′22″"],
      },
    } satisfies Record<StandardProjectId, Record<Audience, readonly [string, string]>>;

    for (const item of gymStandardProjects) {
      for (const audience of audiences) {
        const standardRows = rows(item.id, audience, "standard");
        expect([
          standardRows[0].thresholds[0],
          standardRows[standardRows.length - 1].thresholds[1],
        ]).toEqual(expected[item.id][audience]);
      }
    }
  });

  it("keeps every BMI category and threshold as a separate source row", () => {
    expect(project("bmi").standards.male).toEqual([
      {
        category: "正常",
        kind: "standard",
        score: 100,
        thresholds: ["17.9–23.9", "17.9–23.9"],
      },
      {
        category: "低体重",
        kind: "standard",
        score: 80,
        thresholds: ["≤ 17.8", "≤ 17.8"],
      },
      {
        category: "超重",
        kind: "standard",
        score: 80,
        thresholds: ["24.0–27.9", "24.0–27.9"],
      },
      {
        category: "肥胖",
        kind: "standard",
        score: 60,
        thresholds: ["≥ 28.0", "≥ 28.0"],
      },
    ]);
    expect(project("bmi").standards.female).toEqual([
      {
        category: "正常",
        kind: "standard",
        score: 100,
        thresholds: ["17.2–23.9", "17.2–23.9"],
      },
      {
        category: "低体重",
        kind: "standard",
        score: 80,
        thresholds: ["≤ 17.1", "≤ 17.1"],
      },
      {
        category: "超重",
        kind: "standard",
        score: 80,
        thresholds: ["24.0–27.9", "24.0–27.9"],
      },
      {
        category: "肥胖",
        kind: "standard",
        score: 60,
        thresholds: ["≥ 28.0", "≥ 28.0"],
      },
    ]);
  });

  it("converts every endurance and strength bonus increment to a concrete threshold", () => {
    expect(rows("endurance", "male", "bonus").map((row) => row.thresholds)).toEqual([
      ["≤ 2′42″", "≤ 2′40″"],
      ["≤ 2′45″", "≤ 2′43″"],
      ["≤ 2′48″", "≤ 2′46″"],
      ["≤ 2′51″", "≤ 2′49″"],
      ["≤ 2′54″", "≤ 2′52″"],
      ["≤ 2′57″", "≤ 2′55″"],
      ["≤ 3′01″", "≤ 2′59″"],
      ["≤ 3′05″", "≤ 3′03″"],
      ["≤ 3′09″", "≤ 3′07″"],
      ["≤ 3′13″", "≤ 3′11″"],
    ]);
    expect(rows("endurance", "female", "bonus").map((row) => row.thresholds)).toEqual([
      ["≤ 2′28″", "≤ 2′26″"],
      ["≤ 2′33″", "≤ 2′31″"],
      ["≤ 2′38″", "≤ 2′36″"],
      ["≤ 2′43″", "≤ 2′41″"],
      ["≤ 2′48″", "≤ 2′46″"],
      ["≤ 2′53″", "≤ 2′51″"],
      ["≤ 2′58″", "≤ 2′56″"],
      ["≤ 3′03″", "≤ 3′01″"],
      ["≤ 3′08″", "≤ 3′06″"],
      ["≤ 3′13″", "≤ 3′11″"],
    ]);
    expect(rows("strength", "male", "bonus").map((row) => row.thresholds)).toEqual([
      ["≥ 29", "≥ 30"],
      ["≥ 28", "≥ 29"],
      ["≥ 27", "≥ 28"],
      ["≥ 26", "≥ 27"],
      ["≥ 25", "≥ 26"],
      ["≥ 24", "≥ 25"],
      ["≥ 23", "≥ 24"],
      ["≥ 22", "≥ 23"],
      ["≥ 21", "≥ 22"],
      ["≥ 20", "≥ 21"],
    ]);
    expect(rows("strength", "female", "bonus").map((row) => row.thresholds)).toEqual([
      ["≥ 69", "≥ 70"],
      ["≥ 68", "≥ 69"],
      ["≥ 67", "≥ 68"],
      ["≥ 66", "≥ 67"],
      ["≥ 65", "≥ 66"],
      ["≥ 64", "≥ 65"],
      ["≥ 63", "≥ 64"],
      ["≥ 62", "≥ 63"],
      ["≥ 60", "≥ 61"],
      ["≥ 58", "≥ 59"],
    ]);
  });
});
