import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { StationState } from '../types';
import { status as statusColor, statusLabel } from '../theme';
import { num } from '../utils/format';
import { Layers, X } from 'lucide-react';

export type BasemapStyle =
  | 'light-v11'
  | 'outdoors-v12'
  | 'satellite-streets-v12'
  | 'streets-v12'
  | 'dark-v11';

const BASEMAPS: { id: BasemapStyle; label: string }[] = [
  { id: 'light-v11', label: 'Claro' },
  { id: 'outdoors-v12', label: 'Topográfico' },
  { id: 'satellite-streets-v12', label: 'Satelital' },
  { id: 'streets-v12', label: 'Calles' },
  { id: 'dark-v11', label: 'Oscuro' },
];

const MAPBOX_TOKEN =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MAPBOX_TOKEN ?? '';

const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const RIVERS_MVT_URL =
  'https://api.ellipsis-drive.com/v3/ogc/mvt/c001410b-232a-43c7-945a-2989b88f0a6d/{z}/{x}/{y}?timestampId=6890e507-e7e8-45c7-82c8-0c411563fc5d&token=epat_g6H3SbsolcBukmxPlYifqUkp5BdyUYK3e4n09WUeT1GlXP1lUFAwIDfR1JN6fRjh';

interface MapPanelProps {
  stations: StationState[];
  activeId: string;
  onSelect: (id: string) => void;
  center: [number, number];
  zoom: number;
}

function basemapUrl(style: BasemapStyle): string {
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
}

/** Marker markup. Labels collapse to the dot alone when zoomed far out. */
function markerHtml(station: StationState, isActive: boolean, showLabel: boolean): string {
  const color = statusColor[station.status];
  const dot = `<span class="station-marker__dot" style="background:${color}"></span>`;

  if (!showLabel) {
    return `<div class="station-marker__inner">${dot}</div>`;
  }

  const value = station.latest
    ? `${num(station.latest.level, 1)} ${station.config.settings.levelUnit} · ${num(
        station.latest.flow,
        1
      )} ${station.config.settings.flowUnit}`
    : `<em>${statusLabel[station.status]}</em>`;

  return `
    <div class="station-marker__inner">
      ${dot}
      <span class="station-marker__label">
        <span class="station-marker__name">${station.config.riverName}</span>
        <span class="station-marker__value">${value}</span>
      </span>
    </div>
  `;
}

/**
 * The map is the primary view: a quiet basemap, the river network as vector
 * tiles, and one marker per station. Everything else floats above it.
 */
export const MapPanel: React.FC<MapPanelProps> = ({ stations, activeId, onSelect, center, zoom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const riversLayerRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [basemap, setBasemap] = useState<BasemapStyle>('light-v11');
  const [showRivers, setShowRivers] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // Callbacks registered on Leaflet layers outlive a render, so read live data
  // through refs instead of closing over it.
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // --- Map instance -------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    map.zoomControl.setPosition('bottomright');
    map.on('zoomend', () => setCurrentZoom(map.getZoom()));

    mapRef.current = map;
    setCurrentZoom(map.getZoom());

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = {};
    };
    // Mounting only; center/zoom are the initial view by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Basemap ------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseLayerRef.current) map.removeLayer(baseLayerRef.current);

    // Without a Mapbox token the styled tiles 401 and the map renders blank —
    // fall back to plain OSM so the view still works.
    const layer = MAPBOX_TOKEN
      ? L.tileLayer(basemapUrl(basemap), {
          maxZoom: 19,
          tileSize: 512,
          zoomOffset: -1,
          attribution: MAPBOX_ATTRIBUTION,
        })
      : L.tileLayer(OSM_URL, { maxZoom: 19, attribution: OSM_ATTRIBUTION });

    layer.addTo(map);
    layer.bringToBack();
    baseLayerRef.current = layer;
  }, [basemap]);

  // --- River network (vector tiles) ---------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (riversLayerRef.current) {
      map.removeLayer(riversLayerRef.current);
      riversLayerRef.current = null;
    }
    if (!showRivers) return;

    const vectorGrid = (L as unknown as { vectorGrid?: { protobuf: (url: string, opts: unknown) => L.Layer } })
      .vectorGrid;
    if (!vectorGrid?.protobuf) return;

    const styleFor = (properties: Record<string, unknown>) => {
      const asText = JSON.stringify(properties ?? {}).toLowerCase();
      const match = stationsRef.current.find((s) =>
        asText.includes(s.config.riverName.toLowerCase())
      );

      if (match?.status === 'ALERTA') {
        return { weight: 3, color: statusColor.ALERTA, opacity: 0.95, fill: false, className: 'river-alert' };
      }
      if (match?.status === 'PRECAUCION') {
        return { weight: 2.5, color: statusColor.PRECAUCION, opacity: 0.95, fill: false, className: 'river-warn' };
      }
      return { weight: 1.4, color: '#9dc0dd', opacity: 0.9, fill: false, className: 'river-normal' };
    };

    try {
      const layer = vectorGrid.protobuf(RIVERS_MVT_URL, {
        rendererFactory: (L as unknown as { svg: { tile: unknown } }).svg.tile,
        // leaflet.vectorgrid looks the style up by MVT layer name and has no
        // wildcard, so without this proxy every reach silently falls back to
        // Leaflet's default 3px #3388ff path.
        vectorTileLayerStyles: new Proxy({} as Record<string, unknown>, {
          get: () => styleFor,
          has: () => true,
        }),
        maxNativeZoom: 13,
        maxZoom: 22,
        minZoom: 1,
        interactive: false,
      });

      layer.addTo(map);
      riversLayerRef.current = layer;
    } catch (err) {
      console.error('No se pudo cargar la capa de ríos:', err);
    }
  }, [showRivers]);

  // Restyle the reaches when a station changes state, without a full rebuild.
  useEffect(() => {
    const layer = riversLayerRef.current as (L.Layer & { redraw?: () => void }) | null;
    layer?.redraw?.();
  }, [stations]);

  // --- Station markers ----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const showLabel = currentZoom >= 12;

    stations.forEach((station) => {
      const isActive = station.config.id === activeId;
      const icon = L.divIcon({
        className: `station-marker${isActive ? ' station-marker--active' : ''}`,
        html: markerHtml(station, isActive, showLabel),
        iconSize: undefined,
        iconAnchor: [7, 7],
      });

      const existing = markersRef.current[station.config.id];
      if (existing) {
        existing.setIcon(icon);
        existing.setZIndexOffset(isActive ? 1000 : 0);
      } else {
        const marker = L.marker([station.config.lat, station.config.lng], {
          icon,
          title: `${station.config.riverName} — ${station.config.name}`,
          zIndexOffset: isActive ? 1000 : 0,
        }).addTo(map);
        marker.on('click', () => onSelectRef.current(station.config.id));
        markersRef.current[station.config.id] = marker;
      }
    });
  }, [stations, activeId, currentZoom]);

  // Open on the whole network, then follow the selection. Flying straight to
  // the default station on load would hide the other three off-screen.
  const hasFramedRef = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || hasFramedRef.current || stations.length === 0) return;
    hasFramedRef.current = true;
    map.fitBounds(
      L.latLngBounds(stations.map((s) => [s.config.lat, s.config.lng] as [number, number])),
      { padding: [72, 72], maxZoom: 14 }
    );
  }, [stations]);

  const previousActiveRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const station = stations.find((s) => s.config.id === activeId);
    if (!map || !station) return;

    // Skip the first run so the initial fitBounds survives.
    if (previousActiveRef.current === null) {
      previousActiveRef.current = activeId;
      return;
    }
    if (previousActiveRef.current === activeId) return;
    previousActiveRef.current = activeId;

    map.flyTo([station.config.lat, station.config.lng], Math.max(map.getZoom(), 14), {
      duration: 0.9,
    });
    // Only react to the selection itself, not to every telemetry refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  // Leaflet needs a nudge whenever its container is resized by the layout.
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const legendStates = ['NORMAL', 'PRECAUCION', 'ALERTA', 'OFFLINE'] as const;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Layer controls */}
      <div className="absolute top-3 right-3 z-20">
        {layersOpen ? (
          <div className="w-52 bg-surface border border-hairline rounded-lg shadow-sm animate-fadeIn">
            <div className="flex items-center justify-between px-3 py-2 border-b border-hairline">
              <span className="eyebrow">Capas</span>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                className="text-ink-3 hover:text-ink"
                aria-label="Cerrar capas"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div>
                <label htmlFor="basemap" className="text-[11px] text-ink-2 block mb-1.5">
                  Mapa base
                </label>
                <select
                  id="basemap"
                  value={basemap}
                  onChange={(e) => setBasemap(e.target.value as BasemapStyle)}
                  className="w-full text-[12px] border border-hairline rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-ink-3"
                >
                  {BASEMAPS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRivers}
                  onChange={(e) => setShowRivers(e.target.checked)}
                  className="accent-ink w-3.5 h-3.5"
                />
                Red hidrográfica
              </label>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLayersOpen(true)}
            className="flex items-center gap-1.5 bg-surface border border-hairline rounded-lg px-2.5 py-1.5 text-[12px] text-ink-2 hover:text-ink shadow-sm"
          >
            <Layers className="w-3.5 h-3.5" />
            Capas
          </button>
        )}
      </div>

      {/* Legend — colour is always paired with its label. */}
      <div className="absolute bottom-3 left-3 z-20 bg-surface/95 border border-hairline rounded-lg px-3 py-2 shadow-sm">
        <div className="eyebrow mb-1.5">Estado del nivel</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {legendStates.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-ink-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: statusColor[key] }}
                aria-hidden="true"
              />
              {statusLabel[key]}
            </span>
          ))}
        </div>
      </div>

      {!MAPBOX_TOKEN && (
        <div className="absolute top-3 left-3 z-20 bg-surface border border-hairline rounded-lg px-3 py-2 text-[11px] text-ink-2 shadow-sm max-w-xs">
          Sin <code>VITE_MAPBOX_TOKEN</code>: se está usando OpenStreetMap como mapa base.
        </div>
      )}
    </div>
  );
};
