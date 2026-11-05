import { hasCoords, type Bounds, type LatLng } from "./map";
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

/** 두 지점 사이 거리 (m, 하버사인) */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** center 를 둘러싼 반경 radiusM 의 사각 범위 (검색 범위 제한용) */
export function boundsAround(center: LatLng, radiusM: number): Bounds {
  const dLat = (radiusM / 6371000) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((center.lat * Math.PI) / 180), 1e-6);
  return { north: center.lat + dLat, south: center.lat - dLat, east: center.lng + dLng, west: center.lng - dLng };
}

/** center 에서 radiusM 안에 있는 곳만 (좌표 없는 곳은 뺀다) */
export const withinRadius = <T extends { lat: number | null; lng: number | null }>(list: T[], center: LatLng, radiusM: number): T[] =>
  list.filter((r) => r.lat !== null && r.lng !== null && distanceM(center, { lat: r.lat, lng: r.lng }) <= radiusM);

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
