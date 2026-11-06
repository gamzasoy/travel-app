import { expect, test } from "@playwright/test";
import { join } from "./helpers";
import { TRIP_ID } from "./ids";

/** 카카오톡 등 크롤러처럼 쿠키 없이 HTML 만 받아 og 태그를 읽는다 */
const meta = (html: string, property: string) =>
  html.match(new RegExp(`<meta[^>]+property="${property}"[^>]+content="([^"]*)"`))?.[1] ?? null;

test("초대 링크 미리보기: 리다이렉트 없이 여행 이름·기간·이미지(절대 주소), PIN 은 없음", async ({ request, baseURL }) => {
  const res = await request.get(`/t/${TRIP_ID}/join`, { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  const html = await res.text();

  expect(meta(html, "og:title")).toBe("도쿄 여행에 초대받았어요 ✈️");
  expect(meta(html, "og:description")).toContain("12/1 (화) ~ 12/5 (토)");
  expect(meta(html, "og:image")).toBe(`${baseURL}/og.png`);
  expect(meta(html, "og:image:width")).toBe("1200");
  expect(html).not.toContain("1234"); // PIN

  const img = await request.get("/og.png");
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toBe("image/png");
});

test("홈 화면도 기본 미리보기 이미지가 있다", async ({ request, baseURL }) => {
  const html = await (await request.get("/")).text();
  expect(meta(html, "og:title")).toBe("여행 플래너");
  expect(meta(html, "og:image")).toBe(`${baseURL}/og.png`);
});

test("이미 들어온 사람이 초대 링크를 다시 누르면 바로 일정으로, 설정의 초대 링크는 입장 화면 주소", async ({ page }) => {
  await join(page, "현우");
  await page.goto(`/t/${TRIP_ID}/join`);
  await expect(page).toHaveURL(new RegExp(`/t/${TRIP_ID}/schedule$`));

  await page.getByRole("link", { name: "설정" }).click();
  await expect(page.getByText(new RegExp(`/t/${TRIP_ID}/join$`))).toBeVisible();
});
