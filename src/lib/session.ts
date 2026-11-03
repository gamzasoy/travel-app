/**
 * 서명된 세션 토큰 (HMAC-SHA256). middleware(edge)와 서버 양쪽에서 쓰므로
 * Node 전용 API 대신 Web Crypto 만 사용한다.
 */
export const SESSION_COOKIE = "tp_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

export interface SessionData {
  tripId: string;
  memberId: string;
}

interface Payload extends SessionData {
  exp: number; // epoch seconds
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("SESSION_SECRET 이(가) 없거나 너무 짧습니다 (16자 이상). openssl rand -hex 32");
  }
  return s;
}

async function hmacKey(usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(
  data: SessionData,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: Payload = { ...data, exp: nowSec + SESSION_MAX_AGE_SEC };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey("sign"), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/** 유효하면 세션 데이터, 위조/만료/형식 오류면 null */
export async function verifySession(
  token: string | undefined | null,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<SessionData | null> {
  if (!token) return null;
  const [body, sig, ...rest] = token.split(".");
  if (!body || !sig || rest.length) return null;
  try {
    // crypto.subtle.verify 는 상수 시간 비교를 한다
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey("verify"),
      fromB64url(sig) as BufferSource,
      enc.encode(body),
    );
    if (!ok) return null;
    const p = JSON.parse(dec.decode(fromB64url(body))) as Partial<Payload>;
    if (typeof p.tripId !== "string" || typeof p.memberId !== "string") return null;
    if (typeof p.exp !== "number" || p.exp <= nowSec) return null;
    return { tripId: p.tripId, memberId: p.memberId };
  } catch {
    return null;
  }
}

/** PIN 비교용 상수 시간 문자열 비교 */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
