/** @type {import('next').NextConfig} */
const nextConfig = {
  // Minimal configuration for MCP server
  // Disable static optimization since we're only using API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
