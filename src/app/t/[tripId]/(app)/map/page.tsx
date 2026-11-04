import { notFound } from "next/navigation";
import { getTrip, listPlaces, listSchedule } from "@/lib/notion/repo";
import { TRIP_TIME_ZONE, pickDefaultDay, todayIn, tripDays } from "@/lib/schedule";
import { MapView } from "./MapView";

export default async function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { tripId } = await params;
  const { p } = await searchParams;
  const [trip, items, places] = await Promise.all([getTrip(tripId), listSchedule(tripId), listPlaces(tripId)]);
  if (!trip) notFound();

  const days = tripDays(trip.startDate, trip.endDate, items);
  return (
    <MapView
      days={days}
      defaultDay={pickDefaultDay(days, todayIn(TRIP_TIME_ZONE))}
      items={items}
      places={places}
      initialPlaceId={p && places.some((x) => x.id === p) ? p : null}
    />
  );
}
