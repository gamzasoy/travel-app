"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
import { dateOf, nextOrder, toStart } from "@/lib/schedule";
import type { ActionResult } from "./expenses";

const idSchema = z.string().min(10).max(64);

const scheduleInput = z.object({
  title: z.string().trim().min(1, "제목을 입력해주세요.").max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜를 선택해주세요."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않아요.").nullable(),
  placeId: idSchema.nullable(),
  note: z.string().trim().max(1000),
});
export type ScheduleInput = z.input<typeof scheduleInput>;

const fail = (error: string): ActionResult => ({ ok: false, error });

async function parse(tripId: string, input: unknown) {
  const parsed = scheduleInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." };
  const d = parsed.data;
  // 연결할 장소는 이 여행의 장소여야 한다
  if (d.placeId && !(await repo.listPlaces(tripId)).some((p) => p.id === d.placeId)) {
    return { error: "선택한 장소를 찾을 수 없어요." };
  }
  return { data: d };
}

export async function addScheduleItem(input: ScheduleInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const p = await parse(tripId, input);
  if (p.error || !p.data) return fail(p.error ?? "입력값이 올바르지 않아요.");
  const d = p.data;
  const existing = await repo.listSchedule(tripId);
  await repo.createScheduleItem({
    tripId,
    title: d.title,
    start: toStart(d.date, d.time),
    placeId: d.placeId,
    note: d.note,
    order: nextOrder(existing, d.date),
  });
  return { ok: true };
}

export async function editScheduleItem(itemId: string, input: ScheduleInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(itemId);
  if (!id.success) return fail("일정을 찾을 수 없어요.");
  const existing = await repo.listSchedule(tripId);
  const current = existing.find((i) => i.id === id.data);
  if (!current) return fail("일정을 찾을 수 없어요.");

  const p = await parse(tripId, input);
  if (p.error || !p.data) return fail(p.error ?? "입력값이 올바르지 않아요.");
  const d = p.data;
  // 날짜가 바뀌면 새 날짜의 맨 뒤로, 그대로면 기존 순서 유지
  const order = dateOf(current.start) === d.date ? current.order : nextOrder(existing, d.date);
  await repo.updateScheduleItem(current.id, {
    tripId,
    title: d.title,
    start: toStart(d.date, d.time),
    placeId: d.placeId,
    note: d.note,
    order,
  });
  return { ok: true };
}

export async function removeScheduleItem(itemId: string): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(itemId);
  if (!id.success) return fail("일정을 찾을 수 없어요.");
  if (!(await repo.listSchedule(tripId)).some((i) => i.id === id.data)) return fail("일정을 찾을 수 없어요.");
  await repo.deleteScheduleItem(id.data, tripId);
  return { ok: true };
}
