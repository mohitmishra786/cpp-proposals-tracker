/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@anthropic-ai/sdk", "openai"],
};

export default nextConfig;
