import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "mobile", use: {
      ...devices["iPhone 13"], browserName: "chromium",
      launchOptions: {
        // 클라우드 환경 등에서 미리 설치된 브라우저를 쓸 때: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      },
    } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
