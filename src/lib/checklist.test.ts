import { describe, expect, it } from "vitest";
import { DEFAULT_CHECKLIST, groupChecklist, nextChecklistOrder } from "./checklist";
import { CHECKLIST_CATEGORIES } from "./types";

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
});
