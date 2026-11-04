"use client";

import { useState, useTransition } from "react";
import { saveManualRate } from "@/actions/settings";
import { safe } from "@/lib/safe-action";

export function RateForm({ manualRate, liveRate }: { manualRate: number | null; liveRate: number | null }) {
  const [text, setText] = useState(manualRate ? String(manualRate) : "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (value: number | null) =>
    startTransition(async () => {
      const res = await safe(() => saveManualRate(value));
      setMsg(res.ok ? { ok: true, text: value === null ? "자동 환율을 사용해요." : "저장했어요." } : { ok: false, text: res.error });
      if (res.ok && value === null) setText("");
    });

  const parsed = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(parsed);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-muted p-3 text-sm">
        <p>
          자동 환율:{" "}
          <b>{liveRate ? `100엔 = ${liveRate.toLocaleString("ko-KR")}원` : "불러오지 못했어요"}</b>
        </p>
        <p className="mt-1 text-muted-foreground">
          현재 적용: {manualRate ? `직접 입력 (100엔 = ${manualRate.toLocaleString("ko-KR")}원)` : "자동 환율"}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        직접 입력 (100엔당 원)
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={liveRate ? String(liveRate) : "예: 905"}
          className="rounded-xl border border-border px-4 py-3 text-lg outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-2">
        {manualRate !== null && (
          <button
            type="button"
            disabled={pending}
            onClick={() => save(null)}
            className="rounded-xl border border-border px-4 py-3 text-foreground disabled:opacity-50"
          >
            자동으로
          </button>
        )}
        <button
          type="button"
          disabled={pending || !valid}
          onClick={() => save(parsed)}
          className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
      </div>

      {msg && (
        <p role="status" className={`text-sm ${msg.ok ? "text-emerald-700" : "text-destructive"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
