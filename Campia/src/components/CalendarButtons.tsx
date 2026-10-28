import { calendarLinks } from '@/lib/ics';
import { siteUrl } from '@/lib/env';

/** "📅 Agenda": assinar no Google Agenda, no iPhone/Outlook ou baixar o arquivo. */
export default function CalendarButtons({ slug, teamId, label = '📅 Agenda', small = true }: { slug: string; teamId?: string; label?: string; small?: boolean }) {
  const l = calendarLinks(`${siteUrl()}/c/${slug}/agenda.ics${teamId ? `?time=${teamId}` : ''}`);
  return (
    <details className="cal-menu">
      <summary className={`btn ghost ${small ? 'sm' : ''}`}>{label}</summary>
      <div className="cal-panel">
        <span className="sub small">Os jogos entram na agenda do celular e mudam sozinhos se o horário mudar.</span>
        <a href={l.google} target="_blank" rel="noopener">Google Agenda (Android)</a>
        <a href={l.webcal}>iPhone, Mac ou Outlook</a>
        <a href={l.download} download>Baixar arquivo (.ics)</a>
      </div>
    </details>
  );
}
