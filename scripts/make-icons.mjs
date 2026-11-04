// public/icons/*.svg → PNG. 실행: PW_CHROMIUM_PATH=... node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const jobs = [
  ["icon.svg", "icon-192.png", 192],
  ["icon.svg", "icon-512.png", 512],
  ["icon-maskable.svg", "icon-maskable-512.png", 512],
  ["icon-maskable.svg", "apple-touch-icon.png", 180], // iOS 는 자체적으로 모서리를 깎는다
];

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
for (const [src, out, size] of jobs) {
  const svg = readFileSync(`public/icons/${src}`, "utf8");
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  writeFileSync(`public/icons/${out}`, await page.screenshot({ omitBackground: true }));
  await page.close();
}
await browser.close();
console.log("icons done");
