"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "schedule", label: "일정", icon: "🗓️" },
  { href: "map", label: "지도", icon: "🗺️" },
  { href: "recommend", label: "추천", icon: "⭐" },
  { href: "prep", label: "준비", icon: "🧳" },
  { href: "expenses", label: "가계부", icon: "💴" },
  { href: "settle", label: "정산", icon: "🤝" },
  { href: "settings", label: "설정", icon: "⚙️" },
] as const;

export function BottomTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  return (
    <nav className="z-10 flex shrink-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const href = `/t/${tripId}/${t.href}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            <span className="text-lg" aria-hidden>
              {t.icon}
            </span>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
