import type { Metadata, Viewport } from "next";
import { PwaClient } from "@/components/PwaClient";
import { SITE_DESCRIPTION, SITE_NAME, shareMetadata, siteOrigin } from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    // 미리보기 이미지는 절대 주소여야 카카오톡 등이 가져갈 수 있다
    metadataBase: new URL(await siteOrigin()),
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
    appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
    ...shareMetadata(SITE_NAME, SITE_DESCRIPTION),
  };
}

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
