"use client";

import { AdvancedMarker, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo } from "react";
import {
  DEFAULT_CENTER,
  boundsOf,
  categoryColor,
  hasCoords,
  type PlaceWithCoords,
  type RouteStop,
} from "@/lib/map";
import type { Place } from "@/lib/types";

interface Props {
  places: Place[];
  route: RouteStop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** 지도 + 마커 + 선택한 날짜의 경로. 반드시 <APIProvider> 안에서 렌더링한다. */
export function GoogleMap({ places, route, selectedId, onSelect }: Props) {
  const withCoords = useMemo(() => places.filter(hasCoords), [places]);
  // 경로에서 장소가 처음 나오는 순번 (마커에 숫자로 표시)
  const firstStop = useMemo(() => {
    const m = new globalThis.Map<string, number>();
    for (const s of route) if (!m.has(s.place.id)) m.set(s.place.id, s.n);
    return m;
  }, [route]);

  return (
    <Map
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={11}
      gestureHandling="greedy"
      disableDefaultUI
      zoomControl
      className="h-72 w-full overflow-hidden rounded-2xl"
    >
      <FitToPlaces places={withCoords} />
      <PanToSelected places={withCoords} selectedId={selectedId} />
      <RouteLine route={route} />
      {withCoords.map((p) => {
        const n = firstStop.get(p.id);
        const selected = p.id === selectedId;
        return (
          <AdvancedMarker
            key={p.id}
            position={{ lat: p.lat, lng: p.lng }}
            title={p.name}
            zIndex={selected ? 10 : n ? 5 : 1}
            onClick={() => onSelect(p.id)}
          >
            <Pin
              background={categoryColor(p.category)}
              borderColor={selected ? "#0f172a" : "#ffffff"}
              glyphColor="#ffffff"
              glyph={n ? String(n) : undefined}
              scale={selected ? 1.3 : 1}
            />
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}

/** 장소 목록이 바뀔 때만 전체가 보이도록 맞춘다 (사용자가 움직인 뒤 매번 되돌리지 않음) */
function FitToPlaces({ places }: { places: PlaceWithCoords[] }) {
  const map = useMap();
  const key = places.map((p) => p.id).sort().join(",");
  useEffect(() => {
    if (!map) return;
    const b = boundsOf(places);
    if (!b) return;
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat, lng: places[0].lng });
      map.setZoom(15);
    } else {
      map.fitBounds({ north: b.north, south: b.south, east: b.east, west: b.west }, 48);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key 가 places 의 변화를 대표한다
  }, [map, key]);
  return null;
}

function PanToSelected({ places, selectedId }: { places: PlaceWithCoords[]; selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    const p = places.find((x) => x.id === selectedId);
    if (map && p) map.panTo({ lat: p.lat, lng: p.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택이 바뀔 때만 이동
  }, [map, selectedId]);
  return null;
}

function RouteLine({ route }: { route: RouteStop[] }) {
  const map = useMap();
  const path = useMemo(() => route.map((s) => ({ lat: s.place.lat, lng: s.place.lng })), [route]);
  useEffect(() => {
    if (!map || path.length < 2) return;
    const line = new google.maps.Polyline({ path, strokeColor: "#0ea5e9", strokeOpacity: 0.9, strokeWeight: 4, map });
    return () => line.setMap(null);
  }, [map, path]);
  return null;
}
