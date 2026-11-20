"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORIES, type Currency, type ExpenseCategory } from "@/lib/types";

/**
 * 분류마다 고정 색 (분류 순서 = 색 순서, 사람을 바꿔도 같은 분류는 같은 색).
 * 색약에서도 이웃한 조각이 구분되도록 검증된 순서이고, "기타"는 중립 회색.
 * 연한 색은 배경과 대비가 낮아서 범례에 이름·금액을 항상 글자로 같이 보여준다.
 */
const COLOR: Record<ExpenseCategory, string> = {
  식비: "#2a78d6",
  간식: "#eb6834",
  교통: "#1baf7a",
  숙소: "#eda100",
  쇼핑: "#e87ba4",
  관광: "#008300",
  보험: "#6250d6",
  기타: "#8a8984",
};

export interface PieView {
  key: string;
  label: string;
  total: number;
  byCategory: { category: ExpenseCategory; amount: number }[];
}

const R = 60;
const STROKE = 26;
const C = 2 * Math.PI * R;
const GAP = 2; // 조각 사이 틈 (px)

export function CategoryPie({ views, currency }: { views: PieView[]; currency: Currency }) {
  const [viewKey, setViewKey] = useState(views[0]?.key);
  const [active, setActive] = useState<ExpenseCategory | null>(null);
  const view = views.find((v) => v.key === viewKey) ?? views[0];
  if (!view) return null;

  // 조각은 분류 고정 순서로, 범례는 금액 큰 순으로
  const amountOf = new Map(view.byCategory.map((c) => [c.category, c.amount]));
  const slices = EXPENSE_CATEGORIES.filter((c) => (amountOf.get(c) ?? 0) > 0).map((c) => ({ category: c, amount: amountOf.get(c)! }));
  const legend = [...slices].sort((a, b) => b.amount - a.amount);
  const pct = (n: number) => (view.total > 0 ? Math.round((n / view.total) * 1000) / 10 : 0);
  const gap = slices.length > 1 ? GAP : 0;
  const focus = active && amountOf.get(active) ? active : null;

  let offset = 0;
  const arcs = slices.map((s) => {
    const len = (s.amount / view.total) * C;
    const arc = { ...s, dash: Math.max(len - gap, 0.5), offset };
    offset += len;
    return arc;
  });

  const toggle = (c: ExpenseCategory) => setActive((cur) => (cur === c ? null : c));

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="차트 대상">
        {views.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={v.key === view.key}
            onClick={() => {
              setViewKey(v.key);
              setActive(null);
            }}
            className={`rounded-full border px-3 py-1 text-sm ${v.key === view.key ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground"}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {slices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">쓴 돈이 없어요.</p>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-44 w-44">
            <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" role="img" aria-label={`${view.label} 분류별 지출 원형 차트`}>
              {arcs.map((a) => (
                <circle
                  key={a.category}
                  cx="80"
                  cy="80"
                  r={R}
                  fill="none"
                  stroke={COLOR[a.category]}
                  strokeWidth={focus === a.category ? STROKE + 6 : STROKE}
                  strokeDasharray={`${a.dash} ${C - a.dash}`}
                  strokeDashoffset={-a.offset}
                  style={{ opacity: focus && focus !== a.category ? 0.25 : 1 }}
                  className="cursor-pointer"
                  onClick={() => toggle(a.category)}
                >
                  <title>{`${a.category} ${formatMoney(a.amount, currency)} (${pct(a.amount)}%)`}</title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-muted-foreground">{focus ?? "합계"}</span>
              <span className="text-sm font-semibold">{formatMoney(focus ? amountOf.get(focus)! : view.total, currency)}</span>
              {focus && <span className="text-xs text-muted-foreground">{pct(amountOf.get(focus)!)}%</span>}
            </div>
          </div>

          <ul aria-label={`${view.label} 분류별 금액`} className="w-full divide-y divide-border text-sm">
            {legend.map((s) => (
              <li key={s.category}>
                <button
                  type="button"
                  aria-pressed={focus === s.category}
                  onClick={() => toggle(s.category)}
                  className={`flex w-full items-center gap-2 py-2 text-left ${focus && focus !== s.category ? "opacity-50" : ""}`}
                >
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COLOR[s.category] }} aria-hidden />
                  <span className="flex-1">{s.category}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground">{pct(s.amount)}%</span>
                  <span className="w-24 text-right font-medium">{formatMoney(s.amount, currency)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
