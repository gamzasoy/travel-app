"use client";

import { leaveTrip } from "@/actions/session";

/** 이름 바꾸기/나가기. 공용 기기에 오프라인용 페이지가 남지 않도록 서비스워커 캐시도 비운다. */
export function LeaveButton({ tripId, label }: { tripId: string; label: string }) {
  return (
    <form
      action={leaveTrip.bind(null, tripId)}
      onSubmit={() => navigator.serviceWorker?.controller?.postMessage("clear-pages")}
    >
      <button type="submit" className="text-sm text-muted-foreground underline">
        {label}
      </button>
    </form>
  );
}
