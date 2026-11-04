import { test, expect } from "@playwright/test";

const TRIP = "00000000000000000000000000000001";

test("세션 없이 여행 페이지에 접근하면 입장 화면으로 보낸다", async ({ page }) => {
  await page.goto(`/t/${TRIP}/expenses`);
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP}/join$`));
});

test("위조된 쿠키는 통과하지 못한다", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "tp_session", value: "e30.AAAA", url: baseURL! }]);
  await page.goto(`/t/${TRIP}`);
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP}/join$`));
});
