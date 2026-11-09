import { convert } from "./currency";
import type { Currency, Expense, Member } from "./types";

export interface Balance {
  memberId: string;
  /** 낸 돈 */
  paid: number;
  /** 부담할 몫 */
  owed: number;
  /** paid - owed. 양수면 받을 돈, 음수면 보낼 돈 */
  balance: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export interface SettleResult {
  currency: Currency;
  /** 정산 대상 지출 합계 */
  total: number;
  balances: Balance[];
  transfers: Transfer[];
  /**
   * 송금 횟수를 줄이지 않은 직접 정산: 각 지출의 참여자가 결제자에게 자기 몫을 보낸다고 보고,
   * 두 사람 사이에서 서로 주고받을 돈만 상계한 결과
   */
  directTransfers: Transfer[];
  /** 결제자 불명·환율 없음 등으로 계산에서 빠진 지출 id */
  skipped: string[];
}

/**
 * 한 지출을 참여자별 부담액으로 나눈다. 합계는 항상 total 과 같다.
 * 나누어떨어지지 않는 나머지는 결제자(참여자일 때)가 더 부담하고,
 * 결제자가 참여자가 아니면 참여자 순서대로 1씩 나눠 부담한다.
 */
export function splitAmount(total: number, participantIds: string[], payerId: string): Map<string, number> {
  const n = participantIds.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  const shares = new Map(participantIds.map((id) => [id, base]));
  if (remainder > 0) {
    if (shares.has(payerId)) {
      shares.set(payerId, base + remainder);
    } else {
      participantIds.slice(0, remainder).forEach((id) => shares.set(id, base + 1));
    }
  }
  return shares;
}

/** 채권자/채무자를 큰 금액끼리 짝지어 송금 횟수를 줄인다 */
export function minimizeTransfers(balances: Balance[]): Transfer[] {
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ id: b.memberId, left: b.balance }));
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ id: b.memberId, left: -b.balance }));
  // 큰 금액 우선, 동률이면 입력(멤버) 순서 유지 — Array.sort 는 안정 정렬
  creditors.sort((a, b) => b.left - a.left);
  debtors.sort((a, b) => b.left - a.left);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.min(creditors[i].left, debtors[j].left);
    if (amount > 0) transfers.push({ from: debtors[j].id, to: creditors[i].id, amount });
    creditors[i].left -= amount;
    debtors[j].left -= amount;
    if (creditors[i].left === 0) i++;
    if (debtors[j].left === 0) j++;
  }
  return transfers;
}

/** 두 사람 사이의 채무만 상계한다. 결과는 멤버 순서(from, to)로 정렬 */
export function netPairwise(debts: Map<string, Map<string, number>>, memberIds: string[]): Transfer[] {
  const order = new Map(memberIds.map((id, i) => [id, i]));
  const get = (from: string, to: string) => debts.get(from)?.get(to) ?? 0;
  const transfers: Transfer[] = [];
  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const a = memberIds[i];
      const b = memberIds[j];
      const net = get(a, b) - get(b, a);
      if (net > 0) transfers.push({ from: a, to: b, amount: net });
      else if (net < 0) transfers.push({ from: b, to: a, amount: -net });
    }
  }
  return transfers.sort(
    (x, y) => order.get(x.from)! - order.get(y.from)! || order.get(x.to)! - order.get(y.to)!,
  );
}

/**
 * @param currency 정산 통화
 * @param fallbackRate 스냅샷이 없는 지출/원→엔 환산에 쓰는 현재 환율(100엔당 원)
 */
export function settle(
  expenses: Expense[],
  members: Member[],
  currency: Currency,
  fallbackRate: number | null,
): SettleResult {
  const memberIds = members.map((m) => m.id);
  const known = new Set(memberIds);
  const paid = new Map(memberIds.map((id) => [id, 0]));
  const owed = new Map(memberIds.map((id) => [id, 0]));
  const debts = new Map<string, Map<string, number>>();
  const skipped: string[] = [];
  let total = 0;

  for (const e of expenses) {
    const amount = convert(e.amount, e.currency, currency, e.rate, fallbackRate);
    if (amount === null || !e.payerId || !known.has(e.payerId)) {
      skipped.push(e.id);
      continue;
    }
    // 삭제된 멤버는 제외, 참여자가 비면 전원
    let participants = e.participantIds.filter((id) => known.has(id));
    if (participants.length === 0) participants = memberIds;

    total += amount;
    paid.set(e.payerId, (paid.get(e.payerId) ?? 0) + amount);
    for (const [id, share] of splitAmount(amount, participants, e.payerId)) {
      owed.set(id, (owed.get(id) ?? 0) + share);
      if (id !== e.payerId && share > 0) {
        const row = debts.get(id) ?? new Map<string, number>();
        row.set(e.payerId, (row.get(e.payerId) ?? 0) + share);
        debts.set(id, row);
      }
    }
  }

  const balances: Balance[] = memberIds.map((id) => ({
    memberId: id,
    paid: paid.get(id) ?? 0,
    owed: owed.get(id) ?? 0,
    balance: (paid.get(id) ?? 0) - (owed.get(id) ?? 0),
  }));

  return {
    currency,
    total,
    balances,
    transfers: minimizeTransfers(balances),
    directTransfers: netPairwise(debts, memberIds),
    skipped,
  };
}
