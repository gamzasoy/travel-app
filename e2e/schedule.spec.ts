import { expect, test } from "@playwright/test";
import { join } from "./helpers";

// 가짜 노션 여행 기간: 2026-12-01 ~ 12-05 (오늘이 기간 밖이면 첫날이 선택됨)
test("일정: 추가(시간순 정렬) → 장소 연결 길찾기 → 수정 → 날짜 탭 → 삭제", async ({ page }) => {
  await join(page, "민수");

  // 기간의 모든 날이 탭으로 나오고, 첫날이 선택돼 있다
  await expect(page.getByRole("tab")).toHaveCount(5);
  await expect(page.getByRole("tab", { selected: true })).toContainText("12/1 (화)");
  await expect(page.getByText("이 날의 일정이 아직 없어요.")).toBeVisible();

  const add = async (title: string, time: string | null, place?: string) => {
    await page.getByRole("button", { name: "일정 추가" }).click();
    await page.getByLabel("제목").fill(title);
    if (time) await page.getByLabel("시간 (선택)").fill(time);
    if (place) await page.getByLabel("장소 (선택)").selectOption({ label: place });
    await page.getByRole("button", { name: "저장" }).click();
    await expect(page.getByRole("button", { name: title })).toBeVisible();
  };

  // 일부러 시간 순서를 뒤섞어서 추가
  await add("점심 라멘", "12:30");
  await add("호텔 체크인", null);
  await add("센소지 구경", "10:00", "센소지");

  // 시간 있는 일정은 시간순, 시간 없는 일정은 맨 뒤
  const titles = page.locator("ol > li button.block");
  await expect(titles).toHaveText([/센소지 구경/, /점심 라멘/, /호텔 체크인/]);

  // 장소를 연결한 일정에는 구글맵 길찾기 링크가 생긴다
  const link = page.getByRole("link", { name: /구글맵 길찾기/ });
  await expect(link).toHaveCount(1);
  const href = new URL((await link.getAttribute("href"))!);
  expect(href.searchParams.get("destination")).toBe("35.7148,139.7967");
  expect(href.searchParams.get("destination_place_id")).toBe("ChIJ8T1GpMGOGGARDYGSgpooDWw");
  await expect(page.getByText("📍 센소지")).toBeVisible();

  // 날씨: 장소를 연결한 날은 그 장소 기준 예보가 보인다 (가짜 예보: 12/1 맑음 13°/4°)
  const weather = page.getByRole("region", { name: "날씨" });
  await expect(weather).toContainText("맑음");
  await expect(weather).toContainText("13°");
  await expect(weather).toContainText("기준: 센소지");
  await expect(page.getByRole("tab", { name: /12\/1/ })).toContainText("☀️ 13°");

  // 다른 날 탭은 비어 있고, 탭의 개수 표시가 맞다
  await expect(page.getByRole("tab", { name: /12\/1/ })).toContainText("3개");
  await page.getByRole("tab", { name: /12\/2/ }).click();
  await expect(page.getByText("이 날의 일정이 아직 없어요.")).toBeVisible();
  // 장소 없는 날(숙소도 없음)은 날씨 대신 안내
  await expect(page.getByRole("region", { name: "날씨" })).toHaveCount(0);
  await expect(page.getByText(/날씨는 여행 약 2주 전부터/)).toBeVisible();
  await page.getByRole("tab", { name: /12\/1/ }).click();

  // 수정: 점심을 다른 날(12/2) 11:00 으로 옮긴다
  await page.getByRole("button", { name: "점심 라멘" }).click();
  await page.getByRole("textbox", { name: "날짜" }).fill("2026-12-02");
  await page.getByLabel("시간 (선택)").fill("11:00");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("button", { name: "점심 라멘" })).toHaveCount(0);
  await page.getByRole("tab", { name: /12\/2/ }).click();
  await expect(page.getByRole("button", { name: "점심 라멘" })).toBeVisible();
  await expect(page.getByText("11:00")).toBeVisible();

  // 삭제
  await page.getByRole("button", { name: "점심 라멘" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("이 날의 일정이 아직 없어요.")).toBeVisible();
});
