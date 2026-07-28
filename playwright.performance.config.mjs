import { defineConfig } from "@playwright/test";

const port = Number(process.env.PERFORMANCE_PORT || 8041);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/performance",
  outputDir: "./output/playwright/performance/test-results",
  reporter: [["line"]],
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "off",
    trace: "off",
  },
  projects: [
    {
      name: "chromium-dpr1",
      use: { deviceScaleFactor: 1 },
    },
    {
      name: "chromium-dpr2",
      use: { deviceScaleFactor: 2 },
    },
  ],
  webServer: {
    command: `python3 scripts/serve_local.py ${port} --directory . >/dev/null 2>&1`,
    url: `${baseURL}/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
