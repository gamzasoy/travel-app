"use client";

import { useState } from "react";

export function CopyButton({ text, label = "복사" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          alert(text); // 클립보드 권한이 없으면 직접 복사할 수 있게 보여준다
        }
      }}
      className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700 active:bg-slate-50"
    >
      {done ? "복사됨 ✓" : label}
    </button>
  );
}
