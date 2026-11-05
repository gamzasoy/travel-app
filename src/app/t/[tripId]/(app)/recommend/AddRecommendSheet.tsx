"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addPlace } from "@/actions/places";
import type { RankedRecommendation, RecommendKind } from "@/lib/recommend";
import { safe } from "@/lib/safe-action";
import { DayPicker, toggleIn } from "../map/DayPicker";

interface Props {
  tripId: string;
  rec: RankedRecommendation;
  kind: RecommendKind;
  days: string[];
  onClose: () => void;
  onAdded: (googlePlaceId: string) => void;
}

/** 추천 장소를 지도 탭의 장소 목록에 추가 (방문 날짜는 골라도 되고 안 골라도 됨) */
export function AddRecommendSheet({ tripId, rec, kind, days, onClose, onAdded }: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await safe(() =>
        addPlace(
          { name: rec.name, address: rec.address, lat: rec.lat, lng: rec.lng, googlePlaceId: rec.googlePlaceId, category: kind },
          days.filter((d) => picked.has(d)),
        ),
      );
      if (res.ok) {
        onAdded(rec.googlePlaceId);
        setDone(true);
      } else setError(res.error);
    });
  };

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-label="추천 장소 추가"
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex max-h-[92dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{done ? "추가했어요 🎉" : "장소에 추가"}</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            닫기
          </button>
        </div>

        <div>
          <p className="font-medium">{rec.name}</p>
          <p className="text-sm">
            <span className="text-amber-500">★</span> {rec.rating.toFixed(1)}{" "}
            <span className="text-xs text-muted-foreground">
              (리뷰 {rec.reviews.toLocaleString("ko-KR")}) · {kind}
            </span>
          </p>
          {rec.address && <p className="text-xs text-muted-foreground">{rec.address}</p>}
        </div>

        {done ? (
          <>
            <p className="text-sm text-muted-foreground">지도 탭의 장소 목록에 추가됐어요.</p>
            <Link href={`/t/${tripId}/map`} className="rounded-xl border border-border py-3 text-center font-semibold active:bg-muted">
              지도에서 보기
            </Link>
            <button type="button" onClick={onClose} className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground">
              계속 둘러보기
            </button>
          </>
        ) : (
          <>
            {days.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted-foreground">방문 날짜 (선택)</p>
                <DayPicker days={days} picked={picked} onToggle={(d) => setPicked((prev) => toggleIn(prev, d))} />
                <p className="mt-1 text-xs text-muted-foreground">고른 날의 일정에 이 장소가 자동으로 추가돼요. 안 골라도 돼요.</p>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {pending ? "추가 중…" : "장소에 추가"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
