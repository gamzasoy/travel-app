// 카카오톡·메신저 링크 미리보기 이미지(public/og.png, 1200x630) 생성
// 실행: PW_CHROMIUM_PATH=... node scripts/make-og.mjs   (Noto Sans KR 을 Google Fonts 에서 받아 렌더링)
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const icon = readFileSync("public/icons/icon.svg", "utf8").replace("<svg ", '<svg width="300" height="300" ');
const chips = ["🗓️ 일정", "🗺️ 지도", "💴 가계부", "🤝 N빵 정산", "🧳 준비물", "🌤️ 날씨"];

const html = `<!doctype html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;800&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    font-family: "Noto Sans KR", sans-serif; color: #0c4a6e;
    background: linear-gradient(135deg, #e0f2fe 0%, #ffffff 55%, #fde2e8 100%);
    display: flex; align-items: center; gap: 64px; padding: 0 88px;
    position: relative;
  }
  .route { position: absolute; inset: 0; }
  .icon { flex: none; filter: drop-shadow(0 18px 30px rgba(14,165,233,.28)); }
  h1 { font-size: 92px; font-weight: 800; letter-spacing: -2px; line-height: 1.1; }
  p.sub { margin-top: 18px; font-size: 34px; font-weight: 500; color: #0369a1; }
  .chips { margin-top: 34px; display: flex; flex-wrap: wrap; gap: 12px; max-width: 640px; }
  .chip { font-size: 26px; font-weight: 500; padding: 8px 20px; border-radius: 999px; background: #fff; border: 2px solid #bae6fd; }
</style></head>
<body>
  <svg class="route" viewBox="0 0 1200 630"><path d="M-20 560 C 300 470, 520 640, 820 540 S 1150 470, 1240 520" fill="none" stroke="#7dd3fc" stroke-width="6" stroke-dasharray="4 22" stroke-linecap="round"/></svg>
  <div class="icon">${icon}</div>
  <div>
    <h1>여행 플래너</h1>
    <p class="sub">친구들과 함께 쓰는 우리 여행 앱</p>
    <div class="chips">${chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
writeFileSync("public/og.png", await page.screenshot({ type: "png" }));
await browser.close();
console.log("public/og.png done");
