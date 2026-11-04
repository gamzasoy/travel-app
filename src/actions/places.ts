"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
import { planExtraVisits, planPlaceDays, planReorderVisits } from "@/lib/map";
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

/** 장소를 방문하는 날짜(YYYY-MM-DD)들 */
const daysInput = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60);

/** 장소의 방문 날짜를 일정에 반영한다 (새 날짜는 일정 추가, 바뀐 날짜는 이동, 해제된 날짜는 삭제) */
async function syncPlaceDays(tripId: string, place: { id: string; name: string }, days: string[]) {
  const items = await repo.listSchedule(tripId);
  const plan = planPlaceDays(items, { ...place, tripId }, days);
  for (const item of plan.create) await repo.createScheduleItem(item);
  for (const u of plan.update) await repo.updateScheduleItem(u.id, u.item);
  for (const id of plan.remove) await repo.deleteScheduleItem(id, tripId);
}

const fail = (error: string): ActionResult => ({ ok: false, error });

export async function addPlace(input: PlaceInput, daysRaw: string[] = []): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const parsed = placeInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");

  const existing = await repo.listPlaces(tripId);
  const d = parsed.data;
  const days = daysInput.safeParse(daysRaw);
  if (!days.success) return fail("날짜가 올바르지 않아요.");
  // 같은 구글 장소를 두 번 저장하지 않는다. 대신 날짜를 골랐다면 그 장소를 그날 일정 맨 뒤에 한 번 더 넣는다 (숙소 복귀 등)
  const dup = d.googlePlaceId ? existing.find((p) => p.googlePlaceId === d.googlePlaceId) : undefined;
  if (dup) {
    if (days.data.length === 0) return fail("이미 추가된 장소예요. 일정에 또 넣으려면 방문 날짜를 골라주세요.");
    try {
      const items = await repo.listSchedule(tripId);
      for (const item of planExtraVisits(items, dup, days.data)) await repo.createScheduleItem(item);
    } catch {
      return fail("날짜를 일정에 넣지 못했어요. 다시 시도해주세요.");
    }
    return { ok: true };
  }
  const id = await repo.createPlace({ tripId, ...d, visited: false });
  if (days.data.length > 0) {
    try {
      await syncPlaceDays(tripId, { id, name: d.name }, days.data);
    } catch {
      return fail("장소는 저장됐지만 날짜를 일정에 넣지 못했어요. 장소를 눌러 날짜를 다시 골라주세요.");
    }
  }
  return { ok: true };
}

/** daysRaw 가 undefined 면 날짜는 건드리지 않는다 (빈 배열이면 모든 날짜 해제) */
export async function editPlace(placeId: string, input: PlaceInput, daysRaw?: string[]): Promise<ActionResult> {
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
  const days = daysRaw === undefined ? null : daysInput.safeParse(daysRaw);
  if (days && !days.success) return fail("날짜가 올바르지 않아요.");
  await repo.updatePlace(current.id, { tripId, ...d, visited: current.visited });
  if (days?.success) {
    try {
      await syncPlaceDays(tripId, { id: current.id, name: d.name }, days.data);
    } catch {
      return fail("장소는 저장됐지만 날짜를 일정에 반영하지 못했어요. 다시 시도해주세요.");
    }
  }
  return { ok: true };
}

/** 그날 방문 순서를 바꾼다. placeIds 는 그날 방문하는 장소 전체를 새 순서대로 (일정의 시간·순서 자리를 옮김) */
export async function reorderVisits(day: string, placeIds: string[]): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(day);
  const ids = z.array(idSchema).max(200).safeParse(placeIds);
  if (!date.success || !ids.success) return fail("순서를 바꿀 수 없어요.");

  const [items, places] = await Promise.all([repo.listSchedule(tripId), repo.listPlaces(tripId)]);
  const plan = planReorderVisits(items, places, date.data, ids.data);
  if (!plan) return fail("일정이 바뀌어서 순서를 적용하지 못했어요. 화면을 새로고침해 주세요.");

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
