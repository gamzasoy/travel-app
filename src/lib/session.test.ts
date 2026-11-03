import { beforeAll, describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_SEC, safeEqual, signSession, verifySession } from "./session";
import { createLimiter } from "./rate-limit";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-test-secret-1234";
});

describe("세션 토큰", () => {
  const data = { tripId: "trip-1", memberId: "m-1" };

  it("서명한 토큰을 검증하면 같은 데이터가 나온다", async () => {
    expect(await verifySession(await signSession(data))).toEqual(data);
  });

  it("본문이 바뀌면 거부한다", async () => {
    const [body, sig] = (await signSession(data)).split(".");
    const forged = btoa(JSON.stringify({ ...data, memberId: "m-2", exp: 9999999999 }))
      .replace(/=+$/, "");
    expect(forged).not.toBe(body);
    expect(await verifySession(`${forged}.${sig}`)).toBeNull();
  });

  it("다른 비밀키로 서명된 토큰은 거부한다", async () => {
    const token = await signSession(data);
    process.env.SESSION_SECRET = "another-secret-another-secret";
    expect(await verifySession(token)).toBeNull();
    process.env.SESSION_SECRET = "test-secret-test-secret-1234";
  });

  it("만료된 토큰은 거부한다", async () => {
    const token = await signSession(data, 1_000);
    expect(await verifySession(token, 1_000 + SESSION_MAX_AGE_SEC - 1)).toEqual(data);
    expect(await verifySession(token, 1_000 + SESSION_MAX_AGE_SEC)).toBeNull();
  });

  it("쓰레기 입력은 null", async () => {
    for (const t of [undefined, null, "", "abc", "a.b", "a.b.c", "!!!.???"]) {
      expect(await verifySession(t)).toBeNull();
    }
  });
});

describe("safeEqual", () => {
  it("같으면 true, 다르거나 길이가 다르면 false", () => {
    expect(safeEqual("1234", "1234")).toBe(true);
    expect(safeEqual("1234", "1235")).toBe(false);
    expect(safeEqual("1234", "12345")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("실패 횟수 제한", () => {
  it("한도에 도달하면 차단하고 윈도우가 지나면 풀린다", () => {
    const l = createLimiter(3, 1000);
    l.recordFail("t", 0);
    l.recordFail("t", 100);
    expect(l.isBlocked("t", 200)).toBe(false);
    l.recordFail("t", 200);
    expect(l.isBlocked("t", 300)).toBe(true);
    expect(l.isBlocked("other", 300)).toBe(false);
    expect(l.isBlocked("t", 1100)).toBe(false); // 0, 100 은 만료 → 1건만 남음
  });

  it("reset 하면 풀린다", () => {
    const l = createLimiter(1, 1000);
    l.recordFail("t", 0);
    expect(l.isBlocked("t", 1)).toBe(true);
    l.reset("t");
    expect(l.isBlocked("t", 1)).toBe(false);
  });
});
