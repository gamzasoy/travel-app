"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import * as repo from "@/lib/notion/repo";
import type { ActionResult } from "./expenses";

/** 수동 환율(100엔당 원). null 이면 자동(공개) 환율로 되돌린다 */
export async function saveManualRate(rate: number | null): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const parsed = z.number().min(100).max(5000).nullable().safeParse(rate);
  if (!parsed.success) return { ok: false, error: "환율은 100엔당 100~5000원 사이로 입력해주세요." };
  await repo.setManualRate(tripId, parsed.data);
  return { ok: true };
}
