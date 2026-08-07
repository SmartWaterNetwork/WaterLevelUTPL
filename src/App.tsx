import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { AlertConfig, AlertLogItem, ChannelSettings, StationState } from './types';
import { NETWORK_CENTER, NETWORK_ZOOM } from './stations';
import { useStationNetwork } from './hooks/useStationNetwork';
import { useStationCatalog } from './hooks/useStationCatalog';
import { useAuth } from './hooks/useAuth';
import { configToDraft, saveStation } from './lib/stationsApi';
import { levelRateOfChange, playAlertChime, triggerPushNotification } from './utils/flowCalculator';
import { TabId, TopBar } from './components/TopBar';
import { StationPanel } from './components/StationPanel';
import { StationSheet } from './components/StationSheet';
import { MapPanel } from './components/MapPanel';
import { Hydrograph } from './components/Hydrograph';
import { SensorSchematic } from './components/SensorSchematic';
import { Drawer } from './components/Drawer';
import { AlertManager } from './components/AlertManager';
import { PdfDocsViewer } from './components/PdfDocsViewer';
import { SensorSettingsForm } from './components/SensorSettingsForm';
import { StationForm } from './components/StationForm';
import { AdminPanel } from './components/AdminPanel';

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
  {
    // st-3 sits on a desarenador, not an open channel: a rise there is as
    // likely to mean the weir outlet is choked with debris as it is to mean
    // more water is coming down the Malacatos. 15 cm/h is a starting point —
    // no live readings were available to calibrate it against; tighten it
    // once real data is flowing.
    id: 'rule-rate-st3',
    name: 'Subida rápida en el desarenador',
    type: 'RATE_OF_CHANGE',
    threshold: 15,
    enabled: true,
    severity: 'warning',
    pushNotification: true,
    soundAlert: false,
    stationId: 'st-3',
  },
];

/** How far back RATE_OF_CHANGE rules look to judge whether a rise is sustained. */
const RATE_OF_CHANGE_WINDOW_MIN = 60;

type DrawerId = 'ALERTS' | 'DOCS' | 'SETTINGS' | 'ADMIN' | null;

export default function App() {
  const auth = useAuth();
  const catalog = useStationCatalog();
  const network = useStationNetwork(catalog.stations);
  const { stations, active, activeId, setActiveId, updateSettings } = network;

  const [tab, setTab] = useState<TabId>('MAP');
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [alerts, setAlerts] = useState<AlertConfig[]>(DEFAULT_ALERTS);
  const [logs, setLogs] = useState<AlertLogItem[]>([]);
  const [soundMuted, setSoundMuted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [savingStation, setSavingStation] = useState(false);
  const [stationError, setStationError] = useState<string | null>(null);

  /** True when this station's settings live in the database and may be edited. */
  const canEditStation = Boolean(auth.isAdmin && active?.config.remote && active?.config.dbId);

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
      if (rule.stationId && rule.stationId !== config.id) return;

      let triggered = false;
      let value = latest.level;
      let unit: string = config.settings.levelUnit;

      if (rule.type === 'MAX_LEVEL' && latest.levelCm >= rule.threshold) triggered = true;
      else if (rule.type === 'MIN_LEVEL' && latest.levelCm <= rule.threshold) triggered = true;
      else if (rule.type === 'MAX_FLOW' && latest.flow >= rule.threshold) {
        triggered = true;
        value = latest.flow;
        unit = config.settings.flowUnit;
      } else if (rule.type === 'RATE_OF_CHANGE') {
        const rate = levelRateOfChange(station.readings, RATE_OF_CHANGE_WINDOW_MIN);
        if (rate !== null && rate >= rule.threshold) {
          triggered = true;
          value = rate;
          unit = `${config.settings.levelUnit}/h`;
        }
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

  const stationsAreEmpty = !catalog.isLoading && stations.length === 0;

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
        onOpenAdmin={() => setDrawer('ADMIN')}
        isAdmin={auth.isAdmin}
        settingsDisabled={!active}
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

      {stationsAreEmpty && (
        <div className="px-4 py-2 bg-tint border-b border-hairline text-[12px] text-ink-2 shrink-0">
          No hay estaciones en servicio.{' '}
          <button
            type="button"
            onClick={() => setDrawer('ADMIN')}
            className="underline underline-offset-2 hover:text-ink"
          >
            Darlas de alta desde administración
          </button>
          .
        </div>
      )}

      {catalog.source === 'local' && catalog.error && (
        <div className="px-4 py-2 bg-[#fdf3f3] border-b border-[#f2d5d5] text-[12px] text-ink-2 shrink-0">
          No se pudo leer el catálogo de estaciones; se está mostrando la lista incluida en el
          código. <span className="text-ink-3">{catalog.error}</span>
        </div>
      )}

      {/* The map/telemetry area and the station rail sit side by side on desktop.
          On phones the rail becomes a bottom sheet (StationSheet, below) instead
          of pushing content down, so the map keeps the full height. */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden thin-scroll">
        <div className="flex-1 min-h-0">
          {tab === 'MAP' ? (
            <div className="h-full">
              <MapPanel
                stations={stations}
                activeId={activeId}
                onSelect={setActiveId}
                center={NETWORK_CENTER}
                zoom={NETWORK_ZOOM}
              />
            </div>
          ) : active ? (
            <div className="h-full overflow-y-auto thin-scroll p-3 sm:p-4 pb-24 lg:pb-4 space-y-4">
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
          ) : (
            <div className="h-full flex items-center justify-center p-8 text-[12px] text-ink-3">
              {catalog.isLoading ? 'Cargando estaciones…' : 'No hay ninguna estación seleccionada.'}
            </div>
          )}
        </div>

        <div className="hidden lg:block lg:w-[340px] xl:w-[380px] shrink-0 lg:h-full lg:min-h-0">
          <StationPanel stations={stations} activeId={activeId} onSelect={setActiveId} />
        </div>
      </main>

      <StationSheet stations={stations} activeId={activeId} onSelect={setActiveId} />

      <Drawer
        isOpen={drawer === 'ALERTS'}
        onClose={() => setDrawer(null)}
        title="Alertas e incidentes"
        subtitle="Reglas de disparo y registro de eventos de toda la red"
      >
        {active && (
          <AlertManager
            alerts={alerts}
            onUpdateAlerts={setAlerts}
            logs={logs}
            onClearLogs={() => setLogs([])}
            settings={active.config.settings}
            stations={stations}
          />
        )}
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
        isOpen={drawer === 'SETTINGS' && active !== null}
        onClose={() => setDrawer(null)}
        title={`Configuración · ${active?.config.riverName ?? ''}`}
        subtitle={
          canEditStation
            ? 'Se guarda en la base de datos para toda la red'
            : 'Ajustes de esta sesión; no se guardan en la base de datos'
        }
        width="max-w-xl"
      >
        {active &&
          // An admin editing a database station changes it for everyone, so the
          // drawer opens the full record. Anyone else is only adjusting their
          // own view, and gets the settings that make sense to change alone.
          (canEditStation ? (
            <StationForm
              key={active.config.id}
              draft={configToDraft(active.config)}
              isNew={false}
              busy={savingStation}
              error={stationError}
              neighbours={catalog.allStations
                .filter((s) => s.dbId !== active.config.dbId)
                .map((s) => ({ lat: s.lat, lng: s.lng }))}
              onCancel={() => {
                setStationError(null);
                setDrawer(null);
              }}
              onSave={async (draft) => {
                setSavingStation(true);
                setStationError(null);
                try {
                  await saveStation(active.config.dbId!, draft);
                  await catalog.reload();
                  setDrawer(null);
                } catch (err) {
                  setStationError(err instanceof Error ? err.message : String(err));
                } finally {
                  setSavingStation(false);
                }
              }}
            />
          ) : (
            <SensorSettingsForm
              settings={active.config.settings}
              onSave={handleSaveSettings}
              onCancel={() => setDrawer(null)}
            />
          ))}
      </Drawer>

      <Drawer
        isOpen={drawer === 'ADMIN'}
        onClose={() => setDrawer(null)}
        title="Administración"
        subtitle="Cuenta, permisos y alta de estaciones"
        width="max-w-xl"
      >
        <AdminPanel auth={auth} catalog={catalog} />
      </Drawer>
    </div>
  );
}
