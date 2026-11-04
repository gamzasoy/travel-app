import { describe, expect, it } from "vitest";
import { boundsOf, categoryColor, hasCoords, routeForDay } from "./map";
import type { Place, ScheduleItem } from "./types";

const place = (id: string, lat: number | null, lng: number | null): Place => ({
  id,
  tripId: "t",
  name: id,
  address: "",
  lat,
  lng,
  googlePlaceId: "",
  category: null,
  visited: false,
});
let n = 0;
const item = (start: string | null, placeId: string | null, order = 0): ScheduleItem => ({
  id: `s${++n}`,
  tripId: "t",
  title: `t${n}`,
  start,
  placeId,
  note: "",
  order,
});

describe("routeForDay", () => {
  const places = [place("a", 35.1, 139.1), place("b", 35.2, 139.2), place("noc", null, null)];

  it("그날 일정 순서(시간순)대로 좌표 있는 장소만 번호를 매긴다", () => {
    const items = [
      item("2026-12-01T15:00:00", "b"),
      item("2026-12-01T09:00:00", "a"),
      item("2026-12-01T12:00:00", "noc"), // 좌표 없음 → 건너뜀
      item("2026-12-01T13:00:00", null), // 장소 없음 → 건너뜀
      item("2026-12-02T09:00:00", "a"), // 다른 날
    ];
    const r = routeForDay(items, places, "2026-12-01");
    expect(r.map((s) => [s.n, s.place.id])).toEqual([[1, "a"], [2, "b"]]);
  });

  it("같은 장소를 두 번 방문하면 두 번 나온다", () => {
    const items = [item("2026-12-01T09:00:00", "a"), item("2026-12-01T18:00:00", "a")];
    expect(routeForDay(items, places, "2026-12-01").map((s) => s.n)).toEqual([1, 2]);
  });

  it("삭제된 장소를 가리키는 일정이나 날짜 없음은 빈 경로", () => {
    expect(routeForDay([item("2026-12-01", "gone")], places, "2026-12-01")).toEqual([]);
    expect(routeForDay([item("2026-12-01", "a")], places, null)).toEqual([]);
  });
});

describe("boundsOf / hasCoords / categoryColor", () => {
  it("경계 계산", () => {
    expect(boundsOf([{ lat: 35, lng: 139 }, { lat: 36, lng: 138 }, { lat: 34, lng: 140 }])).toEqual({
      north: 36,
      south: 34,
      east: 140,
      west: 138,
    });
    expect(boundsOf([])).toBeNull();
  });
  it("0 좌표도 좌표로 취급한다", () => {
    expect(hasCoords(place("z", 0, 0))).toBe(true);
    expect(hasCoords(place("z", 0, null))).toBe(false);
  });
  it("카테고리 색", () => {
    expect(categoryColor("맛집")).toBe("#f97316");
    expect(categoryColor(null)).toBe("#94a3b8");
  });
});
