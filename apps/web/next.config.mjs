/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@huddle/brand", "@huddle/shared", "@huddle/ui"],
  experimental: {
    optimizePackageImports: ["@huddle/ui"],
  },
};

export default nextConfig;
