"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
import { toStart } from "@/lib/schedule";
import { RESERVATION_KINDS } from "@/lib/types";
import type { ActionResult } from "./expenses";

const idSchema = z.string().min(10).max(64);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜가 올바르지 않아요.");
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "시간 형식이 올바르지 않아요.");

const reservationInput = z.object({
  title: z.string().trim().min(1, "예약 이름을 입력해주세요.").max(100),
  kind: z.enum(RESERVATION_KINDS).nullable(),
  startDate: dateSchema.nullable(),
  startTime: timeSchema.nullable(),
  endDate: dateSchema.nullable(),
  endTime: timeSchema.nullable(),
  confirmation: z.string().trim().max(100),
  note: z.string().trim().max(1000),
  url: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "링크는 http(s) 주소로 입력해주세요." })]),
});
export type ReservationInput = z.input<typeof reservationInput>;

const fail = (error: string): ActionResult => ({ ok: false, error });
const NOT_FOUND = "예약을 찾을 수 없어요.";

function build(tripId: string, input: unknown) {
  const parsed = reservationInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요." };
  const d = parsed.data;
  if (!d.startDate && (d.startTime || d.endDate || d.endTime)) return { error: "시작 날짜를 먼저 선택해주세요." };
  if (!d.endDate && d.endTime) return { error: "끝 날짜를 선택해주세요." };
  // 노션 날짜 범위는 시작·끝이 같은 형식이어야 한다
  if (d.endDate && !!d.startTime !== !!d.endTime) return { error: "시작과 끝 모두 시간을 넣거나, 모두 비워주세요." };
  const start = d.startDate ? toStart(d.startDate, d.startTime) : null;
  const end = d.endDate ? toStart(d.endDate, d.endTime) : null;
  if (start && end && end < start) return { error: "끝 일시가 시작보다 빨라요." };
  return {
    data: {
      tripId,
      title: d.title,
      kind: d.kind,
      start,
      end,
      confirmation: d.confirmation,
      note: d.note,
      url: d.url,
    },
  };
}

export async function addReservation(input: ReservationInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const b = build(tripId, input);
  if (!b.data) return fail(b.error ?? "입력값이 올바르지 않아요.");
  await repo.createReservation(b.data);
  return { ok: true };
}

async function exists(tripId: string, reservationId: unknown) {
  const id = idSchema.safeParse(reservationId);
  if (!id.success) return null;
  return (await repo.listReservations(tripId)).find((r) => r.id === id.data) ?? null;
}

export async function editReservation(reservationId: string, input: ReservationInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const current = await exists(tripId, reservationId);
  if (!current) return fail(NOT_FOUND);
  const b = build(tripId, input);
  if (!b.data) return fail(b.error ?? "입력값이 올바르지 않아요.");
  await repo.updateReservation(current.id, b.data);
  return { ok: true };
}

export async function removeReservation(reservationId: string): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const current = await exists(tripId, reservationId);
  if (!current) return fail(NOT_FOUND);
  await repo.deleteReservation(current.id, tripId);
  return { ok: true };
}
