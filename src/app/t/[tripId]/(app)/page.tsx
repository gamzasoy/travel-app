import { redirect } from "next/navigation";

export default async function TripHome({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  redirect(`/t/${tripId}/schedule`);
}
