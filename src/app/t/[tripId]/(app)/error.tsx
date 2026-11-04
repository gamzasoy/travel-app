"use client";

export default function TripError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-3xl">😵</p>
      <h2 className="text-lg font-bold">불러오지 못했어요</h2>
      <p className="text-sm text-slate-500">
        잠시 후 다시 시도해주세요. 계속되면 노션 연결(토큰·DB 공유 설정)을 확인해주세요.
      </p>
      <button type="button" onClick={reset} className="rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white">
        다시 시도
      </button>
    </div>
  );
}
