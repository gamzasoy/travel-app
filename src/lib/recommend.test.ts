import { describe, expect, it } from "vitest";
import { boundsAround, centerOf, distanceM, rankRecommendations, savedIds, withinRadius, type Recommendation } from "./recommend";
import type { Place } from "./types";

const place = (id: string, lat: number | null, lng: number | null, googlePlaceId = ""): Place => ({
  id,
  tripId: "t",
  name: id,
  address: "",
  lat,
  lng,
  googlePlaceId,
  category: null,
  visited: false,
});

const rec = (id: string, rating: number | null, reviews: number | null): Recommendation => ({
  googlePlaceId: id,
  name: id,
  address: "",
  lat: 35,
  lng: 139,
  rating,
  reviews,
  typeLabel: "",
  mapsUrl: "",
});

describe("centerOf", () => {
  it("좌표 있는 장소들의 평균 위치", () => {
    expect(centerOf([place("a", 35, 139), place("b", 36, 141), place("c", null, null)])).toEqual({ lat: 35.5, lng: 140 });
  });
  it("좌표 있는 장소가 없으면 null", () => {
    expect(centerOf([])).toBeNull();
    expect(centerOf([place("c", null, null)])).toBeNull();
  });
});

describe("distanceM / boundsAround / withinRadius", () => {
  const center = { lat: 35.7148, lng: 139.7967 }; // 센소지
  it("거리 계산 (위도 0.01도 ≈ 1.1km)", () => {
    expect(distanceM(center, { lat: center.lat + 0.01, lng: center.lng })).toBeCloseTo(1112, -1);
    expect(distanceM(center, center)).toBe(0);
  });
  it("범위 사각형은 반경만큼 위아래·좌우로 펼쳐진다", () => {
    const b = boundsAround(center, 1000);
    expect(distanceM(center, { lat: b.north, lng: center.lng })).toBeCloseTo(1000, -1);
    expect(distanceM(center, { lat: center.lat, lng: b.east })).toBeCloseTo(1000, -1);
  });
  it("반경 밖·좌표 없는 곳은 뺀다", () => {
    const near = { ...rec("near", 4.5, 100), lat: center.lat + 0.005, lng: center.lng };
    const far = { ...rec("far", 4.9, 100), lat: center.lat + 0.05, lng: center.lng };
    const none = { ...rec("none", 4.9, 100), lat: null, lng: null };
    expect(withinRadius([near, far, none], center, 1500).map((r) => r.googlePlaceId)).toEqual(["near"]);
  });
});

describe("rankRecommendations", () => {
  it("평점 내림차순, 같으면 리뷰 많은 순", () => {
    const out = rankRecommendations([rec("a", 4.2, 500), rec("b", 4.7, 100), rec("c", 4.7, 900)]);
    expect(out.map((r) => r.googlePlaceId)).toEqual(["c", "b", "a"]);
  });
  it("평점·리뷰 수가 없거나 리뷰가 적은 곳은 뺀다", () => {
    const out = rankRecommendations([rec("a", 5, 3), rec("b", null, 100), rec("c", 4.5, null), rec("d", 4.1, 30)]);
    expect(out.map((r) => r.googlePlaceId)).toEqual(["d"]);
    expect(rankRecommendations([rec("a", 5, 3)], { minReviews: 0 })).toHaveLength(1);
  });
  it("같은 구글 장소는 한 번만", () => {
    expect(rankRecommendations([rec("a", 4.5, 100), rec("a", 4.5, 100)])).toHaveLength(1);
  });
});

describe("savedIds", () => {
  it("구글 장소 ID 가 있는 것만", () => {
    expect([...savedIds([place("a", null, null, "g1"), place("b", null, null)])]).toEqual(["g1"]);
  });
});
