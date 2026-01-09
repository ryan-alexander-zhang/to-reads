/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiBaseUrl =
      process.env.NEXT_INTERNAL_API_BASE_URL ?? "http://backend:8080/api";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
