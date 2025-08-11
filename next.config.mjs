/** @type {import('next').NextConfig} */

const nextConfig = {
  async rewrites() {
    
    const backend =
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE
    return [
      // Auth endpoints
      { source: '/auth/:path*', destination: `${backend}/auth/:path*` },
      // Documents & OCR endpoints
      { source: '/documents/:path*', destination: `${backend}/documents/:path*` },

      { source: '/users', destination: `${backend}/users` },

    ];
  },
};

export default nextConfig;
