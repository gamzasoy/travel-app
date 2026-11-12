/**
 * e2e 용 가짜 Notion API. 실제 토큰 없이 PIN 입장 → 지출 추가 → 정산 흐름을 검증한다.
 * 실행: npx tsx e2e/mock-notion.ts  (기본 포트 4010)
 */
import http from "node:http";
import { P } from "../src/lib/notion/schema";

import { TRIP_ID } from "./ids";
const MEMBERS = [
  { id: "member-minsu-00000001", name: "민수" },
  { id: "member-jieun-00000002", name: "지은" },
  { id: "member-hyunwoo-0000003", name: "현우" },
];

type Page = { object: "page"; id: string; properties: Record<string, unknown> };
const text = (s: string) => [{ plain_text: s }];
const rel = (...ids: string[]) => ({ relation: ids.map((id) => ({ id })) });

const store: Record<string, Page[]> = {
  get "ds-trips"(): Page[] {
    return [
      trip,
      {
        object: "page" as const,
        id: "trip-bbbbbbbbbbbbbbbb",
        properties: {
          [P.title]: { title: text("오사카 여행") },
          [P.startEnd]: { date: { start: "2027-03-10", end: "2027-03-13" } },
          [P.pin]: { rich_text: text("5678") },
        },
      },
    ];
  },
  "ds-members": MEMBERS.map((m) => ({
    object: "page",
    id: m.id,
    properties: { [P.title]: { title: text(m.name) }, [P.trip]: rel(TRIP_ID), [P.color]: { select: null } },
  })),
  "ds-expenses": [],
  "ds-places": [
    {
      object: "page",
      id: "place-sensoji-000000001",
      properties: {
        [P.title]: { title: text("센소지") },
        [P.trip]: rel(TRIP_ID),
        [P.address]: { rich_text: text("Asakusa") },
        [P.lat]: { number: 35.7148 },
        [P.lng]: { number: 139.7967 },
        [P.googlePlaceId]: { rich_text: text("ChIJ8T1GpMGOGGARDYGSgpooDWw") },
        [P.placeCategory]: { select: { name: "관광" } },
        [P.visited]: { checkbox: false },
      },
    },
  ],
  "ds-schedule": [],
  "ds-checklist": [],
  "ds-reservations": [],
};

/** 데이터 소스 스키마 (속성 목록). 준비물 DB 는 "짐" 없이 시작 */
const dsProps: Record<string, Record<string, unknown>> = {
  "ds-checklist": { [P.title]: {}, [P.trip]: {}, [P.checked]: {}, [P.expenseCategory]: {}, [P.order]: {} },
};

/** 가짜 Open-Meteo 예보: 여행 기간(12/1~12/5) 동안 맑음 → 비 … */
const FORECAST = {
  daily: {
    time: ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05"],
    weather_code: [0, 63, 3, 2, 0],
    temperature_2m_max: [13.4, 9.6, 11, 12, 14],
    temperature_2m_min: [4.2, 5, 3, 2, 4],
    precipitation_probability_max: [10, 90, 30, 20, 0],
  },
};

const trip: Page = {
  object: "page",
  id: TRIP_ID,
  properties: {
    [P.title]: { title: text("도쿄 여행") },
    [P.startEnd]: { date: { start: "2026-12-01", end: "2026-12-05" } },
    [P.pin]: { rich_text: text("1234") },
    [P.localCurrency]: { select: { name: "JPY" } },
    [P.settleCurrency]: { select: { name: "KRW" } },
    [P.manualRate]: { number: 900 },
  },
};

type TextReq = { text: { content: string } };
type PropReq = { title?: TextReq[]; rich_text?: TextReq[] } & Record<string, unknown>;
type RelProp = { relation?: { id: string }[] };

/** 요청 형식(properties 쓰기) → 응답 형식(읽기) */
function toResponseProps(req: Record<string, PropReq>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(req)) {
    if (v && v.title) out[k] = { title: v.title.map((t) => ({ plain_text: t.text.content })) };
    else if (v && v.rich_text) out[k] = { rich_text: v.rich_text.map((t) => ({ plain_text: t.text.content })) };
    else out[k] = v;
  }
  return out;
}

/** 실제 노션처럼, 스키마에 없는 속성을 쓰면 validation_error */
const unknownProp = (ds: string, props: Record<string, unknown> | undefined) =>
  dsProps[ds] ? Object.keys(props ?? {}).find((k) => !(k in dsProps[ds])) : undefined;
const invalid = (res: http.ServerResponse, prop: string) =>
  send(res, 400, { object: "error", status: 400, code: "validation_error", message: `${prop} is not a property that exists.` });

let seq = 0;
const send = (res: http.ServerResponse, code: number, body: unknown) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const notFound = (res: http.ServerResponse) =>
  send(res, 404, { object: "error", status: 404, code: "object_not_found", message: "not found" });

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : {};
      const path = (req.url ?? "").split("?")[0];
      let m: RegExpMatchArray | null;

      if (req.method === "GET" && path === "/v1/forecast") return send(res, 200, FORECAST);
      if (req.method === "GET" && (m = path.match(/^\/v1\/pages\/([^/]+)$/))) {
        return m[1] === TRIP_ID ? send(res, 200, trip) : notFound(res);
      }
      if (req.method === "POST" && (m = path.match(/^\/v1\/data_sources\/([^/]+)\/query$/))) {
        const rows = store[m[1]];
        if (!rows) return notFound(res);
        const want = body.filter?.relation?.contains as string | undefined;
        const results = rows.filter((r) => !want || (r.properties[P.trip] as RelProp)?.relation?.some((x) => x.id === want));
        return send(res, 200, { object: "list", results, has_more: false, next_cursor: null });
      }
      // 예전 준비물 DB 처럼 "짐" 속성이 없는 상태에서 시작 → 앱이 처음 쓸 때 추가한다
      if (req.method === "GET" && (m = path.match(/^\/v1\/data_sources\/([^/]+)$/))) {
        if (!store[m[1]]) return notFound(res);
        return send(res, 200, { object: "data_source", id: m[1], properties: dsProps[m[1]] ?? {} });
      }
      if (req.method === "PATCH" && (m = path.match(/^\/v1\/data_sources\/([^/]+)$/))) {
        if (!store[m[1]]) return notFound(res);
        dsProps[m[1]] = { ...dsProps[m[1]], ...body.properties };
        return send(res, 200, { object: "data_source", id: m[1], properties: dsProps[m[1]] });
      }
      if (req.method === "POST" && path === "/v1/pages") {
        const ds = body.parent?.data_source_id as string;
        if (!store[ds]) return notFound(res);
        if (unknownProp(ds, body.properties)) return invalid(res, unknownProp(ds, body.properties)!);
        const page: Page = { object: "page", id: `page-${ds}-${String(++seq).padStart(6, "0")}`, properties: toResponseProps(body.properties) };
        store[ds].push(page);
        return send(res, 200, page);
      }
      if (req.method === "PATCH" && (m = path.match(/^\/v1\/pages\/([^/]+)$/))) {
        for (const [ds, rows] of Object.entries(store)) {
          const i = rows.findIndex((r) => r.id === m![1]);
          if (i < 0) continue;
          const bad = unknownProp(ds, body.properties);
          if (bad) return invalid(res, bad);
          if (body.in_trash) rows.splice(i, 1);
          else rows[i].properties = { ...rows[i].properties, ...toResponseProps(body.properties ?? {}) };
          return send(res, 200, rows[i] ?? { object: "page", id: m[1] });
        }
        if (m[1] === TRIP_ID) {
          trip.properties = { ...trip.properties, ...toResponseProps(body.properties ?? {}) };
          return send(res, 200, trip);
        }
        return notFound(res);
      }
      notFound(res);
    });
  })
  .listen(Number(process.env.MOCK_NOTION_PORT ?? 4010), () => console.log("mock notion on", process.env.MOCK_NOTION_PORT ?? 4010));
