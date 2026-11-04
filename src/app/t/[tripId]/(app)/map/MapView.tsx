"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { moveVisit, removePlace, setPlaceVisited } from "@/actions/places";
import { categoryColor, dayNumbersByPlace, placesByDay, routeForDay } from "@/lib/map";
import { dayLabel, directionsUrl } from "@/lib/schedule";
import type { Place, ScheduleItem } from "@/lib/types";
import { GoogleMap } from "./GoogleMap";
import { PlaceSheet } from "./PlaceSheet";
import { safe } from "@/lib/safe-action";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface Props {
  days: string[];
  defaultDay: string | null;
  items: ScheduleItem[];
  places: Place[];
  initialPlaceId: string | null;
}

export function MapView(props: Props) {
  const content = <MapContent {...props} hasKey={!!API_KEY} />;
  return API_KEY ? (
    <APIProvider apiKey={API_KEY} language="ko">
      {content}
    </APIProvider>
  ) : (
    content
  );
}

function MapContent({ days, defaultDay, items, places: serverPlaces, initialPlaceId, hasKey }: Props & { hasKey: boolean }) {
  // 체크하면 서버 응답을 기다리지 않고 바로 반영한다 (실패하면 서버 값으로 자동 복귀)
  const [places, setVisitedOptimistic] = useOptimistic(
    serverPlaces,
    (state, v: { id: string; visited: boolean }) => state.map((p) => (p.id === v.id ? { ...p, visited: v.visited } : p)),
  );
  // 처음엔 오늘/첫날 장소만 보여주되, 그날 연결된 장소가 없거나 특정 장소로 들어왔으면 전체를 보여준다
  const [day, setDay] = useState<string | null>(() =>
    !initialPlaceId && defaultDay && placesByDay(items, serverPlaces).has(defaultDay) ? defaultDay : null,
  );
  const [selectedId, setSelectedId] = useState<string | null>(initialPlaceId);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeDay = day && days.includes(day) ? day : null;
  const route = useMemo(() => routeForDay(items, places, activeDay), [items, places, activeDay]);
  const byDay = useMemo(() => placesByDay(items, places), [items, places]);
  const dayNumbers = useMemo(() => dayNumbersByPlace(byDay, days), [byDay, days]);
  // 날짜를 고르면 그날 일정에 연결된 장소만 (일정 순서대로), 아니면 전체
  const visiblePlaces = activeDay ? (byDay.get(activeDay) ?? []) : places;

  const editingPlace = editingId ? places.find((p) => p.id === editingId) : undefined;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, optimistic?: () => void) => {
    setError(null);
    startTransition(async () => {
      optimistic?.();
      const res = await safe(fn);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {hasKey ? (
        <GoogleMap places={visiblePlaces} route={route} selectedId={selectedId} onSelect={setSelectedId} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
          <p className="font-semibold">지도를 보려면 구글 지도 키가 필요해요 🗺️</p>
          <p className="mt-1 text-xs">
            <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> 를 설정하면 지도·마커·경로·장소 검색이 켜져요. 키 없이도 장소를 직접
            추가해 일정에 연결하고 구글맵 길찾기를 쓸 수 있어요.
          </p>
        </div>
      )}

      {days.length > 0 && (
        <div>
          <p className="mb-1 text-xs text-muted-foreground">날짜별 보기</p>
          <div className="-mx-4 overflow-x-auto px-4">
            <div className="flex gap-2 pb-1" role="group" aria-label="날짜">
              <DayChip label="전체" selected={activeDay === null} onClick={() => setDay(null)} />
              {days.map((d, i) => (
                <DayChip key={d} label={`Day ${i + 1} · ${dayLabel(d)}`} selected={activeDay === d} onClick={() => setDay(d)} />
              ))}
            </div>
          </div>
          {activeDay && (
            <p className="mt-1 text-xs text-muted-foreground">
              {visiblePlaces.length === 0
                ? "이 날 일정에 연결된 장소가 없어요. 일정에서 장소를 연결하면 여기에 나와요."
                : route.length === 0
                  ? "이 날 일정에 좌표가 있는 장소가 없어요."
                  : route.map((s) => `${s.n}. ${s.place.name}`).join(" → ")}
            </p>
          )}
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">장소 ({visiblePlaces.length})</h2>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-primary px-3 py-1 text-sm font-medium text-primary-foreground active:brightness-95"
          >
            + 장소 추가
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {visiblePlaces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {activeDay ? "이 날 일정에 연결된 장소가 없어요. 위에서 '전체'를 누르면 모든 장소가 보여요." : "아직 장소가 없어요. 가고 싶은 곳을 추가해보세요."}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {visiblePlaces.map((p, i) => (
              <li key={p.id} className={p.id === selectedId ? "bg-primary/20" : undefined}>
                <div className="flex items-start gap-3 px-3 py-3">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: categoryColor(p.category) }} aria-hidden />
                  <button
                    type="button"
                    aria-label={`${p.name} 편집`}
                    onClick={() => {
                      setSelectedId(p.id);
                      setEditingId(p.id);
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className={`block font-medium ${p.visited ? "text-muted-foreground line-through" : ""}`}>
                      {activeDay && `${i + 1}. `}
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[p.category, dayTag(dayNumbers.get(p.id)), p.address].filter(Boolean).join(" · ") || "—"}
                      {p.lat === null && " · 좌표 없음"}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    {activeDay && visiblePlaces.length > 1 && (
                      <div className="flex gap-1" role="group" aria-label={`${p.name} 순서`}>
                        <button
                          type="button"
                          disabled={pending || i === 0}
                          aria-label={`${p.name} 위로`}
                          onClick={() => run(() => moveVisit(p.id, activeDay, "up"))}
                          className="rounded-lg border border-border px-2 py-1 text-foreground active:bg-muted disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={pending || i === visiblePlaces.length - 1}
                          aria-label={`${p.name} 아래로`}
                          onClick={() => run(() => moveVisit(p.id, activeDay, "down"))}
                          className="rounded-lg border border-border px-2 py-1 text-foreground active:bg-muted disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                    )}
                    <a
                      href={directionsUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border px-2 py-1 text-foreground active:bg-muted"
                    >
                      길찾기 ↗
                    </a>
                    <label className="flex items-center gap-1 text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={p.visited}
                        onChange={(e) => {
                          const visited = e.target.checked;
                          run(() => setPlaceVisited(p.id, visited), () => setVisitedOptimistic({ id: p.id, visited }));
                        }}
                      />
                      다녀옴
                    </label>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`${p.name} 삭제`}
                      onClick={() => {
                        if (confirm(`'${p.name}' 장소를 삭제할까요? 연결된 일정에서는 장소가 빠져요.`)) {
                          run(() => removePlace(p.id));
                        }
                      }}
                      className="text-destructive disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {adding && <PlaceSheet searchEnabled={hasKey} onClose={() => setAdding(false)} />}
      {editingPlace && <PlaceSheet key={editingPlace.id} place={editingPlace} searchEnabled={hasKey} onClose={() => setEditingId(null)} />}
    </div>
  );
}

/** [1, 3] → "Day 1·3" */
const dayTag = (nums: number[] | undefined): string | null => (nums?.length ? `Day ${nums.join("·")}` : null);

function DayChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
    >
      {label}
    </button>
  );
}
