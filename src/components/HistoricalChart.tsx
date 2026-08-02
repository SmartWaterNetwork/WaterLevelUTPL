import React, { useState, useMemo, useEffect, useRef } from 'react';
import Dygraph from 'dygraphs';
import 'dygraphs/dist/dygraph.css';
import { ThingSpeakFeed, ChannelSettings, AlertConfig } from '../types';
import { convertLevelValue, calculateFlowRate } from '../utils/flowCalculator';
import {
  Calendar,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  ZoomOut,
  Sliders,
  Clock,
  Play,
  BarChart2,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Brush,
} from 'recharts';

interface HistoricalChartProps {
  feeds: ThingSpeakFeed[];
  isLoading: boolean;
  onRefresh: () => void;
  resultsCount: number;
  onResultsCountChange: (count: number) => void;
  settings: ChannelSettings;
  alerts: AlertConfig[];
}

const formatDateToLocalInput = (d: Date): string => {
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatFullDateEs = (ms: number): string => {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatAxisDateEs = (d: Date | number): string => {
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Custom Tooltip for Recharts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomRechartsTooltip = ({ active, payload, label, settings }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-900/95 text-white p-3.5 rounded-xl border border-slate-700 shadow-xl text-xs space-y-2 backdrop-blur-md">
      <div className="font-mono text-slate-300 border-b border-slate-800 pb-1 text-[11px] font-semibold">
        {label}
      </div>
      <div className="space-y-1 font-mono">
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              <span>{item.name}:</span>
            </div>
            <span className="font-extrabold text-sm" style={{ color: item.color }}>
              {item.value} {item.dataKey === 'level' ? settings.levelUnit : settings.flowUnit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  feeds,
  isLoading,
  onRefresh,
  resultsCount,
  onResultsCountChange,
  settings,
  alerts,
}) => {
  const [activeMetric, setActiveMetric] = useState<'BOTH' | 'LEVEL' | 'FLOW'>('BOTH');
  const [engineMode, setEngineMode] = useState<'VECTOR' | 'DYGRAPHS'>('VECTOR');
  const [showThresholds, setShowThresholds] = useState<boolean>(true);

  // Date range filters state
  const [startFilter, setStartFilter] = useState<string>('');
  const [endFilter, setEndFilter] = useState<string>('');
  const [activePreset, setActivePreset] = useState<string>('ALL');

  const chartRef = useRef<HTMLDivElement | null>(null);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const dygraphInstanceRef = useRef<Dygraph | null>(null);

  // Process feeds into structured chart data points
  const chartData = useMemo(() => {
    return feeds
      .filter((feed) => feed.field1 !== null && feed.field1 !== undefined && !isNaN(Number(feed.field1)))
      .map((feed) => {
        const rawLevel = Number(feed.field1);
        const level = convertLevelValue(rawLevel, settings.levelUnit);
        const flow = calculateFlowRate(rawLevel, settings);
        const dateObj = new Date(feed.created_at);

        return {
          id: feed.entry_id,
          timestamp: feed.created_at,
          dateObj,
          timestampMs: dateObj.getTime(),
          timestampFormatted: dateObj.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }),
          dateFormatted: formatAxisDateEs(dateObj),
          rawLevel,
          level: Number(level.toFixed(2)),
          flow: Number(flow.toFixed(2)),
        };
      })
      .sort((a, b) => a.timestampMs - b.timestampMs);
  }, [feeds, settings]);

  // Statistical calculations over current chart dataset
  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return { minLevel: 0, maxLevel: 0, avgLevel: 0, minFlow: 0, maxFlow: 0, avgFlow: 0, trend: 'STABLE' };
    }

    const levels = chartData.map((d) => d.level);
    const flows = chartData.map((d) => d.flow);

    const minLevel = Math.min(...levels);
    const maxLevel = Math.max(...levels);
    const avgLevel = levels.reduce((a, b) => a + b, 0) / levels.length;

    const minFlow = Math.min(...flows);
    const maxFlow = Math.max(...flows);
    const avgFlow = flows.reduce((a, b) => a + b, 0) / flows.length;

    let trend: 'RISING' | 'FALLING' | 'STABLE' = 'STABLE';
    if (chartData.length >= 2) {
      const firstHalf = chartData.slice(0, Math.floor(chartData.length / 2));
      const secondHalf = chartData.slice(Math.floor(chartData.length / 2));

      const avgFirst = firstHalf.reduce((a, b) => a + b.level, 0) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b.level, 0) / secondHalf.length;

      const diff = avgSecond - avgFirst;
      if (diff > 0.5) trend = 'RISING';
      else if (diff < -0.5) trend = 'FALLING';
    }

    return { minLevel, maxLevel, avgLevel, minFlow, maxFlow, avgFlow, trend };
  }, [chartData]);

  // Alert thresholds
  const maxLevelAlert = alerts.find((a) => a.type === 'MAX_LEVEL' && a.enabled);
  const minLevelAlert = alerts.find((a) => a.type === 'MIN_LEVEL' && a.enabled);

  // Preset Date Ranges Handler
  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    if (!chartData.length) return;

    const lastTime = chartData[chartData.length - 1].timestampMs;
    let firstTime = chartData[0].timestampMs;

    if (preset === '1H') firstTime = Math.max(firstTime, lastTime - 1 * 3600 * 1000);
    else if (preset === '6H') firstTime = Math.max(firstTime, lastTime - 6 * 3600 * 1000);
    else if (preset === '24H') firstTime = Math.max(firstTime, lastTime - 24 * 3600 * 1000);
    else if (preset === '7D') firstTime = Math.max(firstTime, lastTime - 7 * 24 * 3600 * 1000);
    else if (preset === '30D') firstTime = Math.max(firstTime, lastTime - 30 * 24 * 3600 * 1000);
    else if (preset === 'ALL') {
      firstTime = chartData[0].timestampMs;
    }

    setStartFilter(formatDateToLocalInput(new Date(firstTime)));
    setEndFilter(formatDateToLocalInput(new Date(lastTime)));

    if (dygraphInstanceRef.current) {
      if (preset === 'ALL') {
        dygraphInstanceRef.current.resetZoom();
      } else {
        dygraphInstanceRef.current.updateOptions({
          dateWindow: [firstTime, lastTime],
        });
      }
    }
  };

  // Custom Date Filter Apply
  const handleApplyCustomDates = () => {
    if (!startFilter || !endFilter) return;
    const startMs = new Date(startFilter).getTime();
    const endMs = new Date(endFilter).getTime();

    if (!isNaN(startMs) && !isNaN(endMs) && startMs < endMs) {
      setActivePreset('CUSTOM');
      if (dygraphInstanceRef.current) {
        dygraphInstanceRef.current.updateOptions({
          dateWindow: [startMs, endMs],
        });
      }
    }
  };

  const handleResetZoom = () => {
    if (chartData.length > 0) {
      setActivePreset('ALL');
      const firstTime = chartData[0].dateObj;
      const lastTime = chartData[chartData.length - 1].dateObj;
      setStartFilter(formatDateToLocalInput(firstTime));
      setEndFilter(formatDateToLocalInput(lastTime));
      if (dygraphInstanceRef.current) {
        dygraphInstanceRef.current.resetZoom();
      }
    }
  };

  // Filtered dataset for Recharts based on date range input
  const filteredData = useMemo(() => {
    if (!startFilter || !endFilter) return chartData;
    const startMs = new Date(startFilter).getTime();
    const endMs = new Date(endFilter).getTime();
    if (isNaN(startMs) || isNaN(endMs)) return chartData;
    return chartData.filter((d) => d.timestampMs >= startMs && d.timestampMs <= endMs);
  }, [chartData, startFilter, endFilter]);

  // Dygraphs initialization & cleanup logic
  useEffect(() => {
    if (engineMode !== 'DYGRAPHS' || !chartRef.current || chartData.length === 0) {
      if (dygraphInstanceRef.current) {
        dygraphInstanceRef.current.destroy();
        dygraphInstanceRef.current = null;
      }
      return;
    }

    // Always clean up previous instance when metric mode changes to avoid column mismatch
    if (dygraphInstanceRef.current) {
      dygraphInstanceRef.current.destroy();
      dygraphInstanceRef.current = null;
    }

    const levelLabel = `Nivel (${settings.levelUnit})`;
    const flowLabel = `Caudal (${settings.flowUnit})`;

    let labels: string[] = ['Fecha'];
    let formattedData: (Date | number)[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let seriesOpts: any = {};

    if (activeMetric === 'BOTH') {
      labels = ['Fecha', levelLabel, flowLabel];
      formattedData = chartData.map((d) => [d.dateObj, d.level, d.flow]);
      seriesOpts = {
        [levelLabel]: { axis: 'y', color: '#10b981' },
        [flowLabel]: { axis: 'y2', color: '#0284c7' },
      };
    } else if (activeMetric === 'LEVEL') {
      labels = ['Fecha', levelLabel];
      formattedData = chartData.map((d) => [d.dateObj, d.level]);
      seriesOpts = {
        [levelLabel]: { axis: 'y', color: '#10b981' },
      };
    } else {
      labels = ['Fecha', flowLabel];
      formattedData = chartData.map((d) => [d.dateObj, d.flow]);
      seriesOpts = {
        [flowLabel]: { axis: 'y', color: '#0284c7' },
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: any = {
      labels,
      legend: 'always',
      labelsDiv: legendRef.current || undefined,
      showRangeSelector: true,
      rangeSelectorHeight: 30,
      rangeSelectorPlotFillColor: 'rgba(16, 185, 129, 0.15)',
      rangeSelectorPlotStrokeColor: '#10b981',
      animatedZooms: false,
      strokeWidth: 2.5,
      drawPoints: true,
      pointSize: 2.5,
      highlightCircleSize: 5,
      highlightSeriesOpts: {
        strokeWidth: 3,
        strokeBorderWidth: 1,
        highlightCircleSize: 6,
      },
      gridLineColor: '#f1f5f9',
      axisLineColor: '#94a3b8',
      axisLabelFontSize: 11,
      labelsSeparateLines: true,
      ylabel: activeMetric === 'BOTH' || activeMetric === 'LEVEL' ? levelLabel : flowLabel,
      y2label: activeMetric === 'BOTH' ? flowLabel : undefined,
      series: seriesOpts,
      axes: {
        x: {
          valueFormatter: (ms: number) => formatFullDateEs(ms),
          axisLabelFormatter: (d: Date | number) => formatAxisDateEs(d),
        },
      },
      zoomCallback: (minDate: number, maxDate: number) => {
        setStartFilter(formatDateToLocalInput(new Date(minDate)));
        setEndFilter(formatDateToLocalInput(new Date(maxDate)));
      },
    };

    dygraphInstanceRef.current = new Dygraph(chartRef.current, formattedData, options);

    return () => {
      if (dygraphInstanceRef.current) {
        dygraphInstanceRef.current.destroy();
        dygraphInstanceRef.current = null;
      }
    };
  }, [engineMode, chartData, activeMetric, showThresholds, settings]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (chartData.length === 0) return;
    const headers = ['Entry ID', 'Timestamp', `Nivel (${settings.levelUnit})`, `Caudal (${settings.flowUnit})`].join(',');
    const rows = chartData.map((d) => [d.id, d.timestamp, d.level, d.flow].join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetria_historica_loja_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm text-slate-800 flex flex-col gap-5">
      {/* Chart Header & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Hidrograma y Registro Histórico de Telemetría
            </h2>
            <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 font-mono font-bold px-2.5 py-0.5 rounded-full">
              {chartData.length} lecturas
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Evolución temporal del Nivel de Agua (cm) y Caudal Estimado Q (L/s)
          </p>
        </div>

        {/* Action Controls & Metric Selector Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Metric Selector Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold">
            <button
              onClick={() => setActiveMetric('BOTH')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'BOTH' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ambos (Nivel + Caudal)
            </button>
            <button
              onClick={() => setActiveMetric('LEVEL')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'LEVEL' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Nivel ({settings.levelUnit})
            </button>
            <button
              onClick={() => setActiveMetric('FLOW')}
              className={`px-3 py-1 rounded-lg transition-all ${
                activeMetric === 'FLOW' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Caudal ({settings.flowUnit})
            </button>
          </div>

          {/* Render Engine Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 font-semibold">
            <button
              onClick={() => setEngineMode('VECTOR')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                engineMode === 'VECTOR' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista Gráfica Vectorial Interactiva"
            >
              <LineChartIcon className="w-3.5 h-3.5" />
              <span>Vectorial</span>
            </button>
            <button
              onClick={() => setEngineMode('DYGRAPHS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                engineMode === 'DYGRAPHS' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Vista Dygraphs de Alta Densidad"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Alta Densidad</span>
            </button>
          </div>

          {/* Threshold Toggle */}
          <button
            onClick={() => setShowThresholds(!showThresholds)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold transition-all ${
              showThresholds ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Alertas</span>
          </button>

          {/* Results Count Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Puntos:</span>
            <select
              value={resultsCount}
              onChange={(e) => onResultsCountChange(Number(e.target.value))}
              className="bg-transparent text-slate-900 font-bold font-mono focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
              <option value={500}>500</option>
            </select>
          </div>

          {/* Refresh & CSV Buttons */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl font-medium transition-all disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-xl font-semibold transition-all"
            title="Exportar a CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Date Range Control Toolbar */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Quick Range Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 font-semibold flex items-center gap-1 mr-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" /> Rango:
          </span>
          {[
            { id: '1H', label: '1 Hora' },
            { id: '6H', label: '6 Horas' },
            { id: '24H', label: '24 Horas' },
            { id: '7D', label: '7 Días' },
            { id: 'ALL', label: 'Todo' },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePresetChange(preset.id)}
              className={`px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                activePreset === preset.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom DateTime Inputs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Desde:</span>
            <input
              type="datetime-local"
              value={startFilter}
              onChange={(e) => setStartFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700">
            <span className="text-slate-400 font-medium">Hasta:</span>
            <input
              type="datetime-local"
              value={endFilter}
              onChange={(e) => setEndFilter(e.target.value)}
              className="bg-transparent text-slate-800 font-mono text-xs focus:outline-none"
            />
          </div>

          <button
            onClick={handleApplyCustomDates}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-semibold shadow-xs transition-all"
            title="Aplicar rango de fechas personalizado"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Aplicar</span>
          </button>

          <button
            onClick={handleResetZoom}
            className="flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-lg font-semibold transition-all"
            title="Restablecer vista"
          >
            <ZoomOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 font-semibold mb-0.5">Nivel Mínimo (cm)</div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {stats.minLevel.toFixed(1)} <span className="text-xs text-slate-500 font-sans font-normal">{settings.levelUnit}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 font-semibold mb-0.5">Nivel Máximo (cm)</div>
          <div className="text-lg font-black text-emerald-600 font-mono">
            {stats.maxLevel.toFixed(1)} <span className="text-xs text-slate-500 font-sans font-normal">{settings.levelUnit}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="text-slate-500 font-semibold mb-0.5">Caudal Promedio Q</div>
          <div className="text-lg font-black text-blue-600 font-mono">
            {stats.avgFlow.toFixed(1)} <span className="text-xs text-slate-500 font-sans font-normal">{settings.flowUnit}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-slate-500 font-semibold mb-0.5">Tendencia Nivel</div>
            <div className="text-xs font-bold text-slate-800">
              {stats.trend === 'RISING' ? 'En Aumento' : stats.trend === 'FALLING' ? 'En Descenso' : 'Estable'}
            </div>
          </div>
          {stats.trend === 'RISING' ? (
            <TrendingUp className="w-5 h-5 text-amber-600" />
          ) : stats.trend === 'FALLING' ? (
            <TrendingDown className="w-5 h-5 text-emerald-600" />
          ) : (
            <Activity className="w-5 h-5 text-blue-600" />
          )}
        </div>
      </div>

      {/* Main Canvas Chart View */}
      <div className="w-full flex flex-col gap-2">
        {/* Recharts Vector Canvas Mode */}
        {engineMode === 'VECTOR' ? (
          <div className="w-full h-[360px] bg-slate-900/95 rounded-2xl border border-slate-800 p-4 relative text-white">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="dateFormatted" stroke="#94a3b8" fontSize={11} tickLine={false} />

                {(activeMetric === 'BOTH' || activeMetric === 'LEVEL') && (
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    stroke="#10b981"
                    fontSize={11}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    unit={` ${settings.levelUnit}`}
                  />
                )}

                {(activeMetric === 'BOTH' || activeMetric === 'FLOW') && (
                  <YAxis
                    yAxisId="right"
                    orientation={activeMetric === 'FLOW' ? 'left' : 'right'}
                    stroke="#38bdf8"
                    fontSize={11}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    unit={` ${settings.flowUnit}`}
                  />
                )}

                <Tooltip content={<CustomRechartsTooltip settings={settings} />} />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />

                {/* Threshold Reference Lines */}
                {showThresholds && maxLevelAlert && (
                  <ReferenceLine
                    yAxisId="left"
                    y={maxLevelAlert.threshold}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Alerta Máx (${maxLevelAlert.threshold}cm)`, fill: '#ef4444', fontSize: 10 }}
                  />
                )}
                {showThresholds && minLevelAlert && (
                  <ReferenceLine
                    yAxisId="left"
                    y={minLevelAlert.threshold}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: `Alerta Mín (${minLevelAlert.threshold}cm)`, fill: '#f59e0b', fontSize: 10 }}
                  />
                )}

                {/* Level Line (Green) */}
                {(activeMetric === 'BOTH' || activeMetric === 'LEVEL') && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="level"
                    name={`Nivel de Agua (${settings.levelUnit})`}
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#10b981' }}
                    activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2 }}
                  />
                )}

                {/* Flow Line (Sky Blue) */}
                {(activeMetric === 'BOTH' || activeMetric === 'FLOW') && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="flow"
                    name={`Caudal Volumétrico (${settings.flowUnit})`}
                    stroke="#38bdf8"
                    strokeWidth={3}
                    dot={{ r: 3, fill: '#38bdf8' }}
                    activeDot={{ r: 6, stroke: '#0284c7', strokeWidth: 2 }}
                  />
                )}

                <Brush dataKey="dateFormatted" height={22} stroke="#38bdf8" fill="#0f172a" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Dygraphs High-Density Canvas Mode */
          <div className="flex flex-col gap-2">
            <div
              ref={legendRef}
              className="bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 text-xs font-mono min-h-[38px] flex items-center shadow-xs"
            />
            <div className="w-full h-[360px] bg-slate-50 rounded-2xl border border-slate-200 p-3 relative">
              {isLoading && chartData.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-xs z-10 rounded-xl">
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Cargando datos históricos...</span>
                  </div>
                </div>
              ) : null}

              <div ref={chartRef} className="w-full h-full text-slate-800 dygraph-chart-container select-none cursor-crosshair" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
