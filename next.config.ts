import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Only public/non-sensitive fallbacks here to prevent GitHub push protection blocks!
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_b3B0aW11bS1yYXB0b3ItODMuY2xlcmsuYWNjb3VudHMuZGV2JA",
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || "LifecycleZero_Assets",
    AWS_REGION: process.env.AWS_REGION || "us-east-1",
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost:3000']
};

export default nextConfig;
