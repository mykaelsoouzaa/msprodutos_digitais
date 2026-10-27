import type { Championship, Game } from './domain/types';
import { sportLabel } from './domain/sports';

/** Fuso de Brasília: os horários dos jogos são locais. */
const TZ = '-03:00';

function stamp(date: string, time: string) {
  return time ? `${date}T${time}:00${TZ}` : date;
}

interface EventInput {
  champ: Championship;
  games: Game[];
  url: string;
  imageUrl: string;
  organizer?: { name: string; url: string } | null;
  /** Preço de hoje em centavos, só quando há inscrição aberta. */
  offerCents?: number | null;
  signupUrl?: string;
  finished: boolean;
}

/**
 * Dados estruturados (schema.org SportsEvent) para o Google entender que a página é
 * um campeonato com datas e local. Só entra quando há pelo menos um jogo com data.
 */
export function eventJsonLd(i: EventInput): Record<string, unknown> | null {
  const dated = i.games.filter(g => g.date).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!dated.length) return null;
  const first = dated[0], last = dated[dated.length - 1];
  const c = i.champ;
  const address = [c.city, c.state].filter(Boolean).join(' - ');

  const location = c.online
    ? { '@type': 'VirtualLocation', url: i.url }
    : {
        '@type': 'Place',
        name: c.location || address || c.name,
        address: {
          '@type': 'PostalAddress',
          ...(c.location ? { streetAddress: c.location } : {}),
          ...(c.city ? { addressLocality: c.city } : {}),
          ...(c.state ? { addressRegion: c.state } : {}),
          addressCountry: 'BR',
        },
      };

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: c.name,
    sport: sportLabel(c.sport),
    description: `${sportLabel(c.sport)}: jogos, tabela e resultados de ${c.name}.`,
    url: i.url,
    image: [i.imageUrl],
    startDate: stamp(first.date, first.time),
    endDate: stamp(last.date, last.time),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: c.online
      ? 'https://schema.org/OnlineEventAttendanceMode'
      : 'https://schema.org/OfflineEventAttendanceMode',
    location,
    ...(i.organizer ? { organizer: { '@type': 'Organization', name: i.organizer.name, url: i.organizer.url } } : {}),
    ...(i.offerCents != null && !i.finished
      ? {
          offers: {
            '@type': 'Offer',
            name: 'Inscrição de time',
            price: (i.offerCents / 100).toFixed(2),
            priceCurrency: 'BRL',
            availability: 'https://schema.org/InStock',
            url: i.signupUrl ?? i.url,
          },
        }
      : {}),
  };
}

/** JSON dentro de <script>: escapa "<" para não fechar a tag com um nome malicioso. */
export function safeJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

interface ArenaInput {
  name: string; bio: string; address: string; city: string; state: string;
  whatsapp: string; instagram: string; logo_url: string;
}

/** Dados estruturados da página da arena (local esportivo com endereço e contatos). */
export function arenaJsonLd(a: ArenaInput, url: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: a.name,
    url,
    ...(a.bio ? { description: a.bio } : {}),
    ...(a.logo_url ? { logo: a.logo_url, image: a.logo_url } : {}),
    ...(a.whatsapp ? { telephone: `+55${a.whatsapp}` } : {}),
    ...(a.instagram ? { sameAs: [`https://instagram.com/${a.instagram}`] } : {}),
    ...(a.address || a.city ? {
      address: {
        '@type': 'PostalAddress',
        ...(a.address ? { streetAddress: a.address } : {}),
        ...(a.city ? { addressLocality: a.city } : {}),
        ...(a.state ? { addressRegion: a.state } : {}),
        addressCountry: 'BR',
      },
    } : {}),
  };
}
