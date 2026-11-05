import { notFound } from "next/navigation";
import { getTrip, listPlaces, listSchedule } from "@/lib/notion/repo";
import { tripDays } from "@/lib/schedule";
import { RecommendView } from "./RecommendView";

export default async function RecommendPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const [trip, items, places] = await Promise.all([getTrip(tripId), listSchedule(tripId), listPlaces(tripId)]);
  if (!trip) notFound();

  return <RecommendView tripId={tripId} days={tripDays(trip.startDate, trip.endDate, items)} places={places} />;
}
