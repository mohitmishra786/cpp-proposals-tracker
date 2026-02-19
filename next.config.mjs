/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk", "openai"],
  },
};

export default nextConfig;
