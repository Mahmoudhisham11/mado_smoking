/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  async headers() {
    return [
      {
        // الـ service worker لازم مايتخزنش في الكاش عشان التحديثات توصل فوراً
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
