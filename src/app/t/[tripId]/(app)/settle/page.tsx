import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { formatMoney } from "@/lib/currency";
import { getTrip, listExpenses, listMembers } from "@/lib/notion/repo";
import { getRate } from "@/lib/rate";
import { settle } from "@/lib/settle";
import type { Currency } from "@/lib/types";

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
          <ul className="divide-y divide-border rounded-xl border border-border">
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
      </section>

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
