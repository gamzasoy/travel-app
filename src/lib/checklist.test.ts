import { describe, expect, it } from "vitest";
import { bagSuggestions, DEFAULT_CHECKLIST, filterByBag, groupChecklist, nextChecklistOrder, suggestBag } from "./checklist";
import { CHECKLIST_BAGS, CHECKLIST_CATEGORIES } from "./types";

describe("checklist", () => {
  it("nextChecklistOrder", () => {
    expect(nextChecklistOrder([])).toBe(0);
    expect(nextChecklistOrder([{ order: 2 }, { order: 7 }])).toBe(8);
  });

  it("groupChecklist 는 분류 순서를 따르고 분류 없음은 맨 뒤", () => {
    const groups = groupChecklist(
      [
        { category: null, order: 0 },
        { category: "약", order: 1 },
        { category: "서류", order: 3 },
        { category: "서류", order: 2 },
      ],
      CHECKLIST_CATEGORIES,
    );
    expect(groups.map((g) => g.category)).toEqual(["서류", "약", "분류 없음"]);
    expect(groups[0].items.map((i) => i.order)).toEqual([2, 3]);
  });

  it("기본 목록의 분류는 모두 유효", () => {
    for (const d of DEFAULT_CHECKLIST) expect(CHECKLIST_CATEGORIES).toContain(d.category);
  });

  it("기본 목록의 짐: 유효한 값이고 보조배터리는 기내", () => {
    for (const d of DEFAULT_CHECKLIST) if (d.bag) expect(CHECKLIST_BAGS).toContain(d.bag);
    expect(DEFAULT_CHECKLIST.find((d) => d.title.includes("보조배터리"))?.bag).toBe("기내");
  });

  it("filterByBag: 전체는 그대로, 기내/위탁은 해당 짐만 (미정 제외)", () => {
    const items = [{ bag: "기내" as const }, { bag: "위탁" as const }, { bag: null }];
    expect(filterByBag(items, "전체")).toHaveLength(3);
    expect(filterByBag(items, "기내")).toEqual([{ bag: "기내" }]);
    expect(filterByBag(items, "위탁")).toEqual([{ bag: "위탁" }]);
  });

  it("suggestBag: 기본 목록은 그대로, 예전 이름·직접 넣은 것은 키워드로, 모르면 null", () => {
    for (const d of DEFAULT_CHECKLIST) expect(suggestBag(d.title)).toBe(d.bag);
    expect(suggestBag("보조배터리 (기내 반입)")).toBe("기내");
    expect(suggestBag("귀마개")).toBe("기내");
    expect(suggestBag("접이식우산")).toBe("위탁");
    expect(suggestBag("ESIM")).toBe("기내");
    expect(suggestBag("물티슈")).toBeNull();
  });

  it("bagSuggestions: 이미 짐이 있는 항목과 모르는 항목은 건드리지 않는다", () => {
    expect(
      bagSuggestions([
        { id: "a", title: "여권", bag: null },
        { id: "b", title: "잠옷", bag: "기내" },
        { id: "c", title: "물티슈", bag: null },
      ]),
    ).toEqual([{ id: "a", bag: "기내" }]);
  });
});
