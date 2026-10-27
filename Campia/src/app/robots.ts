import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/env';

/** O que o Google pode visitar: páginas públicas sim; painel, pagamento e áreas logadas não. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/painel', '/admin', '/meus-times', '/pagamento', '/entrar', '/auth', '/api', '/offline', '/c/*/imprimir', '/c/*/arte', '/c/*/craque', '/atleta$'],
    }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
