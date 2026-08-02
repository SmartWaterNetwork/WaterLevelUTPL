import React from 'react';
import { StationState } from '../types';
import { series, status as statusColor, statusLabel, LEVEL_THRESHOLDS } from '../theme';
import { num, relativeTime } from '../utils/format';
import { Sparkline } from './Sparkline';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

interface StationPanelProps {
  stations: StationState[];
  activeId: string;
  onSelect: (id: string) => void;
}

const trendIcon = {
  RISING: ArrowUpRight,
  FALLING: ArrowDownRight,
  STABLE: Minus,
} as const;

const trendLabel = {
  RISING: 'Subiendo',
  FALLING: 'Bajando',
  STABLE: 'Estable',
} as const;

const StationRow: React.FC<{
  station: StationState;
  isActive: boolean;
  onSelect: (id: string) => void;
}> = ({ station, isActive, onSelect }) => {
  const { config, latest, readings, status, trend, isStale, isEmpty, error } = station;
  const TrendIcon = trendIcon[trend];
  const hasData = latest !== null;
  const levels = readings.map((r) => r.level);

  return (
    <button
      type="button"
      onClick={() => onSelect(config.id)}
      aria-pressed={isActive}
      className={`w-full text-left px-4 py-3.5 border-l-2 transition-colors ${
        isActive
          ? 'border-l-ink bg-[#f7f7f5]'
          : 'border-l-transparent hover:bg-[#faf9f7]'
      }`}
    >
      {/* Identity + state. The dot never carries the state on its own. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-ink truncate">{config.riverName}</div>
          <div className="text-[11px] text-ink-3 truncate">
            {config.name} · {config.locationName}
          </div>
        </div>

        <span className="flex items-center gap-1.5 shrink-0 pt-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: statusColor[status] }}
            aria-hidden="true"
          />
          <span className="text-[10px] font-semibold text-ink-2 whitespace-nowrap">
            {statusLabel[status]}
          </span>
        </span>
      </div>

      {hasData ? (
        <>
          {/* Readings. Level leads; flow is derived from it. */}
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex items-baseline gap-4">
              <div>
                <div className="text-[22px] leading-none font-semibold text-ink">
                  {num(latest.level, 1)}
                  <span className="text-[12px] font-normal text-ink-3 ml-1">
                    {config.settings.levelUnit}
                  </span>
                </div>
                <div className="eyebrow mt-1.5">Nivel</div>
              </div>

              <div>
                <div className="text-[15px] leading-none font-semibold" style={{ color: series.flow }}>
                  {num(latest.flow, 1)}
                  <span className="text-[11px] font-normal text-ink-3 ml-1">
                    {config.settings.flowUnit}
                  </span>
                </div>
                <div className="eyebrow mt-1.5">Caudal</div>
              </div>
            </div>

            <Sparkline
              values={levels}
              color={series.level}
              threshold={config.settings.levelUnit === 'cm' ? LEVEL_THRESHOLDS.alerta : undefined}
              width={104}
              height={30}
              className="shrink-0 mb-0.5"
            />
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-3">
            <span className="flex items-center gap-1">
              <TrendIcon className="w-3 h-3" aria-hidden="true" />
              {trendLabel[trend]}
            </span>
            <span className={isStale ? 'text-crit font-medium' : ''}>
              {isStale && '⚠ '}
              {relativeTime(latest.tMs)}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 text-[11px] text-ink-3 leading-relaxed">
          {error
            ? `No se pudo leer el canal ${config.settings.channelId}.`
            : isEmpty
            ? `El canal ${config.settings.channelId} está creado pero aún no ha recibido lecturas.`
            : 'Consultando canal…'}
        </div>
      )}
    </button>
  );
};

/**
 * The persistent right-hand rail: the whole network at a glance, and the
 * control that picks which station the map and the charts are about.
 */
export const StationPanel: React.FC<StationPanelProps> = ({ stations, activeId, onSelect }) => {
  const withData = stations.filter((s) => s.latest !== null).length;

  return (
    <aside className="flex flex-col h-full bg-surface border-l border-hairline">
      <div className="px-4 py-3 border-b border-hairline">
        <h2 className="text-[13px] font-semibold text-ink">Estaciones</h2>
        <p className="text-[11px] text-ink-3 mt-0.5">
          {withData} de {stations.length} transmitiendo
        </p>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll divide-y divide-hairline">
        {stations.map((station) => (
          <StationRow
            key={station.config.id}
            station={station}
            isActive={station.config.id === activeId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="px-4 py-3 border-t border-hairline text-[10px] text-ink-3 leading-relaxed">
        Umbrales de nivel · Precaución {LEVEL_THRESHOLDS.precaucion} cm · Alerta{' '}
        {LEVEL_THRESHOLDS.alerta} cm
      </div>
    </aside>
  );
};
