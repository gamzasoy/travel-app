"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
import { planMoveVisit } from "@/lib/map";
import { PLACE_CATEGORIES } from "@/lib/types";
import type { ActionResult } from "./expenses";

const idSchema = z.string().min(10).max(64);

const placeInput = z
  .object({
    name: z.string().trim().min(1, "장소 이름을 입력해주세요.").max(100),
    address: z.string().trim().max(300),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    googlePlaceId: z.string().trim().max(300),
    category: z.enum(PLACE_CATEGORIES).nullable(),
  })
  // 좌표는 위도·경도가 함께 있거나 함께 없어야 한다
  .refine((p) => (p.lat === null) === (p.lng === null), { message: "좌표가 올바르지 않아요." });
export type PlaceInput = z.input<typeof placeInput>;

const fail = (error: string): ActionResult => ({ ok: false, error });

export async function addPlace(input: PlaceInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");

  const existing = await repo.listPlaces(tripId);
  const d = parsed.data;
  // 같은 구글 장소를 두 번 저장하지 않는다
  if (d.googlePlaceId && existing.some((p) => p.googlePlaceId === d.googlePlaceId)) {
    return fail("이미 추가된 장소예요.");
  }
  await repo.createPlace({ tripId, ...d, visited: false });
  return { ok: true };
}

export async function editPlace(placeId: string, input: PlaceInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(placeId);
  const existing = await repo.listPlaces(tripId);
  const current = id.success ? existing.find((p) => p.id === id.data) : undefined;
  if (!current) return fail("장소를 찾을 수 없어요.");
  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");

  const d = parsed.data;
  if (d.googlePlaceId && existing.some((p) => p.id !== current.id && p.googlePlaceId === d.googlePlaceId)) {
    return fail("이미 추가된 장소예요.");
  }
  await repo.updatePlace(current.id, { tripId, ...d, visited: current.visited });
  return { ok: true };
}

/** 그날 방문 순서에서 장소를 한 칸 위/아래로 옮긴다 (일정의 시간·순서를 맞바꿈) */
export async function moveVisit(placeId: string, day: string, direction: "up" | "down"): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(placeId);
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(day);
  if (!id.success || !date.success || (direction !== "up" && direction !== "down")) return fail("순서를 바꿀 수 없어요.");

  const [items, places] = await Promise.all([repo.listSchedule(tripId), repo.listPlaces(tripId)]);
  const plan = planMoveVisit(items, places, date.data, id.data, direction === "up" ? -1 : 1);
  if (!plan) return fail("더 옮길 수 없어요.");

  for (const u of plan) {
    const item = items.find((i) => i.id === u.id);
    if (!item) return fail("일정을 찾을 수 없어요.");
    await repo.updateScheduleItem(item.id, { tripId, title: item.title, start: u.start, placeId: item.placeId, note: item.note, order: u.order });
  }
  return { ok: true };
}

export async function setPlaceVisited(placeId: string, visited: boolean): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(placeId);
  const current = id.success ? (await repo.listPlaces(tripId)).find((p) => p.id === id.data) : undefined;
  if (!current) return fail("장소를 찾을 수 없어요.");
  await repo.updatePlace(current.id, {
    tripId: current.tripId,
    name: current.name,
    address: current.address,
    lat: current.lat,
    lng: current.lng,
    googlePlaceId: current.googlePlaceId,
    category: current.category,
    visited: visited === true,
  });
  return { ok: true };
}

export async function removePlace(placeId: string): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(placeId);
  if (!id.success || !(await repo.listPlaces(tripId)).some((p) => p.id === id.data)) {
    return fail("장소를 찾을 수 없어요.");
  }
  await repo.deletePlace(id.data, tripId);
  return { ok: true };
}
