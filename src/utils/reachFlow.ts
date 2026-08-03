import { StationState } from '../types';
import { levelToStatus, status as statusColor } from '../theme';
import { calculateVelocity } from './flowCalculator';

/**
 * Deriving what a river reach is doing from the stations that gauge it.
 *
 * The rivers of the Loja basin drain north — verified against the vector-tile
 * geometry, whose vertex order runs north for every named reach (Malacatos
 * −0.99, Zamora −0.86 length-weighted). So latitude doubles as the along-flow
 * coordinate: a larger latitude is further downstream.
 */

/** Latitude increases downstream in this basin. */
export const DOWNSTREAM_IS_NORTH = true;

/** Metres per degree of latitude, near enough at this scale. */
const M_PER_DEG_LAT = 111_320;

export type ReachStatus = 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'UNGAUGED';

export interface ReachState {
  status: ReachStatus;
  /** Interpolated level in cm, or null where nothing gauges this reach. */
  levelCm: number | null;
  /** Water velocity in m/s used to pace the wave; 0 when unknown. */
  velocityMps: number;
  /** True when the value comes from two gauges bracketing the reach. */
  interpolated: boolean;
  /** Stations the value was derived from, upstream first. */
  gaugeIds: string[];
}

export const UNGAUGED: ReachState = {
  status: 'UNGAUGED',
  levelCm: null,
  velocityMps: 0,
  interpolated: false,
  gaugeIds: [],
};

function stateOf(station: StationState): ReachState {
  if (!station.latest) return UNGAUGED;
  return {
    status: station.status === 'OFFLINE' ? 'UNGAUGED' : station.status,
    levelCm: station.latest.levelCm,
    velocityMps: calculateVelocity(station.latest.levelCm, station.config.settings),
    interpolated: false,
    gaugeIds: [station.config.id],
  };
}

/**
 * What a reach of `riverToken` at `latitude` is doing.
 *
 * With a single gauge the reach simply inherits its reading. With two gauges on
 * the same river — the Zamora has one upstream and one downstream — a reach
 * between them takes the linear profile of the two, which is the usual
 * first-order reading of a river between gauges; outside the gauged span the
 * nearest reading is carried over rather than extrapolated, since nothing in
 * the data supports continuing the trend.
 */
export function reachStateAt(
  stations: StationState[],
  riverToken: string | null,
  latitude: number
): ReachState {
  if (!riverToken) return UNGAUGED;

  const gauges = stations
    .filter((s) => s.config.matchTokens.includes(riverToken) && s.latest !== null)
    .sort((a, b) => a.config.lat - b.config.lat); // upstream (south) first

  if (gauges.length === 0) return UNGAUGED;
  if (gauges.length === 1) return stateOf(gauges[0]);

  const first = gauges[0];
  const last = gauges[gauges.length - 1];
  if (latitude <= first.config.lat) return stateOf(first);
  if (latitude >= last.config.lat) return stateOf(last);

  for (let i = 0; i < gauges.length - 1; i++) {
    const up = gauges[i];
    const down = gauges[i + 1];
    if (latitude < up.config.lat || latitude > down.config.lat) continue;

    const span = down.config.lat - up.config.lat;
    const t = span === 0 ? 0 : (latitude - up.config.lat) / span;

    const levelCm = up.latest!.levelCm + (down.latest!.levelCm - up.latest!.levelCm) * t;
    const vUp = calculateVelocity(up.latest!.levelCm, up.config.settings);
    const vDown = calculateVelocity(down.latest!.levelCm, down.config.settings);
    const status = levelToStatus(levelCm);

    return {
      status: status === 'OFFLINE' ? 'UNGAUGED' : status,
      levelCm,
      velocityMps: vUp + (vDown - vUp) * t,
      interpolated: true,
      gaugeIds: [up.config.id, down.config.id],
    };
  }

  return stateOf(last);
}

/** Median velocity across the stations that are reporting, in m/s. */
export function networkVelocity(stations: StationState[]): number {
  const values = stations
    .filter((s) => s.latest !== null)
    .map((s) => calculateVelocity(s.latest!.levelCm, s.config.settings))
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  if (values.length === 0) return 0;
  return values[Math.floor(values.length / 2)];
}

/** Resting and crest colours for a reach. The crest is a darker step of the
 *  same hue, so the pulse never changes what the colour means. */
export function reachColors(status: ReachStatus): { rest: string; crest: string } {
  switch (status) {
    case 'ALERTA':
      return { rest: statusColor.ALERTA, crest: '#8f2727' };
    case 'PRECAUCION':
      return { rest: statusColor.PRECAUCION, crest: '#b07c00' };
    case 'NORMAL':
      return { rest: '#9dc0dd', crest: '#2a78d6' };
    default:
      return { rest: '#b9c6cf', crest: '#7d93a3' };
  }
}

/**
 * How much faster than reality the wave travels.
 *
 * A flood wave covers the ~12 km of this network in hours; at true speed nothing
 * would appear to move. This factor puts a crest across a river in a few
 * seconds while keeping the *relative* pace faithful — a river running twice as
 * fast still shows its crest arriving twice as soon. It is also tuned so that
 * roughly one crest is on a river at a time, which is what makes the direction
 * legible; a much larger value would put several crests on screen at once.
 */
export const WAVE_SPEEDUP = 4000;

/** Seconds between two crests passing the same point. */
export const WAVE_PERIOD_S = 5.5;

/**
 * Where the mapped network drains to — the Zamora leaving the basin to the
 * north. Distance to this point, rather than latitude alone, is what orders a
 * reach along the network: it also works for the Jipiro, which runs almost
 * east-west and whose latitude barely changes along its course.
 */
const OUTLET_LAT = -3.93;
const OUTLET_LNG = -79.19;

/** Comfortably longer than any reach-to-outlet distance the map shows. */
const NETWORK_SPAN_M = 18_000;

function distanceToOutletM(latitude: number, longitude: number): number {
  const dLat = (latitude - OUTLET_LAT) * M_PER_DEG_LAT;
  const dLng =
    (longitude - OUTLET_LNG) * M_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

/**
 * Animation delay, in seconds, that makes a reach crest after the travel time
 * its own velocity implies. Reaches further down the network crest later, and
 * that ordering is the whole of the direction cue.
 *
 * The delay is folded into a single period and kept negative, so every reach is
 * already mid-cycle on the first frame — a positive delay would leave the map
 * still for as long as the travel time.
 */
export function waveDelaySeconds(
  latitude: number,
  longitude: number,
  velocityMps: number,
  periodSeconds: number = WAVE_PERIOD_S
): number {
  if (velocityMps <= 0) return 0;
  const metresTravelled = NETWORK_SPAN_M - distanceToOutletM(latitude, longitude);
  const travelSeconds = metresTravelled / (velocityMps * WAVE_SPEEDUP);
  const phase = ((travelSeconds % periodSeconds) + periodSeconds) % periodSeconds;
  return -(periodSeconds - phase);
}
