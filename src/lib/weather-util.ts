import { dateOf } from "./schedule";
import type { Place, ScheduleItem } from "./types";

export interface DayWeather {
  icon: string;
  label: string;
  max: number | null;
  min: number | null;
  /** 강수 확률 (%) */
  pop: number | null;
  /** 날씨 기준 장소 이름 */
  placeName: string;
}

type Coord = Pick<Place, "name" | "lat" | "lng">;
const hasCoord = (p: Place | undefined): p is Place & { lat: number; lng: number } =>
  !!p && p.lat !== null && p.lng !== null;

/** 그날 일정에 연결된 첫 장소(좌표 있는 것) → 없으면 숙소 → 없으면 null */
export function pickWeatherPlace(day: string, items: ScheduleItem[], places: Place[]): Coord | null {
  const byId = new Map(places.map((p) => [p.id, p]));
  for (const it of items) {
    if (dateOf(it.start) !== day || !it.placeId) continue;
    const p = byId.get(it.placeId);
    if (hasCoord(p)) return p;
  }
  return places.find((p) => p.category === "숙소" && hasCoord(p)) ?? null;
}

/** 캐시·요청 수를 줄이려고 좌표를 소수 2자리(약 1km)로 묶는다 */
export const coordKey = (lat: number, lng: number) => `${lat.toFixed(2)},${lng.toFixed(2)}`;

/** WMO 날씨 코드 → 아이콘·한글 (https://open-meteo.com/en/docs 의 weather_code 표) */
export function describeWeather(code: number | null): { icon: string; label: string } {
  if (code === null) return { icon: "❔", label: "알 수 없음" };
  if (code === 0) return { icon: "☀️", label: "맑음" };
  if (code <= 2) return { icon: "🌤️", label: "구름 조금" };
  if (code === 3) return { icon: "☁️", label: "흐림" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "안개" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "이슬비" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: "🌧️", label: "비" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: "🌨️", label: "눈" };
  if (code >= 95) return { icon: "⛈️", label: "뇌우" };
  return { icon: "❔", label: "알 수 없음" };
}

export interface ForecastResponse {
  daily?: {
    time?: string[];
    weather_code?: (number | null)[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

/** Open-Meteo 응답 → 날짜별 날씨 */
export function parseForecast(json: ForecastResponse, placeName: string): Map<string, DayWeather> {
  const d = json.daily ?? {};
  const out = new Map<string, DayWeather>();
  const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  (d.time ?? []).forEach((date, i) => {
    const code = d.weather_code?.[i];
    out.set(date, {
      ...describeWeather(typeof code === "number" ? code : null),
      max: num(d.temperature_2m_max?.[i]),
      min: num(d.temperature_2m_min?.[i]),
      pop: num(d.precipitation_probability_max?.[i]),
      placeName,
    });
  });
  return out;
}
