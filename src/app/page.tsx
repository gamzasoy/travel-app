import Link from "next/link";
import { listTrips } from "@/lib/notion/repo";

export const dynamic = "force-dynamic";

function period(start: string | null, end: string | null): string {
  if (!start) return "날짜 미정";
  const fmt = (d: string) => d.replaceAll("-", ".");
  return end && end !== start ? `${fmt(start)} ~ ${fmt(end)}` : fmt(start);
}

export default async function Home() {
  const trips = await listTrips();
  return (
    <main className="flex min-h-dvh flex-col gap-6 p-6">
      <header className="pt-6">
        <h1 className="text-2xl font-bold">여행 플래너</h1>
        <p className="mt-1 text-sm text-muted-foreground">일정 · 가계부 · 지도를 한 곳에서</p>
      </header>

      {trips.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          아직 여행이 없어요. 노션 여행 DB에 행을 추가해 주세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label="여행 목록">
          {trips.map((t) => (
            <li key={t.id}>
              <Link
                href={`/t/${t.id}`}
                className="flex items-center justify-between rounded-xl bg-card p-4 shadow-sm active:bg-muted"
              >
                <span>
                  <span className="block font-semibold">{t.name || "이름 없는 여행"}</span>
                  <span className="block text-sm text-muted-foreground">
                    {period(t.startDate, t.endDate)}
                  </span>
                </span>
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-center text-xs text-muted-foreground">여행을 누르고 PIN을 입력하면 들어갈 수 있어요.</p>
    </main>
  );
}
