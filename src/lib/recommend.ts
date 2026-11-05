import { hasCoords, type LatLng } from "./map";
import type { Place } from "./types";

/** 추천 탭에서 고를 수 있는 종류 (장소로 저장할 때 같은 이름의 카테고리가 붙는다) */
export const RECOMMEND_KINDS = {
  맛집: { query: "맛집", includedType: "restaurant", icon: "🍜" },
  관광: { query: "관광 명소", includedType: "tourist_attraction", icon: "📸" },
} as const;
export type RecommendKind = keyof typeof RECOMMEND_KINDS;

export interface Recommendation {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  reviews: number | null;
  typeLabel: string;
  mapsUrl: string;
}

export type RankedRecommendation = Recommendation & { rating: number; reviews: number };

/** 좌표가 있는 장소들의 평균 위치 (없으면 null) */
export function centerOf(places: Place[]): LatLng | null {
  const pts = places.filter(hasCoords);
  if (pts.length === 0) return null;
  return {
    lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
    lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
  };
}

/** 검색어: "<지역> 맛집" (지역이 비면 키워드만 → 위치 기준 검색) */
export const recommendQuery = (region: string, kind: RecommendKind): string =>
  [region.trim(), RECOMMEND_KINDS[kind].query].filter(Boolean).join(" ");

/**
 * 구글 평점 순 추천 목록.
 * 평점·리뷰 수가 없거나 리뷰가 너무 적은 곳(평점이 믿기 어려움)은 빼고,
 * 평점 내림차순 → 리뷰 수 내림차순으로 정렬한다. 같은 구글 장소는 한 번만.
 */
export function rankRecommendations(list: Recommendation[], { minReviews = 30 }: { minReviews?: number } = {}): RankedRecommendation[] {
  const seen = new Set<string>();
  const out: RankedRecommendation[] = [];
  for (const r of list) {
    if (r.rating === null || r.reviews === null || r.reviews < minReviews) continue;
    if (r.googlePlaceId && seen.has(r.googlePlaceId)) continue;
    if (r.googlePlaceId) seen.add(r.googlePlaceId);
    out.push(r as RankedRecommendation);
  }
  return out.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
}

/** 이미 장소로 저장된 구글 장소 ID */
export const savedIds = (places: Place[]): Set<string> => new Set(places.map((p) => p.googlePlaceId).filter(Boolean));
