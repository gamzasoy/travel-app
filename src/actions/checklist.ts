"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { DEFAULT_CHECKLIST, nextChecklistOrder } from "@/lib/checklist";
import * as repo from "@/lib/notion/repo";
import { CHECKLIST_BAGS, CHECKLIST_CATEGORIES } from "@/lib/types";
import type { ActionResult } from "./expenses";

const idSchema = z.string().min(10).max(64);

const itemInput = z.object({
  title: z.string().trim().min(1, "준비물을 입력해주세요.").max(100),
  category: z.enum(CHECKLIST_CATEGORIES).nullable(),
  bag: z.enum(CHECKLIST_BAGS).nullable().default(null),
});
export type ChecklistInput = z.input<typeof itemInput>;

const fail = (error: string): ActionResult => ({ ok: false, error });
const NOT_FOUND = "준비물을 찾을 수 없어요.";

/** 이 여행의 준비물인지 확인하고 가져온다 */
async function findItem(tripId: string, itemId: unknown) {
  const id = idSchema.safeParse(itemId);
  if (!id.success) return null;
  return (await repo.listChecklist(tripId)).find((i) => i.id === id.data) ?? null;
}

export async function addChecklistItem(input: ChecklistInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");
  const existing = await repo.listChecklist(tripId);
  await repo.createChecklistItem({ tripId, ...parsed.data, checked: false, order: nextChecklistOrder(existing) });
  return { ok: true };
}

export async function editChecklistItem(itemId: string, input: ChecklistInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const current = await findItem(tripId, itemId);
  if (!current) return fail(NOT_FOUND);
  const parsed = itemInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");
  await repo.updateChecklistItem(current.id, { ...current, ...parsed.data });
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string, checked: boolean): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const current = await findItem(tripId, itemId);
  if (!current) return fail(NOT_FOUND);
  await repo.setChecklistChecked(current.id, tripId, checked === true);
  return { ok: true };
}

export async function removeChecklistItem(itemId: string): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const current = await findItem(tripId, itemId);
  if (!current) return fail(NOT_FOUND);
  await repo.deleteChecklistItem(current.id, tripId);
  return { ok: true };
}

/** 목록이 비어 있을 때만 기본 준비물을 넣는다 (두 사람이 동시에 눌러 중복되는 것 방지) */
export async function addDefaultChecklist(): Promise<ActionResult> {
  const { tripId } = await requireSession();
  if ((await repo.listChecklist(tripId)).length > 0) return fail("이미 준비물이 있어요. 새로고침해 주세요.");
  await repo.createChecklistItems(
    DEFAULT_CHECKLIST.map((d, i) => ({ tripId, ...d, checked: false, order: i })),
  );
  return { ok: true };
}
