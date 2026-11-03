/**
 * PIN 무차별 대입 완화용 실패 횟수 제한 (슬라이딩 윈도우).
 * 메모리 기반이라 서버리스 인스턴스마다 따로 센다 → 완전한 방어가 아니라 "완화" 수준.
 */
export function createLimiter(maxFails: number, windowMs: number) {
  const fails = new Map<string, number[]>();

  const recent = (key: string, now: number) => {
    const list = (fails.get(key) ?? []).filter((t) => now - t < windowMs);
    if (list.length) fails.set(key, list);
    else fails.delete(key);
    return list;
  };

  return {
    isBlocked: (key: string, now = Date.now()) => recent(key, now).length >= maxFails,
    recordFail: (key: string, now = Date.now()) => {
      fails.set(key, [...recent(key, now), now]);
    },
    reset: (key: string) => void fails.delete(key),
  };
}
