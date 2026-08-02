import React, { useState } from 'react';
import { ChannelSettings } from '../types';
import { convertLevelValue, calculateFlowRate } from '../utils/flowCalculator';
import { ShieldCheck, Radio, Layers, Info, CheckCircle2, AlertTriangle, Eye, Box, Sparkles } from 'lucide-react';
import { ThreeDChannelCanvas } from './ThreeDChannelCanvas';

interface LiveLevelGaugeProps {
  currentRawLevelCm: number;
  lastUpdated: string | null;
  settings: ChannelSettings;
  stationName?: string;
  riverName?: string;
  locationName?: string;
  coordinates?: { lat: number; lng: number };
}

export const LiveLevelGauge: React.FC<LiveLevelGaugeProps> = ({
  currentRawLevelCm,
  lastUpdated,
  settings,
  stationName = 'Estación 01 - Río Malacatos',
  riverName = 'Río Malacatos',
  locationName = 'Centro Loja',
  coordinates = { lat: -4.025112, lng: -79.200527 },
}) => {
  const selectedMaterial = 'PP';
  const [showKeyPoints, setShowKeyPoints] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

  const levelVal = convertLevelValue(currentRawLevelCm, settings.levelUnit);
  const flowVal = calculateFlowRate(currentRawLevelCm, settings);

  // Installation height in cm (OC)
  const installationHeightCm = settings.installationHeight || 100;
  
  // Empty height (OF = OC - FC)
  const emptyHeightCm = Math.max(0, installationHeightCm - currentRawLevelCm);

  // Percentage filled (0% to 100%)
  const fillPercentage = Math.min(100, Math.max(0, (currentRawLevelCm / installationHeightCm) * 100));

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-800 flex flex-col gap-6">
      {/* Top Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Medidor Telemétrico de Nivel de Agua
            </h2>
            <span className="bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Sensor de Nivel
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Geometría de medición y perfil de canal en tiempo real
          </p>
        </div>

        {/* Sensor Housing Badge */}
        <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
          <span className="w-2 h-2 rounded-full bg-slate-900" />
          <span>Protección de Intemperie (IP68)</span>
        </div>
      </div>

      {/* Main Container: Split View (Diagram Canvas + Live Specs) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Column: Interactive Technical SVG Cutaway Diagram (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-50 rounded-xl border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
          
          {/* Top View Mode Selector Bar */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Box className="w-4 h-4 text-blue-600" />
              <span>Gráfico de Telemetría</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setViewMode('3D')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === '3D'
                    ? 'bg-blue-600 text-white shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Vista 3D Interactiva</span>
              </button>
              <button
                onClick={() => setViewMode('2D')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === '2D'
                    ? 'bg-white text-slate-900 shadow-sm font-bold border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-slate-600" />
                <span>Corte 2D Esquema</span>
              </button>
            </div>
          </div>

          {/* Conditional View Rendering: 3D Three.js Model or 2D Cutaway Diagram */}
          {viewMode === '3D' ? (
            <ThreeDChannelCanvas
              currentRawLevelCm={currentRawLevelCm}
              installationHeightCm={installationHeightCm}
              levelUnit={settings.levelUnit}
              showKeyPoints={showKeyPoints}
              stationName={stationName}
              riverName={riverName}
              locationName={locationName}
              coordinates={coordinates}
            />
          ) : (
            <div className="relative w-full h-[320px]">
            <svg
              className="w-full h-full"
              viewBox="0 0 500 320"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Water Gradient */}
                <linearGradient id="waterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.95" />
                </linearGradient>

                {/* Radar Beam Wave Gradient */}
                <linearGradient id="beamGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                </linearGradient>

                {/* Metallic Sensor Gradient */}
                <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#cbd5e1" />
                  <stop offset="50%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#94a3b8" />
                </linearGradient>
              </defs>

              {/* Channel / Channel Structure Walls */}
              {/* Outer Ground */}
              <rect x="20" y="240" width="80" height="70" fill="#e2e8f0" />
              <rect x="400" y="240" width="80" height="70" fill="#e2e8f0" />
              
              {/* Sloped Open Channel Walls */}
              <polygon points="20,80 100,240 100,300 20,300" fill="#cbd5e1" />
              <polygon points="480,80 400,240 400,300 480,300" fill="#cbd5e1" />
              <line x1="100" y1="240" x2="100" y2="300" stroke="#94a3b8" strokeWidth="2" />
              <line x1="400" y1="240" x2="400" y2="300" stroke="#94a3b8" strokeWidth="2" />
              <line x1="100" y1="300" x2="400" y2="300" stroke="#64748b" strokeWidth="3" />

              {/* Water Body (Height proportional to fillPercentage) */}
              {(() => {
                // Ground level is y=300 (bottom of channel). Max water surface at y=100.
                const maxY = 100;
                const minY = 300;
                const waterY = minY - (fillPercentage / 100) * (minY - maxY);

                const widthFactor = (300 - waterY) / 220;
                const leftX = 100 - widthFactor * 80;
                const rightX = 400 + widthFactor * 80;

                return (
                  <g>
                    {/* Water polygon */}
                    <polygon
                      points={`${leftX},${waterY} ${rightX},${waterY} 400,300 100,300`}
                      fill="url(#waterGrad)"
                    />
                    {/* Animated Water Surface Line */}
                    <line
                      x1={leftX}
                      y1={waterY}
                      x2={rightX}
                      y2={waterY}
                      stroke="#2563eb"
                      strokeWidth="3"
                    />

                    {/* Radar Emission Beam Cone (6 degree beam angle) */}
                    <polygon
                      points={`250,55 ${leftX + 20},${waterY} ${rightX - 20},${waterY}`}
                      fill="url(#beamGrad)"
                    />
                    {/* Radar Pulse Rings */}
                    <circle cx="250" cy="80" r="15" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
                    <circle cx="250" cy="110" r="30" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                    <circle cx="250" cy="140" r="45" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

                    {/* Key Points Markers matching PDF Diagram Page 12 (OC, FC, OF) */}
                    {showKeyPoints && (
                      <g>
                        {/* Sensor Point O */}
                        <circle cx="250" cy="35" r="4" fill="#ef4444" />
                        <text x="235" y="38" fill="#ef4444" fontSize="12" fontWeight="bold">O</text>

                        {/* Point A (Top Edge) */}
                        <circle cx="100" cy="100" r="3" fill="#d97706" />
                        <text x="85" y="98" fill="#d97706" fontSize="10" fontWeight="bold">A</text>

                        {/* Point B (Right Edge) */}
                        <circle cx="400" cy="100" r="3" fill="#d97706" />
                        <text x="410" y="98" fill="#d97706" fontSize="10" fontWeight="bold">B</text>

                        {/* Point C (Bottom Left) */}
                        <circle cx="100" cy="300" r="3" fill="#d97706" />
                        <text x="85" y="315" fill="#d97706" fontSize="10" fontWeight="bold">C</text>

                        {/* Point D (Bottom Right) */}
                        <circle cx="400" cy="300" r="3" fill="#d97706" />
                        <text x="410" y="315" fill="#d97706" fontSize="10" fontWeight="bold">D</text>

                        {/* Point F (Water Surface Center) */}
                        <circle cx="250" cy={waterY} r="4" fill="#2563eb" />
                        <text x="260" y={waterY + 4} fill="#1d4ed8" fontSize="11" fontWeight="bold">F</text>

                        {/* Distance Dimension Lines on Left */}
                        {/* Empty Height OF (Air distance) */}
                        <line x1="170" y1="35" x2="170" y2={waterY} stroke="#9333ea" strokeWidth="1.5" strokeDasharray="4 2" />
                        <text x="125" y={(35 + waterY) / 2} fill="#7e22ce" fontSize="10" fontWeight="bold">
                          OF={emptyHeightCm.toFixed(1)}cm (Vacío)
                        </text>

                        {/* Water Level FC */}
                        <line x1="170" y1={waterY} x2="170" y2="300" stroke="#2563eb" strokeWidth="2" />
                        <text x="125" y={(waterY + 300) / 2} fill="#1d4ed8" fontSize="10" fontWeight="bold">
                          FC={currentRawLevelCm.toFixed(1)}cm (Agua)
                        </text>

                        {/* Total Height OC */}
                        <line x1="50" y1="35" x2="50" y2="300" stroke="#64748b" strokeWidth="1" strokeDasharray="2 2" />
                        <text x="10" y="170" fill="#475569" fontSize="9" fontWeight="bold" transform="rotate(-90 20 170)">
                          OC={installationHeightCm}cm (Instalación)
                        </text>
                      </g>
                    )}
                  </g>
                );
              })()}

              {/* Sensor Mounting Bracket & Sensor Head */}
              <g>
                {/* Wall Bracket */}
                <path d="M220,10 L250,10 L250,35" stroke="#64748b" strokeWidth="4" fill="none" />
                <rect x="210" y="5" width="15" height="20" fill="#475569" rx="2" />

                {/* Radar Sensor Housing */}
                {selectedMaterial === 'PP' ? (
                  // Black PP Body
                  <g>
                    {/* Cable Gland */}
                    <rect x="244" y="12" width="12" height="10" fill="#64748b" rx="1" />
                    {/* Upper body */}
                    <rect x="238" y="22" width="24" height="8" fill="#1e293b" />
                    {/* Main Cylindrical Hull */}
                    <rect x="230" y="30" width="40" height="20" fill="#0f172a" rx="2" stroke="#334155" />
                    {/* Thread G1-1/2 */}
                    <rect x="236" y="50" width="28" height="8" fill="#334155" />
                    {/* Lens Antenna Cone */}
                    <polygon points="236,58 264,58 250,68" fill="#475569" />
                  </g>
                ) : (
                  // Stainless Steel Body
                  <g>
                    {/* Cable Gland */}
                    <rect x="244" y="12" width="12" height="10" fill="url(#metalGrad)" rx="1" />
                    {/* Metallic Grooved Cylindrical Hull */}
                    <rect x="230" y="24" width="40" height="26" fill="url(#metalGrad)" rx="2" stroke="#cbd5e1" />
                    <line x1="230" y1="30" x2="270" y2="30" stroke="#64748b" strokeWidth="1" />
                    <line x1="230" y1="36" x2="270" y2="36" stroke="#64748b" strokeWidth="1" />
                    <line x1="230" y1="42" x2="270" y2="42" stroke="#64748b" strokeWidth="1" />
                    {/* Thread G2 */}
                    <rect x="234" y="50" width="32" height="8" fill="#94a3b8" />
                    {/* Lens Antenna Dome */}
                    <path d="M236,58 Q250,70 264,58 Z" fill="#e2e8f0" />
                  </g>
                )}
              </g>

              {/* Beam Angle Annotation (6°) */}
              <text x="255" y="75" fill="#2563eb" fontSize="9" fontWeight="bold">
                Ángulo haz: 6°
              </text>
            </svg>
          </div>
          )}

          {/* Diagram Footer Controls */}
          <div className="flex items-center justify-between text-xs border-t border-slate-200 pt-2 mt-1">
            <button
              onClick={() => setShowKeyPoints(!showKeyPoints)}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5 text-blue-600" />
              <span>{showKeyPoints ? 'Ocultar Cotas OC/FC/OF' : 'Mostrar Cotas OC/FC/OF'}</span>
            </button>
            <div className="text-slate-500 text-[11px] font-medium">
              Rango de Medición: <span className="text-slate-900 font-mono font-bold">0.1m - 15m</span> | Precisión: <span className="text-slate-900 font-mono font-bold">±1mm</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Telemetry & Calculated Metrics (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          
          {/* Main Hero Card 1: Nivel de Agua (Water Level) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5">
              <Layers className="w-20 h-20 text-blue-600" />
            </div>

            <div className="flex justify-between items-start mb-2">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-600">
                Nivel Actual de Agua (FC)
              </span>
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> En Vivo
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-1">
              <span className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 font-mono">
                {levelVal.toFixed(2)}
              </span>
              <span className="text-lg font-bold text-blue-600 font-sans">
                {settings.levelUnit}
              </span>
            </div>

            {/* Level Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 my-3 border border-slate-200 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${fillPercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-500 font-medium mt-1">
              <span>Capacidad: <strong className="text-slate-900">{fillPercentage.toFixed(1)}%</strong></span>
              <span>Dist. Vacía (OF): <strong className="text-slate-900">{emptyHeightCm.toFixed(1)} cm</strong></span>
            </div>
          </div>

          {/* Main Hero Card 2: Caudal Calculado (Flow Rate) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs uppercase tracking-wider font-bold text-blue-600">
                Caudal Estimado (Q)
              </span>
              <span className="text-[11px] text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                Modo: {settings.conversionMode}
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-1">
              <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 font-mono">
                {flowVal.toFixed(2)}
              </span>
              <span className="text-lg font-bold text-blue-600 font-sans">
                {settings.flowUnit}
              </span>
            </div>

            <div className="text-xs text-slate-500 font-medium mt-2 border-t border-slate-100 pt-2 flex justify-between">
              <span>Ecuación: <strong className="text-slate-800">
                {settings.conversionMode === 'MANNING' ? 'Manning Canal Abierto' :
                 settings.conversionMode === 'WEIR' ? 'Vertedero Rectangular' : 'Factor Lineal K'}
              </strong></span>
              <span>Ancho Canal: <strong className="text-slate-800">{settings.channelWidth}m</strong></span>
            </div>
          </div>

          {/* Quick Specifications Table */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs flex flex-col gap-2">
            <div className="font-semibold text-slate-800 border-b border-slate-200 pb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Especificaciones Técnicas del Sensor
              </span>
              <span className="text-[10px] text-slate-400 font-sans">Modelo Telemétrico</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-slate-600 font-medium">
              <div>Rango Medición: <span className="text-slate-900 font-mono font-semibold">0.1m - 15m</span></div>
              <div>Incertidumbre: <span className="text-slate-900 font-mono font-semibold">±1 mm</span></div>
              <div>Protección: <span className="text-slate-900 font-mono font-semibold">IP68 (Sumergible)</span></div>
              <div>Alimentación: <span className="text-slate-900 font-mono font-semibold">18-28V DC</span></div>
              <div>Interfaz: <span className="text-slate-900 font-mono font-semibold">{settings.communicationType}</span></div>
              <div>Transmisión: <span className="text-slate-900 font-mono font-semibold">Telemétrica Inalámbrica</span></div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
