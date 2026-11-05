import { describe, expect, it } from "vitest";
import { formatPeriod, nowIn, splitReservations } from "./reservation";

describe("reservation", () => {
  it("splitReservations: 시간/날짜 기준으로 끝난 예약을 나눈다", () => {
    const list = [
      { id: "a", start: "2026-12-01T09:30:00.000+09:00", end: "2026-12-01T11:45:00.000+09:00" },
      { id: "b", start: "2026-12-01", end: "2026-12-04" },
      { id: "c", start: "2026-11-30", end: null },
      { id: "d", start: null, end: null },
    ];
    const { upcoming, past } = splitReservations(list, "2026-12-01T12:00");
    expect(past.map((r) => r.id)).toEqual(["a", "c"]);
    expect(upcoming.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("formatPeriod", () => {
    expect(formatPeriod("2026-12-01T09:30:00.000+09:00", "2026-12-01T11:45:00.000+09:00")).toBe("12/1 (화) 09:30 → 11:45");
    expect(formatPeriod("2026-12-01", "2026-12-04")).toBe("12/1 (화) → 12/4 (금)");
    expect(formatPeriod("2026-12-01T15:00", null)).toBe("12/1 (화) 15:00");
    expect(formatPeriod(null, null)).toBe("날짜 미정");
  });

  it("nowIn", () => {
    expect(nowIn("Asia/Tokyo", new Date("2026-12-01T03:05:00Z"))).toBe("2026-12-01T12:05");
  });
});
