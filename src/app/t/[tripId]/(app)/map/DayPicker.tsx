"use client";

import { dayLabel } from "@/lib/schedule";

/** 방문 날짜 칩 (여러 개 선택). 고른 날의 일정에 장소가 들어간다 */
export function DayPicker({ days, picked, onToggle }: { days: string[]; picked: Set<string>; onToggle: (day: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="방문 날짜">
      {days.map((d, i) => {
        const on = picked.has(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(d)}
            className={`rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            Day {i + 1} · {dayLabel(d)}
          </button>
        );
      })}
    </div>
  );
}

/** Set 에서 값 하나를 켜고/끈 새 Set */
export const toggleIn = (prev: Set<string>, d: string): Set<string> => {
  const next = new Set(prev);
  if (next.has(d)) next.delete(d);
  else next.add(d);
  return next;
};
