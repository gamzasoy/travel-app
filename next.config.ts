import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e 는 개발용 .next 와 캐시가 섞이지 않도록 별도 폴더를 쓴다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // 서비스워커 파일은 항상 최신으로 받아야 업데이트가 반영된다
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] },
    ];
  },
  // 화면 왼쪽 아래 개발용 표시("N")가 하단 탭(일정)을 가려 클릭을 막으므로 끈다
  devIndicators: false,
};

export default nextConfig;
