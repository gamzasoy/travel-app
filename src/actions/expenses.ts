"use server";

import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { isValidRate } from "@/lib/currency";
import * as repo from "@/lib/notion/repo";
import { getRate } from "@/lib/rate";
import { EXPENSE_CATEGORIES, type NewExpense } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.string().min(10).max(64);

const expenseInput = z.object({
  title: z.string().trim().min(1, "항목을 입력해주세요.").max(100),
  amount: z.number().int("금액은 정수로 입력해주세요.").positive("금액을 입력해주세요.").max(100_000_000),
  currency: z.enum(["JPY", "KRW"]),
  category: z.enum(EXPENSE_CATEGORIES).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "날짜가 올바르지 않아요.").nullable(),
  payerId: idSchema,
  participantIds: z.array(idSchema).min(1, "참여자를 한 명 이상 선택해주세요.").max(50),
  placeId: idSchema.nullable().optional(),
});
export type ExpenseInput = z.input<typeof expenseInput>;

const fail = (error: string): ActionResult => ({ ok: false, error });

async function build(input: unknown, keepRate: number | null): Promise<{ tripId: string; expense: NewExpense } | ActionResult> {
  const { tripId } = await requireSession();
  const parsed = expenseInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않아요.");
  const d = parsed.data;

  // 결제자/참여자는 이 여행의 멤버여야 한다
  const members = new Set((await repo.listMembers(tripId)).map((m) => m.id));
  if (!members.has(d.payerId) || !d.participantIds.every((id) => members.has(id))) {
    return fail("선택한 멤버를 찾을 수 없어요.");
  }

  // 엔화 지출은 저장 시점의 환율을 스냅샷으로 남긴다 (수정 시 통화가 그대로면 기존 환율 유지)
  let rate: number | null = null;
  if (d.currency === "JPY") {
    if (isValidRate(keepRate)) {
      rate = keepRate;
    } else {
      const trip = await repo.getTrip(tripId);
      if (!trip) return fail("여행을 찾을 수 없어요.");
      rate = (await getRate(trip)).rate;
      if (rate === null) return fail("환율을 가져오지 못했어요. 설정에서 환율을 직접 입력해주세요.");
    }
  }

  return {
    tripId,
    expense: {
      tripId,
      title: d.title,
      amount: d.amount,
      currency: d.currency,
      rate,
      payerId: d.payerId,
      participantIds: [...new Set(d.participantIds)],
      category: d.category,
      date: d.date,
      placeId: d.placeId ?? null,
    },
  };
}

export async function addExpense(input: ExpenseInput): Promise<ActionResult> {
  const built = await build(input, null);
  if ("ok" in built) return built;
  await repo.createExpense(built.expense);
  return { ok: true };
}

export async function editExpense(expenseId: string, input: ExpenseInput): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return fail("지출을 찾을 수 없어요.");
  const existing = (await repo.listExpenses(tripId)).find((e) => e.id === id.data);
  if (!existing) return fail("지출을 찾을 수 없어요.");

  const nextCurrency = (input as { currency?: string }).currency;
  const built = await build(input, nextCurrency === existing.currency ? existing.rate : null);
  if ("ok" in built) return built;
  await repo.updateExpense(existing.id, built.expense);
  return { ok: true };
}

export async function removeExpense(expenseId: string): Promise<ActionResult> {
  const { tripId } = await requireSession();
  const id = idSchema.safeParse(expenseId);
  if (!id.success) return fail("지출을 찾을 수 없어요.");
  // 다른 여행의 지출은 지울 수 없다
  if (!(await repo.listExpenses(tripId)).some((e) => e.id === id.data)) return fail("지출을 찾을 수 없어요.");
  await repo.deleteExpense(id.data, tripId);
  return { ok: true };
}
