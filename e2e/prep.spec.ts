import { expect, test } from "@playwright/test";
import { join } from "./helpers";

test("준비물: 기본 목록 넣기 → 추가(기내/위탁) → 짐 필터 → 체크(새로고침 후 유지) → 수정·삭제", async ({ page }) => {
  await join(page, "지은");
  await page.getByRole("link", { name: "준비" }).click();
  await expect(page.getByRole("tab", { name: /준비물/, selected: true })).toBeVisible();

  await page.getByRole("button", { name: "기본 준비물 넣기" }).click();
  await expect(page.getByText("여권", { exact: true })).toBeVisible();
  const total = await page.getByRole("checkbox", { name: /./ }).count(); // "챙긴 것 숨기기" 포함
  expect(total).toBeGreaterThan(10);

  // 직접 추가 (분류·짐 선택)
  await page.getByLabel("준비물", { exact: true }).fill("우산");
  await page.getByLabel("분류", { exact: true }).selectOption("기타");
  await page.getByRole("radiogroup", { name: "추가할 짐" }).getByRole("radio", { name: /위탁/ }).click();
  await page.getByRole("button", { name: "추가" }).click();
  await expect(page.getByRole("checkbox", { name: "우산" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "우산" })).toContainText("위탁");

  // 짐 필터: 기내만 보면 보조배터리는 있고 우산(위탁)은 없다. 진행률도 기내 기준
  const bagFilter = page.getByRole("radiogroup", { name: "짐 필터" });
  await bagFilter.getByRole("radio", { name: /기내/ }).click();
  await expect(page.getByRole("checkbox", { name: "보조배터리" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "우산" })).toHaveCount(0);
  await expect(page.getByText(/^기내 0 \/ \d+ 챙김$/)).toBeVisible();
  await bagFilter.getByRole("radio", { name: /위탁/ }).click();
  await expect(page.getByRole("checkbox", { name: "우산" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "보조배터리" })).toHaveCount(0);
  await bagFilter.getByRole("radio", { name: /전체/ }).click();

  // 체크 → 진행률, 새로고침 후에도 유지 (노션에 저장됨)
  await page.getByRole("checkbox", { name: "여권" }).check();
  await expect(page.getByText(/^1 \/ \d+ 챙김$/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "여권" })).toBeChecked();

  // 챙긴 것 숨기기
  await page.getByRole("checkbox", { name: "챙긴 것 숨기기" }).check();
  await expect(page.getByRole("checkbox", { name: "여권" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "챙긴 것 숨기기" }).uncheck();

  // 수정 → 삭제
  await page.getByRole("button", { name: "우산 수정" }).click();
  await page.getByLabel("이름").fill("접이식 우산");
  await page.getByRole("radiogroup", { name: "짐", exact: true }).getByRole("radio", { name: /기내/ }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("checkbox", { name: "접이식 우산" })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "접이식 우산" })).toContainText("기내");
  await page.getByRole("button", { name: "접이식 우산 수정" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("checkbox", { name: "접이식 우산" })).toHaveCount(0);
});

test("예약: 항공권 추가 → 예약번호·링크 → 숙소 추가(일시순) → 삭제", async ({ page }) => {
  await join(page, "민수");
  await page.goto(page.url().replace(/schedule$/, "prep?view=reservations"));
  await expect(page.getByRole("tab", { name: /예약/, selected: true })).toBeVisible();
  await expect(page.getByText(/예약번호를 바로 꺼내 볼 수 있어요/)).toBeVisible();

  const addReservation = async (fill: () => Promise<void>, title: string) => {
    await page.getByRole("button", { name: "예약 추가" }).click();
    await fill();
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toBeVisible();
  };

  // 숙소를 먼저 넣고 항공을 나중에 넣어도 일시순(항공이 먼저)으로 보인다
  await addReservation(async () => {
    await page.getByRole("radio", { name: /숙소/ }).click();
    await page.getByLabel("예약 이름").fill("호텔 그레이서리");
    await page.getByLabel("체크인 날짜").fill("2026-12-01");
    await page.getByLabel("체크아웃 날짜").fill("2026-12-05");
  }, "호텔 그레이서리");

  // 시작·끝 형식이 다르면 저장 거부
  await page.getByRole("button", { name: "예약 추가" }).click();
  await page.getByLabel("예약 이름").fill("인천 → 하네다 KE719");
  await page.getByLabel("출발 날짜").fill("2026-12-01");
  await page.getByLabel("출발 시간").fill("09:30");
  await page.getByLabel("도착 날짜").fill("2026-12-01");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("시작과 끝 모두 시간을 넣거나, 모두 비워주세요.")).toBeVisible();
  await page.getByLabel("도착 시간").fill("11:45");
  await page.getByLabel("예약번호").fill("ABC123");
  await page.getByLabel("예약 확인 링크 (선택)").fill("https://example.com/booking");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: /인천 → 하네다/ })).toBeVisible();

  const cards = page.locator("ul > li");
  await expect(cards.first()).toContainText("인천 → 하네다");
  await expect(cards.first()).toContainText("다음 예약");
  await expect(cards.first()).toContainText("12/1 (화) 09:30 → 11:45");
  await expect(cards.nth(1)).toContainText("12/1 (화) → 12/5 (토)");
  await expect(page.getByText("ABC123")).toBeVisible();
  await expect(page.getByRole("button", { name: "예약번호 복사" })).toBeVisible();
  await expect(page.getByRole("link", { name: /예약 확인/ })).toHaveAttribute("href", "https://example.com/booking");

  // 수정 화면에 값이 그대로 → 삭제
  await page.getByRole("button", { name: /호텔 그레이서리/ }).click();
  await expect(page.getByLabel("체크아웃 날짜")).toHaveValue("2026-12-05");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("button", { name: /호텔 그레이서리/ })).toHaveCount(0);
});
