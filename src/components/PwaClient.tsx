"use client";

import { useEffect, useState } from "react";

/** 서비스워커 등록(운영 빌드에서만) + 오프라인 배너 */
export function PwaClient() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-30 mx-auto max-w-md bg-amber-500 px-4 py-2 text-center text-sm font-medium text-primary-foreground"
    >
      오프라인이에요 · 마지막으로 본 내용만 보여요. 저장은 연결된 뒤에 할 수 있어요.
    </div>
  );
}
