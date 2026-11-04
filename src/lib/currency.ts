import type { Currency } from "./types";

/**
 * 환율 단위: 100엔당 원 (예: 905 → 1엔 = 9.05원).
 * 금액은 항상 정수(엔·원 모두 소수점 없음)이고 환산 결과는 반올림한다.
 */

export const SYMBOL: Record<Currency, string> = { JPY: "¥", KRW: "₩" };

export function formatMoney(amount: number, currency: Currency): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}${SYMBOL[currency]}${Math.abs(amount).toLocaleString("ko-KR")}`;
}

/** 엔 → 원 */
export function jpyToKrw(jpy: number, rate: number): number {
  return Math.round((jpy * rate) / 100);
}

/** 원 → 엔 */
export function krwToJpy(krw: number, rate: number): number {
  return Math.round((krw * 100) / rate);
}

export function isValidRate(rate: unknown): rate is number {
  return typeof rate === "number" && Number.isFinite(rate) && rate >= 100 && rate <= 5000;
}

/**
 * 금액을 다른 통화로 환산한다.
 * @param rate 지출에 저장된 환율 스냅샷(엔→원). 없으면 fallbackRate 를 쓴다.
 * @returns 환산 불가(환율 없음)면 null
 */
export function convert(
  amount: number,
  from: Currency,
  to: Currency,
  rate: number | null,
  fallbackRate: number | null,
): number | null {
  if (from === to) return amount;
  const r = isValidRate(rate) ? rate : isValidRate(fallbackRate) ? fallbackRate : null;
  if (r === null) return null;
  return from === "JPY" ? jpyToKrw(amount, r) : krwToJpy(amount, r);
}
