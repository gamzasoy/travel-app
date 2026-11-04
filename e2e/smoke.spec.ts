import { test, expect } from "@playwright/test";

test("홈 화면이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "여행 플래너" })).toBeVisible();
});

test("홈에 여행 목록이 보이고 누르면 입장 화면으로 간다", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "여행 목록" });
  await expect(list.getByRole("link")).toHaveCount(2);
  // 최신 시작일 순
  await expect(list.getByRole("link").first()).toContainText("오사카 여행");
  await list.getByRole("link", { name: /도쿄 여행/ }).click();
  await expect(page).toHaveURL(/\/t\/trip-aaaaaaaaaaaaaaaa\/join$/);
});
