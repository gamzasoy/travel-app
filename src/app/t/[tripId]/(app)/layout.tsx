import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { leaveTrip } from "@/actions/session";
import { getTrip, listMembers } from "@/lib/notion/repo";
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
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h1 className="truncate font-bold">{trip.name}</h1>
        <form action={leaveTrip.bind(null, tripId)}>
          <button type="submit" className="text-sm text-slate-500 underline">
            {me?.name ?? "나"} · 바꾸기
          </button>
        </form>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
