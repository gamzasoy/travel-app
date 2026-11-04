import { notFound } from "next/navigation";
import { getTrip } from "@/lib/notion/repo";
import { JoinForm } from "./JoinForm";

export default async function JoinPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  return <JoinForm tripId={tripId} tripName={trip.name} />;
}
