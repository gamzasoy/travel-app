"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { dayLabel, directionsUrl, groupByDay, timeOf } from "@/lib/schedule";
import type { Place, ScheduleItem } from "@/lib/types";
import type { DayWeather } from "@/lib/weather-util";
import { ScheduleSheet } from "./ScheduleSheet";

interface Props {
  days: string[];
  defaultDay: string | null;
  today: string;
  items: ScheduleItem[];
  places: Place[];
  weather: Record<string, DayWeather>;
}

type Editing = { mode: "new" } | { mode: "edit"; item: ScheduleItem } | null;

export function ScheduleView({ days, defaultDay, today, items, places, weather }: Props) {
  const { tripId } = useParams<{ tripId: string }>();
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
                  className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                >
                  <span className="block text-[10px] opacity-80">{d === today ? "오늘" : `Day ${i + 1}`}</span>
                  <span className="block font-semibold">{dayLabel(d)}</span>
                  <span className="block text-[10px] opacity-80">
                    {weather[d] ? `${weather[d].icon} ${weather[d].max ?? "-"}° · ` : ""}
                    {count}개
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {days.length === 0 && undated.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          여행 기간이 비어 있어요. 일정을 추가하면 날짜가 생겨요.
        </p>
      )}

      {activeDay && <WeatherCard day={activeDay} today={today} weather={weather[activeDay]} />}

      {activeDay && (
        <section aria-label={`${dayLabel(activeDay)} 일정`}>
          {list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              이 날의 일정이 아직 없어요.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {list.map((it, i) => (
                <ScheduleCard key={it.id} index={i + 1} tripId={tripId} item={it} place={it.placeId ? placeById.get(it.placeId) : undefined} onEdit={() => setEditing({ mode: "edit", item: it })} />
              ))}
            </ol>
          )}
        </section>
      )}

      {undated.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold text-muted-foreground">날짜 미정</h2>
          <ol className="flex flex-col gap-2">
            {undated.map((it, i) => (
              <ScheduleCard key={it.id} index={i + 1} tripId={tripId} item={it} place={it.placeId ? placeById.get(it.placeId) : undefined} onEdit={() => setEditing({ mode: "edit", item: it })} />
            ))}
          </ol>
        </section>
      )}

      <button
        type="button"
        aria-label="일정 추가"
        onClick={() => setEditing({ mode: "new" })}
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl text-primary-foreground shadow-lg active:brightness-95"
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

function ScheduleCard({ tripId, item, place, index, onEdit }: { tripId: string; index: number; item: ScheduleItem; place?: Place; onEdit: () => void }) {
  const time = timeOf(item.start);
  return (
    <li className="flex gap-3 rounded-xl border border-border p-3">
      <div
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
      >
        {index}
      </div>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={onEdit} className="block w-full text-left">
          <span className="block font-medium">
            {time && <span className="mr-1.5 text-sm font-semibold text-primary">{time}</span>}
            {item.title}
          </span>
          {place && place.name !== item.title && (
            <span className="block truncate text-xs text-muted-foreground">📍 {place.name}</span>
          )}
          {item.note && <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">{item.note}</span>}
        </button>
        {place && (
          <div className="mt-1.5 flex gap-2">
            <Link
              href={`/t/${tripId}/map?p=${place.id}`}
              className="rounded-lg border border-border px-2 py-1 text-xs text-foreground active:bg-muted"
            >
              지도에서 보기
            </Link>
            <a
              href={directionsUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-2 py-1 text-xs text-foreground active:bg-muted"
            >
              구글맵 길찾기 ↗
            </a>
          </div>
        )}
      </div>
    </li>
  );
}

function WeatherCard({ day, today, weather }: { day: string; today: string; weather?: DayWeather }) {
  if (!weather) {
    // 지난 날은 조용히 생략, 앞으로의 날은 왜 없는지 한 줄로 안내
    if (day < today) return null;
    return (
      <p className="text-xs text-muted-foreground">
        🌤️ 날씨는 여행 약 2주 전부터 보여요. (일정에 장소를 연결하거나 숙소를 등록해 두세요)
      </p>
    );
  }
  return (
    <section aria-label="날씨" className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
      <span className="text-3xl" aria-hidden>
        {weather.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {weather.label}
          {weather.max !== null && (
            <span className="ml-2 font-normal">
              <span className="text-destructive">{weather.max}°</span>
              {weather.min !== null && <span className="text-muted-foreground"> / {weather.min}°</span>}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {weather.pop !== null && `☔ 강수 ${weather.pop}% · `}기준: {weather.placeName}
        </p>
      </div>
    </section>
  );
}
