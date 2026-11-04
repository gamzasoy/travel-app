import { describe, expect, it } from "vitest";
import { convert, formatMoney, jpyToKrw, krwToJpy } from "./currency";
import { minimizeTransfers, settle, splitAmount } from "./settle";
import type { Expense, Member } from "./types";

const members: Member[] = ["a", "b", "c"].map((id) => ({ id, tripId: "t", name: id.toUpperCase(), color: null }));

let seq = 0;
const exp = (o: Partial<Expense>): Expense => ({
  id: `e${++seq}`,
  tripId: "t",
  title: "x",
  amount: 0,
  currency: "KRW",
  rate: null,
  payerId: "a",
  participantIds: ["a", "b", "c"],
  category: null,
  date: null,
  placeId: null,
  ...o,
});

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe("currency", () => {
  it("엔↔원 환산은 반올림한다", () => {
    expect(jpyToKrw(1200, 905)).toBe(10860);
    expect(jpyToKrw(333, 905)).toBe(3014); // 3013.65
    expect(krwToJpy(10860, 905)).toBe(1200);
  });

  it("convert: 같은 통화는 그대로, 스냅샷이 없으면 fallback, 둘 다 없으면 null", () => {
    expect(convert(500, "JPY", "JPY", null, null)).toBe(500);
    expect(convert(1000, "JPY", "KRW", 900, 800)).toBe(9000);
    expect(convert(1000, "JPY", "KRW", null, 800)).toBe(8000);
    expect(convert(1000, "JPY", "KRW", null, null)).toBeNull();
    expect(convert(9000, "KRW", "JPY", null, 900)).toBe(1000);
  });

  it("비정상 환율은 무시한다", () => {
    expect(convert(1000, "JPY", "KRW", 0, 900)).toBe(9000);
    expect(convert(1000, "JPY", "KRW", NaN, null)).toBeNull();
  });

  it("formatMoney", () => {
    expect(formatMoney(1200, "JPY")).toBe("¥1,200");
    expect(formatMoney(-11000, "KRW")).toBe("-₩11,000");
  });
});

describe("splitAmount", () => {
  it("합계가 항상 원금과 같다", () => {
    for (const [total, n] of [[10000, 3], [1, 3], [7, 4], [100, 7], [0, 2]] as const) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      expect(sum([...splitAmount(total, ids, "p0").values()])).toBe(total);
    }
  });

  it("나머지는 참여자인 결제자가 부담한다", () => {
    const s = splitAmount(10000, ["a", "b", "c"], "b");
    expect(s.get("a")).toBe(3333);
    expect(s.get("b")).toBe(3334);
    expect(s.get("c")).toBe(3333);
  });

  it("결제자가 참여자가 아니면 앞사람부터 1씩 나눠 부담한다", () => {
    const s = splitAmount(10, ["a", "b", "c"], "z"); // 3,3,3 + 1
    expect([...s.values()]).toEqual([4, 3, 3]);
    const s2 = splitAmount(11, ["a", "b", "c"], "z"); // 3,3,3 + 2
    expect([...s2.values()]).toEqual([4, 4, 3]);
  });
});

describe("settle", () => {
  it("균등 분할: 한 명이 전부 냈을 때", () => {
    const r = settle([exp({ amount: 30000, payerId: "a" })], members, "KRW", null);
    expect(r.total).toBe(30000);
    expect(r.balances.map((b) => b.balance)).toEqual([20000, -10000, -10000]);
    expect(r.transfers).toEqual([
      { from: "b", to: "a", amount: 10000 },
      { from: "c", to: "a", amount: 10000 },
    ]);
  });

  it("일부만 참여한 지출", () => {
    const r = settle([exp({ amount: 20000, payerId: "a", participantIds: ["a", "b"] })], members, "KRW", null);
    expect(r.balances.map((b) => b.balance)).toEqual([10000, -10000, 0]);
    expect(r.transfers).toEqual([{ from: "b", to: "a", amount: 10000 }]);
  });

  it("서로 주고받은 지출은 상계되어 송금이 줄어든다", () => {
    const r = settle(
      [exp({ amount: 30000, payerId: "a" }), exp({ amount: 30000, payerId: "b" }), exp({ amount: 30000, payerId: "c" })],
      members,
      "KRW",
      null,
    );
    expect(r.transfers).toEqual([]);
    expect(r.balances.every((b) => b.balance === 0)).toBe(true);
  });

  it("엔화·원화 혼합: 엔화 지출은 지출 당시 환율 스냅샷으로 환산", () => {
    const r = settle(
      [
        exp({ amount: 3000, currency: "JPY", rate: 900, payerId: "a" }), // 27,000원
        exp({ amount: 3000, currency: "JPY", rate: 1000, payerId: "b" }), // 30,000원
        exp({ amount: 9000, currency: "KRW", payerId: "c" }),
      ],
      members,
      "KRW",
      850, // 현재 환율은 스냅샷 있는 지출에 영향 없음
    );
    expect(r.total).toBe(66000);
    expect(r.balances.map((b) => b.paid)).toEqual([27000, 30000, 9000]);
    expect(r.balances.map((b) => b.owed)).toEqual([22000, 22000, 22000]);
  });

  it("정산 통화를 엔화로 바꾸면 원화 지출은 현재 환율로 환산", () => {
    const r = settle(
      [exp({ amount: 3000, currency: "JPY", rate: 900, payerId: "a" }), exp({ amount: 9000, currency: "KRW", payerId: "b" })],
      members,
      "JPY",
      900,
    );
    expect(r.currency).toBe("JPY");
    expect(r.total).toBe(4000); // 3000엔 + 9000원(=1000엔)
    expect(r.balances.map((b) => b.paid)).toEqual([3000, 1000, 0]);
  });

  it("환율이 없어 환산할 수 없는 지출과 결제자 불명 지출은 skipped", () => {
    const noRate = exp({ amount: 1000, currency: "JPY", rate: null });
    const noPayer = exp({ amount: 1000, payerId: null });
    const ghostPayer = exp({ amount: 1000, payerId: "deleted" });
    const ok = exp({ amount: 3000, payerId: "a" });
    const r = settle([noRate, noPayer, ghostPayer, ok], members, "KRW", null);
    expect(r.skipped).toEqual([noRate.id, noPayer.id, ghostPayer.id]);
    expect(r.total).toBe(3000);
  });

  it("참여자가 비었거나 삭제된 멤버뿐이면 전원이 나눈다", () => {
    const r = settle([exp({ amount: 3000, payerId: "a", participantIds: ["gone"] })], members, "KRW", null);
    expect(r.balances.map((b) => b.owed)).toEqual([1000, 1000, 1000]);
  });

  it("0원 지출·지출 없음", () => {
    expect(settle([], members, "KRW", null).transfers).toEqual([]);
    expect(settle([exp({ amount: 0 })], members, "KRW", null).total).toBe(0);
  });

  it("잔액 합은 항상 0이고 송금을 따라가면 모두 0이 된다 (무작위)", () => {
    let s = 12345;
    const rnd = (n: number) => ((s = (s * 1103515245 + 12345) % 2147483648), s % n);
    for (let t = 0; t < 200; t++) {
      const ms: Member[] = Array.from({ length: 2 + rnd(5) }, (_, i) => ({ id: `m${i}`, tripId: "t", name: `${i}`, color: null }));
      const es = Array.from({ length: 1 + rnd(8) }, () => {
        const cur = rnd(2) ? "JPY" : "KRW";
        return exp({
          amount: rnd(50000),
          currency: cur,
          rate: cur === "JPY" ? 850 + rnd(100) : null,
          payerId: ms[rnd(ms.length)].id,
          participantIds: ms.filter(() => rnd(2)).map((m) => m.id),
        });
      });
      const r = settle(es, ms, rnd(2) ? "KRW" : "JPY", 900);
      expect(sum(r.balances.map((b) => b.balance))).toBe(0);
      const left = new Map(r.balances.map((b) => [b.memberId, b.balance]));
      for (const tr of r.transfers) {
        expect(tr.amount).toBeGreaterThan(0);
        left.set(tr.from, left.get(tr.from)! + tr.amount);
        left.set(tr.to, left.get(tr.to)! - tr.amount);
      }
      expect([...left.values()].every((v) => v === 0)).toBe(true);
      expect(r.transfers.length).toBeLessThanOrEqual(Math.max(0, ms.length - 1));
    }
  });
});

describe("minimizeTransfers", () => {
  it("큰 금액끼리 먼저 짝짓는다", () => {
    const t = minimizeTransfers([
      { memberId: "a", paid: 0, owed: 0, balance: 30 },
      { memberId: "b", paid: 0, owed: 0, balance: 10 },
      { memberId: "c", paid: 0, owed: 0, balance: -25 },
      { memberId: "d", paid: 0, owed: 0, balance: -15 },
    ]);
    expect(t).toEqual([
      { from: "c", to: "a", amount: 25 },
      { from: "d", to: "a", amount: 5 },
      { from: "d", to: "b", amount: 10 },
    ]);
  });
});
