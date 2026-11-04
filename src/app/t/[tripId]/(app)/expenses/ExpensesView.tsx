"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { convert, formatMoney } from "@/lib/currency";
import type { Expense, Member } from "@/lib/types";
import { ExpenseSheet } from "./ExpenseSheet";

interface Props {
  tripId: string;
  meId: string | null;
  members: Member[];
  expenses: Expense[];
  rate: number | null;
  rateSource: "manual" | "live" | "none";
}

type Editing = { mode: "new" } | { mode: "edit"; expense: Expense } | null;

export function ExpensesView({ tripId, meId, members, expenses, rate, rateSource }: Props) {
  const [editing, setEditing] = useState<Editing>(null);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  const { groups, jpyTotal, krwTotal, unconverted } = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    const groups = new Map<string, Expense[]>();
    let jpyTotal = 0;
    let krwTotal = 0;
    let unconverted = 0;
    for (const e of sorted) {
      const key = e.date ?? "날짜 없음";
      groups.set(key, [...(groups.get(key) ?? []), e]);
      if (e.currency === "JPY") jpyTotal += e.amount;
      const krw = convert(e.amount, e.currency, "KRW", e.rate, rate);
      if (krw === null) unconverted++;
      else krwTotal += krw;
    }
    return { groups: [...groups], jpyTotal, krwTotal, unconverted };
  }, [expenses, rate]);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-sky-50 p-4">
        <p className="text-xs text-slate-500">총 지출 (원화 환산)</p>
        <p className="mt-1 text-2xl font-bold">{formatMoney(krwTotal, "KRW")}</p>
        {jpyTotal > 0 && <p className="text-sm text-slate-600">그중 엔화 {formatMoney(jpyTotal, "JPY")}</p>}
        <p className="mt-2 text-xs text-slate-500">
          {rate
            ? `100엔 = ${rate.toLocaleString("ko-KR")}원 (${rateSource === "manual" ? "직접 입력" : "자동"})`
            : "환율을 불러오지 못했어요"}
          {" · "}
          <Link href={`/t/${tripId}/settings`} className="underline">
            환율 설정
          </Link>
        </p>
        {unconverted > 0 && (
          <p className="mt-1 text-xs text-amber-700">환율이 없어 합계에서 빠진 지출이 {unconverted}건 있어요.</p>
        )}
      </section>

      {expenses.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">아직 지출이 없어요. 아래 + 버튼으로 추가해보세요.</p>
      )}

      {groups.map(([date, items]) => (
        <section key={date}>
          <h2 className="mb-1 text-xs font-semibold text-slate-500">{date}</h2>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {items.map((e) => {
              const krw = e.currency === "JPY" ? convert(e.amount, "JPY", "KRW", e.rate, rate) : null;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", expense: e })}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left active:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.title}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {e.payerId ? (names.get(e.payerId) ?? "알 수 없음") : "결제자 없음"} 결제
                        {e.category ? ` · ${e.category}` : ""}
                        {` · ${e.participantIds.length || members.length}명`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold">{formatMoney(e.amount, e.currency)}</span>
                      {krw !== null && <span className="block text-xs text-slate-500">≈{formatMoney(krw, "KRW")}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <button
        type="button"
        aria-label="지출 추가"
        onClick={() => setEditing({ mode: "new" })}
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-lg active:bg-sky-600"
      >
        +
      </button>

      {editing && (
        <ExpenseSheet
          key={editing.mode === "edit" ? editing.expense.id : "new"}
          meId={meId}
          members={members}
          rate={rate}
          expense={editing.mode === "edit" ? editing.expense : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
