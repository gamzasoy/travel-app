import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "여행 플래너",
  description: "친구들과 함께하는 여행 일정·가계부·지도",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="mx-auto min-h-dvh max-w-md bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
