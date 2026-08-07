import { LevelUnit, FlowUnit, ConversionMode, ChannelSettings, Reading } from '../types';
import { CrossSectionPoint, crossSectionArea, crossSectionWettedPerimeter, waterCrossSectionPoints } from './crossSection';

/**
 * Wetted area (m²) and wetted perimeter (m) at a given depth — from the
 * station's real surveyed cross-section when there is one, falling back to
 * the configured rectangular approximation (`channelWidth` as a constant
 * width, straight vertical walls) when there isn't. A rectangle was always
 * only a placeholder for "we don't know the real shape yet", not a property
 * of Manning's equation itself — the equation works over any cross-section.
 */
function wettedGeometryAt(
  depthM: number,
  channelWidthM: number,
  crossSection?: CrossSectionPoint[]
): { area: number; wettedPerimeter: number } {
  if (crossSection) {
    const points = waterCrossSectionPoints(crossSection, depthM);
    return { area: crossSectionArea(points), wettedPerimeter: crossSectionWettedPerimeter(points) };
  }
  return { area: channelWidthM * depthM, wettedPerimeter: channelWidthM + 2 * depthM };
}

/**
 * Converts a canonical level in centimetres to the target LevelUnit, for display.
 */
export function convertLevelValue(rawLevelCm: number, targetUnit: LevelUnit): number {
  switch (targetUnit) {
    case 'm':
      return rawLevelCm / 100;
    case 'mm':
      return rawLevelCm * 10;
    case 'in':
      return rawLevelCm / 2.54;
    case 'cm':
    default:
      return rawLevelCm;
  }
}

/**
 * The inverse of convertLevelValue: a sensor's raw field1 value, in whatever
 * unit it actually transmits (sourceUnit), normalised to centimetres — the
 * unit every calculation downstream (Manning, thresholds, gauges) assumes.
 */
export function toCentimeters(rawValue: number, sourceUnit: LevelUnit): number {
  switch (sourceUnit) {
    case 'm':
      return rawValue * 100;
    case 'mm':
      return rawValue / 10;
    case 'in':
      return rawValue * 2.54;
    case 'cm':
    default:
      return rawValue;
  }
}

/**
 * Calculates flow rate (Q) based on water level (H in cm) and hydraulic configuration.
 * Returns flow rate in L/s by default, or converted to target FlowUnit.
 */
export function calculateFlowRate(
  rawLevelCm: number,
  settings: ChannelSettings,
  crossSection?: CrossSectionPoint[]
): number {
  const depthM = Math.max(0, rawLevelCm / 100); // Depth in meters
  if (depthM <= 0) return 0;

  let flowLps = 0; // Flow rate in Liters per second

  switch (settings.conversionMode) {
    case 'MANNING': {
      // Manning's equation, over the real cross-section when there is one:
      // Q = (1/n) * A * R^(2/3) * S^(1/2), R = A / P
      const B = Math.max(0.1, settings.channelWidth || 0.5); // meters width, fallback only
      const n = Math.max(0.005, settings.manningN || 0.013); // roughness
      const S = Math.max(0.0001, settings.channelSlope || 0.002); // slope

      const { area: A, wettedPerimeter: P } = wettedGeometryAt(depthM, B, crossSection);
      if (A <= 0 || P <= 0) {
        flowLps = 0;
        break;
      }
      const R = A / P;

      const Q_m3s = (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S);
      flowLps = Q_m3s * 1000; // m3/s to L/s
      break;
    }

    case 'WEIR': {
      // Francis formula for rectangular suppressed weir:
      // Q = 1.84 * L * H^(1.5) in m3/s
      //
      // H is head *above the crest*, not raw depth: a weir holds back a pool,
      // so depth below the crest is dead storage that never spills. Without
      // subtracting it, every reading below the crest would still report a
      // (small, wrong) flow, and every reading above it would overstate H by
      // the full crest height.
      const L = Math.max(0.1, settings.channelWidth || 0.5);
      const crestM = Math.max(0, (settings.weirCrestHeight || 0) / 100);
      const headM = Math.max(0, depthM - crestM);
      const Q_m3s = 1.84 * L * Math.pow(headM, 1.5);
      flowLps = Q_m3s * 1000;
      break;
    }

    case 'LINEAR': {
      // Q (L/s) = H (cm) * factor
      flowLps = rawLevelCm * (settings.linearFactor || 2.5);
      break;
    }

    case 'DIRECT':
    default: {
      // Direct raw reading treated as flow or standard calibration Q = 2.8 * H^1.2
      flowLps = rawLevelCm * 2.8;
      break;
    }
  }

  // Convert L/s to target flow unit
  return convertFlowUnit(flowLps, settings.flowUnit);
}

/**
 * Mean flow velocity in the channel, in m/s.
 *
 * With Manning this is the equation's own velocity term, v = (1/n)·R^(2/3)·S^(1/2);
 * for the other conversions it falls back to continuity, v = Q / A. It is what
 * drives how fast the river animation moves downstream on the map.
 */
export function calculateVelocity(
  rawLevelCm: number,
  settings: ChannelSettings,
  crossSection?: CrossSectionPoint[]
): number {
  const depthM = Math.max(0, rawLevelCm / 100);
  if (depthM <= 0) return 0;

  const B = Math.max(0.1, settings.channelWidth || 0.5);

  if (settings.conversionMode === 'MANNING') {
    const n = Math.max(0.005, settings.manningN || 0.013);
    const S = Math.max(0.0001, settings.channelSlope || 0.002);
    const { area: A, wettedPerimeter: P } = wettedGeometryAt(depthM, B, crossSection);
    if (A <= 0 || P <= 0) return 0;
    const R = A / P;
    return (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S);
  }

  // Continuity, v = Q / A — real wetted area when available, independent of
  // which formula estimated Q (the weir/linear/direct formulas above are
  // untouched; only the area behind this velocity figure gets more accurate).
  const { area: A } = wettedGeometryAt(depthM, B, crossSection);
  if (A <= 0) return 0;
  // calculateFlowRate returns the configured unit, so ask it for L/s explicitly.
  const flowLps = calculateFlowRate(rawLevelCm, { ...settings, flowUnit: 'L/s' }, crossSection);
  return flowLps / 1000 / A;
}

/**
 * How fast the level is rising, in cm per hour, over the last `windowMinutes`.
 *
 * Compares the latest reading against the oldest one still inside the window
 * rather than the previous sample, so a single noisy point can't swing the
 * result — the signal this is meant to catch (a weir choking on debris, a
 * pump station backing up) is a *sustained* rise, not a one-sample jitter.
 * Returns null when there isn't yet enough history to say.
 */
export function levelRateOfChange(readings: Reading[], windowMinutes: number): number | null {
  if (readings.length < 2) return null;
  const latest = readings[readings.length - 1];
  const cutoff = latest.tMs - windowMinutes * 60_000;
  const past = readings.find((r) => r.tMs >= cutoff);
  if (!past || past.tMs === latest.tMs) return null;

  const hours = (latest.tMs - past.tMs) / 3_600_000;
  return (latest.levelCm - past.levelCm) / hours;
}

/**
 * Converts flow rate from L/s to desired unit.
 */
export function convertFlowUnit(flowLps: number, targetUnit: FlowUnit): number {
  switch (targetUnit) {
    case 'm3/s':
      return flowLps / 1000;
    case 'm3/h':
      return (flowLps * 3600) / 1000;
    case 'GPM':
      return flowLps * 15.8503;
    case 'L/s':
    default:
      return flowLps;
  }
}

/**
 * Plays an audio alert chime using Web Audio API synthesizer (no external mp3 file needed).
 */
export function playAlertChime(severity: 'critical' | 'warning' | 'info' = 'warning') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (severity === 'critical') {
      // Double alarm beep
      const freqs = [880, 1108, 880, 1108];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.15 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + idx * 0.15 + 0.12);
      });
    } else {
      // Gentle notification chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn("Could not play alert audio chime:", e);
  }
}

/**
 * Requests browser push notification permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn("This browser does not support desktop notifications.");
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

/**
 * Triggers a browser push notification if permission granted.
 */
export function triggerPushNotification(title: string, body: string, iconUrl?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: iconUrl || '/icon.png',
        tag: 'water-sensor-alert',
      });
    } catch (err) {
      console.warn("Push notification error:", err);
    }
  }
}
