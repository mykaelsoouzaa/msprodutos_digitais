// Regulamento do campeonato: texto livre do organizador, guardado junto com as regras.
import { sportRules } from './domain/sports';

export const REGULATION_MAX = 10000;

/** Modelo para o organizador partir dele (ajusta ao esporte). */
export function regulationTemplate(sport: string, yellowLimit = 3) {
  const r = sportRules(sport);
  const lines = [
    '1. INSCRIÇÃO',
    'A vaga só é confirmada com a inscrição paga. Cada time pode inscrever até __ atletas.',
    '',
    '2. ATLETAS',
    'Só jogam atletas inscritos até a véspera do jogo. É proibido o mesmo atleta jogar por dois times.',
    '',
    '3. HORÁRIOS E W.O.',
    `Tolerância de 10 minutos para o início do jogo. Depois disso, W.O. (o time presente vence por ${r.woScore[0]} × ${r.woScore[1]}).`,
    '',
    '4. PONTUAÇÃO E DESEMPATE',
    `${r.draws ? `Vitória ${r.points[0]} pontos, empate ${r.points[1]} e derrota ${r.points[2]}.` : `Vitória ${r.points[0]} pontos e derrota ${r.points[2]}; não há empate.`} Desempate: vitórias, saldo, ${r.unit === 'pontos' ? 'pontos marcados' : r.unit === 'gols' ? 'gols marcados' : `${r.unit} vencidos`} e confronto direto.`,
  ];
  if (r.cards) lines.push('', '5. CARTÕES', `Vermelho (ou 2 amarelos no mesmo jogo) = suspenso no próximo jogo. ${yellowLimit} amarelos acumulados = suspenso no próximo jogo.`);
  lines.push('', `${r.cards ? '6' : '5'}. CONDUTA`, 'Brigas, ofensas ao árbitro ou a outros atletas podem levar à eliminação do atleta ou do time, sem devolução da inscrição.',
    '', `${r.cards ? '7' : '6'}. CASOS OMISSOS`, 'Situações não previstas neste regulamento são decididas pela organização.');
  return lines.join('\n');
}

/** Divide o texto em parágrafos (linhas em branco separam). */
export const paragraphs = (text: string) => text.trim().split(/\n{2,}/).map(p => p.split('\n'));

/** Linha de título: tudo em maiúsculas (ex.: "3. HORÁRIOS E W.O."). */
export const isHeading = (line: string) => line.trim().length > 1 && line.trim().length <= 60 && line === line.toUpperCase() && /[A-ZÀ-Ú]/.test(line);
