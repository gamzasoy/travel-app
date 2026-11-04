"use client";

import { useMemo, useState } from "react";
import { dayLabel, directionsUrl, groupByDay, timeOf } from "@/lib/schedule";
import type { Place, ScheduleItem } from "@/lib/types";
import { ScheduleSheet } from "./ScheduleSheet";

interface Props {
  days: string[];
  defaultDay: string | null;
  today: string;
  items: ScheduleItem[];
  places: Place[];
}

type Editing = { mode: "new" } | { mode: "edit"; item: ScheduleItem } | null;

export function ScheduleView({ days, defaultDay, today, items, places }: Props) {
  const [day, setDay] = useState<string | null>(defaultDay);
  const [editing, setEditing] = useState<Editing>(null);

  const grouped = useMemo(() => groupByDay(items), [items]);
  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
  const undated = grouped.get("미정") ?? [];
  // 선택한 날짜가 목록에서 사라졌어도(삭제 등) 화면이 깨지지 않게
  const activeDay = day && days.includes(day) ? day : (days[0] ?? null);
  const list = activeDay ? (grouped.get(activeDay) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      {days.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4" role="tablist" aria-label="날짜">
          <div className="flex gap-2 pb-1">
            {days.map((d, i) => {
              const selected = d === activeDay;
              const count = grouped.get(d)?.length ?? 0;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setDay(d)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm ${selected ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 text-slate-600"}`}
                >
                  <span className="block text-[10px] opacity-80">{d === today ? "오늘" : `Day ${i + 1}`}</span>
                  <span className="block font-semibold">{dayLabel(d)}</span>
                  <span className="block text-[10px] opacity-80">{count}개</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {days.length === 0 && undated.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-500">
          여행 기간이 비어 있어요. 일정을 추가하면 날짜가 생겨요.
        </p>
      )}

      {activeDay && (
        <section aria-label={`${dayLabel(activeDay)} 일정`}>
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              이 날의 일정이 아직 없어요.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {list.map((it) => (
                <ScheduleCard key={it.id} item={it} place={it.placeId ? placeById.get(it.placeId) : undefined} onEdit={() => setEditing({ mode: "edit", item: it })} />
              ))}
            </ol>
          )}
        </section>
      )}

      {undated.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-slate-500">날짜 미정</h2>
          <ol className="flex flex-col gap-2">
            {undated.map((it) => (
              <ScheduleCard key={it.id} item={it} place={it.placeId ? placeById.get(it.placeId) : undefined} onEdit={() => setEditing({ mode: "edit", item: it })} />
            ))}
          </ol>
        </section>
      )}

      <button
        type="button"
        aria-label="일정 추가"
        onClick={() => setEditing({ mode: "new" })}
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-3xl text-white shadow-lg active:bg-sky-600"
      >
        +
      </button>

      {editing && (
        <ScheduleSheet
          key={editing.mode === "edit" ? editing.item.id : "new"}
          item={editing.mode === "edit" ? editing.item : null}
          defaultDate={activeDay ?? today}
          places={places}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ScheduleCard({ item, place, onEdit }: { item: ScheduleItem; place?: Place; onEdit: () => void }) {
  const time = timeOf(item.start);
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 p-3">
      <div className="w-12 shrink-0 pt-0.5 text-sm font-semibold text-sky-600">{time ?? "—"}</div>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="block w-full text-left">
          <span className="block font-medium">{item.title}</span>
          {place && <span className="block truncate text-xs text-slate-500">📍 {place.name}</span>}
          {item.note && <span className="mt-1 block whitespace-pre-line text-xs text-slate-500">{item.note}</span>}
        </button>
        {place && (
          <a
            href={directionsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 active:bg-slate-50"
          >
            구글맵 길찾기 ↗
          </a>
        )}
      </div>
    </li>
  );
}
