import type { Place, ScheduleItem } from "./types";

/** 여행지 현지 시간대. 시간이 있는 일정은 이 시간대의 "벽시계 시간"으로 저장한다. */
export const TRIP_TIME_ZONE = "Asia/Tokyo";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_RE = /T(\d{2}):(\d{2})/;

/** "2026-12-01T12:30:00+09:00" → "2026-12-01" */
export const dateOf = (iso: string | null): string | null => iso?.match(DATE_RE)?.slice(1, 4).join("-") ?? null;

/** "2026-12-01T12:30:00+09:00" → "12:30", 시간이 없으면 null */
export const timeOf = (iso: string | null): string | null => {
  const m = iso?.match(TIME_RE);
  return m ? `${m[1]}:${m[2]}` : null;
};

/** 폼 입력(날짜, 선택적 시간)을 노션에 저장할 ISO 문자열로 */
export const toStart = (date: string, time: string | null): string => (time ? `${date}T${time}:00` : date);

const toUtcMs = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** start..end 날짜(포함) 목록. 역순이거나 형식이 틀리면 빈 배열, 최대 maxDays 일 */
export function dateRange(start: string | null, end: string | null, maxDays = 60): string[] {
  const s = dateOf(start);
  const e = dateOf(end) ?? s;
  if (!s || !e || toUtcMs(e) < toUtcMs(s)) return [];
  const days: string[] = [];
  for (let ms = toUtcMs(s); ms <= toUtcMs(e) && days.length < maxDays; ms += 86_400_000) days.push(fromUtcMs(ms));
  return days;
}

/** 여행 기간 + 일정이 있는 날짜를 합쳐 정렬한 날짜 탭 목록 */
export function tripDays(tripStart: string | null, tripEnd: string | null, items: ScheduleItem[]): string[] {
  const set = new Set(dateRange(tripStart, tripEnd));
  for (const it of items) {
    const d = dateOf(it.start);
    if (d) set.add(d);
  }
  return [...set].sort();
}

/** 날짜 → 그날 일정 (시간 있는 것 먼저 시간순, 시간 없는 것은 순서대로 뒤에). "미정"은 날짜 없는 일정 */
export function groupByDay(items: ScheduleItem[]): Map<string, ScheduleItem[]> {
  const map = new Map<string, ScheduleItem[]>();
  for (const it of items) {
    const key = dateOf(it.start) ?? "미정";
    map.set(key, [...(map.get(key) ?? []), it]);
  }
  for (const [k, list] of map) {
    map.set(
      k,
      [...list].sort((a, b) => {
        const ta = timeOf(a.start);
        const tb = timeOf(b.start);
        if (ta && tb) return ta.localeCompare(tb) || a.order - b.order;
        if (ta) return -1;
        if (tb) return 1;
        return a.order - b.order;
      }),
    );
  }
  return map;
}

/** 오늘이 여행 날짜에 있으면 오늘, 아니면 첫날 */
export function pickDefaultDay(days: string[], today: string): string | null {
  return days.includes(today) ? today : (days[0] ?? null);
}

export const todayIn = (timeZone: string, now = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026-12-01" → "12/1 (화)" */
export function dayLabel(date: string): string {
  if (!DATE_RE.test(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  return `${m}/${d} (${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/** 다음 순서값: 같은 날 일정의 최대 order + 1 */
export const nextOrder = (items: ScheduleItem[], date: string): number =>
  Math.max(-1, ...items.filter((i) => dateOf(i.start) === date).map((i) => i.order)) + 1;

/** 구글맵 길찾기 링크. 좌표가 있으면 좌표(+place id), 없으면 이름/주소 검색 */
export function directionsUrl(place: Pick<Place, "name" | "address" | "lat" | "lng" | "googlePlaceId">): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  if (place.lat !== null && place.lng !== null) {
    url.searchParams.set("destination", `${place.lat},${place.lng}`);
    if (place.googlePlaceId) url.searchParams.set("destination_place_id", place.googlePlaceId);
  } else {
    url.searchParams.set("destination", [place.name, place.address].filter(Boolean).join(" "));
  }
  return url.toString();
}
