"use client";

import { useState } from "react";
import type { ChecklistItem, Reservation } from "@/lib/types";
import { ChecklistView } from "./ChecklistView";
import { ReservationsView } from "./ReservationsView";

export type PrepTab = "checklist" | "reservations";

const TABS: { key: PrepTab; label: string }[] = [
  { key: "checklist", label: "🧳 준비물" },
  { key: "reservations", label: "🎫 예약" },
];

interface Props {
  initial: PrepTab;
  checklist: ChecklistItem[];
  reservations: Reservation[];
  now: string;
}

export function PrepView({ initial, checklist, reservations, now }: Props) {
  const [tab, setTab] = useState<PrepTab>(initial);

  const select = (next: PrepTab) => {
    setTab(next);
    // 새로고침·뒤로가기 후에도 같은 화면이 보이게 주소만 바꾼다 (서버 재요청 없음)
    const url = new URL(window.location.href);
    if (next === "checklist") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="준비" className="flex rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => select(t.key)}
            className={`flex-1 rounded-lg py-2 text-sm ${tab === t.key ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "checklist" ? <ChecklistView items={checklist} /> : <ReservationsView reservations={reservations} now={now} />}
    </div>
  );
}
