import { StationState } from '../types';
import { status as statusColor } from '../theme';
import { calculateVelocity } from './flowCalculator';
import { STATION_CROSS_SECTIONS } from '../data/stationCrossSections';

/**
 * How a gauge's reading is carried onto the river network.
 *
 * A gauge only tells you about water that has already passed it, so what it
 * describes is the channel *downstream* of itself, up to the next gauge. That
 * is the rule used here: every reach is governed by the nearest gauge upstream
 * of it along the network, and reaches with no gauge upstream carry no state.
 *
 * Station names are deliberately not used. The layer's own geometry shows the
 * four stations do not sit on the watercourses their names claim — station 02,
 * labelled "Río Zamora", is 10 m from the Quebrada Shushuhuaycu and nowhere
 * near the Zamora — so attribution is done by position on the network instead.
 */

export type ReachStatus = 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'UNGAUGED';

/** Only a raised state animates, so movement on the map always means a warning. */
export function isRaised(status: ReachStatus): boolean {
  return status === 'PRECAUCION' || status === 'ALERTA';
}

export function statusOf(station: StationState | undefined): ReachStatus {
  if (!station || !station.latest || station.status === 'OFFLINE') return 'UNGAUGED';
  return station.status;
}

/** Water velocity the gauge implies, in m/s; 0 when it is not reporting. */
export function velocityOf(station: StationState | undefined): number {
  if (!station?.latest) return 0;
  const crossSection = STATION_CROSS_SECTIONS[station.config.id];
  return calculateVelocity(station.latest.levelCm, station.config.settings, crossSection);
}

/** A desarenador or similar built basin — a structure, not a watercourse —
 *  drawn in this hue whenever it isn't actively raised, so it reads as
 *  infrastructure at a glance rather than blending into the plain river blue. */
export const STRUCTURE_COLOR = '#7570b3';

/**
 * Resting and crest colours. The crest is a darker step of the same hue, so the
 * pulse never changes what the colour means.
 *
 * `isStructure` only affects the calm case: a real warning still takes the
 * usual amber/red regardless of what the reach is built as, since the alert
 * colour is a safety signal and a structure's own identity isn't.
 */
export function reachColors(status: ReachStatus, isStructure: boolean = false): { rest: string; crest: string } {
  switch (status) {
    case 'ALERTA':
      return { rest: statusColor.ALERTA, crest: '#8f2727' };
    case 'PRECAUCION':
      return { rest: statusColor.PRECAUCION, crest: '#b07c00' };
    default:
      if (isStructure) return { rest: STRUCTURE_COLOR, crest: STRUCTURE_COLOR };
      // Normal and ungauged reaches are the same quiet hairline: a gauge
      // reading "normal" is not a statement worth colouring the map for.
      return { rest: '#9dc0dd', crest: '#2a78d6' };
  }
}

export function reachWeight(status: ReachStatus): number {
  if (status === 'ALERTA') return 2.6;
  if (status === 'PRECAUCION') return 2.2;
  return 1.5;
}

/**
 * How much faster than reality the crest travels.
 *
 * A flood wave takes hours to cover the ~12 km of this network; at true speed
 * nothing would appear to move. The factor is tuned so a crest crosses a river
 * in a few seconds, while the *relative* pace stays faithful — a river running
 * twice as fast still shows its crest arriving twice as soon.
 */
export const WAVE_SPEEDUP = 4000;

/** Seconds between two crests passing the same point. */
export const WAVE_PERIOD_S = 5.5;

/**
 * Animation delay for a reach that lies `distanceFromGaugeM` downstream of the
 * gauge that governs it. The crest leaves the gauge and arrives later the
 * further down the network it goes, which is the whole of the direction cue.
 *
 * The delay is folded into a single period and kept negative so every reach is
 * already mid-cycle on the first frame; a positive delay would leave the map
 * still for as long as the travel time.
 */
export function waveDelaySeconds(
  distanceFromGaugeM: number,
  velocityMps: number,
  periodSeconds: number = WAVE_PERIOD_S
): number {
  if (velocityMps <= 0) return 0;
  const travelSeconds = distanceFromGaugeM / (velocityMps * WAVE_SPEEDUP);
  const phase = ((travelSeconds % periodSeconds) + periodSeconds) % periodSeconds;
  return -(periodSeconds - phase);
}
