"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "expenses", label: "가계부", icon: "💴" },
  { href: "settle", label: "정산", icon: "🤝" },
  { href: "settings", label: "설정", icon: "⚙️" },
] as const;

export function BottomTabs({ tripId }: { tripId: string }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      {TABS.map((t) => {
        const href = `/t/${tripId}/${t.href}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={t.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${active ? "font-semibold text-sky-600" : "text-slate-500"}`}
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
