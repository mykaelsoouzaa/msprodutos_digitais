// Regras de placar por esporte.

export type SportIcon = 'futebol' | 'basquete' | 'volei' | 'handebol' | 'tenis' | 'padel' | 'pingpong' | 'games';
export type SportGroup = 'Futebol' | 'Quadra' | 'Areia' | 'Raquete' | 'Games';

export interface SportRules {
  icon: string;
  /** Nome curto exibido nas telas (a chave do objeto é o que fica salvo no banco). */
  label: string;
  group: SportGroup;
  glyph: SportIcon;
  /** O que o placar conta: gols, pontos, sets ou mapas. */
  unit: 'gols' | 'pontos' | 'sets' | 'mapas';
  draws: boolean;
  /** Registra quem marcou (artilharia / cestinha). */
  scorers: boolean;
  /** Pontos na tabela por vitória, empate e derrota. */
  points: [number, number, number];
  /** Nome do desempate de mata-mata empatado. */
  tieLabel: string;
  /** Rótulo da coluna de saldo. */
  diff: string;
  /** Como chamar o elenco. */
  who: 'Jogadores' | 'Atletas' | 'Dupla';
}

const FOOT: Omit<SportRules, 'icon' | 'label' | 'group' | 'glyph'> = {
  unit: 'gols', draws: true, scorers: true, points: [3, 1, 0], tieLabel: 'Pênaltis', diff: 'SG', who: 'Jogadores',
};
const SETS: Omit<SportRules, 'icon' | 'label' | 'group' | 'glyph'> = {
  unit: 'sets', draws: false, scorers: false, points: [3, 0, 0], tieLabel: '', diff: 'SS', who: 'Atletas',
};

export const SPORTS: Record<string, SportRules> = {
  'Futebol society': { ...FOOT, icon: '⚽', label: 'Society', group: 'Futebol', glyph: 'futebol' },
  'Futsal': { ...FOOT, icon: '⚽', label: 'Futsal', group: 'Futebol', glyph: 'futebol' },
  'Futebol de campo': { ...FOOT, icon: '⚽', label: 'Campo', group: 'Futebol', glyph: 'futebol' },
  'Basquete': { ...FOOT, icon: '🏀', label: 'Basquete', group: 'Quadra', glyph: 'basquete', unit: 'pontos', draws: false, points: [2, 0, 1], tieLabel: '', diff: 'SC' },
  'Handebol': { ...FOOT, icon: '🤾', label: 'Handebol', group: 'Quadra', glyph: 'handebol', tieLabel: 'Tiros de 7 m' },
  'Vôlei': { ...SETS, icon: '🏐', label: 'Vôlei', group: 'Quadra', glyph: 'volei' },
  'Vôlei de praia': { ...SETS, icon: '🏐', label: 'Vôlei de praia', group: 'Areia', glyph: 'volei', who: 'Dupla' },
  'Futevôlei': { ...SETS, icon: '⚽', label: 'Futevôlei', group: 'Areia', glyph: 'futebol', who: 'Dupla' },
  'Beach tennis': { ...SETS, icon: '🎾', label: 'Beach tennis', group: 'Areia', glyph: 'tenis', who: 'Dupla' },
  'Tênis': { ...SETS, icon: '🎾', label: 'Tênis', group: 'Raquete', glyph: 'tenis' },
  'Padel': { ...SETS, icon: '🎾', label: 'Padel', group: 'Raquete', glyph: 'padel', who: 'Dupla' },
  'Tênis de mesa': { ...SETS, icon: '🏓', label: 'Tênis de mesa', group: 'Raquete', glyph: 'pingpong' },
  'E-sports (EA FC)': { ...FOOT, icon: '🎮', label: 'EA FC', group: 'Games', glyph: 'games' },
  'E-sports (CS2/Valorant)': { ...SETS, icon: '🎮', label: 'CS2 e Valorant', group: 'Games', glyph: 'games', unit: 'mapas', diff: 'SM' },
};

export const SPORT_GROUPS: SportGroup[] = ['Futebol', 'Quadra', 'Areia', 'Raquete', 'Games'];

/** Esportes de um grupo, na ordem de exibição. */
export const sportsIn = (group: SportGroup) => Object.entries(SPORTS).filter(([, r]) => r.group === group);

/** Nome para exibir: "Society", "Vôlei de praia", "EA FC"… */
export const sportLabel = (sport: string) => SPORTS[sport]?.label ?? sport;

/** Só e-sports podem ser disputados online. */
export const allowsOnline = (sport: string) => SPORTS[sport]?.group === 'Games';

export const sportRules = (sport: string): SportRules => SPORTS[sport] ?? SPORTS['Futebol society'];

export const FORMATS = {
  pontos: 'Pontos corridos',
  grupos: 'Grupos + mata-mata',
  mata: 'Mata-mata',
} as const;
