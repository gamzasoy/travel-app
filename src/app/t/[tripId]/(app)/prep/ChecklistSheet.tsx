"use client";

import { useState, useTransition } from "react";
import { editChecklistItem, removeChecklistItem } from "@/actions/checklist";
import { safe } from "@/lib/safe-action";
import {
  CHECKLIST_BAGS,
  CHECKLIST_CATEGORIES,
  type ChecklistBag,
  type ChecklistCategory,
  type ChecklistItem,
} from "@/lib/types";

export const BAG_ICON: Record<ChecklistBag, string> = { 기내: "🎒", 위탁: "🧳" };

/** 목록에서 항목 옆에 붙는 짐 표시 */
export function BagBadge({ bag }: { bag: ChecklistBag }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${bag === "기내" ? "bg-primary/25 text-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {BAG_ICON[bag]} {bag}
    </span>
  );
}

export function ChecklistSheet({ item, onClose }: { item: ChecklistItem; onClose: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<ChecklistCategory | "">(item.category ?? "");
  const [bag, setBag] = useState<ChecklistBag | null>(item.bag);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await safe(() => editChecklistItem(item.id, { title, category: category || null, bag }));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  const remove = () => {
    if (!confirm("이 준비물을 삭제할까요?")) return;
    startTransition(async () => {
      const res = await safe(() => removeChecklistItem(item.id));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">준비물 수정</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            닫기
          </button>
        </div>
        <input
          aria-label="이름"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="분류">
          {CHECKLIST_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(category === c ? "" : c)}
              className={`rounded-full border px-3 py-1 text-sm ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="짐">
          <span className="text-sm text-muted-foreground">짐</span>
          {CHECKLIST_BAGS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bag === b}
              onClick={() => setBag(bag === b ? null : b)}
              className={`rounded-full border px-3 py-1 text-sm ${bag === b ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {BAG_ICON[b]} {b}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded-xl border border-destructive px-4 py-3 font-medium text-destructive disabled:opacity-50"
          >
            삭제
          </button>
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
