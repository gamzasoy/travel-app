"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { addChecklistItem, addDefaultChecklist, toggleChecklistItem } from "@/actions/checklist";
import { filterByBag, groupChecklist, type BagFilter } from "@/lib/checklist";
import { safe } from "@/lib/safe-action";
import {
  CHECKLIST_BAGS,
  CHECKLIST_CATEGORIES,
  type ChecklistBag,
  type ChecklistCategory,
  type ChecklistItem,
} from "@/lib/types";
import { BAG_ICON, BagBadge, ChecklistSheet } from "./ChecklistSheet";

export function ChecklistView({ items }: { items: ChecklistItem[] }) {
  const [optimistic, setChecked] = useOptimistic(items, (state, change: { id: string; checked: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, checked: change.checked } : i)),
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ChecklistCategory | "">("");
  const [bag, setBag] = useState<ChecklistBag | null>(null);
  const [bagFilter, setBagFilter] = useState<BagFilter>("전체");
  const [hideChecked, setHideChecked] = useState(false);
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, startAdd] = useTransition();
  const [, startToggle] = useTransition();

  // 진행률·목록 모두 선택한 짐 기준 (기내 가방만 싸는 중일 때 그것만 보이게)
  const inBag = filterByBag(optimistic, bagFilter);
  const done = inBag.filter((i) => i.checked).length;
  const visible = hideChecked ? inBag.filter((i) => !i.checked) : inBag;
  const groups = useMemo(() => groupChecklist(visible, CHECKLIST_CATEGORIES), [visible]);

  const toggle = (item: ChecklistItem) => {
    setError(null);
    startToggle(async () => {
      setChecked({ id: item.id, checked: !item.checked });
      const res = await safe(() => toggleChecklistItem(item.id, !item.checked));
      if (!res.ok) setError(res.error); // 실패하면 낙관적 변경은 자동으로 되돌아간다
    });
  };

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    startAdd(async () => {
      const res = await safe(() => addChecklistItem({ title, category: category || null, bag }));
      if (res.ok) setTitle("");
      else setError(res.error);
    });
  };

  const addDefaults = () => {
    setError(null);
    startAdd(async () => {
      const res = await safe(() => addDefaultChecklist());
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {optimistic.length > 0 && (
        <div className="flex gap-1.5" role="radiogroup" aria-label="짐 필터">
          {(["전체", ...CHECKLIST_BAGS] as const).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bagFilter === b}
              onClick={() => setBagFilter(b)}
              className={`rounded-full border px-3 py-1 text-sm ${bagFilter === b ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
            >
              {b === "전체" ? "전체" : `${BAG_ICON[b]} ${b}`}
              <span className="ml-1 text-xs opacity-70">{filterByBag(optimistic, b).length}</span>
            </button>
          ))}
        </div>
      )}

      {optimistic.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              {bagFilter !== "전체" && `${bagFilter} `}
              <b>{done}</b> / {inBag.length} 챙김
            </span>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} />
              챙긴 것 숨기기
            </label>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="준비물 진행률"
            aria-valuemin={0}
            aria-valuemax={inBag.length}
            aria-valuenow={done}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{
                width: `${inBag.length ? (done / inBag.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      <form onSubmit={add} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            aria-label="준비물"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="준비물 추가 (예: 우산)"
            maxLength={100}
            className="min-w-0 flex-1 rounded-xl border border-border px-3 py-2 outline-none focus:border-primary"
          />
          <select
            aria-label="분류"
            value={category}
            onChange={(e) => setCategory(e.target.value as ChecklistCategory | "")}
            className="w-24 rounded-xl border border-border px-2 py-2 text-sm"
          >
            <option value="">분류</option>
            {CHECKLIST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding || !title.trim()}
            className="rounded-xl bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-50"
          >
            추가
          </button>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          role="radiogroup"
          aria-label="추가할 짐"
        >
          <span>짐</span>
          {CHECKLIST_BAGS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={bag === b}
              onClick={() => setBag(bag === b ? null : b)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 ${bag === b ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
            >
              {BAG_ICON[b]} {b}
            </button>
          ))}
          <span className="ml-auto text-right">보조배터리는 기내, 100ml 넘는 액체는 위탁</span>
        </div>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {optimistic.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <p>아직 준비물이 없어요. 모두가 같은 목록을 함께 체크해요.</p>
          <button
            type="button"
            onClick={addDefaults}
            disabled={adding}
            className="rounded-xl border border-primary px-4 py-2 font-medium text-primary disabled:opacity-50"
          >
            {adding ? "넣는 중…" : "기본 준비물 넣기"}
          </button>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.category} aria-label={g.category}>
            <h2 className="mb-1 text-xs font-semibold text-muted-foreground">{g.category}</h2>
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {g.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                  <label className="flex min-w-0 flex-1 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={it.checked}
                      onChange={() => toggle(it)}
                      className="h-5 w-5 shrink-0 accent-primary"
                    />
                    <span className={`truncate ${it.checked ? "text-muted-foreground line-through" : ""}`}>
                      {it.title}
                    </span>
                  </label>
                  {it.bag && <BagBadge bag={it.bag} />}
                  <button
                    type="button"
                    aria-label={`${it.title} 수정`}
                    onClick={() => setEditing(it)}
                    className="shrink-0 px-1 text-sm text-muted-foreground"
                  >
                    ✏️
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {optimistic.length > 0 && inBag.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {bagFilter} 짐으로 정한 준비물이 없어요. ✏️ 를 눌러 짐을 정해 보세요.
        </p>
      )}

      {hideChecked && done > 0 && done === inBag.length && (
        <p className="py-4 text-center text-sm text-muted-foreground">모두 챙겼어요! 🎉</p>
      )}

      {editing && <ChecklistSheet key={editing.id} item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
