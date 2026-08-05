import { LevelThresholds } from '../types';
import { status as statusColor, series, StatusKey } from '../theme';

/**
 * Shared by the bounded level gauge in both places it's drawn: StationPanel
 * (a React component) and MapPanel's marker (a raw HTML string, since Leaflet
 * divIcons aren't React). Kept here once so the fill math and the colour rule
 * can't drift between the two.
 */

/** The tube's top represents this multiple of `alerta`, so a reading right at
 *  the threshold still leaves visible headroom instead of looking capped. */
export const GAUGE_HEADROOM = 1.2;

export function gaugeFillPct(valueCm: number, thresholds: LevelThresholds): number {
  const max = thresholds.alerta * GAUGE_HEADROOM;
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (valueCm / max) * 100));
}

/**
 * Normal water is just water — blue, the same hue the level series already
 * uses elsewhere. Only a real Precaución/Alerta switches the tube to the
 * warning colour; nothing here is tied to the status dot's green, which
 * marks "no active alert" rather than "this is what water looks like".
 */
export function gaugeColor(status: StatusKey): string {
  if (status === 'PRECAUCION' || status === 'ALERTA') return statusColor[status];
  return series.level;
}
