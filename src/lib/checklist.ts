import type { ChecklistBag, ChecklistCategory, ChecklistItem } from "./types";

/** 목록이 비었을 때 한 번에 넣을 수 있는 기본 준비물 (일본 여행 기준) */
export const DEFAULT_CHECKLIST: { title: string; category: ChecklistCategory; bag: ChecklistBag | null }[] = [
  { title: "여권", category: "서류", bag: "기내" },
  { title: "항공권 / 예약 확인서", category: "서류", bag: "기내" },
  { title: "Visit Japan Web 등록", category: "서류", bag: null },
  { title: "여행자 보험", category: "서류", bag: null },
  { title: "엔화 현금", category: "돈·카드", bag: "기내" },
  { title: "해외결제 카드 / 트래블카드", category: "돈·카드", bag: "기내" },
  { title: "교통카드 (Suica · ICOCA)", category: "돈·카드", bag: "기내" },
  { title: "eSIM / 포켓 와이파이", category: "전자기기", bag: "기내" },
  { title: "휴대폰 충전기", category: "전자기기", bag: "기내" },
  // 리튬 배터리는 위탁 수하물로 부칠 수 없다
  { title: "보조배터리", category: "전자기기", bag: "기내" },
  { title: "돼지코 (110V 어댑터)", category: "전자기기", bag: "위탁" },
  { title: "갈아입을 옷", category: "의류", bag: "위탁" },
  { title: "잠옷", category: "의류", bag: "위탁" },
  { title: "편한 신발", category: "의류", bag: "위탁" },
  // 100ml 넘는 액체류는 기내 반입 불가
  { title: "세면도구", category: "세면·화장", bag: "위탁" },
  { title: "화장품 / 선크림", category: "세면·화장", bag: "위탁" },
  { title: "상비약 (소화제·진통제·밴드)", category: "약", bag: "위탁" },
  { title: "개인 복용약", category: "약", bag: "기내" },
];

/** 다음 순서값: 전체 최대 order + 1 */
export const nextChecklistOrder = (items: Pick<ChecklistItem, "order">[]): number =>
  Math.max(-1, ...items.map((i) => i.order)) + 1;

/** 분류 순서대로 묶는다. 분류 없는 항목은 "기타" 뒤 "분류 없음" 으로 */
export function groupChecklist<T extends Pick<ChecklistItem, "category" | "order">>(
  items: T[],
  categories: readonly string[],
): { category: string; items: T[] }[] {
  const order = [...categories, "분류 없음"];
  const map = new Map<string, T[]>();
  for (const it of [...items].sort((a, b) => a.order - b.order)) {
    const key = it.category ?? "분류 없음";
    map.set(key, [...(map.get(key) ?? []), it]);
  }
  return order.filter((c) => map.has(c)).map((category) => ({ category, items: map.get(category)! }));
}

export type BagFilter = ChecklistBag | "전체";

/** 짐 필터: "전체" 면 그대로, 아니면 그 짐에 넣을 항목만 */
export const filterByBag = <T extends Pick<ChecklistItem, "bag">>(items: T[], bag: BagFilter): T[] =>
  bag === "전체" ? items : items.filter((i) => i.bag === bag);
