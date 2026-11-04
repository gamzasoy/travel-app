import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // e2e 는 개발용 .next 와 캐시가 섞이지 않도록 별도 폴더를 쓴다
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // e2e 에서는 화면 구석의 개발용 표시가 버튼을 가려 클릭을 막으므로 끈다
  devIndicators: process.env.NEXT_DIST_DIR ? false : undefined,
};

export default nextConfig;
