import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/CopyButton";
import { fetchLiveRate } from "@/lib/rate";
import { getTrip } from "@/lib/notion/repo";
import { RateForm } from "./RateForm";

export default async function SettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  const live = await fetchLiveRate();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const shareUrl = `${proto}://${host}/t/${tripId}`;

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-lg font-bold">환율 설정</h2>
      <p className="text-sm text-muted-foreground">
        엔화 지출은 <b>저장하는 순간의 환율</b>로 원화 환산해 기록돼요. 환전한 실제 환율로 맞추고 싶다면
        직접 입력하세요. 이미 저장된 지출은 바뀌지 않아요.
      </p>
      <RateForm manualRate={trip.manualRate} liveRate={live} />

      <section className="flex flex-col gap-2 border-t border-border pt-5">
        <h2 className="text-lg font-bold">친구 초대</h2>
        <p className="text-sm text-muted-foreground">
          링크를 보내고 <b>PIN</b>도 따로 알려주세요. 링크만으로는 들어올 수 없어요.
        </p>
        <p className="break-all rounded-xl bg-muted p-3 text-xs text-muted-foreground">{shareUrl}</p>
        <div>
          <CopyButton text={shareUrl} label="링크 복사" />
        </div>
      </section>

      <section className="flex flex-col gap-2 border-t border-border pt-5">
        <h2 className="text-lg font-bold">앱처럼 쓰기</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <b>아이폰</b>: Safari 에서 공유 버튼 → <b>홈 화면에 추가</b>
          </li>
          <li>
            <b>안드로이드</b>: Chrome 메뉴(⋮) → <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>
          </li>
          <li>연결이 없을 때는 마지막으로 본 일정·가계부를 읽을 수 있어요 (저장은 온라인에서만).</li>
        </ul>
      </section>
    </div>
  );
}
