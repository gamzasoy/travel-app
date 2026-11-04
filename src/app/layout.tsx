import type { Metadata, Viewport } from "next";
import { PwaClient } from "@/components/PwaClient";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행 플래너",
  description: "친구들과 함께하는 여행 일정·가계부·지도",
  applicationName: "여행 플래너",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "여행 플래너", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4b8c4",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="mx-auto min-h-dvh max-w-md bg-background text-foreground antialiased">
        {children}
        <PwaClient />
      </body>
    </html>
  );
}
