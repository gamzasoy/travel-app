import { hasDs } from "@/lib/notion/client";
import { cookies } from "next/headers";
import { listChecklist, listMembers, listReservations } from "@/lib/notion/repo";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { nowIn } from "@/lib/reservation";
import { TRIP_TIME_ZONE } from "@/lib/schedule";
import { PrepView, type PrepTab } from "./PrepView";

export default async function PrepPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { tripId } = await params;
  const { view } = await searchParams;
  const initial: PrepTab = view === "reservations" ? "reservations" : "checklist";

  // 예전 버전으로 노션을 만든 경우 준비물/예약 DB 가 없을 수 있다
  const missing = (["checklist", "reservations"] as const).filter((k) => !hasDs(k));
  if (missing.length > 0) return <SetupNotice />;

  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const [checklist, reservations, members] = await Promise.all([
    listChecklist(tripId),
    listReservations(tripId),
    listMembers(tripId),
  ]);
  // 서버에서 정한 현재 시각을 내려줘서 hydration 불일치를 피한다
  return (
    <PrepView
      initial={initial}
      checklist={checklist}
      members={members}
      meId={session?.memberId ?? null}
      reservations={reservations}
      now={nowIn(TRIP_TIME_ZONE)}
    />
  );
}

function SetupNotice() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
      <p className="font-semibold text-foreground">준비물·예약 기능을 쓰려면 노션 DB 2개가 더 필요해요.</p>
      <p>
        <code className="rounded bg-muted px-1">npm run setup:notion -- &lt;상위 페이지 URL&gt; --add-prep</code> 을 실행하고,
        출력된 <code className="rounded bg-muted px-1">NOTION_DS_CHECKLIST</code>,{" "}
        <code className="rounded bg-muted px-1">NOTION_DS_RESERVATIONS</code> 를 환경변수에 넣은 뒤 다시 배포해 주세요.
      </p>
    </div>
  );
}
