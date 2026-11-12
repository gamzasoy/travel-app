import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTrip, listMembers } from "@/lib/notion/repo";
import { BottomTabs } from "@/components/BottomTabs";
import { LeaveButton } from "@/components/LeaveButton";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/** middleware 가 1차로 막지만, 서버 컴포넌트에서도 세션을 다시 확인한다 */
export default async function TripLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.tripId !== tripId) redirect(`/t/${tripId}/join`);

  const [trip, members] = await Promise.all([getTrip(tripId), listMembers(tripId)]);
  if (!trip) notFound();
  const me = members.find((m) => m.id === session.memberId);

  // 화면 전체(문서)는 스크롤하지 않고 가운데 내용만 스크롤한다.
  // iOS Safari 는 주소창이 줄어들고 늘어날 때 position: fixed 하단 탭바를 화면 중간에 잘못 그리는 일이 있어서,
  // 탭바를 fixed 대신 일반 흐름의 맨 아래에 둔다.
  return (
    <div className="flex h-dvh flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h1 className="truncate font-bold">{trip.name}</h1>
        <LeaveButton tripId={tripId} label={`${me?.name ?? "나"} · 바꾸기`} />
      </header>
      {/* relative: 추가(+) 버튼(absolute)이 스크롤과 상관없이 내용 영역 오른쪽 아래에 머문다 */}
      <div className="relative min-h-0 flex-1">
        <main className="h-full overflow-y-auto overscroll-contain p-4 pb-24">
          {children}
        </main>
      </div>
      <BottomTabs tripId={tripId} />
    </div>
  );
}
