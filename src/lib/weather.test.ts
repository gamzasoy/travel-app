import { describe, expect, it } from "vitest";
import type { Place, ScheduleItem } from "./types";
import { coordKey, describeWeather, parseForecast, pickWeatherPlace } from "./weather-util";

const place = (id: string, over: Partial<Place> = {}): Place => ({
  id,
  tripId: "t",
  name: id,
  address: "",
  lat: 35.1,
  lng: 139.1,
  googlePlaceId: "",
  category: null,
  visited: false,
  ...over,
});
const item = (start: string, placeId: string | null): ScheduleItem => ({ id: start + placeId, tripId: "t", title: "", start, placeId, note: "", order: 0 });

describe("pickWeatherPlace", () => {
  const places = [place("noCoord", { lat: null, lng: null }), place("sensoji"), place("hotel", { category: "숙소" })];

  it("그날 일정의 첫 좌표 장소", () => {
    const items = [item("2026-12-01T09:00", "noCoord"), item("2026-12-01T10:00", "sensoji"), item("2026-12-02", "hotel")];
    expect(pickWeatherPlace("2026-12-01", items, places)?.name).toBe("sensoji");
  });

  it("없으면 숙소, 숙소도 없으면 null", () => {
    expect(pickWeatherPlace("2026-12-03", [], places)?.name).toBe("hotel");
    expect(pickWeatherPlace("2026-12-03", [], places.slice(0, 2))).toBeNull();
  });
});

describe("weather", () => {
  it("describeWeather", () => {
    expect(describeWeather(0).label).toBe("맑음");
    expect(describeWeather(63).icon).toBe("🌧️");
    expect(describeWeather(81).label).toBe("비");
    expect(describeWeather(73).label).toBe("눈");
    expect(describeWeather(95).label).toBe("뇌우");
    expect(describeWeather(null).label).toBe("알 수 없음");
  });

  it("parseForecast 는 반올림하고 빈 값은 null", () => {
    const m = parseForecast(
      {
        daily: {
          time: ["2026-12-01", "2026-12-02"],
          weather_code: [0, null],
          temperature_2m_max: [12.6, 10],
          temperature_2m_min: [3.4, null],
          precipitation_probability_max: [10, 80],
        },
      },
      "호텔",
    );
    expect(m.get("2026-12-01")).toEqual({ icon: "☀️", label: "맑음", max: 13, min: 3, pop: 10, placeName: "호텔" });
    expect(m.get("2026-12-02")).toMatchObject({ label: "알 수 없음", min: null, pop: 80 });
    expect(parseForecast({}, "x").size).toBe(0);
  });

  it("coordKey", () => {
    expect(coordKey(35.71481, 139.79671)).toBe("35.71,139.80");
  });
});
