import React from 'react';
import { ChannelSettings } from '../types';
import { Radio, RefreshCw, Settings, Volume2, VolumeX, Activity, SlidersHorizontal, Eye, EyeOff } from 'lucide-react';

interface HeaderProps {
  currentRawLevelCm: number;
  currentFlow: number;
  lastUpdated: string | null;
  isOnline: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
  settings: ChannelSettings;
  soundMuted: boolean;
  onToggleMute: () => void;
  isTechnicalMode: boolean;
  onToggleTechnicalMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRawLevelCm,
  currentFlow,
  lastUpdated,
  isOnline,
  isLoading,
  onRefresh,
  onOpenSettings,
  settings,
  soundMuted,
  onToggleMute,
  isTechnicalMode,
  onToggleTechnicalMode,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 backdrop-blur-md px-4 py-3 text-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 rounded-xl shadow-sm text-white">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base md:text-lg font-bold tracking-tight text-slate-900 font-sans">
                Monitoreo de Nivel y Caudal de Ríos
              </h1>
              <span
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                {isOnline ? 'Transmisión en Vivo' : 'Sin Conexión'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Red Hidrológica de Loja &bull; Sistema de Alertas Tempranas de Crecidas
            </p>
          </div>
        </div>

        {/* Center: Live Quick Metrics Pills */}
        <div className="hidden lg:flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">NIVEL ACTUAL</span>
              <span className="font-mono font-bold text-slate-900">
                {currentRawLevelCm.toFixed(2)} {settings.levelUnit}
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">CAUDAL CALCULADO</span>
            <span className="font-mono font-bold text-blue-600">
              {currentFlow.toFixed(2)} {settings.flowUnit}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div>
            <span className="text-slate-400 font-semibold block text-[10px] uppercase">ÚLTIMA LECTURA</span>
            <span className="font-mono text-slate-600 text-[11px]">
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '---'}
            </span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Technical Mode Switcher Widget */}
          <button
            onClick={onToggleTechnicalMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              isTechnicalMode
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
            }`}
            title={isTechnicalMode ? 'Cambiar a Vista Simplificada' : 'Cambiar a Vista Técnica'}
          >
            {isTechnicalMode ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
            <span>{isTechnicalMode ? 'Modo Técnico' : 'Modo Simplificado'}</span>
          </button>

          {/* Mute Sound Button */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-all ${
              soundMuted
                ? 'bg-slate-100 border-slate-200 text-slate-400 hover:text-slate-600'
                : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
            }`}
            title={soundMuted ? 'Activar Sonido de Alertas' : 'Silenciar Sonido'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Refresh Data Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-2 rounded-xl font-medium text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {/* Settings Modal Button */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shadow-sm"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Configuración</span>
          </button>
        </div>

      </div>
    </header>
  );
};
