"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { KIND_ICON, KIND_LABELS, formatPeriod, splitReservations } from "@/lib/reservation";
import type { Reservation } from "@/lib/types";
import { ReservationSheet } from "./ReservationSheet";

type Editing = { mode: "new" } | { mode: "edit"; item: Reservation } | null;

export function ReservationsView({ reservations, now }: { reservations: Reservation[]; now: string }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [showPast, setShowPast] = useState(false);
  const { upcoming, past } = useMemo(() => splitReservations(reservations, now), [reservations, now]);

  return (
    <div className="flex flex-col gap-3">
      {reservations.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          항공권·렌트카·숙소 예약을 저장해 두면 예약번호를 바로 꺼내 볼 수 있어요.
        </p>
      )}

      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-2">
          {upcoming.map((r, i) => (
            <ReservationCard key={r.id} r={r} highlight={i === 0 && !!r.start} onEdit={() => setEditing({ mode: "edit", item: r })} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowPast((v) => !v)} className="mb-2 text-xs font-semibold text-muted-foreground">
            지난 예약 {past.length}개 {showPast ? "▲" : "▼"}
          </button>
          {showPast && (
            <ul className="flex flex-col gap-2 opacity-60">
              {past.map((r) => (
                <ReservationCard key={r.id} r={r} onEdit={() => setEditing({ mode: "edit", item: r })} />
              ))}
            </ul>
          )}
        </section>
      )}

      <button
        type="button"
        aria-label="예약 추가"
        onClick={() => setEditing({ mode: "new" })}
        className="fixed bottom-20 right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-3xl text-primary-foreground shadow-lg active:brightness-95"
      >
        +
      </button>

      {editing && (
        <ReservationSheet
          key={editing.mode === "edit" ? editing.item.id : "new"}
          item={editing.mode === "edit" ? editing.item : null}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ReservationCard({ r, highlight = false, onEdit }: { r: Reservation; highlight?: boolean; onEdit: () => void }) {
  const [startLabel, endLabel] = KIND_LABELS[r.kind ?? "none"];
  return (
    <li className={`flex flex-col gap-2 rounded-xl border p-3 ${highlight ? "border-primary" : "border-border"}`}>
      <button type="button" onClick={onEdit} className="flex items-start gap-3 text-left">
        <span className="text-2xl" aria-hidden>
          {r.kind ? KIND_ICON[r.kind] : "📌"}
        </span>
        <span className="min-w-0 flex-1">
          {highlight && <span className="mb-0.5 block text-[10px] font-semibold text-primary">다음 예약</span>}
          <span className="block font-medium">{r.title}</span>
          <span className="block text-xs text-muted-foreground" title={`${startLabel} → ${endLabel}`}>
            {formatPeriod(r.start, r.end)}
          </span>
          {r.note && <span className="mt-1 block whitespace-pre-line text-xs text-muted-foreground">{r.note}</span>}
        </span>
      </button>
      {(r.confirmation || r.url) && (
        <div className="flex flex-wrap items-center gap-2 pl-10">
          {r.confirmation && (
            <>
              <span className="rounded-lg bg-muted px-2 py-1 font-mono text-sm tracking-wider">{r.confirmation}</span>
              <CopyButton text={r.confirmation} label="예약번호 복사" />
            </>
          )}
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-3 py-1 text-sm text-foreground active:bg-muted"
            >
              예약 확인 ↗
            </a>
          )}
        </div>
      )}
    </li>
  );
}
