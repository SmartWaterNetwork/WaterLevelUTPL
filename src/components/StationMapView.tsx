import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { Station, ThingSpeakFeed } from '../types';
import { MapThreeJsFlowOverlay } from './MapThreeJsFlowOverlay';
import { MapD3FlowOverlay } from './MapD3FlowOverlay';
import {
  MapPin,
  Compass,
  Radio,
  Waves,
  Sparkles,
  Layers,
  Waypoints,
  X,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ArrowRight,
} from 'lucide-react';

interface StationMapViewProps {
  stations: Station[];
  activeStationId: string;
  onSelectStation: (id: string) => void;
  onSimulateRainStorm?: () => void;
  feeds?: ThingSpeakFeed[];
}

export type MapboxStyleType = 'satellite-streets-v12' | 'outdoors-v12' | 'streets-v12' | 'dark-v11' | 'light-v11';

export interface MvtRiverInspectData {
  lat: number;
  lng: number;
  properties: Record<string, any>;
  nearestStation: Station;
  distanceMeters: number;
  estimatedLevelCm: number;
  estimatedFlowLps: number;
  riskStatus: 'NORMAL' | 'PRECAUCION' | 'ALERTA';
}

const MAPBOX_TOKEN =
  ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MAPBOX_TOKEN) ||
  'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3ifQ.rA3CnP0WydKLi1_1A1Ab1g';

const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

const ELLIPSIS_MVT_RIVERS_URL =
  'https://api.ellipsis-drive.com/v3/ogc/mvt/c001410b-232a-43c7-945a-2989b88f0a6d/{z}/{x}/{y}?timestampId=6890e507-e7e8-45c7-82c8-0c411563fc5d&token=epat_g6H3SbsolcBukmxPlYifqUkp5BdyUYK3e4n09WUeT1GlXP1lUFAwIDfR1JN6fRjh';

// Calculate distance in meters between two geographical points
const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export const StationMapView: React.FC<StationMapViewProps> = ({
  stations,
  activeStationId,
  onSelectStation,
  onSimulateRainStorm,
  feeds = [],
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const mvtLayerRef = useRef<L.Layer | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Toggles for D3 river animation overlay, Ellipsis MVT layer & Mapbox style
  const [isD3FlowActive, setIsD3FlowActive] = useState<boolean>(true);
  const [isMvtLayerActive, setIsMvtLayerActive] = useState<boolean>(true);
  const [is3dOverlayActive] = useState<boolean>(false);
  const [mapStyle, setMapStyle] = useState<MapboxStyleType>('light-v11');

  const [currentZoom, setCurrentZoom] = useState<number>(13);
  const [inspectedRiver, setInspectedRiver] = useState<MvtRiverInspectData | null>(null);
  const inspectMarkerRef = useRef<L.Marker | null>(null);

  // Keep a persistent ref to stations so vector tile callbacks read the latest state without tearing down the layer
  const stationsRef = useRef<Station[]>(stations);
  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  // Station Selection trigger
  const handleStationClick = (stId: string) => {
    onSelectStation(stId);
    const st = stations.find((s) => s.id === stId);
    if (st && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.lat, st.lng], 15, { duration: 1.2 });
    }
  };

  // Initialize Map with Mapbox Base Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center map around Loja, Ecuador (-4.008, -79.197)
    const map = L.map(mapContainerRef.current, {
      center: [-4.008, -79.197],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    const handleZoomEnd = () => {
      setCurrentZoom(map.getZoom());
    };
    map.on('zoomend', handleZoomEnd);

    const mapboxLayer = L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
        attribution: MAPBOX_ATTRIBUTION,
      }
    );

    mapboxLayer.addTo(map);
    baseTileLayerRef.current = mapboxLayer;

    mapInstanceRef.current = map;
    setMapInstance(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamic Mapbox Tile Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
    }

    const mapboxTile = L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
      {
        maxZoom: 19,
        tileSize: 512,
        zoomOffset: -1,
        attribution: MAPBOX_ATTRIBUTION,
      }
    );

    mapboxTile.addTo(map);
    baseTileLayerRef.current = mapboxTile;
  }, [mapStyle]);

  // Ellipsis Drive MVT Vector Tiles Layer with Option 1 (Dynamic Styling) & Option 2 (Click Inspection)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (mvtLayerRef.current) {
      map.removeLayer(mvtLayerRef.current);
      mvtLayerRef.current = null;
    }

    if (isMvtLayerActive) {
      try {
        const vectorGrid = (L as any).vectorGrid;
        if (vectorGrid && vectorGrid.protobuf) {
          const mvtLayer = vectorGrid.protobuf(ELLIPSIS_MVT_RIVERS_URL, {
            rendererFactory: (L as any).svg.tile,
            vectorTileLayerStyles: {
              '*': (properties: any) => {
                const currentStations = stationsRef.current;
                const propString = JSON.stringify(properties || {}).toLowerCase();

                // Find matching station by river name in properties
                let targetStation = currentStations.find((s) => propString.includes(s.riverName.toLowerCase()));

                // If target station is found for this river stretch and has elevated telemetry status
                if (targetStation) {
                  if (targetStation.status === 'ALERTA') {
                    return {
                      weight: 5.5,
                      color: '#dc2626', // Red alert for flood danger
                      opacity: 0.95,
                      stroke: true,
                      fill: false,
                      dashArray: '70, 170',
                      className: 'mvt-river-path-alert',
                    };
                  } else if (targetStation.status === 'PRECAUCION') {
                    return {
                      weight: 4.5,
                      color: '#d97706', // Amber warning for rising level
                      opacity: 0.9,
                      stroke: true,
                      fill: false,
                      dashArray: '70, 170',
                      className: 'mvt-river-path-warning',
                    };
                  }
                }

                // Default natural static river vector line (unanimated solid channel)
                return {
                  weight: 3.2,
                  color: '#0284c7', // Azure blue natural river line
                  opacity: 0.8,
                  stroke: true,
                  fill: false,
                  className: 'mvt-river-path-static',
                };
              },
            },
            maxNativeZoom: 13,
            maxZoom: 22,
            minZoom: 1,
            getFeatureId: (f: any) => f.properties?.id || f.properties?.fid || f.properties?.name || 'river-feature',
            interactive: true,
          });

          // Option 2: Interactive Click on MVT River Vector Features
          mvtLayer.on('click', (e: any) => {
            if (!e.latlng) return;
            const clickLat = e.latlng.lat;
            const clickLng = e.latlng.lng;
            const currentStations = stationsRef.current;

            if (!currentStations || currentStations.length === 0) return;

            // Find nearest station
            let minDistance = Infinity;
            let nearest: Station = currentStations[0];

            currentStations.forEach((st) => {
              const dist = calculateDistanceMeters(clickLat, clickLng, st.lat, st.lng);
              if (dist < minDistance) {
                minDistance = dist;
                nearest = st;
              }
            });

            const properties = e.layer?.properties || e.layer?.feature?.properties || {};

            // Calculate estimated local hydrometrics
            const distFactor = Math.min(1.15, Math.max(0.85, 1 + (Math.sin(clickLat * 500) * 0.08)));
            const estimatedLevel = Math.max(10, Math.round(nearest.currentLevelCm * distFactor * 10) / 10);
            const estimatedFlow = Math.max(5, Math.round(nearest.currentFlowLps * distFactor * 10) / 10);

            let riskStatus: 'NORMAL' | 'PRECAUCION' | 'ALERTA' = 'NORMAL';
            if (estimatedLevel >= 70) riskStatus = 'ALERTA';
            else if (estimatedLevel >= 58) riskStatus = 'PRECAUCION';

            setInspectedRiver({
              lat: clickLat,
              lng: clickLng,
              properties,
              nearestStation: nearest,
              distanceMeters: minDistance,
              estimatedLevelCm: estimatedLevel,
              estimatedFlowLps: estimatedFlow,
              riskStatus,
            });

            // Highlight location marker
            if (mapInstanceRef.current) {
              if (inspectMarkerRef.current) {
                mapInstanceRef.current.removeLayer(inspectMarkerRef.current);
              }

              const markerColor = riskStatus === 'ALERTA' ? '#ef4444' : riskStatus === 'PRECAUCION' ? '#f59e0b' : '#0284c7';
              const customIcon = L.divIcon({
                className: 'mvt-inspect-marker',
                html: `<div style="
                  width: 20px;
                  height: 20px;
                  background-color: ${markerColor};
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 0 12px ${markerColor};
                "></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });

              const marker = L.marker([clickLat, clickLng], { icon: customIcon }).addTo(mapInstanceRef.current);
              inspectMarkerRef.current = marker;
            }
          });

          mvtLayer.addTo(map);
          mvtLayerRef.current = mvtLayer;
        }
      } catch (err) {
        console.error('Error adding Ellipsis Drive MVT vector layer:', err);
      }
    }

    return () => {
      if (map && mvtLayerRef.current) {
        map.removeLayer(mvtLayerRef.current);
        mvtLayerRef.current = null;
      }
    };
  }, [mapInstance, isMvtLayerActive]);

  // Smoothly redraw MVT layer when station telemetry changes without tearing down the layer
  useEffect(() => {
    if (mvtLayerRef.current && (mvtLayerRef.current as any).redraw) {
      try {
        (mvtLayerRef.current as any).redraw();
      } catch (e) {
        // silent
      }
    }
  }, [stations]);

  // Update Station Markers on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const isFarAway = currentZoom < 13.8;

    stations.forEach((st) => {
      const isSelected = st.id === activeStationId;

      // Status color styling
      let badgeBg = 'bg-emerald-500';
      let borderCol = 'border-emerald-400';
      let liquidBg = 'bg-sky-500';
      let flowColor = 'text-sky-300';

      if (st.status === 'PRECAUCION') {
        badgeBg = 'bg-amber-500';
        borderCol = 'border-amber-400';
        liquidBg = 'bg-amber-500';
        flowColor = 'text-amber-300';
      } else if (st.status === 'ALERTA') {
        badgeBg = 'bg-red-600';
        borderCol = 'border-red-500';
        liquidBg = 'bg-red-600';
        flowColor = 'text-red-300';
      }

      // Percentage height for graphic river level gauge (0 to 100 cm max)
      const fillPercent = Math.min(100, Math.max(8, (st.currentLevelCm / 100) * 100));
      const flowM3s = (st.currentFlowLps / 1000).toFixed(3);

      let htmlContent = '';
      if (isD3FlowActive) {
        htmlContent = `
          <div class="relative flex items-center justify-center w-8 h-8 group cursor-pointer">
            <div class="absolute w-8 h-8 rounded-full ${badgeBg} opacity-30 animate-ping"></div>
            <div class="relative w-4 h-4 rounded-full ${badgeBg} border-2 border-white shadow-lg flex items-center justify-center ${
            isSelected ? 'ring-4 ring-blue-500/70 scale-125' : ''
          }">
              <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
            </div>
          </div>
        `;
      } else if (isFarAway) {
        // Compact Caudal Badge when far away for all stations
        htmlContent = `
          <div class="relative flex items-center gap-1.5 bg-slate-950/95 text-white px-2.5 py-1.5 rounded-xl border-2 ${borderCol} shadow-xl backdrop-blur-md cursor-pointer">
            <span class="w-2 h-2 rounded-full ${badgeBg} animate-pulse shrink-0"></span>
            <div class="flex flex-col leading-tight">
              <span class="text-[9px] text-slate-400 font-sans font-bold">${st.riverName}</span>
              <span class="text-[11px] font-extrabold text-sky-400 font-mono">Q: ${st.currentFlowLps.toFixed(1)} L/s</span>
            </div>
          </div>
        `;
      } else {
        // Detailed Level Gauge Card when close
        htmlContent = `
          <div class="relative flex items-center gap-2.5 group cursor-pointer">
            <div class="absolute -left-1 -top-1 w-10 h-10 rounded-full ${badgeBg} opacity-25 animate-ping"></div>
            
            <div class="relative flex flex-col justify-between items-center w-5 h-16 bg-slate-950/95 rounded-full border-2 ${borderCol} p-0.5 shadow-2xl overflow-hidden shrink-0">
              <div class="absolute bottom-0 w-full ${liquidBg} rounded-b-full transition-all duration-700 ease-out flex items-center justify-center opacity-90" style="height: ${fillPercent}%;">
                <div class="w-full h-1 bg-white/40 animate-pulse"></div>
              </div>
              <div class="relative z-10 text-[8px] font-mono font-bold text-white/90 text-center leading-none mt-1">100</div>
              <div class="relative z-10 text-[8px] font-mono font-bold text-white/90 text-center leading-none mb-1">0</div>
            </div>

            <div class="relative flex flex-col bg-slate-900/95 text-white px-3.5 py-2.5 rounded-2xl border-2 ${borderCol} shadow-2xl backdrop-blur-md min-w-[170px] transition-transform transform ${
            isSelected ? 'scale-110 ring-4 ring-blue-500/60' : 'hover:scale-105'
          }">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="w-2 h-2 rounded-full ${badgeBg} animate-pulse"></span>
                <span class="font-extrabold text-slate-100 text-xs font-sans whitespace-nowrap truncate">${st.riverName}</span>
              </div>
              <div class="flex items-center justify-between gap-3 text-xs font-mono mb-1">
                <span class="text-emerald-400 font-black text-xs">h: ${st.currentLevelCm.toFixed(1)} cm</span>
                <span class="${flowColor} font-bold">Q: ${st.currentFlowLps.toFixed(1)} L/s</span>
              </div>
              <div class="text-[10px] text-slate-300 font-mono flex items-center justify-between gap-2 border-t border-slate-800/80 pt-1">
                <span>Q: ${flowM3s} m³/s</span>
                <span class="uppercase font-bold ${st.status === 'NORMAL' ? 'text-emerald-400' : st.status === 'PRECAUCION' ? 'text-amber-400' : 'text-red-400'}">${st.status}</span>
              </div>
            </div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        className: 'custom-station-pin',
        html: htmlContent,
        iconSize: isD3FlowActive ? [32, 32] : isFarAway ? [140, 36] : [200, 75],
        iconAnchor: isD3FlowActive ? [16, 16] : isFarAway ? [10, 18] : [100, 37],
      });

      if (markersRef.current[st.id]) {
        markersRef.current[st.id].setLatLng([st.lat, st.lng]);
        markersRef.current[st.id].setIcon(customIcon);
      } else {
        const marker = L.marker([st.lat, st.lng], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          handleStationClick(st.id);
        });
        markersRef.current[st.id] = marker;
      }
    });
  }, [stations, activeStationId, isD3FlowActive, currentZoom, onSelectStation]);

  // Center Map on Active Station
  const handleFlyToStation = (st: Station) => {
    handleStationClick(st.id);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <Radio className="w-5 h-5 text-blue-600 animate-pulse" />
            <h3>Red Telemetría Hidrológica - 4 Estaciones en Loja</h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Mapa interactivo con medidor gráfico de nivel de río y caudal (Q) en cada punto de control.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Map Style Switcher Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <Layers className="w-4 h-4 text-slate-500 ml-1.5" />
            <span className="text-xs font-bold text-slate-700 hidden md:inline">Estilo de Mapa:</span>
            <select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value as MapboxStyleType)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="light-v11">Mapa Claro</option>
              <option value="dark-v11">Mapa Oscuro</option>
              <option value="outdoors-v12">Topográfico e Hidrográfico</option>
              <option value="satellite-streets-v12">Vista Satelital HD</option>
              <option value="streets-v12">Calles y Caminos</option>
            </select>
          </div>

          {/* River Flow Animation Toggle */}
          <button
            onClick={() => setIsD3FlowActive(!isD3FlowActive)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
              isD3FlowActive
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Waves className="w-4 h-4" />
            <span>Animación Flujo: {isD3FlowActive ? 'ACTIVADA' : 'DESACTIVADA'}</span>
          </button>

          {/* Ellipsis Drive Vector Tiles MVT River Layer Toggle */}
          <button
            onClick={() => setIsMvtLayerActive(!isMvtLayerActive)}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-all ${
              isMvtLayerActive
                ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Waypoints className="w-4 h-4" />
            <span>Vector Tiles Ríos (Ellipsis): {isMvtLayerActive ? 'ACTIVADA' : 'DESACTIVADA'}</span>
          </button>

          {/* Rain Storm Simulation Trigger */}
          {onSimulateRainStorm && (
            <button
              onClick={onSimulateRainStorm}
              className="flex items-center gap-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-2 rounded-xl border border-amber-200 shadow-sm transition-all whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-500 animate-bounce" />
              <span>Simular Lluvia</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Stations Quick Switcher Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stations.map((st, index) => {
          const isSelected = st.id === activeStationId;

          let statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          let statusText = 'Normal';
          if (st.status === 'PRECAUCION') {
            statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
            statusText = 'Precaución';
          } else if (st.status === 'ALERTA') {
            statusBadgeClass = 'bg-red-50 text-red-800 border-red-200';
            statusText = 'Alerta Crecida';
          }

          const fillPercent = Math.min(100, Math.max(5, (st.currentLevelCm / 100) * 100));

          return (
            <button
              key={st.id}
              onClick={() => handleFlyToStation(st)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-400/30 shadow-md scale-[1.02]'
                  : 'bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {/* Station Number Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                  Posición #{index + 1}
                </span>

                {st.isLiveThingSpeak ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                    En Vivo
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
                    Simulado
                  </span>
                )}
              </div>

              {/* Station Titles */}
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-slate-900 leading-tight">{st.name}</h4>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span className="truncate">{st.locationName}</span>
                </p>
              </div>

              {/* Mini Graphic Level Tube inside Card */}
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center gap-3">
                <div className="w-3 h-10 bg-slate-200 rounded-full overflow-hidden relative border border-slate-300 shrink-0">
                  <div
                    className={`absolute bottom-0 w-full transition-all duration-500 ${
                      st.status === 'NORMAL' ? 'bg-emerald-500' : st.status === 'PRECAUCION' ? 'bg-amber-500' : 'bg-red-600'
                    }`}
                    style={{ height: `${fillPercent}%` }}
                  />
                </div>

                <div className="flex-1 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-600 block">Nivel de Agua</span>
                    <div className="text-base font-extrabold text-blue-700 font-mono">
                      {st.currentLevelCm.toFixed(1)} <span className="text-xs font-bold text-slate-600">cm</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${statusBadgeClass}`}>
                      {statusText}
                    </span>
                    <span className="text-[10px] text-slate-700 font-bold block mt-0.5">
                      {st.currentFlowLps.toFixed(1)} L/s
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Map Canvas with D3.js River Flow Layer & Mapbox Style */}
      <div className="relative w-full h-[380px] md:h-[440px] rounded-2xl overflow-hidden border border-slate-300 shadow-inner group">
        {/* Mapbox Style Satellite/Dark Map */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* D3.js River Vector Flow Overlay with Graphic Gauges on Each Point */}
        <MapD3FlowOverlay
          stations={stations}
          activeStationId={activeStationId}
          isD3FlowActive={isD3FlowActive}
          mapInstance={mapInstance}
          onSelectStation={(id) => handleStationClick(id)}
        />

        {/* Optional Three.js Particle Overlay if activated */}
        <MapThreeJsFlowOverlay
          stations={stations}
          activeStationId={activeStationId}
          is3dOverlayActive={is3dOverlayActive}
        />

        {/* Interactive MVT River Reach Inspection Card (Option 2) */}
        {inspectedRiver && (
          <div className="absolute top-3 left-3 z-30 bg-slate-900/95 text-white backdrop-blur-md p-4 rounded-2xl border border-slate-700 shadow-2xl max-w-xs sm:max-w-sm w-full space-y-3 font-sans transition-all animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Waypoints className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">
                    Inspección de Tramo de Río
                  </h4>
                  <p className="text-[10px] text-slate-400">Vector Tiles (MVT Ellipsis Drive)</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInspectedRiver(null);
                  if (inspectMarkerRef.current && mapInstanceRef.current) {
                    mapInstanceRef.current.removeLayer(inspectMarkerRef.current);
                    inspectMarkerRef.current = null;
                  }
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Nearest Telemetry Station Badge */}
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-medium">Estación de Control:</span>
                <span className="font-bold text-sky-300">{inspectedRiver.nearestStation.riverName}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300 font-mono">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-emerald-400" />
                  <span>Distancia Telemétrica:</span>
                </span>
                <span className="font-bold text-emerald-400">
                  {inspectedRiver.distanceMeters < 1000
                    ? `${inspectedRiver.distanceMeters} m`
                    : `${(inspectedRiver.distanceMeters / 1000).toFixed(2)} km`}
                </span>
              </div>
            </div>

            {/* Local Estimated Hydrometrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Nivel Estimado (h)</span>
                <span className="text-sm font-black text-white font-mono">
                  {inspectedRiver.estimatedLevelCm.toFixed(1)} <span className="text-[10px] text-slate-400 font-sans">cm</span>
                </span>
              </div>
              <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 block font-medium">Caudal Estimado (Q)</span>
                <span className="text-sm font-black text-sky-400 font-mono">
                  {inspectedRiver.estimatedFlowLps.toFixed(1)} <span className="text-[10px] text-slate-400 font-sans">L/s</span>
                </span>
              </div>
            </div>

            {/* Risk Level Assessment */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Estado en Tramo:
              </span>
              {inspectedRiver.riskStatus === 'ALERTA' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-red-400 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800">
                  <AlertTriangle className="w-3 h-3" /> ALERTA DE CRECIDA
                </span>
              ) : inspectedRiver.riskStatus === 'PRECAUCION' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-800">
                  <Activity className="w-3 h-3" /> PRECAUCIÓN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" /> CAUCE NORMAL
                </span>
              )}
            </div>

            {/* Action button: Fly to station */}
            <button
              onClick={() => handleFlyToStation(inspectedRiver.nearestStation)}
              className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs py-2 px-3 rounded-xl transition-all shadow-md active:scale-95"
            >
              <span>Enfocar Estación {inspectedRiver.nearestStation.riverName}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Map Legend & Hydro Flow Scale Bar */}
        <div className="absolute bottom-3 right-3 bg-slate-900/90 text-white backdrop-blur-md p-3.5 rounded-2xl border border-slate-700 shadow-xl text-[11px] font-semibold space-y-2 z-20 pointer-events-none">
          <div className="text-[10px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center justify-between gap-4">
            <span className="flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>Estaciones Telemétricas de Loja</span>
            </span>
            <span className="text-[9px] text-emerald-400 font-mono">Q = A × V</span>
          </div>

          {/* Vector Tile Layer Status Indicator */}
          <div className="flex items-center justify-between text-[10px] text-sky-300 font-mono bg-sky-950/80 px-2 py-1 rounded-lg border border-sky-800/80">
            <span className="flex items-center gap-1.5">
              <Waypoints className="w-3 h-3 text-sky-400" />
              <span>Vector Tiles (MVT Ellipsis)</span>
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${isMvtLayerActive ? 'bg-sky-500/30 text-sky-300' : 'bg-slate-800 text-slate-500'}`}>
              {isMvtLayerActive ? 'Activa' : 'Oculta'}
            </span>
          </div>

          {/* Velocity Color Ramp Bar (SpinUnit Hydro Dynamic style) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
              <span>0.1 m/s (Bajo)</span>
              <span>1.0 m/s</span>
              <span>&gt; 2.5 m/s (Crecida)</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-amber-500 border border-slate-700" />
          </div>

          {/* Station Coordinates List */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-300 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              <span>Malacatos: -4.0267</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              <span>Zamora: -3.9844</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Jipiro: -4.0179</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              <span>Zamora N: -3.9706</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
