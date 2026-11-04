import { cookies } from "next/headers";
import { getTrip, listExpenses, listMembers } from "@/lib/notion/repo";
import { getRate } from "@/lib/rate";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { ExpensesView } from "./ExpensesView";

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  const [trip, members, expenses] = await Promise.all([getTrip(tripId), listMembers(tripId), listExpenses(tripId)]);
  const { rate, source } = trip ? await getRate(trip) : { rate: null, source: "none" as const };

  return (
    <ExpensesView
      meId={session?.memberId ?? null}
      members={members}
      expenses={expenses}
      rate={rate}
      rateSource={source}
      tripId={tripId}
    />
  );
}
