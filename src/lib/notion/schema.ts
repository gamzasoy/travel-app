import { EXPENSE_CATEGORIES, PLACE_CATEGORIES } from "../types";

/** Notion 속성 이름. 노션 화면에 그대로 보이므로 한글 사용. */
export const P = {
  title: "이름",
  trip: "여행",
  // Trips
  startEnd: "기간",
  pin: "PIN",
  localCurrency: "현지통화",
  settleCurrency: "정산통화",
  manualRate: "환율(100엔당 원)",
  // Members
  color: "색상",
  // Places
  address: "주소",
  lat: "위도",
  lng: "경도",
  googlePlaceId: "Google Place ID",
  placeCategory: "카테고리",
  visited: "방문여부",
  // Schedule
  when: "일시",
  place: "장소",
  note: "메모",
  order: "순서",
  // Expenses
  amount: "금액",
  currency: "통화",
  rate: "적용환율",
  krwTotal: "원화환산",
  payer: "결제자",
  participants: "참여자",
  expenseCategory: "분류",
  date: "날짜",
} as const;

export const CURRENCY_OPTIONS = ["JPY", "KRW"] as const;
export const EXPENSE_CATEGORY_OPTIONS = EXPENSE_CATEGORIES;
export const PLACE_CATEGORY_OPTIONS = PLACE_CATEGORIES;

export const DS_KEYS = ["trips", "members", "schedule", "places", "expenses"] as const;
export type DsKey = (typeof DS_KEYS)[number];

/** 데이터 소스 ID를 담는 환경변수 이름 */
export const DS_ENV: Record<DsKey, string> = {
  trips: "NOTION_DS_TRIPS",
  members: "NOTION_DS_MEMBERS",
  schedule: "NOTION_DS_SCHEDULE",
  places: "NOTION_DS_PLACES",
  expenses: "NOTION_DS_EXPENSES",
};
