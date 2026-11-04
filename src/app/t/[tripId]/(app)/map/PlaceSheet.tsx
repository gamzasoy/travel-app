"use client";

import { useState, useTransition } from "react";
import { addPlace, editPlace } from "@/actions/places";
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from "@/lib/types";
import { PlaceSearch } from "./PlaceSearch";
import { safe } from "@/lib/safe-action";

/**
 * searchEnabled: 구글 키가 있어 <APIProvider> 안에서 렌더링될 때만 true
 * place: 있으면 수정 모드 (없으면 새 장소 추가)
 */
export function PlaceSheet({ searchEnabled, onClose, place }: { searchEnabled: boolean; onClose: () => void; place?: Place }) {
  const [name, setName] = useState(place?.name ?? "");
  const [address, setAddress] = useState(place?.address ?? "");
  const [category, setCategory] = useState<PlaceCategory | null>(place?.category ?? null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; googlePlaceId: string } | null>(
    place && place.lat !== null && place.lng !== null ? { lat: place.lat, lng: place.lng, googlePlaceId: place.googlePlaceId } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const input = {
        name,
        address,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        googlePlaceId: coords?.googlePlaceId ?? "",
        category,
      };
      const res = await safe(() => (place ? editPlace(place.id, input) : addPlace(input)));
      if (res.ok) onClose();
      else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{place ? "장소 수정" : "장소 추가"}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
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
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />
        <input
          aria-label="주소"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="주소 (선택)"
          maxLength={300}
          className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
        />
        {coords && <p className="-mt-2 text-xs text-emerald-700">📍 지도 좌표가 확인됐어요.</p>}
        {place && coords && searchEnabled && (
          <p className="-mt-2 text-xs text-muted-foreground">이름·주소만 고치면 지도 위치는 그대로예요. 위치를 바꾸려면 위에서 다시 검색하세요.</p>
        )}
        {!searchEnabled && (
          <p className="-mt-2 text-xs text-muted-foreground">
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
              className={`rounded-full border px-3 py-1 text-sm ${category === c ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground"}`}
            >
              {c}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </form>
    </div>
  );
}
