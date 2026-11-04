import { notFound } from "next/navigation";
import { fetchLiveRate } from "@/lib/rate";
import { getTrip } from "@/lib/notion/repo";
import { RateForm } from "./RateForm";

export default async function SettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  const live = await fetchLiveRate();

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold">환율 설정</h2>
      <p className="text-sm text-slate-600">
        엔화 지출은 <b>저장하는 순간의 환율</b>로 원화 환산해 기록돼요. 환전한 실제 환율로 맞추고 싶다면
        직접 입력하세요. 이미 저장된 지출은 바뀌지 않아요.
      </p>
      <RateForm manualRate={trip.manualRate} liveRate={live} />
    </div>
  );
}
