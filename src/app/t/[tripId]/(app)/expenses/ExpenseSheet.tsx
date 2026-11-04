"use client";

import { useState, useTransition } from "react";
import { addExpense, editExpense, removeExpense, type ExpenseInput } from "@/actions/expenses";
import { convert, formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES, type Currency, type Expense, type ExpenseCategory, type Member } from "@/lib/types";
import { safe } from "@/lib/safe-action";

interface Props {
  meId: string | null;
  members: Member[];
  rate: number | null;
  expense: Expense | null;
  onClose: () => void;
}

const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ExpenseSheet({ meId, members, rate, expense, onClose }: Props) {
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState<Currency>(expense?.currency ?? "JPY");
  const [category, setCategory] = useState<ExpenseCategory | null>(expense?.category ?? null);
  const [date, setDate] = useState(expense?.date ?? localToday());
  const [payerId, setPayerId] = useState(expense?.payerId ?? meId ?? members[0]?.id ?? "");
  const [participants, setParticipants] = useState<Set<string>>(
    new Set(expense && expense.participantIds.length ? expense.participantIds : members.map((m) => m.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const amount = Number(amountText || 0);
  // 수정 중인 엔화 지출은 저장된 환율로, 그 외에는 현재 환율로 미리보기
  const previewRate = expense && expense.currency === currency ? expense.rate : rate;
  const other: Currency = currency === "JPY" ? "KRW" : "JPY";
  const preview = amount > 0 ? convert(amount, currency, other, previewRate, rate) : null;

  const toggle = (id: string) =>
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: ExpenseInput = {
      title,
      amount,
      currency,
      category,
      date: date || null,
      payerId,
      participantIds: [...participants],
      placeId: expense?.placeId ?? null,
    };
    startTransition(async () => {
      const res = await safe(() => (expense ? editExpense(expense.id, input) : addExpense(input)));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!expense || !confirm("이 지출을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await safe(() => removeExpense(expense.id));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{expense ? "지출 수정" : "지출 추가"}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            닫기
          </button>
        </div>

        <div className="flex gap-2">
          <div className="flex overflow-hidden rounded-xl border border-border" role="group" aria-label="통화">
            {(["JPY", "KRW"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={currency === c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-3 text-lg font-semibold ${currency === c ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
              >
                {c === "JPY" ? "¥" : "₩"}
              </button>
            ))}
          </div>
          <input
            aria-label="금액"
            inputMode="numeric"
            autoFocus={!expense}
            value={amount ? amount.toLocaleString("ko-KR") : ""}
            onChange={(e) => setAmountText(e.target.value.replace(/[^0-9]/g, "").slice(0, 9))}
            placeholder="0"
            className="min-w-0 flex-1 rounded-xl border border-border px-4 py-3 text-right text-xl font-semibold outline-none focus:border-primary"
          />
        </div>
        <p className="-mt-2 text-right text-xs text-muted-foreground">
          {amount > 0 &&
            (preview !== null ? `≈ ${formatMoney(preview, other)}` : "환율이 없어 환산할 수 없어요")}
        </p>

        <input
          aria-label="항목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇에 썼나요? (예: 라멘)"
          maxLength={100}
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />

        <div className="flex flex-wrap gap-2" role="group" aria-label="분류">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={`rounded-full border px-3 py-1 text-sm ${category === c ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-base text-foreground"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
            결제한 사람
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="rounded-xl border border-border px-3 py-2 text-base text-foreground"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-xs text-muted-foreground">
            <span>함께한 사람 ({participants.size}명)</span>
            <button
              type="button"
              className="underline"
              onClick={() => setParticipants(new Set(participants.size === members.length ? [] : members.map((m) => m.id)))}
            >
              {participants.size === members.length ? "모두 해제" : "전원 선택"}
            </button>
          </legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={participants.has(m.id)}
                onClick={() => toggle(m.id)}
                className={`rounded-full border px-3 py-1 text-sm ${participants.has(m.id) ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
              >
                {m.name}
              </button>
            ))}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          {expense && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-xl border border-destructive px-4 py-3 font-medium text-destructive disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="submit"
            disabled={pending || amount <= 0 || !title.trim() || participants.size === 0}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
