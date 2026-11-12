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

/** 이름에 이 말이 들어가면 그 짐으로 추천 (앞에 있는 규칙이 먼저) */
const BAG_KEYWORDS: [ChecklistBag, string[]][] = [
  // 리튬 배터리는 위탁 불가, 귀중품·서류·비행 중 쓸 것은 기내
  ["기내", ["배터리", "여권", "항공권", "예약 확인", "현금", "카드", "지갑", "충전기", "esim", "와이파이", "유심", "복용약", "귀마개", "안대", "목베개", "이어폰", "노트북", "카메라"]],
  // 100ml 넘는 액체류·부피 큰 것은 위탁
  ["위탁", ["옷", "신발", "세면", "화장품", "선크림", "샴푸", "로션", "어댑터", "돼지코", "상비약", "우산", "속옷", "양말"]],
];

/**
 * 준비물 이름으로 짐(기내/위탁)을 추천한다. 모르면 null.
 * 짐 기능이 생기기 전에 넣어 둔 항목을 한 번에 채울 때 쓴다.
 */
export function suggestBag(title: string): ChecklistBag | null {
  const t = title.trim();
  const preset = DEFAULT_CHECKLIST.find((d) => d.title === t);
  if (preset) return preset.bag;
  const lower = t.toLowerCase();
  for (const [bag, words] of BAG_KEYWORDS) if (words.some((w) => lower.includes(w))) return bag;
  return null;
}

/** 짐이 비어 있고 추천할 수 있는 항목들 */
export const bagSuggestions = <T extends Pick<ChecklistItem, "id" | "title" | "bag">>(items: T[]) =>
  items.flatMap((i) => {
    const bag = i.bag ? null : suggestBag(i.title);
    return bag ? [{ id: i.id, bag }] : [];
  });
