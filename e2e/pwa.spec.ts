import { expect, test } from "@playwright/test";
import { TRIP_ID } from "./ids";
import { join } from "./helpers";

// 이 파일은 운영 빌드(next start)에서 실행된다 — playwright.config.ts 의 "pwa" 프로젝트

test("매니페스트와 아이콘이 설치 가능한 형태로 제공된다", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: "여행 플래너", display: "standalone", start_url: "/", lang: "ko" });
  const sizes = m.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ""}`);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512", "512x512:maskable"]));
  for (const icon of m.icons) {
    const r = await request.get(icon.src);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  // 서비스워커 파일은 캐시되지 않아야 업데이트가 반영된다
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-cache");
  expect(sw.headers()["x-frame-options"]).toBe("DENY");
});

test("오프라인: 본 화면은 보이고, 안 본 화면은 안내, 저장은 안내 메시지, 나가면 저장분 삭제", async ({ page, context }) => {
  await join(page, "민수");

  // 서비스워커가 등록돼 이 페이지를 제어할 때까지 기다린다
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  // 제어 중인 상태에서 전체 이동(navigate)을 해야 페이지·정적 파일이 저장된다
  await page.goto(`/t/${TRIP_ID}/schedule`);
  await expect(page.getByRole("heading", { name: "도쿄 여행" })).toBeVisible();
  await page.goto(`/t/${TRIP_ID}/expenses`);
  await expect(page.getByText("총 지출")).toBeVisible();

  // ---- 오프라인 ----
  await context.setOffline(true);

  await page.goto(`/t/${TRIP_ID}/schedule`);
  await expect(page.getByRole("heading", { name: "도쿄 여행" })).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(5); // 하이드레이션까지 오프라인에서 동작
  await expect(page.getByRole("status")).toContainText("오프라인이에요");

  await page.goto(`/t/${TRIP_ID}/expenses`);
  await expect(page.getByText("총 지출")).toBeVisible();

  // 안 본 화면은 오프라인 안내 페이지
  await page.goto(`/t/${TRIP_ID}/settings`);
  await expect(page.getByRole("heading", { name: "오프라인이에요" })).toBeVisible();

  // 오프라인에서 저장하면 에러 화면이 아니라 안내 메시지
  await page.goto(`/t/${TRIP_ID}/expenses`);
  await page.getByRole("button", { name: "지출 추가" }).click();
  await page.getByLabel("금액").fill("1000");
  await page.getByLabel("항목").fill("오프라인 테스트");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("네트워크 연결을 확인하고 다시 시도해주세요.")).toBeVisible();
  await expect(page.getByLabel("항목")).toHaveValue("오프라인 테스트"); // 입력은 보존된다

  // ---- 온라인 복귀 ----
  await context.setOffline(false);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "닫기" }).click();
  await page.goto(`/t/${TRIP_ID}/settings`);
  await expect(page.getByRole("heading", { name: "환율 설정" })).toBeVisible();
  // 친구 초대 링크는 이 서버 주소 + 여행 ID
  await expect(page.getByText(`/t/${TRIP_ID}`, { exact: false }).first()).toBeVisible();

  // 이름 바꾸기(나가기) → 오프라인용으로 저장된 페이지가 지워진다
  await page.getByRole("button", { name: /민수 · 바꾸기/ }).click();
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP_ID}/join$`));
  const cached = await page.evaluate(async () => (await (await caches.open("pages-v1")).keys()).length);
  expect(cached).toBe(0);
});
