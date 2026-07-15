import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const baseConfig = {
  reactCompiler: true,
};

const pwaConfig = withPWA({
  pwa: {
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    // Disable runtime caching to avoid worker issues
    runtimeCaching: [],
  },
});

// Merge base config with PWA config, ensuring reactCompiler is preserved
export default {
  ...pwaConfig,
  ...baseConfig,
};
