import { describe, expect, it } from "vitest";
import { boundsOf, categoryColor, dayNumbersByPlace, hasCoords, placesByDay, planPlaceDays, planReorderVisits, routeForDay } from "./map";
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

describe("placesByDay / dayNumbersByPlace", () => {
  const places = [place("a", 35.1, 139.1), place("b", 35.2, 139.2), place("noc", null, null), place("x", 1, 1)];
  const items = [
    item("2026-12-01T15:00:00", "b"),
    item("2026-12-01T09:00:00", "a"),
    item("2026-12-01T18:00:00", "a"), // 같은 날 같은 장소 → 한 번만
    item("2026-12-01T20:00:00", null), // 장소 없음
    item("2026-12-02T09:00:00", "a"),
    item("2026-12-02T10:00:00", "gone"), // 삭제된 장소
    item("2026-12-03", "noc"), // 좌표 없는 장소도 목록에는 포함
  ];

  it("날짜별로 그날 일정 순서대로 장소를 모은다", () => {
    const m = placesByDay(items, places);
    expect(m.get("2026-12-01")?.map((p) => p.id)).toEqual(["a", "b"]);
    expect(m.get("2026-12-02")?.map((p) => p.id)).toEqual(["a"]);
    expect(m.get("2026-12-03")?.map((p) => p.id)).toEqual(["noc"]);
    expect(m.has("2026-12-04")).toBe(false);
  });

  it("장소가 방문하는 Day 번호", () => {
    const days = ["2026-12-01", "2026-12-02", "2026-12-03"];
    const nums = dayNumbersByPlace(placesByDay(items, places), days);
    expect(nums.get("a")).toEqual([1, 2]);
    expect(nums.get("b")).toEqual([1]);
    expect(nums.get("noc")).toEqual([3]);
    expect(nums.has("x")).toBe(false); // 어느 일정에도 없는 장소
  });
});

describe("planReorderVisits", () => {
  const places = [place("a", 1, 1), place("b", 2, 2), place("c", 3, 3)];
  const D = "2026-12-01";
  const byId = (u: { id: string }[]) => Object.fromEntries(u.map((x) => [x.id, x]));

  it("시간 있는 일정은 새 순서대로 시간 자리를 하나씩 옮겨 받는다 (맨 뒤를 맨 앞으로)", () => {
    const ia = item(`${D}T09:00:00`, "a", 0);
    const ib = item(`${D}T12:00:00`, "b", 1);
    const ic = item(`${D}T19:00:00`, "c", 2);
    const r = byId(planReorderVisits([ia, ib, ic], places, D, ["c", "a", "b"])!);
    expect(r[ic.id]).toEqual({ id: ic.id, start: `${D}T09:00:00`, order: 0 });
    expect(r[ia.id]).toEqual({ id: ia.id, start: `${D}T12:00:00`, order: 1 });
    expect(r[ib.id]).toEqual({ id: ib.id, start: `${D}T19:00:00`, order: 2 });
  });

  it("시간 없는 일정은 순서만 바뀐다", () => {
    const ia = item(D, "a", 0);
    const ib = item(D, "b", 1);
    const r = byId(planReorderVisits([ia, ib], places, D, ["b", "a"])!);
    expect(r[ia.id]).toEqual({ id: ia.id, start: D, order: 1 });
    expect(r[ib.id]).toEqual({ id: ib.id, start: D, order: 0 });
  });

  it("시간 있는 일정과 없는 일정도 위치가 바뀐다", () => {
    const ia = item(`${D}T09:00:00`, "a", 0); // a 가 먼저 (시간 있음)
    const ib = item(D, "b", 1); // b 는 시간 없음 → 뒤
    const r = byId(planReorderVisits([ia, ib], places, D, ["b", "a"])!);
    expect(r[ib.id]).toEqual({ id: ib.id, start: `${D}T09:00:00`, order: 0 });
    expect(r[ia.id]).toEqual({ id: ia.id, start: D, order: 1 });
  });

  it("자리가 그대로인 일정은 건드리지 않고, 변화가 없으면 빈 배열", () => {
    const ia = item(`${D}T09:00:00`, "a", 0);
    const ib = item(`${D}T12:00:00`, "b", 1);
    const ic = item(`${D}T19:00:00`, "c", 2);
    expect(planReorderVisits([ia, ib, ic], places, D, ["a", "c", "b"])!.map((u) => u.id).sort()).toEqual([ib.id, ic.id].sort());
    expect(planReorderVisits([ia, ib, ic], places, D, ["a", "b", "c"])).toEqual([]);
  });

  it("같은 장소를 여러 번 가면 첫 일정만 옮기고, 장소 없는 일정은 건너뛴다", () => {
    const a1 = item(`${D}T09:00:00`, "a", 0);
    const x = item(`${D}T10:00:00`, null, 1);
    const b = item(`${D}T12:00:00`, "b", 2);
    const a2 = item(`${D}T18:00:00`, "a", 3);
    const r = planReorderVisits([a1, x, b, a2], places, D, ["b", "a"])!;
    expect(r.map((u) => u.id).sort()).toEqual([a1.id, b.id].sort());
  });

  it("그날 방문 장소와 맞지 않는 목록(빠짐·중복·모르는 장소·다른 날)은 null", () => {
    const ia = item(D, "a", 0);
    const ib = item(D, "b", 1);
    expect(planReorderVisits([ia, ib], places, D, ["a"])).toBeNull();
    expect(planReorderVisits([ia, ib], places, D, ["a", "a"])).toBeNull();
    expect(planReorderVisits([ia, ib], places, D, ["a", "c"])).toBeNull();
    expect(planReorderVisits([ia, ib], places, "2026-12-02", ["a", "b"])).toBeNull();
  });
});

describe("planPlaceDays", () => {
  const pl = { id: "p1", name: "센소지", tripId: "t" };
  const D1 = "2026-12-01";
  const D2 = "2026-12-02";
  const D3 = "2026-12-03";

  it("새 날짜를 고르면 그날 맨 뒤에 장소 이름으로 일정을 만든다", () => {
    const other = item(`${D1}T09:00:00`, "x", 4); // 같은 날 다른 일정 → order 는 그 뒤
    const plan = planPlaceDays([other], pl, [D1]);
    expect(plan.create).toEqual([{ tripId: "t", title: "센소지", start: D1, placeId: "p1", note: "", order: 5 }]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("이미 있는 날짜는 그대로 두고, 여러 날짜를 고를 수 있다", () => {
    const have = item(`${D1}T10:00:00`, "p1", 0);
    const plan = planPlaceDays([have], pl, [D1, D2]);
    expect(plan.create.map((c) => c.start)).toEqual([D2]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
  });

  it("날짜를 바꾸면 기존 일정을 새 날짜로 옮긴다 (제목·시간·메모 유지)", () => {
    const have = { ...item(`${D1}T10:00:00`, "p1", 0), title: "아침 센소지", note: "일찍" };
    const plan = planPlaceDays([have], pl, [D2]);
    expect(plan.create).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.update).toEqual([
      { id: have.id, item: { tripId: "t", title: "아침 센소지", start: `${D2}T10:00:00`, placeId: "p1", note: "일찍", order: 0 } },
    ]);
  });

  it("날짜를 해제하면 그날 일정은 삭제한다 (날짜 없음 일정·다른 장소 일정은 그대로)", () => {
    const a = item(`${D1}T10:00:00`, "p1", 0);
    const b = item(`${D2}`, "p1", 0);
    const undated = item(null, "p1", 0);
    const other = item(D1, "x", 1);
    const plan = planPlaceDays([a, b, undated, other], pl, [D2]);
    expect(plan.remove).toEqual([a.id]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(planPlaceDays([a, b, undated, other], pl, []).remove.sort()).toEqual([a.id, b.id].sort());
  });

  it("해제와 추가가 함께면 옮기고, 남는 쪽은 만들거나 삭제한다", () => {
    const a = item(D1, "p1", 0);
    const b = item(D2, "p1", 0);
    // D1, D2 해제 → D3 추가: 하나는 D3 로 이동, 하나는 삭제
    const plan = planPlaceDays([a, b], pl, [D3]);
    expect(plan.update).toHaveLength(1);
    expect(plan.update[0].item.start).toBe(D3);
    expect(plan.remove).toHaveLength(1);
    expect(plan.create).toEqual([]);
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
    expect(categoryColor("쇼핑")).toBe("#14b8a6");
    expect(categoryColor(null)).toBe("#94a3b8");
  });
});
