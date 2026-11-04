import { describe, expect, it } from "vitest";
import {
  dateOf,
  dateRange,
  dayLabel,
  directionsUrl,
  groupByDay,
  nextOrder,
  pickDefaultDay,
  timeOf,
  toStart,
  todayIn,
  tripDays,
} from "./schedule";
import type { ScheduleItem } from "./types";

let n = 0;
const item = (start: string | null, order = 0, title = `i${++n}`): ScheduleItem => ({
  id: `s${n}`,
  tripId: "t",
  title,
  start,
  placeId: null,
  note: "",
  order,
});

describe("날짜/시간 파싱", () => {
  it("dateOf / timeOf", () => {
    expect(dateOf("2026-12-01T12:30:00.000+09:00")).toBe("2026-12-01");
    expect(dateOf("2026-12-01")).toBe("2026-12-01");
    expect(dateOf(null)).toBeNull();
    expect(dateOf("abc")).toBeNull();
    expect(timeOf("2026-12-01T12:30:00.000+09:00")).toBe("12:30");
    expect(timeOf("2026-12-01T09:05:00")).toBe("09:05");
    expect(timeOf("2026-12-01")).toBeNull();
  });

  it("toStart ↔ dateOf/timeOf 왕복", () => {
    expect(toStart("2026-12-01", null)).toBe("2026-12-01");
    expect(toStart("2026-12-01", "18:00")).toBe("2026-12-01T18:00:00");
    const s = toStart("2026-12-01", "18:00");
    expect([dateOf(s), timeOf(s)]).toEqual(["2026-12-01", "18:00"]);
  });
});

describe("dateRange / tripDays", () => {
  it("기간을 포함해서 펼친다 (월 경계 포함)", () => {
    expect(dateRange("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });
  it("끝이 없으면 하루, 역순/형식 오류는 빈 배열", () => {
    expect(dateRange("2026-12-01", null)).toEqual(["2026-12-01"]);
    expect(dateRange("2026-12-05", "2026-12-01")).toEqual([]);
    expect(dateRange(null, null)).toEqual([]);
  });
  it("최대 일수로 자른다", () => {
    expect(dateRange("2026-01-01", "2030-01-01", 10)).toHaveLength(10);
  });
  it("기간 밖의 일정 날짜도 탭에 포함하고 정렬한다", () => {
    const days = tripDays("2026-12-01", "2026-12-02", [item("2026-12-04T10:00:00"), item("2026-11-30")]);
    expect(days).toEqual(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-04"]);
  });
  it("기간도 일정도 없으면 빈 배열", () => {
    expect(tripDays(null, null, [])).toEqual([]);
  });
});

describe("groupByDay", () => {
  it("시간 있는 일정은 시간순, 없는 일정은 뒤에 order 순", () => {
    const a = item("2026-12-01T15:00:00", 0, "a");
    const b = item("2026-12-01T09:00:00", 5, "b");
    const c = item("2026-12-01", 2, "c");
    const d = item("2026-12-01", 1, "d");
    const e = item("2026-12-02T08:00:00", 0, "e");
    const g = groupByDay([a, b, c, d, e]);
    expect(g.get("2026-12-01")!.map((i) => i.title)).toEqual(["b", "a", "d", "c"]);
    expect(g.get("2026-12-02")!.map((i) => i.title)).toEqual(["e"]);
  });
  it("같은 시간이면 order 순, 날짜 없는 일정은 '미정'", () => {
    const g = groupByDay([item("2026-12-01T10:00:00", 2, "x"), item("2026-12-01T10:00:00", 1, "y"), item(null, 0, "z")]);
    expect(g.get("2026-12-01")!.map((i) => i.title)).toEqual(["y", "x"]);
    expect(g.get("미정")!.map((i) => i.title)).toEqual(["z"]);
  });
});

describe("기타", () => {
  it("pickDefaultDay", () => {
    expect(pickDefaultDay(["2026-12-01", "2026-12-02"], "2026-12-02")).toBe("2026-12-02");
    expect(pickDefaultDay(["2026-12-01", "2026-12-02"], "2026-11-04")).toBe("2026-12-01");
    expect(pickDefaultDay([], "2026-11-04")).toBeNull();
  });

  it("todayIn 은 시간대 기준 날짜", () => {
    const t = new Date("2026-12-01T16:00:00Z"); // 도쿄는 이미 12/2 01:00
    expect(todayIn("Asia/Tokyo", t)).toBe("2026-12-02");
    expect(todayIn("UTC", t)).toBe("2026-12-01");
  });

  it("dayLabel", () => {
    expect(dayLabel("2026-12-01")).toBe("12/1 (화)");
    expect(dayLabel("미정")).toBe("미정");
  });

  it("nextOrder: 같은 날 최대값 + 1", () => {
    expect(nextOrder([], "2026-12-01")).toBe(0);
    expect(nextOrder([item("2026-12-01", 3), item("2026-12-02", 9)], "2026-12-01")).toBe(4);
  });

  it("directionsUrl: 좌표가 있으면 좌표+place id", () => {
    const u = new URL(directionsUrl({ name: "이치란", address: "", lat: 35.66, lng: 139.7, googlePlaceId: "ChIJabc" }));
    expect(u.origin + u.pathname).toBe("https://www.google.com/maps/dir/");
    expect(u.searchParams.get("api")).toBe("1");
    expect(u.searchParams.get("destination")).toBe("35.66,139.7");
    expect(u.searchParams.get("destination_place_id")).toBe("ChIJabc");
  });

  it("directionsUrl: 좌표가 없으면 이름+주소 검색", () => {
    const u = new URL(directionsUrl({ name: "호텔 A", address: "Shinjuku", lat: null, lng: null, googlePlaceId: "" }));
    expect(u.searchParams.get("destination")).toBe("호텔 A Shinjuku");
    expect(u.searchParams.has("destination_place_id")).toBe(false);
  });
});
