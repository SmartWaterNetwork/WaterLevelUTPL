import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Brush,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Table2, LineChart as LineChartIcon, RefreshCw } from 'lucide-react';
import { AlertConfig, Reading, StationState } from '../types';
import { ink, series } from '../theme';
import { axisDateTime, fullDateTime, num } from '../utils/format';

interface HydrographProps {
  station: StationState;
  alerts: AlertConfig[];
  onRefresh: () => void;
  onResultsCountChange: (count: number) => void;
}

type RangeId = '1H' | '6H' | '24H' | '7D' | 'ALL';

const RANGES: { id: RangeId; label: string; ms: number | null }[] = [
  { id: '1H', label: '1 h', ms: 3_600_000 },
  { id: '6H', label: '6 h', ms: 6 * 3_600_000 },
  { id: '24H', label: '24 h', ms: 24 * 3_600_000 },
  { id: '7D', label: '7 d', ms: 7 * 24 * 3_600_000 },
  { id: 'ALL', label: 'Todo', ms: null },
];

const POINT_OPTIONS = [30, 60, 120, 300, 500];

interface TooltipPayloadItem {
  value: number;
  payload: Reading;
}

const ChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  unit: string;
  name: string;
  color: string;
}> = ({ active, payload, label, unit, name, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-hairline rounded-lg shadow-md px-3 py-2 text-[11px]">
      <div className="text-ink-3 tabular-nums">{fullDateTime(label ?? 0)}</div>
      <div className="mt-1 flex items-center gap-1.5 text-ink">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="text-ink-2">{name}</span>
        <span className="font-semibold tabular-nums ml-1">
          {num(payload[0].value, 2)} {unit}
        </span>
      </div>
    </div>
  );
};

/** One measure, one axis. Two of these stacked replace the old dual-axis plot. */
const MeasureChart: React.FC<{
  data: Reading[];
  dataKey: 'level' | 'flow';
  name: string;
  unit: string;
  color: string;
  height: number;
  showXLabels: boolean;
  showBrush: boolean;
  thresholds?: { value: number; label: string; color: string }[];
}> = ({ data, dataKey, name, unit, color, height, showXLabels, showBrush, thresholds = [] }) => {
  const gradientId = `fill-${dataKey}`;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          syncId="hydrograph"
          margin={{ top: 8, right: 16, left: 4, bottom: showXLabels ? 4 : 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.14} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={ink.grid} strokeDasharray="0" vertical={false} />

          <XAxis
            dataKey="tMs"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={axisDateTime}
            stroke={ink.axis}
            tick={showXLabels ? { fill: ink.muted, fontSize: 10 } : false}
            tickLine={false}
            height={showXLabels ? 22 : 6}
            minTickGap={48}
          />

          <YAxis
            stroke={ink.axis}
            tick={{ fill: ink.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={46}
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => num(v, 0)}
          />

          <Tooltip
            content={<ChartTooltip unit={unit} name={name} color={color} />}
            cursor={{ stroke: ink.axis, strokeWidth: 1 }}
          />

          {thresholds.map((t) => (
            <ReferenceLine
              key={t.label}
              y={t.value}
              stroke={t.color}
              strokeDasharray="4 3"
              strokeWidth={1}
              label={{
                value: t.label,
                position: 'insideTopRight',
                fill: t.color,
                fontSize: 10,
              }}
            />
          ))}

          <Area
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, stroke: '#ffffff', strokeWidth: 2 }}
            isAnimationActive={false}
          />

          {showBrush && (
            <Brush
              dataKey="tMs"
              height={20}
              stroke={ink.axis}
              fill="#faf9f7"
              travellerWidth={8}
              tickFormatter={() => ''}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const Hydrograph: React.FC<HydrographProps> = ({
  station,
  alerts,
  onRefresh,
  onResultsCountChange,
}) => {
  const [range, setRange] = useState<RangeId>('ALL');
  const [view, setView] = useState<'CHART' | 'TABLE'>('CHART');

  const { config, readings, isLoading } = station;
  const { levelUnit, flowUnit } = config.settings;

  const data = useMemo(() => {
    const window = RANGES.find((r) => r.id === range)?.ms ?? null;
    if (!window || readings.length === 0) return readings;
    const last = readings[readings.length - 1].tMs;
    return readings.filter((r) => r.tMs >= last - window);
  }, [readings, range]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const levels = data.map((d) => d.level);
    const flows = data.map((d) => d.flow);
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      minLevel: Math.min(...levels),
      maxLevel: Math.max(...levels),
      avgLevel: mean(levels),
      avgFlow: mean(flows),
      maxFlow: Math.max(...flows),
    };
  }, [data]);

  // Level thresholds come from the alert rules so the plot and the alerts agree.
  const levelThresholds = useMemo(
    () =>
      alerts
        .filter((a) => a.enabled && (a.type === 'MAX_LEVEL' || a.type === 'MIN_LEVEL'))
        .map((a) => ({
          value: a.threshold,
          label: a.type === 'MAX_LEVEL' ? `Máx ${a.threshold}` : `Mín ${a.threshold}`,
          color: a.severity === 'critical' ? '#d03b3b' : '#fab219',
        })),
    [alerts]
  );

  const flowThresholds = useMemo(
    () =>
      alerts
        .filter((a) => a.enabled && a.type === 'MAX_FLOW')
        .map((a) => ({
          value: a.threshold,
          label: `Máx ${a.threshold}`,
          color: a.severity === 'critical' ? '#d03b3b' : '#fab219',
        })),
    [alerts]
  );

  const handleExportCsv = () => {
    if (data.length === 0) return;
    const header = ['entry_id', 'fecha_iso', `nivel_${levelUnit}`, `caudal_${flowUnit}`].join(',');
    const rows = data.map((d) => [d.entryId, d.iso, d.level, d.flow].join(','));
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.riverName.replace(/\s+/g, '_').toLowerCase()}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-surface border border-hairline rounded-lg">
      {/* Header + controls: one row above the plots, scoping both of them. */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3 border-b border-hairline">
        <div>
          <h2 className="text-[14px] font-semibold text-ink">
            Hidrograma · {config.riverName}
          </h2>
          <p className="text-[11px] text-ink-3 mt-0.5">
            {data.length} lectura{data.length === 1 ? '' : 's'}
            {readings.length !== data.length && ` de ${readings.length}`} · nivel medido, caudal
            estimado con {config.settings.conversionMode}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center border border-hairline rounded-md overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`px-2.5 py-1 text-[11px] transition-colors ${
                  range === r.id ? 'bg-ink text-white' : 'text-ink-2 hover:bg-[#f7f7f5]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] text-ink-3 border border-hairline rounded-md px-2 py-1">
            Puntos
            <select
              value={config.settings.resultsCount}
              onChange={(e) => onResultsCountChange(Number(e.target.value))}
              className="bg-transparent text-ink font-medium focus:outline-none cursor-pointer tabular-nums"
            >
              {POINT_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center border border-hairline rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setView('CHART')}
              className={`px-2 py-1.5 ${view === 'CHART' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-[#f7f7f5]'}`}
              title="Ver gráfico"
              aria-pressed={view === 'CHART'}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('TABLE')}
              className={`px-2 py-1.5 ${view === 'TABLE' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-[#f7f7f5]'}`}
              title="Ver tabla de datos"
              aria-pressed={view === 'TABLE'}
            >
              <Table2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 border border-hairline rounded-md text-ink-2 hover:text-ink disabled:opacity-40"
            title="Actualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 border border-hairline rounded-md px-2.5 py-1.5 text-[11px] text-ink-2 hover:text-ink disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-[13px] text-ink-2">
            {isLoading ? 'Consultando el canal…' : 'Esta estación aún no tiene lecturas.'}
          </p>
          {!isLoading && (
            <p className="text-[11px] text-ink-3 mt-1.5">
              El canal {config.settings.channelId} responde correctamente pero no ha registrado
              datos{range !== 'ALL' ? ' en el rango seleccionado' : ''}.
            </p>
          )}
        </div>
      ) : view === 'TABLE' ? (
        <div className="max-h-[520px] overflow-auto thin-scroll">
          <table className="w-full text-[11px] tabular-nums">
            <thead className="sticky top-0 bg-surface border-b border-hairline">
              <tr className="text-left text-ink-3">
                <th className="px-4 py-2 font-medium">Fecha y hora</th>
                <th className="px-4 py-2 font-medium text-right">Nivel ({levelUnit})</th>
                <th className="px-4 py-2 font-medium text-right">Caudal ({flowUnit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {[...data].reverse().map((d) => (
                <tr key={d.entryId} className="hover:bg-[#faf9f7]">
                  <td className="px-4 py-1.5 text-ink-2">{fullDateTime(d.tMs)}</td>
                  <td className="px-4 py-1.5 text-right text-ink font-medium">{num(d.level, 2)}</td>
                  <td className="px-4 py-1.5 text-right text-ink">{num(d.flow, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={isLoading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* Top plot: the measured level. */}
          <div className="px-2 pt-3">
            <div className="flex items-baseline gap-2 px-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: series.level }} aria-hidden="true" />
              <h3 className="text-[12px] font-semibold text-ink">Nivel del agua</h3>
              <span className="text-[11px] text-ink-3">{levelUnit}</span>
            </div>
            <MeasureChart
              data={data}
              dataKey="level"
              name="Nivel"
              unit={levelUnit}
              color={series.level}
              height={190}
              showXLabels={false}
              showBrush={false}
              thresholds={levelThresholds}
            />
          </div>

          {/* Bottom plot: flow, on its own axis, sharing the x-domain. */}
          <div className="px-2 pt-2 pb-3 border-t border-hairline mt-2">
            <div className="flex items-baseline gap-2 px-2 mb-1 mt-2">
              <span className="w-2 h-2 rounded-full" style={{ background: series.flow }} aria-hidden="true" />
              <h3 className="text-[12px] font-semibold text-ink">Caudal estimado</h3>
              <span className="text-[11px] text-ink-3">{flowUnit}</span>
            </div>
            <MeasureChart
              data={data}
              dataKey="flow"
              name="Caudal"
              unit={flowUnit}
              color={series.flow}
              height={200}
              showXLabels
              showBrush={data.length > 20}
              thresholds={flowThresholds}
            />
          </div>
        </div>
      )}

      {/* Summary of the visible window. */}
      {stats && (
        <dl className="grid grid-cols-2 sm:grid-cols-5 border-t border-hairline divide-x divide-hairline">
          {[
            { label: 'Nivel mín', value: num(stats.minLevel, 1), unit: levelUnit },
            { label: 'Nivel máx', value: num(stats.maxLevel, 1), unit: levelUnit },
            { label: 'Nivel medio', value: num(stats.avgLevel, 1), unit: levelUnit },
            { label: 'Caudal medio', value: num(stats.avgFlow, 1), unit: flowUnit },
            { label: 'Caudal máx', value: num(stats.maxFlow, 1), unit: flowUnit },
          ].map((s) => (
            <div key={s.label} className="px-4 py-2.5">
              <dt className="eyebrow">{s.label}</dt>
              <dd className="text-[15px] font-semibold text-ink mt-0.5">
                {s.value}
                <span className="text-[11px] font-normal text-ink-3 ml-1">{s.unit}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};
