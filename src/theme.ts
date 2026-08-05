import { LevelThresholds } from './types';

/**
 * Design tokens shared by CSS (see index.css) and by everything that draws
 * outside of Tailwind: Recharts, D3, Leaflet markers, inline SVG.
 *
 * Palette validated with the data-viz six checks on a white chart surface:
 * adjacent CVD ΔE 23.1, normal-vision ΔE 24.0. `flow` sits below 3:1 against
 * white, so every chart that uses it carries a visible title/label rather than
 * relying on the colour alone.
 */

/** Neutral chrome — warm greys, one shade apart. */
export const ink = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  hairline: '#e4e3dd',
  surface: '#ffffff',
  page: '#f4f4f2',
  // Mirrors --color-tint / --color-hover / --color-hover-soft in index.css —
  // for the few places (Recharts, inline SVG) that need a literal value
  // instead of a Tailwind class.
  tint: '#f2f1ee',
  hover: '#f7f7f5',
  hoverSoft: '#faf9f7',
} as const;

/** The two measured series. Level is the primary; flow is derived from it. */
export const series = {
  level: '#2a78d6',
  flow: '#1baf7a',
} as const;

/** Reserved for state — never reused as a series colour. */
export const status = {
  NORMAL: '#0ca30c',
  PRECAUCION: '#fab219',
  ALERTA: '#d03b3b',
  OFFLINE: '#898781',
} as const;

export type StatusKey = keyof typeof status;

/** Spanish labels for each state; always shown next to the colour dot. */
export const statusLabel: Record<StatusKey, string> = {
  NORMAL: 'Normal',
  PRECAUCION: 'Precaución',
  ALERTA: 'Alerta',
  OFFLINE: 'Sin datos',
};

/**
 * Network defaults for the level thresholds (cm) that drive the station state.
 * Kept here so the map, the panel and the charts can never disagree about what
 * "Precaución" means. A station stored in the database carries its own pair —
 * a 58 cm rise means something different in a 0.4 m gully than in the Zamora —
 * and these apply to anything that does not.
 */
export const LEVEL_THRESHOLDS: LevelThresholds = {
  precaucion: 58,
  alerta: 70,
};

export function levelToStatus(
  levelCm: number | null,
  thresholds: LevelThresholds = LEVEL_THRESHOLDS
): StatusKey {
  if (levelCm === null || Number.isNaN(levelCm)) return 'OFFLINE';
  if (levelCm >= thresholds.alerta) return 'ALERTA';
  if (levelCm >= thresholds.precaucion) return 'PRECAUCION';
  return 'NORMAL';
}

/** A reading older than this is shown as stale rather than as "en vivo". */
export const STALE_AFTER_MS = 60 * 60 * 1000;
