// Regras de placar por esporte.

export interface SportRules {
  icon: string;
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

const FOOT: Omit<SportRules, 'icon'> = {
  unit: 'gols', draws: true, scorers: true, points: [3, 1, 0], tieLabel: 'Pênaltis', diff: 'SG', who: 'Jogadores',
};
const SETS: Omit<SportRules, 'icon'> = {
  unit: 'sets', draws: false, scorers: false, points: [3, 0, 0], tieLabel: '', diff: 'SS', who: 'Atletas',
};

export const SPORTS: Record<string, SportRules> = {
  'Futebol society': { ...FOOT, icon: '⚽' },
  'Futsal': { ...FOOT, icon: '⚽' },
  'Futebol de campo': { ...FOOT, icon: '⚽' },
  'Basquete': { ...FOOT, icon: '🏀', unit: 'pontos', draws: false, points: [2, 0, 1], tieLabel: '', diff: 'SC' },
  'Handebol': { ...FOOT, icon: '🤾', tieLabel: 'Tiros de 7 m' },
  'Vôlei': { ...SETS, icon: '🏐' },
  'Vôlei de praia': { ...SETS, icon: '🏐', who: 'Dupla' },
  'Futevôlei': { ...SETS, icon: '⚽', who: 'Dupla' },
  'Beach tennis': { ...SETS, icon: '🎾', who: 'Dupla' },
  'Tênis': { ...SETS, icon: '🎾' },
  'Padel': { ...SETS, icon: '🎾', who: 'Dupla' },
  'Tênis de mesa': { ...SETS, icon: '🏓' },
  'E-sports (EA FC)': { ...FOOT, icon: '🎮' },
  'E-sports (CS2/Valorant)': { ...SETS, icon: '🎮', unit: 'mapas', diff: 'SM' },
};

export const sportRules = (sport: string): SportRules => SPORTS[sport] ?? SPORTS['Futebol society'];

export const FORMATS = {
  pontos: 'Pontos corridos',
  grupos: 'Grupos + mata-mata',
  mata: 'Mata-mata',
} as const;
