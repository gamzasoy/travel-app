"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createLimiter } from "@/lib/rate-limit";
import { getTrip, listMembers } from "@/lib/notion/repo";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC, safeEqual, signSession } from "@/lib/session";

const limiter = createLimiter(10, 10 * 60 * 1000);

const idSchema = z.string().min(10).max(64);
const pinSchema = z.string().trim().min(1).max(32);

export type MemberChoice = { id: string; name: string; color: string | null };
export type PinResult =
  | { ok: true; members: MemberChoice[] }
  | { ok: false; error: string };

async function checkPin(tripId: string, pin: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (limiter.isBlocked(tripId)) {
    return { ok: false, error: "시도 횟수가 너무 많아요. 잠시 후 다시 해주세요." };
  }
  const trip = await getTrip(tripId);
  if (!trip) return { ok: false, error: "여행을 찾을 수 없어요." };
  if (!trip.pin) return { ok: false, error: "이 여행에는 PIN이 설정되어 있지 않아요. 노션에서 PIN을 입력해주세요." };
  if (!safeEqual(trip.pin, pin)) {
    limiter.recordFail(tripId);
    return { ok: false, error: "PIN이 맞지 않아요." };
  }
  limiter.reset(tripId);
  return { ok: true };
}

/** 1단계: PIN 확인 → 맞으면 멤버 목록을 돌려준다 (PIN 전에는 이름이 노출되지 않음) */
export async function verifyPin(tripIdRaw: string, pinRaw: string): Promise<PinResult> {
  const tripId = idSchema.safeParse(tripIdRaw);
  const pin = pinSchema.safeParse(pinRaw);
  if (!tripId.success || !pin.success) return { ok: false, error: "PIN을 입력해주세요." };

  const checked = await checkPin(tripId.data, pin.data);
  if (!checked.ok) return checked;

  const members = await listMembers(tripId.data);
  if (members.length === 0) {
    return { ok: false, error: "등록된 멤버가 없어요. 노션 멤버 DB에 친구들을 추가해주세요." };
  }
  return {
    ok: true,
    members: members.map((m) => ({ id: m.id, name: m.name, color: m.color })),
  };
}

/** 2단계: PIN 을 다시 검증하고 멤버를 선택해 세션 쿠키를 발급한다 */
export async function joinTrip(
  tripIdRaw: string,
  pinRaw: string,
  memberIdRaw: string,
): Promise<{ ok: false; error: string }> {
  const tripId = idSchema.safeParse(tripIdRaw);
  const pin = pinSchema.safeParse(pinRaw);
  const memberId = idSchema.safeParse(memberIdRaw);
  if (!tripId.success || !pin.success || !memberId.success) {
    return { ok: false, error: "입력값이 올바르지 않아요." };
  }

  const checked = await checkPin(tripId.data, pin.data);
  if (!checked.ok) return checked;

  const members = await listMembers(tripId.data);
  if (!members.some((m) => m.id === memberId.data)) {
    return { ok: false, error: "선택한 멤버를 찾을 수 없어요." };
  }

  (await cookies()).set(SESSION_COOKIE, await signSession({ tripId: tripId.data, memberId: memberId.data }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
  redirect(`/t/${tripId.data}`);
}

/** 이름 바꾸기 / 나가기: 쿠키를 지우고 입장 화면으로 */
export async function leaveTrip(tripIdRaw: string): Promise<void> {
  const tripId = idSchema.parse(tripIdRaw);
  (await cookies()).delete(SESSION_COOKIE);
  redirect(`/t/${tripId}/join`);
}
