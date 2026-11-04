import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e 는 개발용 .next 와 캐시가 섞이지 않도록 별도 폴더를 쓴다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // e2e 에서는 화면 구석의 개발용 표시가 버튼을 가려 클릭을 막으므로 끈다
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
  devIndicators: process.env.NEXT_DIST_DIR ? false : undefined,
};

export default nextConfig;
