import { test, expect } from "@playwright/test";

test("홈 화면이 열린다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "여행 플래너" })).toBeVisible();
});
