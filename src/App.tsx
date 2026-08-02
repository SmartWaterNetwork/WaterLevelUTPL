import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AlertConfig, AlertLogItem, ChannelSettings, StationState } from './types';
import { STATIONS, NETWORK_CENTER, NETWORK_ZOOM } from './stations';
import { useStationNetwork } from './hooks/useStationNetwork';
import { playAlertChime, triggerPushNotification } from './utils/flowCalculator';
import { TabId, TopBar } from './components/TopBar';
import { StationPanel } from './components/StationPanel';
import { MapPanel } from './components/MapPanel';
import { Hydrograph } from './components/Hydrograph';
import { SensorSchematic } from './components/SensorSchematic';
import { Drawer } from './components/Drawer';
import { AlertManager } from './components/AlertManager';
import { PdfDocsViewer } from './components/PdfDocsViewer';
import { SensorSettingsForm } from './components/SensorSettingsForm';

const DEFAULT_ALERTS: AlertConfig[] = [
  {
    id: 'rule-max-level',
    name: 'Nivel alto de agua',
    type: 'MAX_LEVEL',
    threshold: 70,
    enabled: true,
    severity: 'critical',
    pushNotification: true,
    soundAlert: true,
  },
  {
    id: 'rule-min-level',
    name: 'Nivel bajo de agua',
    type: 'MIN_LEVEL',
    threshold: 10,
    enabled: true,
    severity: 'warning',
    pushNotification: true,
    soundAlert: false,
  },
  {
    // Observed flows across the network sit in the 300–700 L/s band, so the
    // trip point is set above them; adjust per basin from the alerts drawer.
    id: 'rule-max-flow',
    name: 'Caudal extremo',
    type: 'MAX_FLOW',
    threshold: 800,
    enabled: true,
    severity: 'critical',
    pushNotification: true,
    soundAlert: true,
  },
];

type DrawerId = 'ALERTS' | 'DOCS' | 'SETTINGS' | null;

export default function App() {
  const network = useStationNetwork(STATIONS);
  const { stations, active, activeId, setActiveId, updateSettings } = network;

  const [tab, setTab] = useState<TabId>('MAP');
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [alerts, setAlerts] = useState<AlertConfig[]>(DEFAULT_ALERTS);
  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Every reading is evaluated once, across all stations.
  const seenRef = useRef<Set<string>>(new Set());
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const mutedRef = useRef(soundMuted);
  mutedRef.current = soundMuted;

  const evaluate = useCallback((station: StationState) => {
    const { latest, config } = station;
    if (!latest) return;

    const key = `${config.id}:${latest.entryId}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    alertsRef.current.forEach((rule) => {
      if (!rule.enabled) return;

      let triggered = false;
      let value = latest.level;
      let unit: string = config.settings.levelUnit;

      if (rule.type === 'MAX_LEVEL' && latest.levelCm >= rule.threshold) triggered = true;
      else if (rule.type === 'MIN_LEVEL' && latest.levelCm <= rule.threshold) triggered = true;
      else if (rule.type === 'MAX_FLOW' && latest.flow >= rule.threshold) {
        triggered = true;
        value = latest.flow;
        unit = config.settings.flowUnit;
      }

      if (!triggered) return;

      const message = `${config.riverName}: ${value.toFixed(1)} ${unit} (umbral ${rule.threshold} ${unit})`;
      setBanner(message);
      setLogs((prev) => [
        {
          id: `${rule.id}-${key}`,
          timestamp: latest.iso,
          stationName: config.riverName,
          title: rule.name,
          message,
          type: rule.type,
          value,
          unit,
          severity: rule.severity,
          read: false,
        },
        ...prev,
      ]);

      if (rule.soundAlert && !mutedRef.current) playAlertChime(rule.severity);
      if (rule.pushNotification) triggerPushNotification(`Alerta: ${rule.name}`, message);
    });
  }, []);

  useEffect(() => {
    stations.forEach(evaluate);
  }, [stations, evaluate]);

  const handleSaveSettings = (settings: ChannelSettings) => {
    updateSettings(activeId, settings);
    setDrawer(null);
  };

  return (
    <div className="h-full flex flex-col bg-page text-ink">
      <TopBar
        activeTab={tab}
        onTabChange={setTab}
        isOnline={network.isOnline}
        isRefreshing={network.isRefreshing}
        lastSyncedAt={network.lastSyncedAt}
        onRefresh={network.refresh}
        soundMuted={soundMuted}
        onToggleMute={() => setSoundMuted((m) => !m)}
        alertCount={logs.length}
        onOpenAlerts={() => setDrawer('ALERTS')}
        onOpenDocs={() => setDrawer('DOCS')}
        onOpenSettings={() => setDrawer('SETTINGS')}
      />

      {banner && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-[#fdf3f3] border-b border-[#f2d5d5] text-[12px] text-ink shrink-0 animate-fadeIn">
          <span className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-crit shrink-0" aria-hidden="true" />
            <span className="font-medium whitespace-nowrap hidden sm:inline">Alerta hidrológica</span>
            <span className="text-ink-2 truncate">{banner}</span>
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            aria-label="Descartar alerta"
            className="p-1 rounded text-ink-3 hover:text-ink shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* The map/telemetry area and the station rail sit side by side on desktop.
          On phones they stack and the whole column scrolls, map first. */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden thin-scroll">
        <div className="flex-1 lg:min-h-0">
          {tab === 'MAP' ? (
            <div className="h-[60vh] lg:h-full">
              <MapPanel
                stations={stations}
                activeId={activeId}
                onSelect={setActiveId}
                center={NETWORK_CENTER}
                zoom={NETWORK_ZOOM}
              />
            </div>
          ) : (
            <div className="lg:h-full lg:overflow-y-auto thin-scroll p-3 sm:p-4 space-y-4">
              <Hydrograph
                station={active}
                alerts={alerts}
                onRefresh={network.refresh}
                onResultsCountChange={(count) =>
                  updateSettings(activeId, { ...active.config.settings, resultsCount: count })
                }
              />
              <SensorSchematic station={active} />
            </div>
          )}
        </div>

        <div className="w-full lg:w-[340px] xl:w-[380px] shrink-0 lg:h-full lg:min-h-0">
          <StationPanel stations={stations} activeId={activeId} onSelect={setActiveId} />
        </div>
      </main>

      <Drawer
        isOpen={drawer === 'ALERTS'}
        onClose={() => setDrawer(null)}
        title="Alertas e incidentes"
        subtitle="Reglas de disparo y registro de eventos de toda la red"
      >
        <AlertManager
          alerts={alerts}
          onUpdateAlerts={setAlerts}
          logs={logs}
          onClearLogs={() => setLogs([])}
          settings={active.config.settings}
        />
      </Drawer>

      <Drawer
        isOpen={drawer === 'DOCS'}
        onClose={() => setDrawer(null)}
        title="Manual del sensor"
        subtitle="Especificaciones, instalación, cableado y app de configuración"
        width="max-w-3xl"
      >
        <PdfDocsViewer />
      </Drawer>

      <Drawer
        isOpen={drawer === 'SETTINGS'}
        onClose={() => setDrawer(null)}
        title={`Configuración · ${active.config.riverName}`}
        subtitle="Canal de telemetría, geometría del cauce y unidades"
        width="max-w-xl"
      >
        <SensorSettingsForm
          settings={active.config.settings}
          onSave={handleSaveSettings}
          onCancel={() => setDrawer(null)}
        />
      </Drawer>
    </div>
  );
}
