"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import type { PlaceInput } from "@/actions/places";

type Picked = Pick<PlaceInput, "name" | "address" | "lat" | "lng" | "googlePlaceId">;

/** Google Places(New) 자동완성. 반드시 <APIProvider> 안에서만 렌더링한다. */
export function PlaceSearch({
  onPick,
  placeholder = "🔍 장소 검색 (예: 센소지, 이치란 라멘)",
  label = "장소 검색",
}: {
  onPick: (p: Picked) => void;
  placeholder?: string;
  label?: string;
}) {
  const places = useMapsLibrary("places");
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);

  useEffect(() => {
    if (!places || input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        token.current ??= new places.AutocompleteSessionToken();
        const res = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: token.current,
          language: "ko",
        });
        if (!cancelled) {
          setSuggestions(res.suggestions.filter((s) => s.placePrediction));
          setError(null);
        }
      } catch {
        if (!cancelled) setError("검색에 실패했어요. API 키와 Places API(New) 설정을 확인해주세요.");
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, places]);

  const pick = async (s: google.maps.places.AutocompleteSuggestion) => {
    const prediction = s.placePrediction;
    if (!prediction) return;
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location", "id"] });
      onPick({
        name: place.displayName ?? prediction.text.text,
        address: place.formattedAddress ?? "",
        lat: place.location?.lat() ?? null,
        lng: place.location?.lng() ?? null,
        googlePlaceId: place.id ?? "",
      });
      token.current = undefined; // 선택하면 세션 종료 (요금 계산 단위)
      setInput("");
      setSuggestions([]);
    } catch {
      setError("장소 정보를 가져오지 못했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        aria-label={label}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-border px-4 py-3 outline-none focus:border-primary"
      />
      {suggestions.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {suggestions.map((s, i) => (
            <li key={s.placePrediction?.placeId ?? i}>
              <button type="button" onClick={() => pick(s)} className="w-full px-3 py-2 text-left text-sm active:bg-muted">
                {s.placePrediction?.text.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
