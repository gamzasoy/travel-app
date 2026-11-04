import type { Page } from "@playwright/test";
import { TRIP_ID } from "./ids";

/** PIN 입장 후 지정한 멤버로 들어간다 (첫 화면은 일정 탭) */
export async function join(page: Page, member: string) {
  await page.goto(`/t/${TRIP_ID}/join`);
  await page.getByLabel("PIN").fill("1234");
  await page.getByRole("button", { name: "다음" }).click();
  await page.getByRole("button", { name: member }).click();
  await page.waitForURL(new RegExp(`/t/${TRIP_ID}/schedule$`));
}
