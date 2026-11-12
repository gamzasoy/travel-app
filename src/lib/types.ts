export type Currency = "JPY" | "KRW";

export const EXPENSE_CATEGORIES = ["식비", "교통", "숙소", "쇼핑", "관광", "기타"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PLACE_CATEGORIES = ["숙소", "맛집", "관광", "쇼핑", "교통"] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const CHECKLIST_CATEGORIES = ["서류", "돈·카드", "전자기기", "의류", "세면·화장", "약", "기타"] as const;
export type ChecklistCategory = (typeof CHECKLIST_CATEGORIES)[number];

/** 준비물을 어느 짐에 넣는지: 기내(들고 타는 가방) / 위탁(부치는 캐리어) */
export const CHECKLIST_BAGS = ["기내", "위탁"] as const;
export type ChecklistBag = (typeof CHECKLIST_BAGS)[number];

export const RESERVATION_KINDS = ["항공", "렌트카", "숙소", "기차", "투어", "기타"] as const;
export type ReservationKind = (typeof RESERVATION_KINDS)[number];

export interface Trip {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  pin: string;
  localCurrency: Currency;
  settleCurrency: Currency;
  /** 수동 환율: 100엔당 원. 없으면 공개 환율을 사용 */
  manualRate: number | null;
}

export interface Member {
  id: string;
  tripId: string;
  name: string;
  color: string | null;
}

export interface Place {
  id: string;
  tripId: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string;
  category: PlaceCategory | null;
  visited: boolean;
}

export interface ScheduleItem {
  id: string;
  tripId: string;
  title: string;
  /** ISO 날짜 또는 날짜+시간 */
  start: string | null;
  placeId: string | null;
  note: string;
  order: number;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  /** 정수 금액 (엔/원 모두 소수점 없음) */
  amount: number;
  currency: Currency;
  /** 저장 시점 환율 스냅샷 (100엔당 원). KRW 지출은 null */
  rate: number | null;
  payerId: string | null;
  participantIds: string[];
  category: ExpenseCategory | null;
  date: string | null;
  placeId: string | null;
}

/** 여행 준비물 (모두가 함께 쓰는 공용 체크리스트) */
export interface ChecklistItem {
  id: string;
  tripId: string;
  title: string;
  category: ChecklistCategory | null;
  /** 기내 반입 / 위탁 수하물. 정하지 않았으면 null */
  bag: ChecklistBag | null;
  /** 챙긴 사람 (멤버 ID). 각자 자기 짐을 챙기므로 사람마다 따로 체크한다 */
  packedBy: string[];
  /** 모두 챙겼는지 (노션 화면용. 앱은 packedBy 로 판단) */
  checked: boolean;
  order: number;
}

/** 항공권·렌트카·숙소 등 예약 내역 */
export interface Reservation {
  id: string;
  tripId: string;
  title: string;
  kind: ReservationKind | null;
  /** ISO 날짜 또는 날짜+시간 (출발/픽업/체크인) */
  start: string | null;
  /** ISO 날짜 또는 날짜+시간 (도착/반납/체크아웃) */
  end: string | null;
  /** 예약번호 */
  confirmation: string;
  note: string;
  /** 예약 확인 페이지 링크 */
  url: string;
}

export type NewExpense = Omit<Expense, "id">;
export type NewPlace = Omit<Place, "id">;
export type NewScheduleItem = Omit<ScheduleItem, "id">;
export type NewChecklistItem = Omit<ChecklistItem, "id" | "packedBy" | "checked">;
export type NewReservation = Omit<Reservation, "id">;
