import type { LineMode, TflLine } from './contracts.js';

export const TFL_MODES: readonly LineMode[] = [
  'tube',
  'elizabeth-line',
  'overground',
  'dlr',
] as const;

export const TFL_LINES: readonly TflLine[] = [
  // Underground Lines (11)
  { id: 'bakerloo', name: 'Bakerloo', mode: 'tube', color: '#B36305' },
  { id: 'central', name: 'Central', mode: 'tube', color: '#E32017' },
  { id: 'circle', name: 'Circle', mode: 'tube', color: '#FFD300' },
  { id: 'district', name: 'District', mode: 'tube', color: '#00782A' },
  { id: 'hammersmith-city', name: 'Hammersmith & City', mode: 'tube', color: '#F3A9BB' },
  { id: 'jubilee', name: 'Jubilee', mode: 'tube', color: '#A0A5A9' },
  { id: 'metropolitan', name: 'Metropolitan', mode: 'tube', color: '#9B0056' },
  { id: 'northern', name: 'Northern', mode: 'tube', color: '#000000', contrastBorder: true },
  { id: 'piccadilly', name: 'Piccadilly', mode: 'tube', color: '#003688' },
  { id: 'victoria', name: 'Victoria', mode: 'tube', color: '#0098D4' },
  { id: 'waterloo-city', name: 'Waterloo & City', mode: 'tube', color: '#95CDBA' },

  // Elizabeth line (1)
  { id: 'elizabeth', name: 'Elizabeth line', mode: 'elizabeth-line', color: '#6950A1' },

  // London Overground Named Lines (6)
  { id: 'lioness', name: 'Lioness line', mode: 'overground', color: '#EE7C0E' },
  { id: 'mildmay', name: 'Mildmay line', mode: 'overground', color: '#EE7C0E' },
  { id: 'windrush', name: 'Windrush line', mode: 'overground', color: '#EE7C0E' },
  { id: 'weaver', name: 'Weaver line', mode: 'overground', color: '#EE7C0E' },
  { id: 'suffragette', name: 'Suffragette line', mode: 'overground', color: '#EE7C0E' },
  { id: 'liberty', name: 'Liberty line', mode: 'overground', color: '#EE7C0E' },

  // Docklands Light Railway (1)
  { id: 'dlr', name: 'DLR', mode: 'dlr', color: '#00A4A7' },
] as const;

export const TFL_LINE_IDS: readonly string[] = TFL_LINES.map((line) => line.id);

export const TFL_LINES_BY_ID: Readonly<Record<string, TflLine>> = Object.freeze(
  TFL_LINES.reduce<Record<string, TflLine>>((acc, line) => {
    acc[line.id] = line;
    return acc;
  }, {}),
);

export function getTflLineById(id: string): TflLine | undefined {
  return TFL_LINES_BY_ID[id];
}

export function isValidLineId(id: string): boolean {
  return id in TFL_LINES_BY_ID;
}

export function getLinesByMode(mode: LineMode): readonly TflLine[] {
  return TFL_LINES.filter((line) => line.mode === mode);
}

export type { LineMode, TflLine };
