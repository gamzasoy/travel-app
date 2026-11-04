"use client";

import { useState, useTransition } from "react";
import { addPlace } from "@/actions/places";
import { PLACE_CATEGORIES, type PlaceCategory } from "@/lib/types";
import { PlaceSearch } from "./PlaceSearch";
import { safe } from "@/lib/safe-action";

/** searchEnabled: 구글 키가 있어 <APIProvider> 안에서 렌더링될 때만 true */
export function PlaceSheet({ searchEnabled, onClose }: { searchEnabled: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await safe(() => addPlace({
        name,
        address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        googlePlaceId: coords?.googlePlaceId ?? "",
        category,
      }));
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
          <h2 className="text-lg font-bold">장소 추가</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            닫기
          </button>
        </div>

        {searchEnabled && (
          <PlaceSearch
            onPick={(p) => {
              setName(p.name);
              setAddress(p.address);
              setCoords(p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng, googlePlaceId: p.googlePlaceId } : null);
            }}
          />
        )}

        <input
          aria-label="장소 이름"
          autoFocus={!searchEnabled}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="장소 이름"
          maxLength={100}
          className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />
        <input
          aria-label="주소"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="주소 (선택)"
          maxLength={300}
          className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-sky-500"
        />
        {coords && <p className="-mt-2 text-xs text-emerald-700">📍 지도 좌표가 확인됐어요.</p>}
        {!searchEnabled && (
          <p className="-mt-2 text-xs text-slate-500">
            지도 키가 없어 좌표 없이 저장돼요. 길찾기는 이름·주소로 검색해요.
          </p>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="카테고리">
          {PLACE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={`rounded-full border px-3 py-1 text-sm ${category === c ? "border-sky-500 bg-sky-50 text-sky-700" : "border-slate-300 text-slate-600"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-xl bg-sky-500 py-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </form>
    </div>
  );
}
