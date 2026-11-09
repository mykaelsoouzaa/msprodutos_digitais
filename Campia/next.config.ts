import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Envio do logo da arena (até 1 MB) passa por Server Action.
  experimental: { serverActions: { bodySizeLimit: '2mb' } },
  async headers() {
    return [
      {
        // Só a própria Campia e a área do cliente da MS Soluções podem mostrar o site dentro de um quadro.
        source: '/:path*',
        headers: [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${process.env.PORTAL_URL || 'https://mssolucoestech.com.br'}` }],
      },
      {
        // O service worker precisa ser sempre buscado de novo para as atualizações chegarem.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default nextConfig;
