import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getTrip } from "@/lib/notion/repo";
import { dayLabel } from "@/lib/schedule";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { SITE_NAME, shareMetadata } from "@/lib/site";
import { JoinForm } from "./JoinForm";

type Props = { params: Promise<{ tripId: string }> };

/** 초대 링크 미리보기: "도쿄 여행에 초대받았어요" + 기간 + 공용 이미지 (PIN 은 절대 넣지 않는다) */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) return { title: SITE_NAME };
  const name = trip.name || "여행";
  const period = trip.startDate
    ? [trip.startDate, trip.endDate].filter(Boolean).map((d) => dayLabel(d!.slice(0, 10))).join(" ~ ")
    : null;
  const title = `${name}에 초대받았어요 ✈️`;
  const description = [period, "링크를 열고 PIN 을 입력해 함께 일정·가계부를 써요"].filter(Boolean).join(" · ");
  return { title: `${name} · ${SITE_NAME}`, description, ...shareMetadata(title, description) };
}

export default async function JoinPage({ params }: Props) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  if (!trip) notFound();
  // 이미 들어와 있는 사람이 초대 링크를 다시 누르면 PIN 없이 바로 일정으로
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.tripId === tripId) redirect(`/t/${tripId}/schedule`);
  return <JoinForm tripId={tripId} tripName={trip.name} />;
}
