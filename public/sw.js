/* 여행 플래너 서비스워커
 * - 정적 파일(/_next/static, 아이콘): 캐시 우선
 * - 페이지 이동(navigate): 네트워크 우선 → 실패하면 마지막으로 본 페이지, 없으면 offline.html
 * - 그 외(서버 액션 POST, RSC 데이터 등)는 건드리지 않는다. 쓰기는 온라인에서만 가능.
 */
const VERSION = "v2";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.add("/offline.html")).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  // 로그아웃/이름 바꾸기 때 앱이 보내면 저장된 페이지를 지운다 (공용 기기 보호)
  if (event.data === "clear-pages") event.waitUntil(caches.delete(PAGES));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req, url));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirstPage(req, url) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    // 리다이렉트 응답은 navigate 요청에 재사용할 수 없고, PIN 입력 화면은 저장해도 쓸모가 없다
    if (res.ok && !res.redirected && !url.pathname.endsWith("/join")) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    return (await caches.open(STATIC).then((c) => c.match("/offline.html"))) || Response.error();
  }
}
