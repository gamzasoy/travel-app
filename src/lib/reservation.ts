import { dateOf, dayLabel, timeOf } from "./schedule";
import type { Reservation, ReservationKind } from "./types";

export const KIND_ICON: Record<ReservationKind, string> = {
  항공: "✈️",
  렌트카: "🚗",
  숙소: "🏨",
  기차: "🚆",
  투어: "🎟️",
  기타: "📌",
};

/** 종류별 시작/끝 이름 (항공: 출발/도착, 숙소: 체크인/체크아웃 …) */
export const KIND_LABELS: Record<ReservationKind | "none", [string, string]> = {
  항공: ["출발", "도착"],
  렌트카: ["픽업", "반납"],
  숙소: ["체크인", "체크아웃"],
  기차: ["출발", "도착"],
  투어: ["시작", "끝"],
  기타: ["시작", "끝"],
  none: ["시작", "끝"],
};

/** "2026-12-01T09:30:00.000+09:00" → "2026-12-01T09:30" (여행지 벽시계 기준 비교용) */
const localKey = (iso: string): string => {
  const d = dateOf(iso) ?? iso;
  const t = timeOf(iso);
  return t ? `${d}T${t}` : d;
};

/** 일시순. 같은 날이면 시간 있는 예약이 먼저, 날짜만 있는 예약은 그 뒤, 일시가 없으면 맨 뒤 */
export function compareReservations(a: Pick<Reservation, "start" | "title">, b: Pick<Reservation, "start" | "title">): number {
  const key = (s: string | null) => (s ? (localKey(s).includes("T") ? localKey(s) : `${s}T99`) : "~");
  const ka = key(a.start);
  const kb = key(b.start);
  // localeCompare 는 "~" 를 숫자보다 앞에 두므로 코드값으로 비교
  return ka < kb ? -1 : ka > kb ? 1 : a.title.localeCompare(b.title);
}

/**
 * 끝난 예약과 남은 예약으로 나눈다. now 는 여행지 기준 "YYYY-MM-DDTHH:MM".
 * 끝(없으면 시작)이 지났으면 끝난 예약. 날짜만 있으면 그날이 지나야 끝난 것으로 본다.
 */
export function splitReservations<T extends Pick<Reservation, "start" | "end">>(list: T[], now: string) {
  const today = now.slice(0, 10);
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const r of list) {
    const last = r.end ?? r.start;
    if (!last) {
      upcoming.push(r);
      continue;
    }
    const key = localKey(last);
    const done = key.includes("T") ? key < now : key < today;
    (done ? past : upcoming).push(r);
  }
  return { upcoming, past };
}

/** "12/1 (화) 09:30 → 11:45", "12/1 (화) → 12/4 (금)" */
export function formatPeriod(start: string | null, end: string | null): string {
  if (!start) return "날짜 미정";
  const part = (iso: string, withDate: boolean) => {
    const d = dateOf(iso);
    const t = timeOf(iso);
    return [withDate && d ? dayLabel(d) : null, t].filter(Boolean).join(" ");
  };
  const s = part(start, true);
  if (!end) return s;
  const sameDay = dateOf(start) === dateOf(end);
  const e = part(end, !sameDay);
  return e ? `${s} → ${e}` : s;
}

/** 여행지 기준 현재 시각 "YYYY-MM-DDTHH:MM" */
export function nowIn(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
