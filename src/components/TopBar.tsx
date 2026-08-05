import React from 'react';
import { Bell, BookOpen, RefreshCw, Settings, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { relativeTime } from '../utils/format';

export type TabId = 'MAP' | 'TELEMETRY';

interface TopBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isOnline: boolean;
  isRefreshing: boolean;
  lastSyncedAt: number | null;
  onRefresh: () => void;
  soundMuted: boolean;
  onToggleMute: () => void;
  alertCount: number;
  onOpenAlerts: () => void;
  onOpenDocs: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  /** Marks the administration entry point when the session carries the role. */
  isAdmin: boolean;
  settingsDisabled: boolean;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'MAP', label: 'Mapa' },
  { id: 'TELEMETRY', label: 'Telemetría' },
];

const IconButton: React.FC<{
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}> = ({ label, onClick, children, badge, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    aria-label={label}
    className="relative p-2 rounded-md text-ink-2 hover:text-ink hover:bg-tint transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
  >
    {children}
    {badge !== undefined && badge > 0 && (
      <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-crit text-white text-[9px] font-semibold leading-[15px] text-center tabular-nums">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  isOnline,
  isRefreshing,
  lastSyncedAt,
  onRefresh,
  soundMuted,
  onToggleMute,
  alertCount,
  onOpenAlerts,
  onOpenDocs,
  onOpenSettings,
  onOpenAdmin,
  isAdmin,
  settingsDisabled,
}) => (
  <header className="shrink-0 bg-surface border-b border-hairline px-3 sm:px-4 py-2 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
    <div className="order-1 flex-1 min-w-0 sm:flex-none flex items-baseline gap-2.5">
      <h1 className="text-[15px] font-semibold tracking-tight text-ink truncate">
        Nivel y caudal de ríos
      </h1>
      <span className="text-[11px] text-ink-3 truncate hidden md:block">Red hidrológica de Loja</span>
    </div>

    {/* On phones the tabs drop to their own full-width row. */}
    <nav
      className="order-3 w-full sm:order-2 sm:w-auto sm:mx-auto flex items-center gap-1 border border-hairline rounded-md p-0.5"
      aria-label="Vistas"
    >
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
          className={`flex-1 sm:flex-none px-3.5 py-1.5 text-[12px] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
            activeTab === tab.id
              ? 'bg-ink text-white font-medium'
              : 'text-ink-2 hover:text-ink hover:bg-hover'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>

    <div className="order-2 sm:order-3 flex items-center gap-0.5 sm:ml-auto">
      {/* Connection state, spelled out rather than encoded in a colour alone. */}
      <span className="hidden xl:flex items-center gap-1.5 text-[11px] text-ink-3 mr-1.5 whitespace-nowrap">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-ok' : 'bg-crit'}`}
          aria-hidden="true"
        />
        {isOnline ? `Sincronizado ${relativeTime(lastSyncedAt)}` : 'Sin conexión'}
      </span>

      <IconButton label="Actualizar ahora" onClick={onRefresh} disabled={isRefreshing}>
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </IconButton>

      <IconButton
        label={soundMuted ? 'Activar sonido de alertas' : 'Silenciar alertas'}
        onClick={onToggleMute}
      >
        {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </IconButton>

      <IconButton label="Alertas e incidentes" onClick={onOpenAlerts} badge={alertCount}>
        <Bell className="w-4 h-4" />
      </IconButton>

      <IconButton label="Manuales del sensor" onClick={onOpenDocs}>
        <BookOpen className="w-4 h-4" />
      </IconButton>

      <IconButton
        label="Configuración de la estación"
        onClick={onOpenSettings}
        disabled={settingsDisabled}
      >
        <Settings className="w-4 h-4" />
      </IconButton>

      <IconButton
        label={isAdmin ? 'Administración · sesión de administrador' : 'Administración'}
        onClick={onOpenAdmin}
      >
        <ShieldCheck className={`w-4 h-4 ${isAdmin ? 'text-ok' : ''}`} />
      </IconButton>
    </div>
  </header>
);
