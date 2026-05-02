/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'manya.pe' },
    ],
  },
}

export default nextConfig
