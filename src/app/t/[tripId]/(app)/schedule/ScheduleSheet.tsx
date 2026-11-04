"use client";

import { useState, useTransition } from "react";
import { addScheduleItem, editScheduleItem, removeScheduleItem, type ScheduleInput } from "@/actions/schedule";
import { dateOf, timeOf } from "@/lib/schedule";
import type { Place, ScheduleItem } from "@/lib/types";
import { safe } from "@/lib/safe-action";

interface Props {
  item: ScheduleItem | null;
  defaultDate: string;
  places: Place[];
  onClose: () => void;
}

export function ScheduleSheet({ item, defaultDate, places, onClose }: Props) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [date, setDate] = useState(dateOf(item?.start ?? null) ?? defaultDate);
  const [time, setTime] = useState(timeOf(item?.start ?? null) ?? "");
  const [placeId, setPlaceId] = useState(item?.placeId ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const input: ScheduleInput = { title, date, time: time || null, placeId: placeId || null, note };
    startTransition(async () => {
      const res = await safe(() => (item ? editScheduleItem(item.id, input) : addScheduleItem(input)));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!item || !confirm("이 일정을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await safe(() => removeScheduleItem(item.id));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{item ? "일정 수정" : "일정 추가"}</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            닫기
          </button>
        </div>

        <input
          aria-label="제목"
          autoFocus={!item}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="무엇을 하나요? (예: 센소지 구경)"
          maxLength={100}
          className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />

        <div className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
            날짜
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-slate-500">
            시간 (선택)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900"
            />
          </label>
        </div>

        {places.length > 0 && (
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            장소 (선택)
            <select
              value={placeId}
              onChange={(e) => setPlaceId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-base text-slate-900"
            >
              <option value="">장소 없음</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <textarea
          aria-label="메모"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모 (예: 예약번호, 준비물)"
          rows={3}
          maxLength={1000}
          className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          {item && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="rounded-xl border border-red-300 px-4 py-3 font-medium text-red-600 disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="submit"
            disabled={pending || !title.trim() || !date}
            className="flex-1 rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50"
          >
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
}
