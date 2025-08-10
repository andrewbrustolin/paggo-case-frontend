/** @type {import('next').NextConfig} */

const nextConfig = {
  async rewrites() {
    // Where your Nest API runs in dev or prod
    const backend =
    process.env.NEXT_PUBLIC_BACKEND_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000'
    return [
      // Auth endpoints
      { source: '/auth/:path*', destination: `${backend}/auth/:path*` },
      // Documents & OCR endpoints
      { source: '/documents/:path*', destination: `${backend}/documents/:path*` },
      
      //{ source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
