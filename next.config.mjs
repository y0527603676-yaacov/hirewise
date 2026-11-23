import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The wizard assistant accepts a document (brochure, job description) up to about 5 MB
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};
export default nextConfig;

// Lets `next dev` use a local D1 database
initOpenNextCloudflareForDev();
