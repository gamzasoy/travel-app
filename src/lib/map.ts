import { groupByDay, timeOf, toStart } from "./schedule";
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

/** 날짜 → 그날 일정에 연결된 장소 (일정 순서, 같은 장소 중복 제거). 장소 없는 일정·삭제된 장소는 제외 */
export function placesByDay(items: ScheduleItem[], places: Place[]): Map<string, Place[]> {
  const byId = new Map(places.map((p) => [p.id, p]));
  const out = new Map<string, Place[]>();
  for (const [day, list] of groupByDay(items)) {
    const seen = new Set<string>();
    const ps: Place[] = [];
    for (const it of list) {
      const place = it.placeId ? byId.get(it.placeId) : undefined;
      if (place && !seen.has(place.id)) {
        seen.add(place.id);
        ps.push(place);
      }
    }
    if (ps.length > 0) out.set(day, ps);
  }
  return out;
}

export interface VisitUpdate {
  id: string;
  start: string;
  order: number;
}

/**
 * 그날 방문 순서에서 장소를 한 칸 위(-1)/아래(1)로 옮기기 위한 일정 변경안.
 * 장소별 첫 일정 두 개의 (시간, 순서)를 서로 맞바꾼다 — 일정은 시간 → 순서 순으로 정렬되므로
 * 시간이 있는 일정은 시간이 서로 바뀌고, 시간이 없는 일정은 순서만 바뀐다.
 * 이미 맨 위/아래이거나 그날 방문 목록에 없으면 null.
 */
export function planMoveVisit(
  items: ScheduleItem[],
  places: Place[],
  day: string,
  placeId: string,
  dir: -1 | 1,
): VisitUpdate[] | null {
  const known = new Set(places.map((p) => p.id));
  const seen = new Set<string>();
  const firsts: ScheduleItem[] = [];
  for (const it of groupByDay(items).get(day) ?? []) {
    if (it.placeId && known.has(it.placeId) && !seen.has(it.placeId)) {
      seen.add(it.placeId);
      firsts.push(it);
    }
  }
  const i = firsts.findIndex((it) => it.placeId === placeId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= firsts.length) return null;
  const a = firsts[i];
  const b = firsts[j];
  const take = (to: ScheduleItem, from: ScheduleItem): VisitUpdate => ({
    id: to.id,
    start: toStart(day, timeOf(from.start)),
    order: from.order,
  });
  return [take(a, b), take(b, a)];
}

/** 장소 → 방문하는 날의 Day 번호들 (days 의 1부터 시작하는 순번, 오름차순) */
export function dayNumbersByPlace(byDay: Map<string, Place[]>, days: string[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  days.forEach((d, i) => {
    for (const p of byDay.get(d) ?? []) out.set(p.id, [...(out.get(p.id) ?? []), i + 1]);
  });
  return out;
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
