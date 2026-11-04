"use client";

import { useState, useTransition } from "react";
import { joinTrip, verifyPin, type MemberChoice } from "@/actions/session";
import { safe } from "@/lib/safe-action";

export function JoinForm({ tripId, tripName }: { tripId: string; tripName: string }) {
  const [pin, setPin] = useState("");
  const [members, setMembers] = useState<MemberChoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await safe(() => verifyPin(tripId, pin));
      if (res.ok) setMembers(res.members);
      else setError(res.error);
    });
  };

  const pick = (memberId: string) => {
    setError(null);
    startTransition(async () => {
      // 성공하면 서버에서 redirect 되므로 실패 결과만 돌아온다
      const res = await joinTrip(tripId, pin, memberId);
      if (res && !res.ok) setError(res.error);
    });
  };

  return (
    <div className="flex min-h-dvh flex-col justify-center gap-6 p-6">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">초대받은 여행</p>
        <h1 className="mt-1 text-2xl font-bold">{tripName || "여행"}</h1>
      </header>

      {members === null ? (
        <form onSubmit={submitPin} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="pin">
            PIN
          </label>
          <input
            id="pin"
            name="pin"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="친구에게 받은 PIN"
            className="rounded-xl border border-border px-4 py-3 text-lg tracking-widest outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={pending || !pin.trim()}
            className="rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {pending ? "확인 중…" : "다음"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm font-medium">나는 누구인가요?</p>
          <ul className="flex flex-col gap-2">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => pick(m.id)}
                  className="w-full rounded-xl border border-border py-3 text-lg font-medium active:bg-primary/20 disabled:opacity-50"
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
