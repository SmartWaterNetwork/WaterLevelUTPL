import { LevelUnit, FlowUnit, ConversionMode, ChannelSettings } from '../types';

/**
 * Converts water level reading (assumed in raw cm from sensor field1) to the target LevelUnit.
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
 * Calculates flow rate (Q) based on water level (H in cm) and hydraulic configuration.
 * Returns flow rate in L/s by default, or converted to target FlowUnit.
 */
export function calculateFlowRate(
  rawLevelCm: number,
  settings: ChannelSettings
): number {
  const depthM = Math.max(0, rawLevelCm / 100); // Depth in meters
  if (depthM <= 0) return 0;

  let flowLps = 0; // Flow rate in Liters per second

  switch (settings.conversionMode) {
    case 'MANNING': {
      // Manning's equation for rectangular open channel:
      // Q = (1/n) * A * R^(2/3) * S^(1/2)
      // A = B * H
      // P = B + 2H
      // R = A / P
      const B = Math.max(0.1, settings.channelWidth || 0.5); // meters width
      const n = Math.max(0.005, settings.manningN || 0.013); // roughness
      const S = Math.max(0.0001, settings.channelSlope || 0.002); // slope

      const A = B * depthM;
      const P = B + 2 * depthM;
      const R = A / P;

      const Q_m3s = (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(S);
      flowLps = Q_m3s * 1000; // m3/s to L/s
      break;
    }

    case 'WEIR': {
      // Francis formula for rectangular suppressed weir:
      // Q = 1.84 * L * H^(1.5) in m3/s
      const L = Math.max(0.1, settings.channelWidth || 0.5);
      const Q_m3s = 1.84 * L * Math.pow(depthM, 1.5);
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
