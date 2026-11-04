"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
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
