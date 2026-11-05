import { expect, test } from "@playwright/test";
import { join } from "./helpers";

// 이 e2e 는 구글 키 없이 실행된다 → 지도 대신 안내가 보이고, 장소는 직접 입력으로 추가한다.
test("지도: 키 없음 안내 → 장소 추가 → 일정 연결 → 지도에서 보기 → 다녀옴/삭제", async ({ page }) => {
  test.setTimeout(90_000); // 개발 서버가 처음 쓰는 화면·액션을 컴파일하느라 오래 걸릴 수 있다
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

  // 장소를 누르면 편집 화면이 열리고, 이름·주소·카테고리를 고칠 수 있다
  await row.getByRole("button", { name: "이치란 시부야점 편집" }).click();
  await expect(page.getByRole("heading", { name: "장소 수정" })).toBeVisible();
  await expect(page.getByLabel("장소 이름")).toHaveValue("이치란 시부야점");
  await page.getByLabel("주소").fill("Shibuya 2-chome, Tokyo");
  await page.getByRole("button", { name: "쇼핑" }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("heading", { name: "장소 수정" })).toHaveCount(0);
  await expect(page.getByText("쇼핑 · Shibuya 2-chome, Tokyo · 좌표 없음")).toBeVisible();
  await expect(page.getByText("장소 (2)")).toBeVisible(); // 새로 생기지 않고 같은 장소가 수정됨

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

  // 같은 날 두 장소를 방문 순서대로 보여주고, ▲▼ 로 순서를 바꾼다 (시간이 있는 일정은 시간이 서로 바뀜)
  await page.getByRole("link", { name: "일정", exact: true }).click();
  await page.getByRole("button", { name: "일정 추가" }).click();
  await page.getByLabel("제목").fill("아침 센소지");
  await page.getByLabel("시간 (선택)").fill("10:00");
  await page.getByLabel("장소 (선택)").selectOption({ label: "센소지" });
  await page.getByRole("button", { name: "저장" }).click();
  await page.getByRole("link", { name: "지도", exact: true }).click();
  await dayChips.getByRole("button", { name: /Day 1/ }).click();
  await expect(page.getByText("장소 (2)")).toBeVisible();
  const places = page.getByRole("listitem");
  await expect(places.nth(0)).toContainText("1. 센소지");
  await expect(places.nth(1)).toContainText("2. 이치란 시부야점");
  await expect(page.getByText("장소를 꾹 눌러 끌면 방문 순서가 바뀌어요")).toBeVisible();

  // 두 번째 장소를 끌어서 맨 위로 옮기면 순서가 바뀐다
  const first = (await places.nth(0).boundingBox())!;
  const second = (await places.nth(1).boundingBox())!;
  await page.mouse.move(second.x + 24, second.y + second.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + 24, second.y + second.height / 2 - 20, { steps: 4 });
  await page.mouse.move(second.x + 24, first.y + 8, { steps: 8 });
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/map"));
  await page.mouse.up();
  await expect(places.nth(0)).toContainText("1. 이치란 시부야점");
  await expect(places.nth(1)).toContainText("2. 센소지");
  // 저장이 끝난 뒤 새로고침해도 유지된다 (일정의 시간이 서로 바뀌어 저장됨)
  await saved;
  await page.reload();
  await dayChips.getByRole("button", { name: /Day 1/ }).click();
  await expect(places.nth(0)).toContainText("1. 이치란 시부야점");
  await expect(places.nth(1)).toContainText("2. 센소지");
  await dayChips.getByRole("button", { name: "전체" }).click();
  await expect(page.getByText("장소 (2)")).toBeVisible();

  // 날짜를 고르고 장소를 추가하면 그날 일정에 자동으로 들어가고(맨 뒤), 장소를 눌러 날짜를 바꾸거나 해제할 수 있다
  await dayChips.getByRole("button", { name: /Day 1/ }).click();
  await page.getByRole("button", { name: "+ 장소 추가" }).click();
  const visitDays = page.getByRole("group", { name: "방문 날짜" });
  await expect(visitDays.getByRole("button", { name: /Day 1/ })).toHaveAttribute("aria-pressed", "true"); // 보던 날이 기본 선택
  await page.getByLabel("장소 이름").fill("도톤보리");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(places.nth(2)).toContainText("3. 도톤보리");

  // 순서: 새로 넣은 장소를 맨 위로 끌어 올린다 (시간이 없는 일정은 순서만 바뀜)
  const top = (await places.nth(0).boundingBox())!;
  const third = (await places.nth(2).boundingBox())!;
  await page.mouse.move(third.x + 24, third.y + third.height / 2);
  await page.mouse.down();
  await page.mouse.move(third.x + 24, third.y + third.height / 2 - 20, { steps: 4 });
  await page.mouse.move(third.x + 24, top.y + 8, { steps: 10 });
  const savedOrder = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/map"));
  await page.mouse.up();
  await expect(places.nth(0)).toContainText("1. 도톤보리");
  await savedOrder;
  await page.reload();
  await dayChips.getByRole("button", { name: /Day 1/ }).click();
  await expect(places.nth(0)).toContainText("1. 도톤보리"); // 새로고침해도 유지

  // 날짜 편집: Day 1 → Day 2 로 옮기면 Day 1 목록에서 빠지고 Day 2 에 나온다
  await page.getByRole("button", { name: "도톤보리 편집" }).click();
  await expect(visitDays.getByRole("button", { name: /Day 1/ })).toHaveAttribute("aria-pressed", "true");
  await visitDays.getByRole("button", { name: /Day 1/ }).click();
  await visitDays.getByRole("button", { name: /Day 2/ }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "도톤보리" })).toHaveCount(0);
  await dayChips.getByRole("button", { name: /Day 2/ }).click();
  await expect(places.nth(0)).toContainText("1. 도톤보리");

  // 날짜를 모두 해제하면 일정에서 빠지고(일정이 삭제됨), 장소는 전체에 남는다
  await page.getByRole("button", { name: "도톤보리 편집" }).click();
  await visitDays.getByRole("button", { name: /Day 2/ }).click();
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("이 날 일정에 연결된 장소가 없어요. 일정에서")).toBeVisible();
  await dayChips.getByRole("button", { name: "전체" }).click();
  await expect(page.getByText("장소 (3)")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "도톤보리 삭제" }).click();
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
  await page.getByRole("button", { name: "아침 센소지" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("button", { name: "아침 센소지" })).toHaveCount(0);
});

// 키 없이 실행되므로 추천 탭은 안내만 보인다 (구글 평점 검색은 브라우저의 Places API 가 필요)
test("추천: 하단 탭으로 이동하면 키 안내가 보인다", async ({ page }) => {
  await join(page, "민수");
  await page.getByRole("link", { name: "추천" }).click();
  await expect(page).toHaveURL(/\/recommend$/);
  await expect(page.getByRole("link", { name: "추천" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("추천을 보려면 구글 지도 키가 필요해요")).toBeVisible();
});
