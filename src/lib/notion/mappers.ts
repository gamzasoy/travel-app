import { P } from "./schema";
import type {
  Currency,
  Expense,
  ExpenseCategory,
  Member,
  NewExpense,
  NewPlace,
  NewScheduleItem,
  Place,
  PlaceCategory,
  ScheduleItem,
  Trip,
} from "@/lib/types";
import { EXPENSE_CATEGORIES, PLACE_CATEGORIES } from "@/lib/types";

/** 매퍼가 필요로 하는 최소한의 Notion 페이지 모양 */
export interface NotionPageLike {
  id: string;
  properties: Record<string, unknown>;
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const plain = (items: unknown): string =>
  arr(items)
    .map((t) => String(rec(t).plain_text ?? ""))
    .join("");

// ---------- 읽기 ----------
const getTitle = (p: NotionPageLike, name: string) => plain(rec(p.properties[name]).title);
const getText = (p: NotionPageLike, name: string) => plain(rec(p.properties[name]).rich_text);
const getNumber = (p: NotionPageLike, name: string): number | null => {
  const n = rec(p.properties[name]).number;
  return typeof n === "number" ? n : null;
};
const getSelect = (p: NotionPageLike, name: string): string | null => {
  const s = rec(rec(p.properties[name]).select).name;
  return typeof s === "string" ? s : null;
};
const getDate = (p: NotionPageLike, name: string) => {
  const d = rec(rec(p.properties[name]).date);
  return {
    start: typeof d.start === "string" ? d.start : null,
    end: typeof d.end === "string" ? d.end : null,
  };
};
const getCheckbox = (p: NotionPageLike, name: string) => rec(p.properties[name]).checkbox === true;
const getRelationIds = (p: NotionPageLike, name: string): string[] =>
  arr(rec(p.properties[name]).relation).map((r) => String(rec(r).id));

const asCurrency = (v: string | null, fallback: Currency): Currency =>
  v === "JPY" || v === "KRW" ? v : fallback;
const asOneOf = <T extends string>(v: string | null, list: readonly T[]): T | null =>
  v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;

export function pageToTrip(page: NotionPageLike): Trip {
  const range = getDate(page, P.startEnd);
  return {
    id: page.id,
    name: getTitle(page, P.title),
    startDate: range.start,
    endDate: range.end,
    pin: getText(page, P.pin),
    localCurrency: asCurrency(getSelect(page, P.localCurrency), "JPY"),
    settleCurrency: asCurrency(getSelect(page, P.settleCurrency), "KRW"),
    manualRate: getNumber(page, P.manualRate),
  };
}

export function pageToMember(page: NotionPageLike): Member {
  return {
    id: page.id,
    tripId: getRelationIds(page, P.trip)[0] ?? "",
    name: getTitle(page, P.title),
    color: getSelect(page, P.color),
  };
}

export function pageToPlace(page: NotionPageLike): Place {
  return {
    id: page.id,
    tripId: getRelationIds(page, P.trip)[0] ?? "",
    name: getTitle(page, P.title),
    address: getText(page, P.address),
    lat: getNumber(page, P.lat),
    lng: getNumber(page, P.lng),
    googlePlaceId: getText(page, P.googlePlaceId),
    category: asOneOf<PlaceCategory>(getSelect(page, P.placeCategory), PLACE_CATEGORIES),
    visited: getCheckbox(page, P.visited),
  };
}

export function pageToScheduleItem(page: NotionPageLike): ScheduleItem {
  return {
    id: page.id,
    tripId: getRelationIds(page, P.trip)[0] ?? "",
    title: getTitle(page, P.title),
    start: getDate(page, P.when).start,
    placeId: getRelationIds(page, P.place)[0] ?? null,
    note: getText(page, P.note),
    order: getNumber(page, P.order) ?? 0,
  };
}

export function pageToExpense(page: NotionPageLike): Expense {
  return {
    id: page.id,
    tripId: getRelationIds(page, P.trip)[0] ?? "",
    title: getTitle(page, P.title),
    amount: getNumber(page, P.amount) ?? 0,
    currency: asCurrency(getSelect(page, P.currency), "JPY"),
    rate: getNumber(page, P.rate),
    payerId: getRelationIds(page, P.payer)[0] ?? null,
    participantIds: getRelationIds(page, P.participants),
    category: asOneOf<ExpenseCategory>(getSelect(page, P.expenseCategory), EXPENSE_CATEGORIES),
    date: getDate(page, P.date).start,
    placeId: getRelationIds(page, P.place)[0] ?? null,
  };
}

// ---------- 쓰기 (pages.create / pages.update 의 properties) ----------
const title = (content: string) => ({ title: [{ text: { content } }] });
const text = (content: string) => ({ rich_text: content ? [{ text: { content } }] : [] });
const relation = (ids: string[]) => ({ relation: ids.map((id) => ({ id })) });
const select = (name: string | null) => ({ select: name ? { name } : null });
const date = (start: string | null) => ({ date: start ? { start } : null });

export function expenseToProperties(e: NewExpense) {
  return {
    [P.title]: title(e.title),
    [P.trip]: relation([e.tripId]),
    [P.amount]: { number: e.amount },
    [P.currency]: select(e.currency),
    [P.rate]: { number: e.rate },
    [P.payer]: relation(e.payerId ? [e.payerId] : []),
    [P.participants]: relation(e.participantIds),
    [P.expenseCategory]: select(e.category),
    [P.date]: date(e.date),
    [P.place]: relation(e.placeId ? [e.placeId] : []),
  };
}

export function placeToProperties(p: NewPlace) {
  return {
    [P.title]: title(p.name),
    [P.trip]: relation([p.tripId]),
    [P.address]: text(p.address),
    [P.lat]: { number: p.lat },
    [P.lng]: { number: p.lng },
    [P.googlePlaceId]: text(p.googlePlaceId),
    [P.placeCategory]: select(p.category),
    [P.visited]: { checkbox: p.visited },
  };
}

export function scheduleItemToProperties(s: NewScheduleItem) {
  return {
    [P.title]: title(s.title),
    [P.trip]: relation([s.tripId]),
    [P.when]: date(s.start),
    [P.place]: relation(s.placeId ? [s.placeId] : []),
    [P.note]: text(s.note),
    [P.order]: { number: s.order },
  };
}

export function memberToProperties(m: { tripId: string; name: string; color: string | null }) {
  return {
    [P.title]: title(m.name),
    [P.trip]: relation([m.tripId]),
    [P.color]: select(m.color),
  };
}

export function tripSettingsToProperties(s: { manualRate: number | null }) {
  return { [P.manualRate]: { number: s.manualRate } };
}
