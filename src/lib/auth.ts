import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, type SessionData } from "./session";

/** 서버 액션/컴포넌트에서 현재 세션을 가져온다. 없으면 에러 (tripId 는 항상 세션 기준으로 사용) */
export async function requireSession(): Promise<SessionData> {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) throw new Error("로그인이 필요해요. 여행 링크로 다시 들어와주세요.");
  return session;
}
