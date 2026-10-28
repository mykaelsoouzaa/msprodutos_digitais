// Regras de placar por esporte.

export type SportIcon = 'futebol' | 'basquete' | 'volei' | 'handebol' | 'tenis' | 'padel' | 'pingpong' | 'peteca' | 'games' | 'sinuca' | 'cartas' | 'domino' | 'xadrez';
export type SportGroup = 'Futebol' | 'Quadra' | 'Areia' | 'Raquete' | 'Mesa' | 'Games';

export interface SportRules {
  icon: string;
  /** Nome curto exibido nas telas (a chave do objeto é o que fica salvo no banco). */
  label: string;
  group: SportGroup;
  glyph: SportIcon;
  /** O que o placar conta: gols, pontos, sets, partidas ou mapas. */
  unit: 'gols' | 'pontos' | 'sets' | 'partidas' | 'mapas';
  draws: boolean;
  /** Registra quem marcou (artilharia / cestinha). */
  scorers: boolean;
  /** Pontos na tabela por vitória, empate e derrota. */
  points: [number, number, number];
  /** Nome do desempate de mata-mata empatado. */
  tieLabel: string;
  /** Rótulo da coluna de saldo. */
  diff: string;
  /** Placar do W.O. (time presente × time ausente). */
  woScore: [number, number];
  /** Tem cartões amarelo e vermelho (e suspensão). */
  cards: boolean;
  /** Como chamar o elenco. */
  who: 'Jogadores' | 'Atletas' | 'Dupla';
}

const FOOT: Omit<SportRules, 'icon' | 'label' | 'group' | 'glyph'> = {
  unit: 'gols', draws: true, scorers: true, points: [3, 1, 0], tieLabel: 'Pênaltis', diff: 'SG', who: 'Jogadores', woScore: [3, 0], cards: true,
};
const SETS: Omit<SportRules, 'icon' | 'label' | 'group' | 'glyph'> = {
  unit: 'sets', draws: false, scorers: false, points: [3, 0, 0], tieLabel: '', diff: 'SS', who: 'Atletas', woScore: [2, 0], cards: false,
};

export const SPORTS: Record<string, SportRules> = {
  'Futebol society': { ...FOOT, icon: '⚽', label: 'Society', group: 'Futebol', glyph: 'futebol' },
  'Futsal': { ...FOOT, icon: '⚽', label: 'Futsal', group: 'Futebol', glyph: 'futebol' },
  'Futebol de campo': { ...FOOT, icon: '⚽', label: 'Campo', group: 'Futebol', glyph: 'futebol' },
  'Basquete': { ...FOOT, icon: '🏀', label: 'Basquete', group: 'Quadra', glyph: 'basquete', unit: 'pontos', draws: false, points: [2, 0, 1], tieLabel: '', diff: 'SC', woScore: [20, 0], cards: false },
  'Handebol': { ...FOOT, icon: '🤾', label: 'Handebol', group: 'Quadra', glyph: 'handebol', tieLabel: 'Tiros de 7 m', woScore: [10, 0] },
  'Vôlei': { ...SETS, icon: '🏐', label: 'Vôlei', group: 'Quadra', glyph: 'volei', woScore: [3, 0] },
  'Vôlei de praia': { ...SETS, icon: '🏐', label: 'Vôlei de praia', group: 'Areia', glyph: 'volei', who: 'Dupla' },
  'Futevôlei': { ...SETS, icon: '⚽', label: 'Futevôlei', group: 'Areia', glyph: 'futebol', who: 'Dupla' },
  'Futebol de areia': { ...FOOT, icon: '⚽', label: 'Futebol de areia', group: 'Areia', glyph: 'futebol', tieLabel: 'Pênaltis' },
  'Beach tennis': { ...SETS, icon: '🎾', label: 'Beach tennis', group: 'Areia', glyph: 'tenis', who: 'Dupla' },
  'Tênis': { ...SETS, icon: '🎾', label: 'Tênis', group: 'Raquete', glyph: 'tenis' },
  'Padel': { ...SETS, icon: '🎾', label: 'Padel', group: 'Raquete', glyph: 'padel', who: 'Dupla' },
  'Tênis de mesa': { ...SETS, icon: '🏓', label: 'Tênis de mesa', group: 'Raquete', glyph: 'pingpong', woScore: [3, 0] },
  'Pickleball': { ...SETS, icon: '🏓', label: 'Pickleball', group: 'Raquete', glyph: 'padel' },
  'Badminton': { ...SETS, icon: '🏸', label: 'Badminton', group: 'Raquete', glyph: 'peteca' },
  'Sinuca': { ...SETS, icon: '🎱', label: 'Sinuca', group: 'Mesa', glyph: 'sinuca', unit: 'partidas', diff: 'SP' },
  'Truco': { ...SETS, icon: '🃏', label: 'Truco', group: 'Mesa', glyph: 'cartas', unit: 'partidas', diff: 'SP', who: 'Dupla' },
  'Dominó': { ...SETS, icon: '🁢', label: 'Dominó', group: 'Mesa', glyph: 'domino', unit: 'partidas', diff: 'SP', who: 'Dupla' },
  // Xadrez: vitória 2, empate 1 (igual a 1 e meio ponto, sem fração). Placar em partidas do confronto.
  'Xadrez': { ...SETS, icon: '♟️', label: 'Xadrez', group: 'Mesa', glyph: 'xadrez', unit: 'partidas', diff: 'SP', draws: true, points: [2, 1, 0], woScore: [1, 0] },
  'E-sports (EA FC)': { ...FOOT, icon: '🎮', label: 'EA FC', group: 'Games', glyph: 'games', cards: false },
  'E-sports (CS2/Valorant)': { ...SETS, icon: '🎮', label: 'CS2 e Valorant', group: 'Games', glyph: 'games', unit: 'mapas', diff: 'SM' },
  'E-sports (LoL)': { ...SETS, icon: '🎮', label: 'League of Legends', group: 'Games', glyph: 'games', unit: 'partidas', diff: 'SP' },
  'E-sports (Rocket League)': { ...FOOT, icon: '🎮', label: 'Rocket League', group: 'Games', glyph: 'games', cards: false, draws: false, points: [3, 0, 0], tieLabel: '' },
};

export const SPORT_GROUPS: SportGroup[] = ['Futebol', 'Quadra', 'Areia', 'Raquete', 'Mesa', 'Games'];

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
