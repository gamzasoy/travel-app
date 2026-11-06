import "server-only";
import type { Metadata } from "next";
import { headers } from "next/headers";

/** 요청 기준 사이트 주소 (예: https://travel.vercel.app). 배포 도메인이 바뀌어도 그대로 맞는다 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** 친구에게 보내는 초대 링크. 입장 화면을 바로 가리켜야 카톡 미리보기가 리다이렉트 없이 만들어진다 */
export const inviteUrl = (origin: string, tripId: string) => `${origin}/t/${tripId}/join`;

export const SITE_NAME = "여행 플래너";
export const SITE_DESCRIPTION = "친구들과 함께 쓰는 여행 일정·지도·가계부·준비물";

/** 카카오톡·메신저 링크 미리보기 이미지 (scripts/make-og.mjs 로 생성) */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "여행 플래너" };

/** 페이지별 미리보기 메타데이터. openGraph 는 상위 값과 합쳐지지 않고 통째로 바뀌므로 이미지까지 함께 넣는다 */
export function shareMetadata(title: string, description: string): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: { type: "website", siteName: SITE_NAME, locale: "ko_KR", title, description, images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}
