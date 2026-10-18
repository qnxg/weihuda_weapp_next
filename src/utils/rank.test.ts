import { describe, expect, it } from "vitest";
import { formatRankScore, parseRankPosition } from "./rank";

describe("ranking formatting", () => {
  it.each([
    ["88.2", "score", "88.20"],
    ["1.005", "score", "1.01"],
    ["100", "score", "100"],
    ["100.00", "score", "100"],
    ["2.55", "gpa", "2.6"],
    ["3.84", "gpa", "3.8"],
    ["1e2", "score", "1e2"],
  ] as const)("formats %s as a %s value", (value, valueType, expected) => {
    expect(formatRankScore(value, valueType)).toBe(expected);
  });

  it("parses a valid rank and calculates its percentage", () => {
    expect(parseRankPosition("8/120")).toEqual({
      position: 8,
      total: 120,
      percentage: "6.7",
    });
  });

  it.each(["0/120", "121/120", "8/0", "9007199254740992/9007199254740992", "8th"])(
    "rejects invalid rank value %s",
    (value) => {
      expect(parseRankPosition(value)).toBeNull();
    },
  );
});
