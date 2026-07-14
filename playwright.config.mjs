import { defineConfig } from "@playwright/test";

const port = Number(process.env.PORT || 8040);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./output/playwright/test-results",
  reporter: [["line"]],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `python3 -m http.server ${port} --directory . >/dev/null 2>&1`,
    url: `${baseURL}/`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
  workers: 1,
});
