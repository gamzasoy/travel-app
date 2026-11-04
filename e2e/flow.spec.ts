import { expect, test } from "@playwright/test";
import { TRIP_ID } from "./ids";

test("PIN 입장 → 엔화 지출 추가 → 정산", async ({ page }) => {
  await page.goto(`/t/${TRIP_ID}/expenses`);
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP_ID}/join$`));
  await expect(page.getByRole("heading", { name: "도쿄 여행" })).toBeVisible();

  // 틀린 PIN → 멤버 이름이 노출되지 않는다
  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "다음" }).click();
  await expect(page.getByText("PIN이 맞지 않아요.")).toBeVisible();
  await expect(page.getByText("민수")).toHaveCount(0);

  // 맞는 PIN → 이름 선택
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "민수" }).click();
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP_ID}/expenses$`));
  await expect(page.getByText("아직 지출이 없어요")).toBeVisible();

  // 엔화 지출 추가: ¥3,000, 환율 100엔=900원 → 3,000×900/100 = ₩27,000
  await page.getByRole("button", { name: "지출 추가" }).click();
  await page.getByLabel("금액").fill("3000");
  await expect(page.getByText("≈ ₩27,000")).toBeVisible();
  await page.getByLabel("항목").fill("라멘");
  await page.getByRole("button", { name: "식비" }).click();
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("라멘")).toBeVisible();
  await expect(page.getByText("¥3,000", { exact: true })).toBeVisible();
  await expect(page.getByText("≈₩27,000")).toBeVisible();
  await expect(page.getByText("민수 결제 · 식비 · 3명")).toBeVisible();

  // 정산: 27,000원을 3명이 9,000원씩, 지은·현우 → 민수
  await page.getByRole("link", { name: "정산" }).click();
  await expect(page.getByText("지은 → 민수")).toBeVisible();
  await expect(page.getByText("현우 → 민수")).toBeVisible();
  await expect(page.getByText("₩9,000").first()).toBeVisible();

  // 엔화로 보기
  await page.getByRole("link", { name: "¥ 엔" }).click();
  await expect(page.getByText("¥1,000").first()).toBeVisible();
});

test("지출 삭제", async ({ page }) => {
  await page.goto(`/t/${TRIP_ID}/join`);
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "지은" }).click();
  await page.getByText("라멘").click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("아직 지출이 없어요")).toBeVisible();
});

test("수동 환율을 바꾸면 이후 지출에 적용된다", async ({ page }) => {
  await page.goto(`/t/${TRIP_ID}/join`);
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: "현우" }).click();
  await page.getByRole("link", { name: "설정" }).click();
  await page.getByLabel(/직접 입력/).fill("1000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("저장했어요.")).toBeVisible();

  await page.getByRole("link", { name: "가계부" }).click();
  await page.getByRole("button", { name: "지출 추가" }).click();
  await page.getByLabel("금액").fill("1000");
  // 100엔=1,000원 → ¥1,000 = ₩10,000
  await expect(page.getByText("≈ ₩10,000")).toBeVisible();
});
