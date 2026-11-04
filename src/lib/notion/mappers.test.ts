import { describe, expect, it } from "vitest";
import {
  expenseToProperties,
  pageToExpense,
  pageToMember,
  pageToPlace,
  pageToScheduleItem,
  pageToTrip,
  placeToProperties,
  scheduleItemToProperties,
} from "./mappers";
import { P } from "./schema";

type Props = Record<string, Record<string, unknown>>;
const rt = (s: string) => [{ plain_text: s }];
const rel = (...ids: string[]) => ({ relation: ids.map((id) => ({ id })) });

describe("pageToTrip", () => {
  it("노션 페이지를 Trip 으로 변환한다", () => {
    const trip = pageToTrip({
      id: "t1",
      properties: {
        [P.title]: { title: rt("도쿄 여행") },
        [P.startEnd]: { date: { start: "2026-12-01", end: "2026-12-05" } },
        [P.pin]: { rich_text: rt("1234") },
        [P.localCurrency]: { select: { name: "JPY" } },
        [P.settleCurrency]: { select: { name: "KRW" } },
        [P.manualRate]: { number: 912.5 },
      },
    });
    expect(trip).toEqual({
      id: "t1",
      name: "도쿄 여행",
      startDate: "2026-12-01",
      endDate: "2026-12-05",
      pin: "1234",
      localCurrency: "JPY",
      settleCurrency: "KRW",
      manualRate: 912.5,
    });
  });

  it("비어 있는 속성은 기본값을 쓴다", () => {
    const trip = pageToTrip({ id: "t2", properties: {} });
    expect(trip).toMatchObject({
      name: "",
      startDate: null,
      pin: "",
      localCurrency: "JPY",
      settleCurrency: "KRW",
      manualRate: null,
    });
  });
});

describe("pageToMember / pageToPlace / pageToScheduleItem", () => {
  it("멤버", () => {
    const m = pageToMember({
      id: "m1",
      properties: {
        [P.title]: { title: rt("민수") },
        [P.trip]: rel("t1"),
        [P.color]: { select: { name: "blue" } },
      },
    });
    expect(m).toEqual({ id: "m1", tripId: "t1", name: "민수", color: "blue" });
  });

  it("장소 — 알 수 없는 카테고리는 null", () => {
    const p = pageToPlace({
      id: "p1",
      properties: {
        [P.title]: { title: rt("이치란 라멘") },
        [P.trip]: rel("t1"),
        [P.address]: { rich_text: rt("Shibuya") },
        [P.lat]: { number: 35.66 },
        [P.lng]: { number: 139.7 },
        [P.googlePlaceId]: { rich_text: rt("abc") },
        [P.placeCategory]: { select: { name: "우주" } },
        [P.visited]: { checkbox: true },
      },
    });
    expect(p).toMatchObject({ name: "이치란 라멘", lat: 35.66, category: null, visited: true });
  });

  it("일정 — 장소 연결과 순서", () => {
    const s = pageToScheduleItem({
      id: "s1",
      properties: {
        [P.title]: { title: rt("점심") },
        [P.trip]: rel("t1"),
        [P.when]: { date: { start: "2026-12-01T12:00:00+09:00" } },
        [P.place]: rel("p1"),
        [P.note]: { rich_text: [] },
        [P.order]: { number: 2 },
      },
    });
    expect(s).toEqual({
      id: "s1",
      tripId: "t1",
      title: "점심",
      start: "2026-12-01T12:00:00+09:00",
      placeId: "p1",
      note: "",
      order: 2,
    });
  });
});

describe("지출 변환", () => {
  const expense = {
    tripId: "t1",
    title: "라멘",
    amount: 1200,
    currency: "JPY" as const,
    rate: 905,
    payerId: "m1",
    participantIds: ["m1", "m2", "m3"],
    category: "식비" as const,
    date: "2026-12-01",
    placeId: null,
  };

  it("pageToExpense: 다중 관계와 환율 스냅샷", () => {
    const e = pageToExpense({
      id: "e1",
      properties: {
        [P.title]: { title: rt("라멘") },
        [P.trip]: rel("t1"),
        [P.amount]: { number: 1200 },
        [P.currency]: { select: { name: "JPY" } },
        [P.rate]: { number: 905 },
        [P.payer]: rel("m1"),
        [P.participants]: rel("m1", "m2", "m3"),
        [P.expenseCategory]: { select: { name: "식비" } },
        [P.date]: { date: { start: "2026-12-01" } },
        [P.place]: rel(),
      },
    });
    expect(e).toEqual({ id: "e1", ...expense });
  });

  it("expenseToProperties → pageToExpense 왕복", () => {
    const props = expenseToProperties(expense) as Props;
    expect(props[P.amount]).toEqual({ number: 1200 });
    expect(props[P.currency]).toEqual({ select: { name: "JPY" } });
    expect(props[P.participants].relation).toHaveLength(3);
    expect(props[P.place]).toEqual({ relation: [] });
  });

  it("KRW 지출은 환율이 null 로 저장된다", () => {
    const props = expenseToProperties({ ...expense, currency: "KRW", rate: null }) as Props;
    expect(props[P.rate]).toEqual({ number: null });
  });
});

describe("쓰기 변환", () => {
  it("장소: 빈 문자열은 빈 rich_text, 좌표 없으면 null", () => {
    const props = placeToProperties({
      tripId: "t1",
      name: "호텔",
      address: "",
      lat: null,
      lng: null,
      googlePlaceId: "",
      category: "숙소",
      visited: false,
    }) as Props;
    expect(props[P.address]).toEqual({ rich_text: [] });
    expect(props[P.lat]).toEqual({ number: null });
    expect(props[P.placeCategory]).toEqual({ select: { name: "숙소" } });
  });

  it("일정: 시간이 있으면 시간대를 함께, 날짜만이면 시간대 없이 저장", () => {
    const base = { tripId: "t1", title: "x", placeId: null, note: "", order: 0 };
    const withTime = scheduleItemToProperties({ ...base, start: "2026-12-01T18:00:00" }) as Props;
    expect(withTime[P.when]).toEqual({ date: { start: "2026-12-01T18:00:00", time_zone: "Asia/Tokyo" } });
    const dateOnly = scheduleItemToProperties({ ...base, start: "2026-12-01" }) as Props;
    expect(dateOnly[P.when]).toEqual({ date: { start: "2026-12-01" } });
  });

  it("일정: 날짜 없으면 date null", () => {
    const props = scheduleItemToProperties({
      tripId: "t1",
      title: "미정",
      start: null,
      placeId: null,
      note: "",
      order: 0,
    }) as Props;
    expect(props[P.when]).toEqual({ date: null });
  });
});
