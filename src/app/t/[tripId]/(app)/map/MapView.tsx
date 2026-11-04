"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useMemo, useOptimistic, useState, useTransition, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from "react";
import { removePlace, reorderVisits, setPlaceVisited } from "@/actions/places";
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
  // 끌어서 순서를 바꾸면 서버 응답을 기다리지 않고 바로 새 순서로 보여준다 (실패하면 원래 순서로 복귀)
  const [optimisticOrder, setOptimisticOrder] = useOptimistic<string[] | null, string[]>(null, (_prev, next) => next);
  const visiblePlaces = useMemo(() => {
    const dayPlaces = activeDay ? (byDay.get(activeDay) ?? []) : places;
    if (!activeDay || !optimisticOrder) return dayPlaces;
    const byId = new Map(dayPlaces.map((p) => [p.id, p]));
    const ordered = optimisticOrder.flatMap((id) => byId.get(id) ?? []);
    return ordered.length === dayPlaces.length ? ordered : dayPlaces;
  }, [activeDay, optimisticOrder, byDay, places]);
  const sortable = !!activeDay && visiblePlaces.length > 1;

  // 마우스는 살짝 끌면, 터치는 꾹 누르면(스크롤과 구분) 시작
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const editingPlace = editingId ? places.find((p) => p.id === editingId) : undefined;

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, optimistic?: () => void) => {
    setError(null);
    startTransition(async () => {
      optimistic?.();
      const res = await safe(fn);
      if (!res.ok) setError(res.error);
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!activeDay || !e.over || e.active.id === e.over.id) return;
    const ids = visiblePlaces.map((p) => p.id);
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    const next = arrayMove(ids, from, to);
    run(() => reorderVisits(activeDay, next), () => setOptimisticOrder(next));
  };

  const rowProps = (p: Place, i: number): RowProps => ({
    place: p,
    index: i,
    numbered: !!activeDay,
    selected: p.id === selectedId,
    pending,
    tag: dayTag(dayNumbers.get(p.id)),
    onEdit: () => {
      setSelectedId(p.id);
      setEditingId(p.id);
    },
    onVisited: (visited) => run(() => setPlaceVisited(p.id, visited), () => setVisitedOptimistic({ id: p.id, visited })),
    onDelete: () => {
      if (confirm(`'${p.name}' 장소를 삭제할까요? 연결된 일정에서는 장소가 빠져요.`)) run(() => removePlace(p.id));
    },
  });

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
          <>
            {sortable && <p className="mb-2 text-xs text-muted-foreground">장소를 꾹 눌러 끌면 방문 순서가 바뀌어요. (일정의 시간도 같이 옮겨져요)</p>}
            {sortable ? (
              <DndContext id="place-order" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={visiblePlaces.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {visiblePlaces.map((p, i) => (
                      <SortablePlaceRow key={p.id} {...rowProps(p, i)} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {visiblePlaces.map((p, i) => (
                  <PlaceRow key={p.id} {...rowProps(p, i)} />
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      {adding && (
        <PlaceSheet searchEnabled={hasKey} days={days} initialDays={activeDay ? [activeDay] : []} onClose={() => setAdding(false)} />
      )}
      {editingPlace && (
        <PlaceSheet
          key={editingPlace.id}
          place={editingPlace}
          searchEnabled={hasKey}
          days={days}
          initialDays={days.filter((d) => byDay.get(d)?.some((p) => p.id === editingPlace.id))}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

interface RowProps {
  place: Place;
  index: number;
  /** 날짜별 보기에서는 방문 순번(1. 2. …)을 붙인다 */
  numbered: boolean;
  selected: boolean;
  pending: boolean;
  tag: string | null;
  onEdit: () => void;
  onVisited: (visited: boolean) => void;
  onDelete: () => void;
}

/** 끌어서 순서를 바꿀 수 있는 행. 행 전체를 꾹 눌러 끌 수 있고, 왼쪽 ≡ 는 키보드로 옮길 때의 손잡이다. */
function SortablePlaceRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.place.id,
    disabled: props.pending,
  });
  return (
    <PlaceRow
      {...props}
      liRef={setNodeRef}
      liStyle={{ transform: CSS.Transform.toString(transform), transition, position: "relative", zIndex: isDragging ? 10 : undefined }}
      liHandlers={listeners}
      dragging={isDragging}
      handle={
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          aria-label={`${props.place.name} 순서 변경`}
          className="-ml-1 mt-0.5 shrink-0 cursor-grab touch-none px-1 text-lg leading-none text-muted-foreground"
        >
          ≡
        </button>
      }
    />
  );
}

function PlaceRow({
  place: p,
  index: i,
  numbered,
  selected,
  pending,
  tag,
  onEdit,
  onVisited,
  onDelete,
  liRef,
  liStyle,
  liHandlers,
  dragging,
  handle,
}: RowProps & {
  liRef?: Ref<HTMLLIElement>;
  liStyle?: CSSProperties;
  liHandlers?: HTMLAttributes<HTMLLIElement>;
  dragging?: boolean;
  handle?: ReactNode;
}) {
  const bg = dragging ? "bg-card shadow-lg" : selected ? "bg-primary/20" : "";
  return (
    <li
      ref={liRef}
      style={liStyle}
      {...liHandlers}
      className={`${bg} ${handle ? "select-none [-webkit-touch-callout:none]" : ""}`}
    >
      <div className="flex items-start gap-3 px-3 py-3">
        {handle}
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: categoryColor(p.category) }} aria-hidden />
        <button type="button" aria-label={`${p.name} 편집`} onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className={`block font-medium ${p.visited ? "text-muted-foreground line-through" : ""}`}>
            {numbered && `${i + 1}. `}
            {p.name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {[p.category, tag, p.address].filter(Boolean).join(" · ") || "—"}
            {p.lat === null && " · 좌표 없음"}
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
          <a
            href={directionsUrl(p)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-2 py-1 text-foreground active:bg-muted"
          >
            길찾기 ↗
          </a>
          <label className="flex items-center gap-1 text-muted-foreground">
            <input type="checkbox" checked={p.visited} onChange={(e) => onVisited(e.target.checked)} />
            다녀옴
          </label>
          <button type="button" disabled={pending} aria-label={`${p.name} 삭제`} onClick={onDelete} className="text-destructive disabled:opacity-50">
            삭제
          </button>
        </div>
      </div>
    </li>
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
