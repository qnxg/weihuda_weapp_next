import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: { "X-Mock-Delay": "0" },
  },
  projects: [
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true },
    },
    {
      name: "mobile-390",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: "MOCK_PORT=3100 MOCK_URL=http://127.0.0.1:3100 npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
