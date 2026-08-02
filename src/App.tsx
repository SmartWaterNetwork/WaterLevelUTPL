import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ThingSpeakResponse,
  ThingSpeakFeed,
  ChannelSettings,
  AlertConfig,
  AlertLogItem,
  Station,
} from './types';
import { calculateFlowRate, playAlertChime, triggerPushNotification } from './utils/flowCalculator';
import { Header } from './components/Header';
import { LiveLevelGauge } from './components/LiveLevelGauge';
import { HistoricalChart } from './components/HistoricalChart';
import { AlertManager } from './components/AlertManager';
import { PdfDocsViewer } from './components/PdfDocsViewer';
import { SensorSettingsModal } from './components/SensorSettingsModal';
import { StationMapView } from './components/StationMapView';
import { AlertTriangle, WifiOff, RefreshCw, SlidersHorizontal, Eye, EyeOff, Radio, MapPin, Sparkles, Droplets } from 'lucide-react';

// Initial 4 Stations Configuration for Loja, Ecuador (UTM Zone 17S)
const INITIAL_STATIONS: Station[] = [
  {
    id: 'st-1',
    name: 'Estación 01 - Río Malacatos (Sensor 1)',
    riverName: 'Río Malacatos',
    locationName: 'UTM: 699451.00 m E, 9554704.00 m S',
    lat: -4.026679,
    lng: -79.203472,
    isLiveThingSpeak: true,
    channelId: 3440458,
    apiKey: 'DG5ZMO8WQHQ4D9IK',
    currentLevelCm: 49.37,
    currentFlowLps: 123.4,
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
    installationHeightCm: 100,
    trend: 'STABLE',
    settings: {
      channelId: 3440458,
      apiKey: 'DG5ZMO8WQHQ4D9IK',
      resultsCount: 60,
      autoRefreshInterval: 15,
      installationHeight: 100,
      sensorMaterial: 'PP',
      communicationType: '4-20mA',
      levelUnit: 'cm',
      flowUnit: 'L/s',
      conversionMode: 'MANNING',
      channelWidth: 0.5,
      channelSlope: 0.002,
      manningN: 0.013,
      linearFactor: 2.5,
    },
  },
  {
    id: 'st-2',
    name: 'Estación 02 - Río Zamora (Sensor 2)',
    riverName: 'Río Zamora',
    locationName: 'UTM: 698471.00 m E, 9559387.00 m S',
    lat: -3.984353,
    lng: -79.212388,
    isLiveThingSpeak: true,
    channelId: 3425609,
    apiKey: '',
    currentLevelCm: 52.4,
    currentFlowLps: 131.0,
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
    installationHeightCm: 120,
    trend: 'STABLE',
    settings: {
      channelId: 3425609,
      apiKey: '',
      resultsCount: 60,
      autoRefreshInterval: 15,
      installationHeight: 120,
      sensorMaterial: 'PP',
      communicationType: '4-20mA',
      levelUnit: 'cm',
      flowUnit: 'L/s',
      conversionMode: 'MANNING',
      channelWidth: 0.8,
      channelSlope: 0.0025,
      manningN: 0.013,
      linearFactor: 2.5,
    },
  },
  {
    id: 'st-3',
    name: 'Estación 03 - Quebrada Jipiro (Sensor 3)',
    riverName: 'Quebrada Jipiro',
    locationName: 'UTM: 699558.00 m E, 9555671.00 m S',
    lat: -4.017933,
    lng: -79.202527,
    isLiveThingSpeak: true,
    channelId: 3440461,
    apiKey: '28SBPW323NCPCT3D',
    currentLevelCm: 38.2,
    currentFlowLps: 95.5,
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
    installationHeightCm: 90,
    trend: 'STABLE',
    settings: {
      channelId: 3440461,
      apiKey: '28SBPW323NCPCT3D',
      resultsCount: 60,
      autoRefreshInterval: 15,
      installationHeight: 90,
      sensorMaterial: 'PP',
      communicationType: '4-20mA',
      levelUnit: 'cm',
      flowUnit: 'L/s',
      conversionMode: 'MANNING',
      channelWidth: 0.4,
      channelSlope: 0.003,
      manningN: 0.013,
      linearFactor: 2.5,
    },
  },
  {
    id: 'st-4',
    name: 'Estación 04 - Río Zamora Norte (Sensor 4)',
    riverName: 'Río Zamora Norte',
    locationName: 'UTM: 699836.00 m E, 9560901.00 m S',
    lat: -3.970636,
    lng: -79.200127,
    isLiveThingSpeak: true,
    channelId: 3440462,
    apiKey: '4EFJ92F823NP50SF',
    currentLevelCm: 61.0,
    currentFlowLps: 152.5,
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
    installationHeightCm: 130,
    trend: 'STABLE',
    settings: {
      channelId: 3440462,
      apiKey: '4EFJ92F823NP50SF',
      resultsCount: 60,
      autoRefreshInterval: 15,
      installationHeight: 130,
      sensorMaterial: 'PP',
      communicationType: '4-20mA',
      levelUnit: 'cm',
      flowUnit: 'L/s',
      conversionMode: 'MANNING',
      channelWidth: 1.0,
      channelSlope: 0.002,
      manningN: 0.013,
      linearFactor: 2.5,
    },
  },
];

export default function App() {
  // Mode toggle: false = Simplified / Executive View, true = Technical View with manuals & alert rules
  const [isTechnicalMode, setIsTechnicalMode] = useState<boolean>(false);

  // Active Station Selection
  const [stations, setStations] = useState<Station[]>(INITIAL_STATIONS);
  const [activeStationId, setActiveStationId] = useState<string>('st-1');

  // Currently Selected Station object
  const activeStation = stations.find((s) => s.id === activeStationId) || stations[0];

  // Configurable Alert Rules
  const [alerts, setAlerts] = useState<AlertConfig[]>([
    {
      id: 'rule-max-level',
      name: 'Alerta Crítica: Nivel Alto de Agua',
      type: 'MAX_LEVEL',
      threshold: 60, // > 60 cm
      enabled: true,
      severity: 'critical',
      pushNotification: true,
      soundAlert: true,
    },
    {
      id: 'rule-min-level',
      name: 'Alerta Advertencia: Nivel Bajo de Agua',
      type: 'MIN_LEVEL',
      threshold: 10, // < 10 cm
      enabled: true,
      severity: 'warning',
      pushNotification: true,
      soundAlert: false,
    },
    {
      id: 'rule-max-flow',
      name: 'Alerta Caudal Extremo',
      type: 'MAX_FLOW',
      threshold: 150, // > 150 L/s
      enabled: true,
      severity: 'critical',
      pushNotification: true,
      soundAlert: true,
    },
  ]);

  // Incident Logs History
  const [logs, setLogs] = useState<AlertLogItem[]>([]);

  // State for fetched ThingSpeak Data for active station
  const [feeds, setFeeds] = useState<ThingSpeakFeed[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Active Critical Alert Message Banner
  const [activeAlertBanner, setActiveAlertBanner] = useState<string | null>(null);

  // Keep track of evaluated entry IDs to avoid duplicate alerts
  const evaluatedEntriesRef = useRef<Set<number>>(new Set());

  // Evaluate Alerts on New Feeds
  const evaluateFeedAlerts = useCallback((feed: ThingSpeakFeed, currentSettings: ChannelSettings) => {
    if (!feed.field1 || evaluatedEntriesRef.current.has(feed.entry_id)) return;
    evaluatedEntriesRef.current.add(feed.entry_id);

    const rawLevelCm = Number(feed.field1);
    if (isNaN(rawLevelCm)) return;

    const currentFlowLps = calculateFlowRate(rawLevelCm, currentSettings);
    let bannerMsg: string | null = null;

    alerts.forEach((rule) => {
      if (!rule.enabled) return;

      let isTriggered = false;
      let val = rawLevelCm;
      let unit: string = currentSettings.levelUnit;

      if (rule.type === 'MAX_LEVEL' && rawLevelCm >= rule.threshold) {
        isTriggered = true;
      } else if (rule.type === 'MIN_LEVEL' && rawLevelCm <= rule.threshold) {
        isTriggered = true;
      } else if (rule.type === 'MAX_FLOW' && currentFlowLps >= rule.threshold) {
        isTriggered = true;
        val = currentFlowLps;
        unit = currentSettings.flowUnit;
      }

      if (isTriggered) {
        const title = `🚨 ALERTA: ${rule.name}`;
        const message = `${activeStation.riverName} reportó ${val.toFixed(1)} ${unit} (Umbral: ${rule.threshold} ${unit})`;
        bannerMsg = message;

        // Add Log Item
        const newLog: AlertLogItem = {
          id: `${rule.id}-${feed.entry_id}`,
          timestamp: feed.created_at,
          title: rule.name,
          message,
          type: rule.type,
          value: val,
          unit,
          severity: rule.severity,
          read: false,
        };

        setLogs((prev) => [newLog, ...prev]);

        if (rule.soundAlert && !soundMuted) {
          playAlertChime(rule.severity);
        }

        if (rule.pushNotification) {
          triggerPushNotification(title, message);
        }
      }
    });

    setActiveAlertBanner(bannerMsg);
  }, [alerts, activeStation.riverName, soundMuted]);

  // Fetch ThingSpeak Data for currently active station
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const channelId = activeStation.settings.channelId;
      const apiKey = activeStation.settings.apiKey || '';
      const results = activeStation.settings.resultsCount;

      const url = `/api/thingspeak?channelId=${channelId}&apiKey=${apiKey}&results=${results}`;
      const res = await fetch(url);
      
      let data: ThingSpeakResponse;
      if (res.ok) {
        data = await res.json();
      } else {
        // Direct fallback to ThingSpeak API if Express proxy isn't reached
        const fallbackUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?results=${results}${apiKey ? `&api_key=${apiKey}` : ''}`;
        const fallbackRes = await fetch(fallbackUrl);
        if (!fallbackRes.ok) throw new Error("Fallback ThingSpeak fetch failed");
        data = await fallbackRes.json();
      }

      if (data && data.feeds && data.feeds.length > 0) {
        setFeeds(data.feeds);
        setIsOnline(true);
        const latestFeed = data.feeds[data.feeds.length - 1];
        const newTime = latestFeed.created_at;
        setLastUpdated(newTime);

        const rawLevelCm = Number(latestFeed.field1);
        const validLevel = !isNaN(rawLevelCm) ? rawLevelCm : activeStation.currentLevelCm;
        const flowLps = calculateFlowRate(validLevel, activeStation.settings);

        // Update active station real-time state
        setStations((prev) =>
          prev.map((s) => {
            if (s.id === activeStation.id) {
              let status: 'NORMAL' | 'PRECAUCION' | 'ALERTA' = 'NORMAL';
              if (validLevel >= 70) status = 'ALERTA';
              else if (validLevel >= 58) status = 'PRECAUCION';

              return {
                ...s,
                currentLevelCm: validLevel,
                currentFlowLps: flowLps,
                status,
                lastUpdated: newTime,
              };
            }
            return s;
          })
        );

        // Evaluate Alerts
        evaluateFeedAlerts(latestFeed, activeStation.settings);
      }
    } catch (err) {
      console.error("Error fetching sensor feeds:", err);
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeStation.id, activeStation.settings, activeStation.currentLevelCm]);

  // Background fetch latest telemetry for all 4 stations to update map & cards
  const fetchAllStationsSummary = useCallback(async () => {
    stations.forEach(async (st) => {
      if (!st.settings.channelId) return;
      try {
        const chId = st.settings.channelId;
        const key = st.settings.apiKey || '';
        const url = `/api/thingspeak?channelId=${chId}&apiKey=${key}&results=5`;
        const res = await fetch(url);
        let feedsList: ThingSpeakFeed[] = [];
        if (res.ok) {
          const data = await res.json();
          feedsList = data.feeds || [];
        } else {
          const fbUrl = `https://api.thingspeak.com/channels/${chId}/feeds.json?results=5${key ? `&api_key=${key}` : ''}`;
          const fbRes = await fetch(fbUrl);
          if (fbRes.ok) {
            const data = await fbRes.json();
            feedsList = data.feeds || [];
          }
        }

        if (feedsList.length > 0) {
          const lastFeed = feedsList[feedsList.length - 1];
          const level = Number(lastFeed.field1);
          if (!isNaN(level)) {
            const flow = calculateFlowRate(level, st.settings);
            let status: 'NORMAL' | 'PRECAUCION' | 'ALERTA' = 'NORMAL';
            if (level >= 70) status = 'ALERTA';
            else if (level >= 58) status = 'PRECAUCION';

            setStations((prev) =>
              prev.map((item) =>
                item.id === st.id
                  ? {
                      ...item,
                      currentLevelCm: level,
                      currentFlowLps: flow,
                      status,
                      lastUpdated: lastFeed.created_at,
                    }
                  : item
              )
            );
          }
        }
      } catch (e) {
        console.error(`Failed to background update station ${st.id}`, e);
      }
    });
  }, [stations]);

  // Periodic Telemetry Updates across all 4 live stations
  useEffect(() => {
    fetchAllStationsSummary();
    const timer = setInterval(() => {
      fetchAllStationsSummary();
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Initial Fetch & Auto Refresh Timer for Station 1
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, activeStation.settings.autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [fetchData, activeStation.settings.autoRefreshInterval]);

  // Rain Storm Simulation Event across all 4 stations
  const handleSimulateRainStorm = () => {
    setStations((prev) =>
      prev.map((s) => {
        const surgeLevel = Math.min(s.installationHeightCm * 0.85, s.currentLevelCm + 22.0);
        const surgeFlow = calculateFlowRate(surgeLevel, s.settings);

        return {
          ...s,
          currentLevelCm: surgeLevel,
          currentFlowLps: surgeFlow,
          status: surgeLevel >= 65 ? 'ALERTA' : 'PRECAUCION',
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    setActiveAlertBanner('⚡ Simulación de Tormenta Activa: Incremento de Nivel de Río detectado en cuenca de Loja.');
  };

  // Update Settings for active station
  const handleSaveSettings = (newSettings: ChannelSettings) => {
    setStations((prev) =>
      prev.map((s) => (s.id === activeStationId ? { ...s, settings: newSettings } : s))
    );
  };

  // Current Latest Values for Active Station
  const latestFeed = feeds.length > 0 ? feeds[feeds.length - 1] : null;
  const currentRawLevelCm = activeStation.isLiveThingSpeak
    ? (latestFeed && latestFeed.field1 ? Number(latestFeed.field1) : activeStation.currentLevelCm)
    : activeStation.currentLevelCm;

  const currentFlow = calculateFlowRate(currentRawLevelCm, activeStation.settings);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Header */}
      <Header
        currentRawLevelCm={currentRawLevelCm}
        currentFlow={currentFlow}
        lastUpdated={lastUpdated}
        isOnline={isOnline}
        isLoading={isLoading}
        onRefresh={fetchData}
        onOpenSettings={() => setIsSettingsOpen(true)}
        settings={activeStation.settings}
        soundMuted={soundMuted}
        onToggleMute={() => setSoundMuted(!soundMuted)}
        isTechnicalMode={isTechnicalMode}
        onToggleTechnicalMode={() => setIsTechnicalMode(!isTechnicalMode)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        
        {/* Active Alert Banner */}
        {activeAlertBanner && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 text-red-900 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-900">¡Alerta Hidrológica Detectada!</h3>
                <p className="text-xs text-red-700 font-medium">{activeAlertBanner}</p>
              </div>
            </div>
            <button
              onClick={() => setActiveAlertBanner(null)}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded-xl transition-colors shadow-sm"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Section 1: Geographic Map & 4-Station Positioning View */}
        <StationMapView
          stations={stations}
          activeStationId={activeStationId}
          onSelectStation={(id) => setActiveStationId(id)}
          onSimulateRainStorm={handleSimulateRainStorm}
          feeds={feeds}
        />

        {/* Offline Warning Banner for Station 1 */}
        {!isOnline && activeStation.isLiveThingSpeak && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 text-amber-900">
            <div className="flex items-center gap-3">
              <WifiOff className="w-5 h-5 text-amber-600" />
              <div className="text-xs font-medium">
                <strong className="block text-slate-900 font-bold">Estación #{activeStation.settings.channelId} sin conexión</strong>
                <span>Compruebe la conexión a internet o el servidor telemático.</span>
              </div>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-900 px-3.5 py-1.5 rounded-xl border border-amber-300 font-bold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        )}

        {/* Section 2: Live Interactive 2D/3D Level Gauge Geometry for Selected Station */}
        <LiveLevelGauge
          currentRawLevelCm={currentRawLevelCm}
          lastUpdated={lastUpdated}
          settings={activeStation.settings}
          stationName={activeStation.name}
          riverName={activeStation.riverName}
          locationName={activeStation.locationName}
          coordinates={{ lat: activeStation.lat, lng: activeStation.lng }}
        />

        {/* Section 3: Historical Chart */}
        <HistoricalChart
          feeds={feeds}
          isLoading={isLoading}
          onRefresh={fetchData}
          resultsCount={activeStation.settings.resultsCount}
          onResultsCountChange={(count) =>
            handleSaveSettings({ ...activeStation.settings, resultsCount: count })
          }
          settings={activeStation.settings}
          alerts={alerts}
        />

        {/* Section 4: Technical Information View Switcher */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex-shrink-0">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Modo de Visualización:</span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isTechnicalMode ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {isTechnicalMode ? 'Vista Técnica Completa' : 'Vista Simplificada / Operativa'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {isTechnicalMode
                  ? 'Se muestran parámetros detallados del canal, gestor de alertas push, registro de incidentes y manuales de instalación.'
                  : 'Los detalles técnicos complejos se encuentran ocultos para ofrecer una vista hidrológica limpia y enfocada.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsTechnicalMode(!isTechnicalMode)}
            className={`flex items-center gap-2 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-sm whitespace-nowrap ${
              isTechnicalMode
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isTechnicalMode ? (
              <>
                <EyeOff className="w-4 h-4 text-slate-600" />
                <span>Ocultar Información Técnica</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Ver Información Técnica y Manuales</span>
              </>
            )}
          </button>
        </div>

        {/* Section 5: Technical Modules (Alert Manager & PDF Manuals) */}
        {isTechnicalMode && (
          <div className="space-y-6 animate-fadeIn">
            {/* Alert Manager & Push Notification Config */}
            <AlertManager
              alerts={alerts}
              onUpdateAlerts={setAlerts}
              logs={logs}
              onClearLogs={() => setLogs([])}
              settings={activeStation.settings}
            />

            {/* PDF Manual Documentation & Technical Diagrams */}
            <PdfDocsViewer />
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 font-medium">
          <p>
            &copy; 2026 Red de Telemetría Hidrológica de Loja &bull; Monitoreo de Ríos y Prevención de Inundaciones
          </p>
          <div className="flex items-center gap-4 text-slate-600">
            <span>Río Malacatos (-4.0251, -79.2005)</span>
            <span>&bull;</span>
            <span>Río Zamora (-3.9965, -79.1976)</span>
            <span>&bull;</span>
            <span>Sensor IP68</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SensorSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={activeStation.settings}
        onSaveSettings={handleSaveSettings}
      />
    </div>
  );
}
