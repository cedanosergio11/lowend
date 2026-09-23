export type Hit = {
  at: number;
  string: 0 | 1 | 2 | 3;
  fret: number;
  len: number;
};

export type Groove = {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  bars: number;
  /** 16th slots per bar. 16 = 4/4. */
  grid: number;
  hits: Hit[];
};

function h(
  at: number,
  string: 0 | 1 | 2 | 3,
  fret: number,
  len: number,
): Hit {
  return { at, string, fret, len };
}

export const GROOVES: Groove[] = [
  {
    id: "seven-nation",
    title: "Seven Nation Army",
    artist: "The White Stripes",
    bpm: 124,
    bars: 2,
    grid: 16,
    hits: [
      h(0, 2, 7, 6),
      h(6, 2, 7, 2),
      h(8, 2, 10, 4),
      h(12, 2, 7, 4),
      h(16, 2, 5, 4),
      h(20, 2, 3, 4),
      h(24, 2, 2, 8),
    ],
  },
  {
    id: "billie-jean",
    title: "Billie Jean",
    artist: "Michael Jackson",
    bpm: 117,
    bars: 1,
    grid: 16,
    hits: [
      h(0, 3, 2, 2),
      h(2, 3, 4, 2),
      h(4, 2, 2, 2),
      h(6, 2, 4, 2),
      h(8, 3, 2, 2),
      h(10, 3, 4, 2),
      h(12, 2, 2, 2),
      h(14, 2, 4, 2),
    ],
  },
  {
    id: "bites-dust",
    title: "Another One Bites the Dust",
    artist: "Queen",
    bpm: 110,
    bars: 1,
    grid: 16,
    hits: [
      h(0, 3, 0, 2),
      h(4, 3, 0, 2),
      h(6, 3, 0, 2),
      h(8, 3, 3, 2),
      h(10, 3, 0, 2),
      h(12, 3, 5, 2),
      h(14, 3, 0, 2),
    ],
  },
  {
    id: "come-together",
    title: "Come Together",
    artist: "The Beatles",
    bpm: 87,
    bars: 1,
    grid: 16,
    hits: [
      h(0, 2, 5, 2),
      h(2, 2, 5, 2),
      h(4, 2, 5, 2),
      h(6, 2, 5, 2),
      h(8, 2, 6, 2),
      h(10, 2, 7, 2),
      h(12, 1, 7, 2),
      h(14, 1, 5, 2),
    ],
  },
  {
    id: "feel-good",
    title: "Feel Good Inc.",
    artist: "Gorillaz",
    bpm: 139,
    bars: 2,
    grid: 16,
    hits: [
      h(0, 3, 3, 2),
      h(2, 3, 3, 2),
      h(4, 3, 3, 2),
      h(6, 3, 3, 2),
      h(8, 3, 3, 2),
      h(10, 3, 3, 2),
      h(12, 3, 1, 2),
      h(14, 3, 1, 2),
      h(16, 3, 3, 2),
      h(18, 3, 3, 2),
      h(20, 3, 3, 2),
      h(22, 3, 3, 2),
      h(24, 3, 5, 2),
      h(26, 3, 5, 2),
      h(28, 3, 1, 2),
      h(30, 3, 1, 2),
    ],
  },
  {
    id: "stand-by-me",
    title: "Stand by Me",
    artist: "Ben E. King",
    bpm: 118,
    bars: 2,
    grid: 16,
    hits: [
      h(0, 2, 0, 8),
      h(8, 3, 2, 8),
      h(16, 2, 5, 8),
      h(24, 2, 7, 8),
    ],
  },
  {
    id: "the-chain",
    title: "The Chain",
    artist: "Fleetwood Mac",
    bpm: 152,
    bars: 2,
    grid: 16,
    hits: [
      h(0, 2, 0, 2),
      h(2, 2, 0, 2),
      h(4, 2, 0, 2),
      h(6, 2, 0, 2),
      h(8, 2, 0, 2),
      h(10, 2, 0, 2),
      h(12, 2, 2, 2),
      h(14, 2, 3, 2),
      h(16, 1, 0, 2),
      h(18, 1, 0, 2),
      h(20, 1, 0, 2),
      h(22, 1, 0, 2),
      h(24, 1, 0, 2),
      h(26, 1, 0, 2),
      h(28, 1, 0, 2),
      h(30, 1, 0, 2),
    ],
  },
  {
    id: "walking-e",
    title: "Walking Blues in E",
    artist: "Practice",
    bpm: 96,
    bars: 2,
    grid: 16,
    hits: [
      h(0, 3, 0, 2),
      h(2, 3, 3, 2),
      h(4, 3, 4, 2),
      h(6, 3, 3, 2),
      h(8, 3, 0, 2),
      h(10, 3, 3, 2),
      h(12, 3, 4, 2),
      h(14, 3, 3, 2),
      h(16, 2, 0, 2),
      h(18, 2, 2, 2),
      h(20, 2, 3, 2),
      h(22, 2, 2, 2),
      h(24, 2, 0, 2),
      h(26, 2, 2, 2),
      h(28, 2, 3, 2),
      h(30, 2, 2, 2),
    ],
  },
];

export function grooveById(id: string | null): Groove | undefined {
  if (!id) return undefined;
  return GROOVES.find((g) => g.id === id);
}

export function hitsAt(groove: Groove, step: number): Hit[] {
  return groove.hits.filter((hit) => step >= hit.at && step < hit.at + hit.len);
}

export function totalSteps(groove: Groove): number {
  return groove.bars * groove.grid;
}
