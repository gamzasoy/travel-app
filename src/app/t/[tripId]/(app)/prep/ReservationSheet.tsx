"use client";

import { useState, useTransition } from "react";
import { addReservation, editReservation, removeReservation, type ReservationInput } from "@/actions/reservations";
import { KIND_ICON, KIND_LABELS } from "@/lib/reservation";
import { safe } from "@/lib/safe-action";
import { dateOf, timeOf } from "@/lib/schedule";
import { RESERVATION_KINDS, type Reservation, type ReservationKind } from "@/lib/types";

const PLACEHOLDER: Record<ReservationKind | "none", string> = {
  항공: "예: 인천 → 하네다 KE719",
  렌트카: "예: 토요타 렌터카 나하공항점",
  숙소: "예: 호텔 그레이서리 신주쿠",
  기차: "예: 신칸센 도쿄 → 교토",
  투어: "예: 디즈니씨 입장권",
  기타: "예약 이름",
  none: "예약 이름",
};

export function ReservationSheet({ item, onClose }: { item: Reservation | null; onClose: () => void }) {
  const [kind, setKind] = useState<ReservationKind | null>(item?.kind ?? "항공");
  const [title, setTitle] = useState(item?.title ?? "");
  const [startDate, setStartDate] = useState(dateOf(item?.start ?? null) ?? "");
  const [startTime, setStartTime] = useState(timeOf(item?.start ?? null) ?? "");
  const [endDate, setEndDate] = useState(dateOf(item?.end ?? null) ?? "");
  const [endTime, setEndTime] = useState(timeOf(item?.end ?? null) ?? "");
  const [confirmation, setConfirmation] = useState(item?.confirmation ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [startLabel, endLabel] = KIND_LABELS[kind ?? "none"];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: ReservationInput = {
      title,
      kind,
      startDate: startDate || null,
      startTime: startTime || null,
      endDate: endDate || null,
      endTime: endTime || null,
      confirmation,
      note,
      url: url.trim(),
    };
    startTransition(async () => {
      const res = await safe(() => (item ? editReservation(item.id, input) : addReservation(input)));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!item || !confirm("이 예약을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await safe(() => removeReservation(item.id));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const field = "rounded-xl border border-border px-3 py-2 text-base text-foreground";

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{item ? "예약 수정" : "예약 추가"}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            닫기
          </button>
        </div>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="종류">
          {RESERVATION_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded-full border px-3 py-1 text-sm ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {KIND_ICON[k]} {k}
            </button>
          ))}
        </div>

        <input
          aria-label="예약 이름"
          autoFocus={!item}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={PLACEHOLDER[kind ?? "none"]}
          maxLength={100}
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {startLabel} 날짜
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {startLabel} 시간
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {endLabel} 날짜
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={field} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {endLabel} 시간
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={field} />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          예약번호
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="예: ABC123"
            maxLength={100}
            autoCapitalize="characters"
            className={`${field} font-mono`}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          예약 확인 링크 (선택)
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" className={field} />
        </label>

        <textarea
          aria-label="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (예: 터미널 2, 좌석 32A, 수하물 23kg)"
          rows={3}
          maxLength={1000}
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          {item && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-xl border border-destructive px-4 py-3 font-medium text-destructive disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
