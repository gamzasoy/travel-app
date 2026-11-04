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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h1 className="truncate font-bold">{trip.name}</h1>
        <LeaveButton tripId={tripId} label={`${me?.name ?? "나"} · 바꾸기`} />
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      <BottomTabs tripId={tripId} />
    </div>
  );
}
