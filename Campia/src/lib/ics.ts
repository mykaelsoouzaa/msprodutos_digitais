// Agenda (.ics) com os jogos: funciona no Google Agenda, iPhone e Outlook.
// Horários da Campia são de Brasília (-03:00, sem horário de verão desde 2019) e viram UTC no arquivo.

export interface IcsEvent { uid: string; date: string; time: string; title: string; location: string; description: string; url: string; minutes?: number }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Linhas de no máximo 75 caracteres (regra do formato). */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) { out.push(rest.slice(0, 75)); rest = ' ' + rest.slice(75); }
  out.push(rest);
  return out.join('\r\n');
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function buildIcs(name: string, events: IcsEvent[], now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Campia//Campeonatos//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:America/Sao_Paulo', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${utc(now)}`);
    if (/^\d{2}:\d{2}$/.test(e.time)) {
      const start = new Date(`${e.date}T${e.time}:00-03:00`);
      const end = new Date(start.getTime() + (e.minutes ?? 60) * 60_000);
      lines.push(`DTSTART:${utc(start)}`, `DTEND:${utc(end)}`);
    } else {
      const next = new Date(`${e.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${e.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push(`DESCRIPTION:${esc(e.description)}`, `URL:${e.url}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Links para assinar a agenda (atualiza sozinha quando o organizador muda um horário). */
export function calendarLinks(httpsUrl: string) {
  const webcal = httpsUrl.replace(/^https?:\/\//, 'webcal://');
  return { webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`, download: httpsUrl };
}
