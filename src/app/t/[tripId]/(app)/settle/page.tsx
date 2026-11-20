import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney } from "@/lib/currency";
import { getTrip, listExpenses, listMembers } from "@/lib/notion/repo";
import { getRate } from "@/lib/rate";
import { CategoryPie, type PieView } from "./CategoryPie";
import { dayLabel } from "@/lib/schedule";
import { settle } from "@/lib/settle";
import type { Currency, ExpenseCategory } from "@/lib/types";

export default async function SettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const { tripId } = await params;
  const { c } = await searchParams;
  const [trip, members, expenses] = await Promise.all([getTrip(tripId), listMembers(tripId), listExpenses(tripId)]);
  if (!trip) notFound();

  const currency: Currency = c === "JPY" || c === "KRW" ? c : trip.settleCurrency;
  const { rate } = await getRate(trip);
  const result = settle(expenses, members, currency, rate);
  const name = new Map(members.map((m) => [m.id, m.name]));
  const n = (id: string) => name.get(id) ?? "?";
  const maxSpent = Math.max(0, ...result.spending.map((s) => s.total));

  // 원형 차트: 전체(모든 사람 몫의 합 = 분류별 지출 합계) + 사람별
  const allByCategory = new Map<ExpenseCategory, number>();
  for (const s of result.spending) for (const c of s.byCategory) allByCategory.set(c.category, (allByCategory.get(c.category) ?? 0) + c.amount);
  const pieViews: PieView[] = [
    { key: "all", label: "전체", total: result.total, byCategory: [...allByCategory].map(([category, amount]) => ({ category, amount })) },
    ...result.spending.map((s) => ({ key: s.memberId, label: n(s.memberId), total: s.total, byCategory: s.byCategory })),
  ];

  const copyText = result.transfers.length
    ? [`${trip.name} 정산 (${currency === "JPY" ? "엔" : "원"})`, ...result.transfers.map((t) => `${n(t.from)} → ${n(t.to)} ${formatMoney(t.amount, currency)}`)].join("\n")
    : `${trip.name} 정산: 보낼 돈이 없어요`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">정산</h2>
        <div className="flex overflow-hidden rounded-lg border border-border text-sm" role="group" aria-label="정산 통화">
          {(["KRW", "JPY"] as const).map((cur) => (
            <Link
              key={cur}
              href={`?c=${cur}`}
              replace
              aria-current={currency === cur ? "true" : undefined}
              className={`px-3 py-1 ${currency === cur ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {cur === "KRW" ? "₩ 원" : "¥ 엔"}
            </Link>
          ))}
        </div>
      </div>

      {result.skipped.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          환율이 없거나 결제자를 알 수 없는 지출 {result.skipped.length}건은 계산에서 빠졌어요. 설정에서 환율을 입력해주세요.
        </p>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">누가 누구에게</h3>
          <CopyButton text={copyText} label="카톡용 복사" />
        </div>
        {result.transfers.length === 0 ? (
          <p className="rounded-xl border border-border p-4 text-center text-sm text-muted-foreground">
            {expenses.length === 0 ? "아직 지출이 없어요." : "정산할 금액이 없어요 🎉"}
          </p>
        ) : (
          <ul aria-label="송금" className="divide-y divide-border rounded-xl border border-border">
            {result.transfers.map((t) => (
              <li key={`${t.from}-${t.to}`} className="flex items-center justify-between px-3 py-3">
                <span>
                  <b>{n(t.from)}</b> → <b>{n(t.to)}</b>
                </span>
                <span className="font-semibold">{formatMoney(t.amount, currency)}</span>
              </li>
            ))}
          </ul>
        )}
        {result.transfers.length > 0 && (
          <details className="mt-2 rounded-xl border border-border text-sm">
            <summary className="cursor-pointer px-3 py-2 text-muted-foreground">자세히 보기</summary>
            <div className="border-t border-border px-3 py-2">
              <p className="mb-2 text-xs text-muted-foreground">
                지출마다 참여자가 결제한 사람에게 자기 몫을 직접 보낸다고 계산하고, 두 사람이 서로 주고받을 돈만
                상계했어요. 위 송금은 이 내역을 합쳐 송금 횟수를 줄인 것이라 각자 최종 금액은 같아요.
              </p>
              <ul aria-label="직접 정산 내역" className="divide-y divide-border">
                {result.directTransfers.map((t) => (
                  <li key={`${t.from}-${t.to}`} className="flex items-center justify-between py-2">
                    <span>
                      {n(t.from)} → {n(t.to)}
                    </span>
                    <span>{formatMoney(t.amount, currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </section>

      {result.total > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">분류별 지출</h3>
          <CategoryPie views={pieViews} currency={currency} />
        </section>
      )}

      {result.total > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-muted-foreground">각자 쓴 돈</h3>
          <p className="mb-2 text-xs text-muted-foreground">누가 결제했든 상관없이 내 몫만 합친 금액이에요.</p>
          <ul aria-label="각자 쓴 돈" className="divide-y divide-border rounded-xl border border-border">
            {result.spending.map((s) => (
              <li key={s.memberId} className="text-sm">
                <details className="group">
                  <summary className="cursor-pointer list-none px-3 py-3 [&::-webkit-details-marker]:hidden">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {n(s.memberId)}
                        <span className="ml-1 text-xs text-muted-foreground group-open:hidden" aria-hidden>
                          ▸ 내역
                        </span>
                        <span className="ml-1 hidden text-xs text-muted-foreground group-open:inline" aria-hidden>
                          ▾ 접기
                        </span>
                      </span>
                      <span className="font-semibold">{formatMoney(s.total, currency)}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${maxSpent > 0 ? (s.total / maxSpent) * 100 : 0}%` }} />
                    </div>
                    {s.byCategory.length > 0 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {s.byCategory.map((c) => `${c.category} ${formatMoney(c.amount, currency)}`).join(" · ")}
                      </p>
                    )}
                  </summary>
                  {s.items.length === 0 ? (
                    <p className="border-t border-border px-3 py-3 text-xs text-muted-foreground">쓴 돈이 없어요.</p>
                  ) : (
                    <ul aria-label={`${n(s.memberId)} 지출 내역`} className="divide-y divide-border border-t border-border bg-muted/40">
                      {s.items.map((it, i) => (
                        <li key={it.expenseId}>
                          {(i === 0 || s.items[i - 1].date !== it.date) && (
                            <p className="px-3 pt-2 text-xs font-semibold text-muted-foreground">{it.date ? dayLabel(it.date) : "날짜 없음"}</p>
                          )}
                          <div className="flex items-start justify-between gap-3 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block break-words">{it.title || "(제목 없음)"}</span>
                              <span className="block text-xs text-muted-foreground">
                                {[
                                  it.category,
                                  it.people === 1 ? "혼자" : `${formatMoney(it.amount, currency)} ÷ ${it.people}명`,
                                  `${n(it.payerId)} 결제`,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="shrink-0 font-medium">{formatMoney(it.share, currency)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
          멤버별 (총 {formatMoney(result.total, currency)})
        </h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {result.balances.map((b) => (
            <li key={b.memberId} className="flex items-center justify-between px-3 py-3 text-sm">
              <span>
                <span className="font-medium">{n(b.memberId)}</span>
                <span className="block text-xs text-muted-foreground">
                  낸 돈 {formatMoney(b.paid, currency)} · 내 몫 {formatMoney(b.owed, currency)}
                </span>
              </span>
              <span className={b.balance > 0 ? "font-semibold text-foreground" : b.balance < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                {b.balance > 0 ? "받을 돈 " : b.balance < 0 ? "보낼 돈 " : ""}
                {b.balance === 0 ? "0" : formatMoney(Math.abs(b.balance), currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
