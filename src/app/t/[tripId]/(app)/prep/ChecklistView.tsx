"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { addChecklistItem, addDefaultChecklist, autoAssignBags, setChecklistPacked } from "@/actions/checklist";
import { bagSuggestions, filterByBag, groupChecklist, type BagFilter } from "@/lib/checklist";
import { safe } from "@/lib/safe-action";
import {
  CHECKLIST_BAGS,
  CHECKLIST_CATEGORIES,
  type ChecklistBag,
  type ChecklistCategory,
  type ChecklistItem,
  type Member,
} from "@/lib/types";
import { BAG_ICON, BagBadge, ChecklistSheet } from "./ChecklistSheet";

type PackChange = { id: string; memberId: string; packed: boolean };

/** 각자 자기 짐을 챙기므로 체크는 사람마다 따로. 큰 체크박스는 "내가 챙김", 아래 이름 버튼은 멤버별 챙김 */
export function ChecklistView({
  items,
  members,
  meId,
}: {
  items: ChecklistItem[];
  members: Member[];
  meId: string | null;
}) {
  const [optimistic, setPacked] = useOptimistic(items, (state, c: PackChange) =>
    state.map((i) =>
      i.id !== c.id
        ? i
        : {
            ...i,
            packedBy: c.packed ? [...new Set([...i.packedBy, c.memberId])] : i.packedBy.filter((m) => m !== c.memberId),
          },
    ),
  );
  const mine = (it: ChecklistItem) => !!meId && it.packedBy.includes(meId);
  const everyone = (it: ChecklistItem) => members.length > 0 && members.every((m) => it.packedBy.includes(m.id));
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
  const done = inBag.filter(mine).length;
  const allDone = inBag.filter(everyone).length;
  const visible = hideChecked ? inBag.filter((i) => !mine(i)) : inBag;
  const groups = useMemo(() => groupChecklist(visible, CHECKLIST_CATEGORIES), [visible]);

  const toggle = (item: ChecklistItem, memberId: string) => {
    const packed = !item.packedBy.includes(memberId);
    setError(null);
    startToggle(async () => {
      setPacked({ id: item.id, memberId, packed });
      const res = await safe(() => setChecklistPacked(item.id, memberId, packed));
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

  const autoBagCount = bagSuggestions(optimistic).length;
  const autoBags = () => {
    setError(null);
    startAdd(async () => {
      const res = await safe(() => autoAssignBags());
      if (!res.ok) setError(res.error);
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
      {autoBagCount > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground">짐(기내/위탁)이 안 정해진 준비물이 있어요.</span>
          <button
            type="button"
            onClick={autoBags}
            disabled={adding}
            className="shrink-0 rounded-lg bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-50"
          >
            {adding ? "정하는 중…" : `자동으로 정하기 (${autoBagCount})`}
          </button>
        </div>
      )}

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
              {bagFilter !== "전체" && `${bagFilter} `}내가 <b>{done}</b> / {inBag.length} 챙김
              {members.length > 1 && <span className="text-xs text-muted-foreground"> · 모두 챙김 {allDone}</span>}
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
          <p>아직 준비물이 없어요. 모두가 같은 목록을 쓰고, 챙겼는지는 각자 체크해요.</p>
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
                <li key={it.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={mine(it)}
                        disabled={!meId}
                        onChange={() => meId && toggle(it, meId)}
                        className="h-5 w-5 shrink-0 accent-primary"
                      />
                      <span className={`truncate ${mine(it) ? "text-muted-foreground line-through" : ""}`}>
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
                  </div>
                  {members.length > 1 && (
                    <div className="flex flex-wrap gap-1 pl-8" aria-label={`${it.title} 챙긴 사람`}>
                      {members.map((m) => {
                        const packed = it.packedBy.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            aria-pressed={packed}
                            aria-label={`${it.title} ${m.name} 챙김`}
                            onClick={() => toggle(it, m.id)}
                            className={`rounded-full border px-2 py-0.5 text-xs ${packed ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"} ${m.id === meId ? "font-semibold" : ""}`}
                          >
                            {packed ? "✓ " : ""}
                            {m.name}
                          </button>
                        );
                      })}
                      {everyone(it) && <span className="self-center text-xs text-muted-foreground">모두 챙김 🎉</span>}
                    </div>
                  )}
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
