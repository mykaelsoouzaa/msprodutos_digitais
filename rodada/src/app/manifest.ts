import type { MetadataRoute } from 'next';

// Manifest do PWA: permite instalar o Rodada na tela inicial e abrir em tela cheia.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rodada · Campeonatos',
    short_name: 'Rodada',
    description: 'Jogos, tabela e lembretes dos seus campeonatos.',
    lang: 'pt-BR',
    start_url: '/?origem=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1410',
    theme_color: '#0b1410',
    categories: ['sports'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Meu painel', url: '/painel', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] }],
  };
}
