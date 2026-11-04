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
  "ds-members": MEMBERS.map((m) => ({
    object: "page",
    id: m.id,
    properties: { [P.title]: { title: text(m.name) }, [P.trip]: rel(TRIP_ID), [P.color]: { select: null } },
  })),
  "ds-expenses": [],
  "ds-places": [],
  "ds-schedule": [],
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
      if (req.method === "POST" && path === "/v1/pages") {
        const ds = body.parent?.data_source_id as string;
        if (!store[ds]) return notFound(res);
        const page: Page = { object: "page", id: `page-${ds}-${String(++seq).padStart(6, "0")}`, properties: toResponseProps(body.properties) };
        store[ds].push(page);
        return send(res, 200, page);
      }
      if (req.method === "PATCH" && (m = path.match(/^\/v1\/pages\/([^/]+)$/))) {
        for (const rows of Object.values(store)) {
          const i = rows.findIndex((r) => r.id === m![1]);
          if (i < 0) continue;
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
