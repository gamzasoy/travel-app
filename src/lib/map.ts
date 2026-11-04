import { dateOf, groupByDay, nextOrder, timeOf, toStart } from "./schedule";
import type { NewScheduleItem, Place, PlaceCategory, ScheduleItem } from "./types";

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
 * 그날 방문 순서를 orderedPlaceIds 순서로 바꾸기 위한 일정 변경안.
 * 장소별 첫 일정이 가진 (시간, 순서) "자리"는 그대로 두고, 장소들이 새 순서대로 그 자리를 하나씩 차지한다.
 * 일정은 시간 → 순서 순으로 정렬되므로, 시간이 있는 일정은 시간이 서로 옮겨 가고 시간이 없는 일정은 순서만 바뀐다.
 * 바뀌는 일정만 돌려주고(변화 없으면 빈 배열), orderedPlaceIds 가 그날 방문 장소와 맞지 않으면 null.
 */
export function planReorderVisits(
  items: ScheduleItem[],
  places: Place[],
  day: string,
  orderedPlaceIds: string[],
): VisitUpdate[] | null {
  const known = new Set(places.map((p) => p.id));
  const seen = new Set<string>();
  const slots: ScheduleItem[] = []; // 현재 방문 순서대로, 장소별 첫 일정
  for (const it of groupByDay(items).get(day) ?? []) {
    if (it.placeId && known.has(it.placeId) && !seen.has(it.placeId)) {
      seen.add(it.placeId);
      slots.push(it);
    }
  }
  if (orderedPlaceIds.length !== slots.length || new Set(orderedPlaceIds).size !== slots.length) return null;
  if (!orderedPlaceIds.every((id) => seen.has(id))) return null;

  const byPlace = new Map(slots.map((it) => [it.placeId as string, it]));
  const updates: VisitUpdate[] = [];
  orderedPlaceIds.forEach((placeId, k) => {
    const item = byPlace.get(placeId) as ScheduleItem;
    const slot = slots[k];
    if (item.id !== slot.id) updates.push({ id: item.id, start: toStart(day, timeOf(slot.start)), order: slot.order });
  });
  return updates;
}

export interface PlaceDayPlan {
  create: NewScheduleItem[];
  update: { id: string; item: NewScheduleItem }[];
  remove: string[];
}

/**
 * 장소의 방문 날짜를 wanted 로 맞추기 위한 일정 변경안.
 * - 새로 생긴 날짜: 그날 맨 뒤에 일정(제목=장소 이름)을 만든다
 * - 해제된 날짜의 일정이 있으면 새 날짜로 옮긴다 (제목·시간·메모 유지) → 날짜 "변경"
 * - 옮기고도 남는 해제된 날짜의 일정은 삭제한다
 * 날짜 없는 일정과 다른 장소의 일정은 건드리지 않는다.
 */
export function planPlaceDays(
  items: ScheduleItem[],
  place: Pick<Place, "id" | "name" | "tripId">,
  wanted: string[],
): PlaceDayPlan {
  const want = [...new Set(wanted)].sort();
  const wantSet = new Set(want);
  const linked = items.filter((i) => i.placeId === place.id && dateOf(i.start));
  const have = new Set(linked.map((i) => dateOf(i.start) as string));
  const spare = linked.filter((i) => !wantSet.has(dateOf(i.start) as string)); // 해제된 날짜의 일정
  const sim: ScheduleItem[] = [...items]; // 순서값(order) 계산용
  const plan: PlaceDayPlan = { create: [], update: [], remove: [] };

  for (const d of want.filter((x) => !have.has(x))) {
    const order = nextOrder(sim, d);
    const moved = spare.shift();
    if (moved) {
      const item: NewScheduleItem = {
        tripId: moved.tripId,
        title: moved.title,
        start: toStart(d, timeOf(moved.start)),
        placeId: place.id,
        note: moved.note,
        order,
      };
      plan.update.push({ id: moved.id, item });
      sim.push({ ...item, id: moved.id });
    } else {
      const item: NewScheduleItem = { tripId: place.tripId, title: place.name, start: d, placeId: place.id, note: "", order };
      plan.create.push(item);
      sim.push({ ...item, id: `new-${d}` });
    }
  }
  plan.remove = spare.map((i) => i.id);
  return plan;
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
