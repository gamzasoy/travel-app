import "server-only";
import { APIErrorCode, APIResponseError } from "@notionhq/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { dsId, notion } from "./client";
import {
  expenseToProperties,
  memberToProperties,
  pageToExpense,
  pageToMember,
  pageToPlace,
  pageToScheduleItem,
  pageToTrip,
  placeToProperties,
  scheduleItemToProperties,
  tripSettingsToProperties,
  type NotionPageLike,
} from "./mappers";
import { P, type DsKey } from "./schema";
import type {
  Expense,
  Member,
  NewExpense,
  NewPlace,
  NewScheduleItem,
  Place,
  ScheduleItem,
  Trip,
} from "@/lib/types";

// ---------- 캐시 태그 ----------
export type Collection = "members" | "schedule" | "places" | "expenses";
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

export const listMembers = cachedList<Member>("members", "members", pageToMember);
export const listPlaces = cachedList<Place>("places", "places", pageToPlace);
export const listExpenses = cachedList<Expense>("expenses", "expenses", pageToExpense);

export async function listSchedule(tripId: string): Promise<ScheduleItem[]> {
  const items = await cachedList<ScheduleItem>("schedule", "schedule", pageToScheduleItem)(tripId);
  return [...items].sort(
    (a, b) => (a.start ?? "").localeCompare(b.start ?? "") || a.order - b.order,
  );
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

export async function createMember(m: { tripId: string; name: string; color: string | null }) {
  const id = await create("members", memberToProperties(m));
  revalidateTag(tag("members", m.tripId));
  return id;
}

export async function setManualRate(tripId: string, manualRate: number | null) {
  await update(tripId, tripSettingsToProperties({ manualRate }));
  revalidateTag(tripTag(tripId));
}
