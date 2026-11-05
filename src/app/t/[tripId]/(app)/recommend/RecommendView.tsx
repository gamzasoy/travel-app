"use client";

import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CENTER } from "@/lib/map";
import {
  RECOMMEND_KINDS,
  boundsAround,
  centerOf,
  rankRecommendations,
  savedIds,
  withinRadius,
  type RankedRecommendation,
  type RecommendKind,
} from "@/lib/recommend";
import type { Place } from "@/lib/types";
import { PlaceSearch } from "../map/PlaceSearch";
import { AddRecommendSheet } from "./AddRecommendSheet";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
/** 기준 장소를 고르지 않았을 때 저장된 장소 중심에서 찾는 반경 (m) */
const DEFAULT_RADIUS = 5000;
/** 기준 장소를 골랐을 때 고를 수 있는 반경 (m) */
const RADII = [500, 1000, 3000] as const;
const radiusLabel = (m: number) => (m >= 1000 ? `${m / 1000}km` : `${m}m`);

interface Props {
  tripId: string;
  days: string[];
  places: Place[];
}

export function RecommendView(props: Props) {
  if (!API_KEY) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
        <p className="font-semibold">추천을 보려면 구글 지도 키가 필요해요 ⭐</p>
        <p className="mt-1 text-xs">
          <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> 를 설정하고 Places API(New) 를 켜면 구글 평점 순으로 맛집·관광지를 추천해 드려요.
        </p>
      </div>
    );
  }
  return (
    <APIProvider apiKey={API_KEY} language="ko">
      <RecommendContent {...props} />
    </APIProvider>
  );
}

/** 탭을 오갈 때 같은 검색을 반복하지 않도록 (API 비용 절약) */
const cache = new Map<string, RankedRecommendation[]>();

type Status = { state: "loading" } | { state: "error"; message: string } | { state: "done"; list: RankedRecommendation[] };

function RecommendContent({ tripId, days, places }: Props) {
  const lib = useMapsLibrary("places");
  const [kind, setKind] = useState<RecommendKind>("맛집");
  // 검색해서 고른 기준 장소. 있으면 그 근처(radius 안)에서만 추천한다
  const [anchor, setAnchor] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState<number>(1000);
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [adding, setAdding] = useState<RankedRecommendation | null>(null);
  // 서버에서 새 장소 목록이 오기 전에도 방금 추가한 곳은 바로 "추가됨" 으로 보여준다
  const [justAdded, setJustAdded] = useState<Set<string>>(() => new Set());

  // 처음 들어왔을 때의 중심으로 고정 (장소를 추가할 때마다 다시 검색하지 않도록)
  const [center] = useState(() => centerOf(places) ?? DEFAULT_CENTER);
  const [hasSavedCenter] = useState(() => centerOf(places) !== null);
  const saved = useMemo(() => {
    const s = savedIds(places);
    for (const id of justAdded) s.add(id);
    return s;
  }, [places, justAdded]);

  const origin = anchor ?? center;
  const range = anchor ? radius : DEFAULT_RADIUS;

  useEffect(() => {
    if (!lib) return;
    const key = `${kind}|${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}|${range}`;
    const hit = cache.get(key);
    if (hit) {
      setStatus({ state: "done", list: hit });
      return;
    }
    let cancelled = false;
    setStatus({ state: "loading" });
    lib.Place.searchByText({
      textQuery: RECOMMEND_KINDS[kind].query,
      fields: ["id", "displayName", "formattedAddress", "location", "rating", "userRatingCount", "primaryTypeDisplayName", "googleMapsURI"],
      includedType: RECOMMEND_KINDS[kind].includedType,
      language: "ko",
      maxResultCount: 20,
      // 기준 위치 주변 사각 범위 안에서만 찾고, 아래에서 원형 반경으로 한 번 더 거른다
      locationRestriction: boundsAround(origin, range),
    })
      .then(({ places: found }) => {
        const list = rankRecommendations(
          withinRadius(
            found.map((p) => ({
            googlePlaceId: p.id,
            name: p.displayName ?? "",
            address: p.formattedAddress ?? "",
            lat: p.location?.lat() ?? null,
            lng: p.location?.lng() ?? null,
            rating: p.rating ?? null,
            reviews: p.userRatingCount ?? null,
            typeLabel: p.primaryTypeDisplayName ?? "",
            mapsUrl: p.googleMapsURI ?? "",
            })),
            origin,
            range,
          ),
        );
        cache.set(key, list);
        if (!cancelled) setStatus({ state: "done", list });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: "error", message: "검색에 실패했어요. API 키와 Places API(New) 설정을 확인해주세요." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- origin 은 좌표 값으로 비교한다
  }, [lib, kind, origin.lat, origin.lng, range]);

  return (
    <div className="flex flex-col gap-4">
      {anchor ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary bg-primary/10 px-4 py-3">
            <p className="min-w-0 truncate text-sm">
              📍 <span className="font-medium">{anchor.name}</span> 근처
            </p>
            <button type="button" onClick={() => setAnchor(null)} className="shrink-0 text-xs text-muted-foreground">
              다시 검색
            </button>
          </div>
          <div className="flex gap-2" role="group" aria-label="반경">
            {RADII.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={radius === m}
                onClick={() => setRadius(m)}
                className={`rounded-full border px-3 py-1 text-xs ${radius === m ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground"}`}
              >
                {radiusLabel(m)} 이내
              </button>
            ))}
          </div>
        </div>
      ) : (
        <PlaceSearch
          label="기준 장소 검색"
          placeholder="🔍 기준 장소 검색 (예: 센소지, 시부야역)"
          onPick={(p) => {
            if (p.lat !== null && p.lng !== null) setAnchor({ name: p.name, lat: p.lat, lng: p.lng });
          }}
        />
      )}

      <div className="flex gap-2" role="group" aria-label="추천 종류">
        {(Object.keys(RECOMMEND_KINDS) as RecommendKind[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full border px-4 py-1.5 text-sm ${kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
          >
            {RECOMMEND_KINDS[k].icon} {k}
          </button>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
          {anchor ? `${anchor.name} ${radiusLabel(radius)} 이내` : hasSavedCenter ? "저장한 장소 근처" : "도쿄"} {kind} · 구글 평점순
        </h2>
        {status.state === "loading" && <p className="p-6 text-center text-sm text-muted-foreground">찾는 중…</p>}
        {status.state === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {status.message}
          </p>
        )}
        {status.state === "done" &&
          (status.list.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              근처에서 추천할 곳을 찾지 못했어요. 반경을 넓히거나 다른 장소로 검색해보세요.
            </p>
          ) : (
            <ol className="divide-y divide-border rounded-xl border border-border">
              {status.list.map((r, i) => {
                const isSaved = saved.has(r.googlePlaceId);
                return (
                  <li key={r.googlePlaceId} className="flex items-start gap-3 px-3 py-3">
                    <span className="mt-0.5 w-5 shrink-0 text-center text-sm font-semibold text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-sm">
                        <span className="text-amber-500">★</span> {r.rating.toFixed(1)}{" "}
                        <span className="text-xs text-muted-foreground">(리뷰 {r.reviews.toLocaleString("ko-KR")})</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{[r.typeLabel, r.address].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      {isSaved ? (
                        <span className="rounded-lg px-2 py-1 font-medium text-emerald-700">추가됨 ✓</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={`${r.name} 장소에 추가`}
                          onClick={() => setAdding(r)}
                          className="rounded-lg bg-primary px-2 py-1 font-medium text-primary-foreground active:brightness-95"
                        >
                          + 추가
                        </button>
                      )}
                      {r.mapsUrl && (
                        <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-border px-2 py-1 active:bg-muted">
                          구글맵 ↗
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ))}
        <p className="mt-2 text-xs text-muted-foreground">리뷰가 30개 미만인 곳은 평점을 믿기 어려워 뺐어요.</p>
      </section>

      {adding && (
        <AddRecommendSheet
          tripId={tripId}
          rec={adding}
          kind={kind}
          days={days}
          onClose={() => setAdding(null)}
          onAdded={(id) => setJustAdded((prev) => new Set(prev).add(id))}
        />
      )}
    </div>
  );
}
