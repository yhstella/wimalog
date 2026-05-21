// 위마로그 Service Worker — 오프라인 캐싱 + 빠른 반복 방문
// 전략:
//   - HTML/JS/CSS: stale-while-revalidate (즉시 캐시 응답 + 백그라운드 갱신)
//   - Supabase RPC: network-first (실시간 데이터 우선, 실패 시 캐시)
//   - 이미지/폰트: cache-first

const VERSION = 'v17';  // bumped 2026-05-21: 정확도 세분화 — Static 47% + Dynamic 53% 누적 단계별
const STATIC_CACHE = `wimalog-static-${VERSION}`;
const RUNTIME_CACHE = `wimalog-runtime-${VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/og.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k.startsWith('wimalog-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 외부 origin은 패스 (Supabase, jsdelivr 등 자체 캐싱 정책)
  if (url.origin !== location.origin) return;

  // Supabase functions/v1 — 캐시 안 함 (이미 supabasePharmacy.js·supabaseStats.js에서 메모리 캐시)
  if (url.pathname.startsWith('/auth/') || url.pathname.startsWith('/api/')) return;

  // HTML (라우트 폴백) — stale-while-revalidate
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match('/').then(cached => {
        const fresh = fetch('/').then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then(c => c.put('/', clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      }),
    );
    return;
  }

  // 정적 asset (JS/CSS/이미지) — stale-while-revalidate
  if (/\.(js|css|svg|png|jpg|jpeg|webp|woff2?)$/.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(RUNTIME_CACHE).then(c => c.put(req, clone));
          }
          return resp;
        }).catch(() => cached);
        return cached || fresh;
      }),
    );
  }
});

// 메시지로 강제 갱신 트리거
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
