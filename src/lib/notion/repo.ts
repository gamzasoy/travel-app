import "server-only";
import { APIErrorCode, APIResponseError } from "@notionhq/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { dsId, notion } from "./client";
import {
  checklistItemToProperties,
  checklistPackedToProperties,
  expenseToProperties,
  memberToProperties,
  pageToChecklistItem,
  pageToExpense,
  pageToMember,
  pageToPlace,
  pageToReservation,
  pageToScheduleItem,
  pageToTrip,
  placeToProperties,
  reservationToProperties,
  scheduleItemToProperties,
  tripSettingsToProperties,
  type NotionPageLike,
} from "./mappers";
import { P, type DsKey } from "./schema";
import { compareReservations } from "@/lib/reservation";
import { CHECKLIST_BAGS, type ChecklistBag } from "@/lib/types";
import type {
  ChecklistItem,
  Expense,
  Member,
  NewChecklistItem,
  NewExpense,
  NewPlace,
  NewReservation,
  NewScheduleItem,
  Place,
  Reservation,
  ScheduleItem,
  Trip,
} from "@/lib/types";

// ---------- 캐시 태그 ----------
export type Collection = "members" | "schedule" | "places" | "expenses" | "checklist" | "reservations";
export const tripTag = (tripId: string) => `trip:${tripId}`;
export const tag = (c: Collection, tripId: string) => `${c}:${tripId}`;

const isFullPage = (r: unknown): r is NotionPageLike =>
  !!r && typeof r === "object" && "properties" in r && "id" in r;

/** 한 여행에 속한 행을 전부 가져온다 (페이지네이션 처리) */
async function queryByTrip(key: DsKey, tripId: string): Promise<NotionPageLike[]> {
  const pages: NotionPageLike[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion().dataSources.query({
      data_source_id: dsId(key),
      filter: { property: P.trip, relation: { contains: tripId } },
      start_cursor: cursor,
      page_size: 100,
    });
    for (const r of res.results as unknown[]) if (isFullPage(r)) pages.push(r);
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return pages;
}

function cachedList<T>(
  key: DsKey,
  collection: Collection,
  map: (p: NotionPageLike) => T,
) {
  return (tripId: string) =>
    unstable_cache(
      async () => (await queryByTrip(key, tripId)).map(map),
      [collection, tripId],
      { tags: [tag(collection, tripId)], revalidate: 300 },
    )();
}

// ---------- 조회 ----------
export function getTrip(tripId: string): Promise<Trip | null> {
  return unstable_cache(
    async () => {
      try {
        const page = await notion().pages.retrieve({ page_id: tripId });
        return isFullPage(page) ? pageToTrip(page) : null;
      } catch (e) {
        // 없는 페이지 / 잘못된 ID 만 null. 토큰·환경변수 오류 등은 그대로 던져서 드러낸다.
        if (
          APIResponseError.isAPIResponseError(e) &&
          (e.code === APIErrorCode.ObjectNotFound || e.code === APIErrorCode.ValidationError)
        ) {
          return null;
        }
        throw e;
      }
    },
    ["trip", tripId],
    { tags: [tripTag(tripId)], revalidate: 300 },
  )();
}

/** 전체 여행 목록 (최신 시작일 순). PIN 은 목록에서 쓰지 않으므로 호출부에서 넘기지 말 것. */
export function listTrips(): Promise<Trip[]> {
  return unstable_cache(
    async () => {
      const pages: NotionPageLike[] = [];
      let cursor: string | undefined;
      do {
        const res = await notion().dataSources.query({
          data_source_id: dsId("trips"),
          start_cursor: cursor,
          page_size: 100,
        });
        for (const r of res.results as unknown[]) if (isFullPage(r)) pages.push(r);
        cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
      } while (cursor);
      return pages
        .map(pageToTrip)
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
    },
    ["trips"],
    { tags: ["trips"], revalidate: 300 },
  )();
}

export const listMembers = cachedList<Member>("members", "members", pageToMember);
export const listPlaces = cachedList<Place>("places", "places", pageToPlace);
export const listExpenses = cachedList<Expense>("expenses", "expenses", pageToExpense);

export async function listSchedule(tripId: string): Promise<ScheduleItem[]> {
  const items = await cachedList<ScheduleItem>("schedule", "schedule", pageToScheduleItem)(tripId);
  return [...items].sort(
    (a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.order - b.order,
  );
}

export async function listChecklist(tripId: string): Promise<ChecklistItem[]> {
  const items = await cachedList<ChecklistItem>("checklist", "checklist", pageToChecklistItem)(tripId);
  return [...items].sort((a, b) => a.order - b.order);
}

/** 일시순, 일시가 없는 예약은 맨 뒤 */
export async function listReservations(tripId: string): Promise<Reservation[]> {
  const items = await cachedList<Reservation>("reservations", "reservations", pageToReservation)(tripId);
  return [...items].sort(compareReservations);
}

// ---------- 쓰기 (쓰기 후 해당 컬렉션 캐시 무효화) ----------
async function create(key: DsKey, properties: Record<string, unknown>): Promise<string> {
  const page = await notion().pages.create({
    parent: { type: "data_source_id", data_source_id: dsId(key) },
    properties: properties as never,
  });
  return page.id;
}

const update = (pageId: string, properties: Record<string, unknown>) =>
  notion().pages.update({ page_id: pageId, properties: properties as never });

const trash = (pageId: string) => notion().pages.update({ page_id: pageId, in_trash: true });

export async function createExpense(e: NewExpense) {
  const id = await create("expenses", expenseToProperties(e));
  revalidateTag(tag("expenses", e.tripId));
  return id;
}
export async function updateExpense(id: string, e: NewExpense) {
  await update(id, expenseToProperties(e));
  revalidateTag(tag("expenses", e.tripId));
}
export async function deleteExpense(id: string, tripId: string) {
  await trash(id);
  revalidateTag(tag("expenses", tripId));
}

export async function createPlace(p: NewPlace) {
  const id = await create("places", placeToProperties(p));
  revalidateTag(tag("places", p.tripId));
  return id;
}
export async function updatePlace(id: string, p: NewPlace) {
  await update(id, placeToProperties(p));
  revalidateTag(tag("places", p.tripId));
}
export async function deletePlace(id: string, tripId: string) {
  await trash(id);
  revalidateTag(tag("places", tripId));
}

export async function createScheduleItem(s: NewScheduleItem) {
  const id = await create("schedule", scheduleItemToProperties(s));
  revalidateTag(tag("schedule", s.tripId));
  return id;
}
export async function updateScheduleItem(id: string, s: NewScheduleItem) {
  await update(id, scheduleItemToProperties(s));
  revalidateTag(tag("schedule", s.tripId));
}
export async function deleteScheduleItem(id: string, tripId: string) {
  await trash(id);
  revalidateTag(tag("schedule", tripId));
}

/**
 * "짐"(기내/위탁)·"챙긴 사람" 속성은 나중에 추가됐으므로, 예전에 만든 준비물 DB 에는 없을 수 있다.
 * 쓰기 전에 한 번 확인해서 없는 것만 만든다 (서버 프로세스당 한 번).
 */
let checklistReady: Promise<void> | null = null;
function ensureChecklistProperties(): Promise<void> {
  checklistReady ??= (async () => {
    const ds = (await notion().dataSources.retrieve({ data_source_id: dsId("checklist") })) as {
      properties?: Record<string, unknown>;
    };
    const has = (name: string) => !!ds.properties && name in ds.properties;
    const add: Record<string, unknown> = {};
    if (!has(P.bag)) add[P.bag] = { select: { options: CHECKLIST_BAGS.map((name) => ({ name })) } };
    if (!has(P.packedBy)) add[P.packedBy] = { relation: { data_source_id: dsId("members"), single_property: {} } };
    if (Object.keys(add).length === 0) return;
    await notion().dataSources.update({ data_source_id: dsId("checklist"), properties: add as never });
  })().catch((e) => {
    checklistReady = null; // 실패하면 다음 쓰기에서 다시 시도
    throw e;
  });
  return checklistReady;
}

export async function createChecklistItem(c: NewChecklistItem) {
  await ensureChecklistProperties();
  const id = await create("checklist", checklistItemToProperties(c));
  revalidateTag(tag("checklist", c.tripId));
  return id;
}
/** 여러 개를 한 번에 추가 (기본 준비물). 노션 속도 제한을 고려해 순서대로 만든다. */
export async function createChecklistItems(items: NewChecklistItem[]) {
  await ensureChecklistProperties();
  for (const c of items) await create("checklist", checklistItemToProperties(c));
  if (items[0]) revalidateTag(tag("checklist", items[0].tripId));
}
export async function updateChecklistItem(id: string, c: NewChecklistItem) {
  await ensureChecklistProperties();
  await update(id, checklistItemToProperties(c));
  revalidateTag(tag("checklist", c.tripId));
}
/** 여러 항목의 짐만 바꾼다 (다른 속성은 건드리지 않음). 노션 속도 제한을 고려해 순서대로 */
export async function setChecklistBags(tripId: string, changes: { id: string; bag: ChecklistBag | null }[]) {
  await ensureChecklistProperties();
  for (const c of changes) await update(c.id, { [P.bag]: { select: c.bag ? { name: c.bag } : null } });
  revalidateTag(tag("checklist", tripId));
}

/**
 * 한 사람의 챙김 여부를 바꾼다. 캐시가 아니라 노션에서 방금 읽은 목록을 고쳐 써서,
 * 여러 명이 동시에 눌러도 서로의 체크를 덮어쓰지 않게 한다.
 */
export async function setChecklistPacked(
  id: string,
  tripId: string,
  memberId: string,
  packed: boolean,
  memberIds: string[],
) {
  await ensureChecklistProperties();
  const page = await notion().pages.retrieve({ page_id: id });
  const current = isFullPage(page) ? pageToChecklistItem(page).packedBy : [];
  const next = packed ? [...new Set([...current, memberId])] : current.filter((m) => m !== memberId);
  await update(id, checklistPackedToProperties(next, memberIds));
  revalidateTag(tag("checklist", tripId));
}
export async function deleteChecklistItem(id: string, tripId: string) {
  await trash(id);
  revalidateTag(tag("checklist", tripId));
}

export async function createReservation(r: NewReservation) {
  const id = await create("reservations", reservationToProperties(r));
  revalidateTag(tag("reservations", r.tripId));
  return id;
}
export async function updateReservation(id: string, r: NewReservation) {
  await update(id, reservationToProperties(r));
  revalidateTag(tag("reservations", r.tripId));
}
export async function deleteReservation(id: string, tripId: string) {
  await trash(id);
  revalidateTag(tag("reservations", tripId));
}

export async function createMember(m: { tripId: string; name: string; color: string | null }) {
  const id = await create("members", memberToProperties(m));
  revalidateTag(tag("members", m.tripId));
  return id;
}

export async function setManualRate(tripId: string, manualRate: number | null) {
  await update(tripId, tripSettingsToProperties({ manualRate }));
  revalidateTag(tripTag(tripId));
}
