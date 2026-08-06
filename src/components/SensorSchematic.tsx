import React, { Suspense, lazy, useState } from 'react';
import { Box, Layers } from 'lucide-react';
import { StationState } from '../types';
import { series } from '../theme';
import { num } from '../utils/format';
import { CATCHMENT_AREA_KM2 } from '../data/catchmentAreas';
import { STATION_CROSS_SECTIONS } from '../data/stationCrossSections';

// Three.js is ~1 MB and only the optional 3D view needs it, so it stays out of
// the initial bundle that the map and the charts depend on.
const ThreeDChannelCanvas = lazy(() =>
  import('./ThreeDChannelCanvas').then((m) => ({ default: m.ThreeDChannelCanvas }))
);

interface SensorSchematicProps {
  station: StationState;
}

const SPECS: [string, string][] = [
  ['Rango de medición', '0.1 m – 15 m'],
  ['Incertidumbre', '±1 mm'],
  ['Protección', 'IP68 (sumergible)'],
  ['Alimentación', '18–28 V DC'],
  ['Ángulo de haz', '6°'],
];

/** Cross-section of the channel with the sensor cotas OC / FC / OF marked. */
const CutawayDiagram: React.FC<{
  levelCm: number;
  installationHeightCm: number;
  emptyHeightCm: number;
  fillPercentage: number;
}> = ({ levelCm, installationHeightCm, emptyHeightCm, fillPercentage }) => {
  const maxY = 100;
  const minY = 300;
  const waterY = minY - (fillPercentage / 100) * (minY - maxY);
  const widthFactor = (300 - waterY) / 220;
  const leftX = 100 - widthFactor * 80;
  const rightX = 400 + widthFactor * 80;

  return (
    <svg
      className="w-full h-full"
      viewBox="0 0 500 330"
      role="img"
      aria-label={`Corte del canal con el nivel de agua en ${levelCm.toFixed(1)} centímetros sobre una altura de instalación de ${installationHeightCm} centímetros`}
    >
      <defs>
        <linearGradient id="cutaway-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series.level} stopOpacity="0.55" />
          <stop offset="100%" stopColor={series.level} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="cutaway-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={series.level} stopOpacity="0.22" />
          <stop offset="100%" stopColor={series.level} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Ground and channel walls */}
      <rect x="20" y="240" width="80" height="70" fill="#eceae4" />
      <rect x="400" y="240" width="80" height="70" fill="#eceae4" />
      <polygon points="20,80 100,240 100,300 20,300" fill="#ddd9cf" />
      <polygon points="480,80 400,240 400,300 480,300" fill="#ddd9cf" />
      <line x1="100" y1="300" x2="400" y2="300" stroke="#a9a599" strokeWidth="2" />

      {/* Water body */}
      <polygon points={`${leftX},${waterY} ${rightX},${waterY} 400,300 100,300`} fill="url(#cutaway-water)" />
      <line x1={leftX} y1={waterY} x2={rightX} y2={waterY} stroke={series.level} strokeWidth="2" />

      {/* Radar beam */}
      <polygon points={`250,58 ${leftX + 20},${waterY} ${rightX - 20},${waterY}`} fill="url(#cutaway-beam)" />

      {/* Sensor mount: cantilevered from the left bank only — a footing and
          post rooted in the ground, matching the real installation, not a
          structure spanning the channel. */}
      <rect x="10" y="68" width="28" height="14" fill="#94a3b8" rx="1" />
      <line x1="24" y1="68" x2="24" y2="12" stroke="#6c6a63" strokeWidth="4" strokeLinecap="round" />
      <line x1="24" y1="42" x2="46" y2="14" stroke="#6c6a63" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="17" y="5" width="14" height="10" fill="#4a4841" rx="1" />

      {/* Sensor body */}
      <path d="M24,12 L250,12 L250,34" stroke="#8a877e" strokeWidth="3" fill="none" />
      <rect x="238" y="24" width="24" height="8" fill="#3a3935" />
      <rect x="230" y="32" width="40" height="20" fill="#25241f" rx="2" />
      <rect x="236" y="52" width="28" height="7" fill="#4a4841" />
      <polygon points="236,59 264,59 250,68" fill="#6c6a63" />

      {/* Cotas */}
      <line x1="170" y1="34" x2="170" y2={waterY} stroke="#898781" strokeWidth="1" strokeDasharray="4 3" />
      <text x="126" y={(34 + waterY) / 2} fill="#52514e" fontSize="10">
        OF {emptyHeightCm.toFixed(1)} cm
      </text>

      <line x1="170" y1={waterY} x2="170" y2="300" stroke={series.level} strokeWidth="1.5" />
      <text x="120" y={(waterY + 300) / 2} fill={series.level} fontSize="10" fontWeight="600">
        FC {levelCm.toFixed(1)} cm
      </text>

      <line x1="52" y1="34" x2="52" y2="300" stroke="#c3c2b7" strokeWidth="1" strokeDasharray="3 3" />
      <text x="14" y="180" fill="#898781" fontSize="9" transform="rotate(-90 20 180)">
        OC {installationHeightCm} cm
      </text>

      {/* Key points */}
      <circle cx="250" cy="34" r="3.5" fill="#d03b3b" />
      <text x="256" y="30" fill="#d03b3b" fontSize="10" fontWeight="600">
        O
      </text>
      <circle cx="250" cy={waterY} r="3.5" fill={series.level} />
      <text x="256" y={waterY + 12} fill={series.level} fontSize="10" fontWeight="600">
        F
      </text>
    </svg>
  );
};

/**
 * The physical side of the reading: how the radar sensor sits above the channel
 * and what the current level means against its installation height.
 */
export const SensorSchematic: React.FC<SensorSchematicProps> = ({ station }) => {
  const [view, setView] = useState<'3D' | '2D'>('2D');
  const { config, latest } = station;
  const { settings } = config;

  const levelCm = latest?.levelCm ?? 0;
  const installationHeightCm = settings.installationHeight || 100;
  const emptyHeightCm = Math.max(0, installationHeightCm - levelCm);
  const fillPercentage = Math.min(100, Math.max(0, (levelCm / installationHeightCm) * 100));
  const catchmentAreaKm2 = CATCHMENT_AREA_KM2[config.id];
  const hasCrossSection = Boolean(STATION_CROSS_SECTIONS[config.id]);

  return (
    <section className="bg-surface border border-hairline rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-hairline">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Sensor y canal</h2>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Radar sobre canal abierto · {config.name} · {config.locationName}
          </p>
        </div>

        <div className="flex items-center border border-hairline rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setView('2D')}
            aria-pressed={view === '2D'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              view === '2D' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Corte 2D
          </button>
          <button
            type="button"
            onClick={() => setView('3D')}
            aria-pressed={view === '3D'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              view === '3D' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Vista 3D
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-4">
        <div className="lg:col-span-7">
          {latest === null && (
            <p className="text-[11px] text-ink-3 mb-2">
              Sin lecturas: el esquema se dibuja con el canal vacío.
            </p>
          )}

          {view === '3D' ? (
            <Suspense
              fallback={
                <div className="h-[340px] flex items-center justify-center bg-hover-soft border border-hairline rounded-md text-[12px] text-ink-3">
                  Cargando vista 3D…
                </div>
              }
            >
              <ThreeDChannelCanvas
                // A scene built for one station's real terrain has no sane way
                // to morph into another's — remount cleanly instead of trying
                // to update the Three.js scene in place when the station changes.
                key={config.id}
                currentRawLevelCm={levelCm}
                installationHeightCm={installationHeightCm}
                levelUnit={settings.levelUnit}
                showKeyPoints
                stationName={config.name}
                riverName={config.riverName}
                locationName={config.locationName}
                coordinates={{ lat: config.lat, lng: config.lng }}
                crossSection={STATION_CROSS_SECTIONS[config.id]}
              />
            </Suspense>
          ) : (
            <div className="h-[340px] bg-hover-soft border border-hairline rounded-md">
              <CutawayDiagram
                levelCm={levelCm}
                installationHeightCm={installationHeightCm}
                emptyHeightCm={emptyHeightCm}
                fillPercentage={fillPercentage}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Level against the installation height. */}
          <div>
            <div className="eyebrow">Nivel actual (FC)</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[32px] leading-none font-semibold text-ink">
                {latest ? num(latest.level, 2) : '—'}
              </span>
              <span className="text-[13px] text-ink-3">{settings.levelUnit}</span>
            </div>

            <div className="mt-3 h-1.5 rounded-full bg-[#eceae4] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${fillPercentage}%`, background: series.level }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-ink-3 mt-1.5 tabular-nums">
              <span>Ocupación {num(fillPercentage, 1)}%</span>
              <span>Vacío (OF) {num(emptyHeightCm, 1)} cm</span>
            </div>
          </div>

          <div className="border-t border-hairline pt-4">
            <div className="eyebrow">Caudal estimado (Q)</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-[24px] leading-none font-semibold" style={{ color: series.flow }}>
                {latest ? num(latest.flow, 2) : '—'}
              </span>
              <span className="text-[13px] text-ink-3">{settings.flowUnit}</span>
            </div>
            <p className="text-[11px] text-ink-3 mt-2 leading-relaxed">
              {settings.conversionMode === 'MANNING'
                ? hasCrossSection
                  ? `Manning sobre la sección real del DEM · pendiente ${settings.channelSlope} · n ${settings.manningN}`
                  : `Manning en canal rectangular (sin sección real aún) · ancho ${settings.channelWidth} m · pendiente ${settings.channelSlope} · n ${settings.manningN}`
                : settings.conversionMode === 'WEIR'
                ? `Vertedero rectangular · cresta ${settings.channelWidth} m`
                : `Factor lineal k = ${settings.linearFactor}`}
            </p>
          </div>

          <dl className="border-t border-hairline pt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]">
            <div>
              <dt className="text-ink-3">Área de cuenca</dt>
              <dd className="text-ink font-medium mt-0.5">
                {catchmentAreaKm2 !== undefined ? `${num(catchmentAreaKm2, 2)} km²` : '—'}
              </dd>
            </div>
            {SPECS.map(([label, value]) => (
              <div key={label}>
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-ink font-medium mt-0.5">{value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-ink-3">Interfaz</dt>
              <dd className="text-ink font-medium mt-0.5">{settings.communicationType}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
};
