import { groupByDay } from "./schedule";
import type { Place, PlaceCategory, ScheduleItem } from "./types";

export const CATEGORY_COLOR: Record<PlaceCategory, string> = {
  숙소: "#8b5cf6",
  맛집: "#f97316",
  관광: "#f4b8c4",
  쇼핑: "#14b8a6",
  교통: "#64748b",
};
export const DEFAULT_PIN_COLOR = "#94a3b8";

export const categoryColor = (c: PlaceCategory | null): string => (c ? CATEGORY_COLOR[c] : DEFAULT_PIN_COLOR);

export type LatLng = { lat: number; lng: number };
export type PlaceWithCoords = Place & { lat: number; lng: number };

export const hasCoords = (p: Place): p is PlaceWithCoords => p.lat !== null && p.lng !== null;

export interface RouteStop {
  /** 그날 경로에서의 순번 (1부터) */
  n: number;
  item: ScheduleItem;
  place: PlaceWithCoords;
}

/** 그날 일정 순서대로 좌표가 있는 장소만 이어 만든 경로 */
export function routeForDay(items: ScheduleItem[], places: Place[], day: string | null): RouteStop[] {
  if (!day) return [];
  const byId = new Map(places.map((p) => [p.id, p]));
  const stops: RouteStop[] = [];
  for (const item of groupByDay(items).get(day) ?? []) {
    const place = item.placeId ? byId.get(item.placeId) : undefined;
    if (place && hasCoords(place)) stops.push({ n: stops.length + 1, item, place });
  }
  return stops;
}

export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function boundsOf(points: LatLng[]): Bounds | null {
  if (points.length === 0) return null;
  return {
    north: Math.max(...points.map((p) => p.lat)),
    south: Math.min(...points.map((p) => p.lat)),
    east: Math.max(...points.map((p) => p.lng)),
    west: Math.min(...points.map((p) => p.lng)),
  };
}

/** 지도 기본 위치 (장소가 하나도 없을 때): 도쿄 */
export const DEFAULT_CENTER: LatLng = { lat: 35.6812, lng: 139.7671 };
