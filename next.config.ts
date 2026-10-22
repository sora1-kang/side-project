import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 화장실 데이터는 경로를 환경변수로 바꿀 수 있어 자동 추적에 잡히지 않으므로, 배포 번들에 직접 넣는다.
  outputFileTracingIncludes: {
    "/api/toilets": ["./data/toilets.json"],
  },
};

export default nextConfig;
