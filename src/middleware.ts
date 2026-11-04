import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** /t/{tripId}/... 는 해당 여행의 유효한 세션이 있어야 접근 가능 (join 제외) */
export async function middleware(req: NextRequest) {
  const [, , tripId, section] = req.nextUrl.pathname.split("/"); // ["", "t", id, section]
  if (!tripId || section === "join") return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session?.tripId === tripId) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/t/${tripId}/join`;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/t/:tripId", "/t/:tripId/:path*"] };
