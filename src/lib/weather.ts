import "server-only";
import { TRIP_TIME_ZONE } from "./schedule";
import type { Place, ScheduleItem } from "./types";
import { coordKey, parseForecast, pickWeatherPlace, type DayWeather, type ForecastResponse } from "./weather-util";

// WEATHER_BASE_URL 은 테스트용 가짜 서버를 가리킬 때만 사용 (e2e/mock-notion.ts)
const BASE = process.env.WEATHER_BASE_URL ?? "https://api.open-meteo.com";

/** Open-Meteo 일별 예보 (오늘부터 16일). 실패하면 null — 화면은 날씨 없이 그대로 동작 */
async function fetchForecast(lat: number, lng: number): Promise<ForecastResponse | null> {
  const url = new URL("/v1/forecast", BASE);
  url.searchParams.set("latitude", lat.toFixed(2));
  url.searchParams.set("longitude", lng.toFixed(2));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("timezone", TRIP_TIME_ZONE);
  url.searchParams.set("forecast_days", "16");
  try {
    const res = await fetch(url, { next: { revalidate: 60 * 60 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return (await res.json()) as ForecastResponse;
  } catch {
    return null;
  }
}

/** 날짜 → 그날 일정 장소(없으면 숙소) 기준 날씨. 예보 범위 밖이거나 장소가 없으면 빠진다 */
export async function weatherForDays(days: string[], items: ScheduleItem[], places: Place[]): Promise<Record<string, DayWeather>> {
  const picks = days
    .map((day) => ({ day, place: pickWeatherPlace(day, items, places) }))
    .filter((x): x is { day: string; place: NonNullable<typeof x.place> } => x.place !== null);

  // 같은 좌표는 한 번만 요청
  const byCoord = new Map<string, { lat: number; lng: number }>();
  for (const { place } of picks) byCoord.set(coordKey(place.lat!, place.lng!), { lat: place.lat!, lng: place.lng! });
  const forecasts = new Map(
    await Promise.all([...byCoord].map(async ([key, c]) => [key, await fetchForecast(c.lat, c.lng)] as const)),
  );

  const out: Record<string, DayWeather> = {};
  for (const { day, place } of picks) {
    const json = forecasts.get(coordKey(place.lat!, place.lng!));
    const w = json ? parseForecast(json, place.name).get(day) : undefined;
    if (w) out[day] = w;
  }
  return out;
}
