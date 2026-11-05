import { notFound } from "next/navigation";
import { getTrip, listPlaces, listSchedule } from "@/lib/notion/repo";
import { TRIP_TIME_ZONE, pickDefaultDay, todayIn, tripDays } from "@/lib/schedule";
import { weatherForDays } from "@/lib/weather";
import { ScheduleView } from "./ScheduleView";

export default async function SchedulePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const [trip, items, places] = await Promise.all([getTrip(tripId), listSchedule(tripId), listPlaces(tripId)]);
  if (!trip) notFound();

  const days = tripDays(trip.startDate, trip.endDate, items);
  // 서버에서 정한 값을 내려줘서 서버/클라이언트 날짜 차이로 인한 hydration 불일치를 피한다
  const today = todayIn(TRIP_TIME_ZONE);
  const weather = await weatherForDays(days, items, places);
  return (
    <ScheduleView
      days={days}
      defaultDay={pickDefaultDay(days, today)}
      today={today}
      items={items}
      places={places}
      weather={weather}
    />
  );
}
