import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
const MOCK_PORT = 4010;
const PWA_PORT = 3200; // 서비스워커는 운영 빌드에서만 등록되므로 별도 서버(next start)로 검증

const APP_ENV = {
  NOTION_BASE_URL: `http://localhost:${MOCK_PORT}`,
  NOTION_TOKEN: "test-token",
  NOTION_DS_TRIPS: "ds-trips",
  NOTION_DS_MEMBERS: "ds-members",
  NOTION_DS_SCHEDULE: "ds-schedule",
  NOTION_DS_PLACES: "ds-places",
  NOTION_DS_EXPENSES: "ds-expenses",
  NOTION_DS_CHECKLIST: "ds-checklist",
  NOTION_DS_RESERVATIONS: "ds-reservations",
  WEATHER_BASE_URL: `http://localhost:${MOCK_PORT}`,
  SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret",
};

export default defineConfig({
  testDir: "e2e",
  workers: 1, // 가짜 노션 서버의 상태를 공유하므로 순차 실행
  use: { baseURL: `http://localhost:${APP_PORT}` },
  projects: [
    {
      name: "mobile",
      testIgnore: /pwa\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        launchOptions: {
          // 클라우드 환경 등에서 미리 설치된 브라우저를 쓸 때: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium
          executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        },
      },
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        baseURL: `http://localhost:${PWA_PORT}`,
        launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH || undefined },
      },
    },
  ],
  webServer: [
    {
      command: "npx tsx e2e/mock-notion.ts",
      port: MOCK_PORT,
      reuseExistingServer: false,
      env: { MOCK_NOTION_PORT: String(MOCK_PORT) },
    },
    {
      // 이전 실행의 데이터 캐시가 남지 않도록 매번 비우고 시작
      command: `rm -rf .next-e2e && npx next dev -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-e2e", ...APP_ENV },
    },
    {
      command: `rm -rf .next-pwa && npx next build && npx next start -p ${PWA_PORT}`,
      url: `http://localhost:${PWA_PORT}`,
      timeout: 240_000,
      reuseExistingServer: false,
      env: { NEXT_DIST_DIR: ".next-pwa", ...APP_ENV },
    },
  ],
});
