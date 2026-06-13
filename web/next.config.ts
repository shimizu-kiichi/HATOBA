import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // src/prompts の .md を実行時に fs で読むため、デプロイ(サーバーレス)時に同梱されるよう明示する
  outputFileTracingIncludes: {
    "/api/**": ["src/prompts/**/*"],
  },
};

export default nextConfig;
