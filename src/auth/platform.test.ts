import { afterEach, describe, expect, it } from "vitest";
import { getPlatformLoginCode } from "./platform";

afterEach(() => {
  delete window.WeihudaPlatform;
});

describe("platform login adapter", () => {
  it("uses the host platform code when available", async () => {
    window.WeihudaPlatform = { login: async () => "wx-login-code" };
    await expect(getPlatformLoginCode()).resolves.toBe("wx-login-code");
  });

  it("creates a mock code only in the development environment", async () => {
    await expect(getPlatformLoginCode()).resolves.toMatch(/^web-draft-/);
  });
});
