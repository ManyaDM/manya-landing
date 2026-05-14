/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // {
      //   source: '/',
      //   destination: 'https://manya.pe',
      //   permanent: false,
      // },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'manya.pe' },
    ],
  },
}

export default nextConfig
