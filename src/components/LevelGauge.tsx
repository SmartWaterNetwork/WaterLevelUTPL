import React from 'react';
import { LevelThresholds } from '../types';
import { StatusKey } from '../theme';
import { gaugeFillPct, gaugeColor } from '../utils/levelGauge';

interface LevelGaugeProps {
  /** Raw sensor depth, always centimetres — same field the thresholds are in,
   *  regardless of what unit the station displays. */
  levelCm: number | null;
  thresholds: LevelThresholds;
  status: StatusKey;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * A small bounded "tube" — how full the channel is against its own
 * precaución/alerta thresholds. Meant to be read in a glance down the
 * station list, alongside the status dot and the sparkline rather than
 * instead of them: this answers "how close to the limit", not "which way is
 * the trend going".
 */
export const LevelGauge: React.FC<LevelGaugeProps> = ({
  levelCm,
  thresholds,
  status,
  width = 12,
  height = 36,
  className = '',
}) => {
  const hasData = levelCm !== null && status !== 'OFFLINE';
  const pct = hasData ? gaugeFillPct(levelCm as number, thresholds) : 0;
  const precaucionPct = gaugeFillPct(thresholds.precaucion, thresholds);
  const alertaPct = gaugeFillPct(thresholds.alerta, thresholds);
  const color = gaugeColor(status);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[2px] border border-hairline bg-page ${className}`}
      style={{ width, height }}
      role="img"
      aria-label={
        hasData
          ? `Nivel ${levelCm} cm de ${thresholds.alerta} cm (umbral de alerta)`
          : 'Sin lectura de nivel'
      }
    >
      {/* Threshold ticks, under the fill so they stay visible once it rises;
          coloured to match their own state so they read without a legend. */}
      <span className="absolute left-0 right-0 h-px bg-warn/70" style={{ bottom: `${precaucionPct}%` }} />
      <span className="absolute left-0 right-0 h-px bg-crit/70" style={{ bottom: `${alertaPct}%` }} />

      {hasData && pct > 0 && (
        <div
          className="absolute left-0 right-0 bottom-0"
          style={{ height: `${pct}%`, backgroundColor: color, opacity: 0.82 }}
        >
          <span className="absolute inset-x-0 top-0 h-px bg-white/60" />
        </div>
      )}
    </div>
  );
};
