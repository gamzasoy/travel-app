import "server-only";
import { isValidRate } from "./currency";
import type { Trip } from "./types";

const URL = "https://open.er-api.com/v6/latest/JPY";

/** 공개 환율(100엔당 원). 실패하면 null — 호출하는 쪽에서 수동 환율로 안내한다. */
export async function fetchLiveRate(): Promise<number | null> {
  try {
    const res = await fetch(URL, { next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; rates?: Record<string, unknown> };
    const krwPerYen = json.rates?.KRW;
    if (json.result !== "success" || typeof krwPerYen !== "number") return null;
    const per100 = Math.round(krwPerYen * 100 * 100) / 100;
    return isValidRate(per100) ? per100 : null;
  } catch {
    return null;
  }
}

export type RateInfo = { rate: number | null; source: "manual" | "live" | "none" };

/** 수동 환율이 있으면 우선, 없으면 공개 환율 */
export async function getRate(trip: Trip): Promise<RateInfo> {
  if (isValidRate(trip.manualRate)) return { rate: trip.manualRate, source: "manual" };
  const live = await fetchLiveRate();
  return live === null ? { rate: null, source: "none" } : { rate: live, source: "live" };
}
