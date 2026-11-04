import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="text-4xl">🧭</p>
      <h1 className="text-xl font-bold">찾을 수 없는 페이지예요</h1>
      <p className="text-sm text-muted-foreground">링크가 맞는지 확인해주세요. 여행 링크는 친구에게 다시 받을 수 있어요.</p>
      <Link href="/" className="mt-4 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
        처음으로
      </Link>
    </main>
  );
}
