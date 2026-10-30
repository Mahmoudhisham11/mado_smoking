// Service worker بسيط: بيخلي التطبيق قابل للتثبيت من غير ما يخزن نسخ قديمة من الكود.
// بيمسح أي كاش قديم من next-pwa/workbox عشان العملاء ماتفضلش على نسخة قديمة.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// كل الطلبات بتروح للشبكة مباشرة
self.addEventListener('fetch', () => {});
