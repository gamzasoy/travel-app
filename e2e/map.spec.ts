import { expect, test } from "@playwright/test";
import { join } from "./helpers";

// 이 e2e 는 구글 키 없이 실행된다 → 지도 대신 안내가 보이고, 장소는 직접 입력으로 추가한다.
test("지도: 키 없음 안내 → 장소 추가 → 일정 연결 → 지도에서 보기 → 다녀옴/삭제", async ({ page }) => {
  await join(page, "민수");
  await page.getByRole("link", { name: "지도" }).click();

  await expect(page.getByText("지도를 보려면 구글 지도 키가 필요해요")).toBeVisible();
  // 가짜 노션에 미리 들어 있는 장소 1개
  await expect(page.getByText("장소 (1)")).toBeVisible();

  // 직접 입력으로 장소 추가 (좌표 없음 → 이름·주소로 길찾기)
  await page.getByRole("button", { name: "+ 장소 추가" }).click();
  await page.getByLabel("장소 이름").fill("이치란 시부야점");
  await page.getByLabel("주소").fill("Shibuya, Tokyo");
  await page.getByRole("button", { name: "맛집" }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("장소 (2)")).toBeVisible();
  await expect(page.getByText("맛집 · Shibuya, Tokyo · 좌표 없음")).toBeVisible();

  // 좌표가 없는 장소의 길찾기는 이름+주소 검색
  const row = page.getByRole("listitem").filter({ hasText: "이치란 시부야점" });
  const href = new URL((await row.getByRole("link", { name: /길찾기/ }).getAttribute("href"))!);
  expect(href.searchParams.get("destination")).toBe("이치란 시부야점 Shibuya, Tokyo");

  // 일정에서 방금 추가한 장소를 고를 수 있다
  await page.getByRole("link", { name: "일정" }).click();
  await page.getByRole("button", { name: "일정 추가" }).click();
  await page.getByLabel("제목").fill("저녁 라멘");
  await page.getByLabel("시간 (선택)").fill("19:00");
  await page.getByLabel("장소 (선택)").selectOption({ label: "이치란 시부야점" });
  await page.getByRole("button", { name: "저장" }).click();

  // 일정 카드의 "지도에서 보기" → 지도 화면에서 그 장소가 선택(강조)돼 있다
  await page.getByRole("link", { name: "지도에서 보기" }).first().click();
  await expect(page).toHaveURL(/\/map\?p=/);
  await expect(page.getByRole("listitem").filter({ hasText: "이치란 시부야점" })).toHaveClass(/bg-primary\/20/);

  // 일정에 연결된 장소엔 Day 표시가 붙고, 날짜를 고르면 그날 장소만 보인다 (좌표 없는 장소뿐이라 경로는 비어 있다는 안내)
  await expect(row.getByText(/Day 1/)).toBeVisible();
  const dayChips = page.getByRole("group", { name: "날짜" });
  await dayChips.getByRole("button", { name: /Day 1/ }).click();
  await expect(page.getByText("이 날 일정에 좌표가 있는 장소가 없어요.")).toBeVisible();
  await expect(page.getByText("장소 (1)")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "센소지" })).toHaveCount(0);
  await dayChips.getByRole("button", { name: /Day 2/ }).click();
  await expect(page.getByText("이 날 일정에 연결된 장소가 없어요. 일정에서")).toBeVisible();
  await dayChips.getByRole("button", { name: "전체" }).click();
  await expect(page.getByText("장소 (2)")).toBeVisible();

  // 다녀옴 체크 → 취소선
  await row.getByLabel("다녀옴").check();
  await expect(row.getByText("이치란 시부야점")).toHaveClass(/line-through/);

  // 삭제
  page.once("dialog", (d) => d.accept());
  await row.getByRole("button", { name: "이치란 시부야점 삭제" }).click();
  await expect(page.getByText("장소 (1)")).toBeVisible();

  // 정리: 만든 일정도 지운다 (가짜 노션 상태를 다른 테스트와 공유하므로)
  await page.getByRole("link", { name: "일정", exact: true }).click();
  await page.getByRole("button", { name: "저녁 라멘" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("button", { name: "저녁 라멘" })).toHaveCount(0);
});
