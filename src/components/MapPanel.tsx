import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { StationState } from '../types';
import { series, status as statusColor, statusLabel } from '../theme';
import { calculateVelocity } from '../utils/flowCalculator';
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

/**
 * Whether the reaches in the vector tiles are digitised from headwater to
 * outlet. Checked against the rendered geometry: length-weighted, the vertex
 * order of this dataset runs north, and north is downstream for the Malacatos
 * and the Zamora through Loja. Flip this if the source layer ever changes.
 */
const VERTEX_ORDER_IS_DOWNSTREAM = true;

/** One dash period of `path.river-flow`, in pixels. Must match index.css. */
const DASH_PERIOD_PX = 40;

/**
 * At true scale the drift would be imperceptible — around 0.03 px/s for a
 * 0.5 m/s river at zoom 13 — so the velocity is exaggerated by this factor.
 * Relative speeds between reaches and between zoom levels stay faithful.
 */
const VELOCITY_EXAGGERATION = 400;

const MIN_FLOW_DURATION_S = 0.9;
const MAX_FLOW_DURATION_S = 5;

/** Below this the reach is too short for the drift to read as movement. */
const MIN_FLOW_REACH_M = 250;

/** Ranking used when two stations gauge the same river. */
const SEVERITY = { OFFLINE: 0, NORMAL: 1, PRECAUCION: 2, ALERTA: 3 } as const;

/** Lowercase and strip diacritics so "Río" matches the layer's "Rio". */
function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Stable identity of a reach, so it can be restyled without a refetch. */
function featureId(properties: Record<string, unknown>): string {
  return String(properties?.id ?? properties?.fid ?? properties?.objectid ?? '');
}

type ReachKind = 'PERENNE' | 'INTERMITENTE' | 'EMBAULADO';

/**
 * The layer's `tipo` field: "Permanente", "Intermitente", "Tramo embaulado",
 * plus a handful of long unclassified reaches coded "1", which are treated as
 * perennial because that is what their length and position suggest.
 */
function reachKind(properties: Record<string, unknown>): ReachKind {
  const tipo = normalize(properties?.tipo);
  if (tipo.includes('intermitente')) return 'INTERMITENTE';
  if (tipo.includes('embaulado')) return 'EMBAULADO';
  return 'PERENNE';
}

/** Ground resolution of the Web Mercator tile grid, in metres per pixel. */
function metresPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

/**
 * Seconds for one dash period, so that a faster river visibly drifts faster and
 * zooming in speeds the drift up the way real motion would.
 */
function flowDuration(velocityMps: number, latitude: number, zoom: number): number {
  if (velocityMps <= 0) return MAX_FLOW_DURATION_S;
  const pxPerSecond = (velocityMps / metresPerPixel(latitude, zoom)) * VELOCITY_EXAGGERATION;
  const seconds = DASH_PERIOD_PX / pxPerSecond;
  return Math.min(MAX_FLOW_DURATION_S, Math.max(MIN_FLOW_DURATION_S, seconds));
}

/**
 * The station that gauges this reach's river, matched on the layer's `nombre`.
 * Two stations sit on the Zamora, so the more severe one wins and an alert is
 * never hidden behind a calm reading.
 */
function gaugeFor(
  stations: StationState[],
  properties: Record<string, unknown>
): StationState | undefined {
  const name = normalize(properties?.nombre);
  if (!name || name === 'none') return undefined;

  const matches = stations.filter((s) =>
    s.config.matchTokens.some((token) => name.includes(token))
  );
  if (matches.length <= 1) return matches[0];

  return matches.reduce((worst, s) => (SEVERITY[s.status] > SEVERITY[worst.status] ? s : worst));
}

/** The continuous river hairline. */
function baseStyleFor(stations: StationState[], properties: Record<string, unknown>) {
  const match = gaugeFor(stations, properties);

  // A gauged river in a raised state is redrawn in its status colour.
  if (match && (match.status === 'ALERTA' || match.status === 'PRECAUCION')) {
    return {
      weight: match.status === 'ALERTA' ? 2.6 : 2.2,
      color: statusColor[match.status],
      opacity: 0.9,
      fill: false,
      dashArray: undefined,
      className: 'river-base',
    };
  }

  // Otherwise the reach is drawn the way hydrographic maps draw it: solid for a
  // perennial course, dashed when it only runs seasonally, dotted where the
  // channel is culverted.
  const kind = reachKind(properties);
  if (kind === 'INTERMITENTE') {
    return {
      weight: 1.1,
      color: '#a9c4d8',
      opacity: 0.75,
      fill: false,
      dashArray: '3 4',
      className: 'river-base',
    };
  }
  if (kind === 'EMBAULADO') {
    return {
      weight: 1.1,
      color: '#b3b1a8',
      opacity: 0.8,
      fill: false,
      dashArray: '1 3',
      className: 'river-base',
    };
  }
  return {
    weight: 1.5,
    color: '#9dc0dd',
    opacity: 0.9,
    fill: false,
    dashArray: undefined,
    className: 'river-base',
  };
}

/** The animated dash pattern laid over the very same geometry. */
function flowStyleFor(stations: StationState[], properties: Record<string, unknown>) {
  const kind = reachKind(properties);
  const lengthM = Number(properties?.shape_length) || 0;

  // Only water that is actually there and visible gets a current: seasonal beds
  // may be dry, culverted stretches run underground, and a 100 m stub is too
  // short for the drift to read as movement.
  if (kind !== 'PERENNE' || lengthM < MIN_FLOW_REACH_M) {
    return { stroke: false, fill: false };
  }

  const match = gaugeFor(stations, properties);
  // Reaches with no gauge of their own drift at the network-wide pace.
  const speedClass = match ? `river-flow--${match.config.id}` : 'river-flow--net';
  const raised =
    match && (match.status === 'ALERTA' || match.status === 'PRECAUCION')
      ? statusColor[match.status]
      : null;

  return {
    stroke: true,
    weight: raised ? 3.2 : 2.2,
    color: raised ?? series.level,
    opacity: raised ? 1 : 0.75,
    fill: false,
    className: `river-flow ${speedClass}`,
  };
}

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
  const flowLayerRef = useRef<L.Layer | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  const [basemap, setBasemap] = useState<BasemapStyle>('light-v11');
  const [showRivers, setShowRivers] = useState(true);
  const [showFlow, setShowFlow] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // Callbacks registered on Leaflet layers outlive a render, so read live data
  // through refs instead of closing over it.
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  /** Station states the river layers were last styled against. */
  const lastSignatureRef = useRef<string | null>(null);
  /** Attributes of every reach rendered so far, keyed by feature id. */
  const featurePropsRef = useRef<Map<string, Record<string, unknown>>>(new Map());

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
  // Both layers read the same tiles; the second one only restrokes the very
  // same reaches with the animated dash pattern.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drop = () => {
      if (riversLayerRef.current) {
        map.removeLayer(riversLayerRef.current);
        riversLayerRef.current = null;
      }
      if (flowLayerRef.current) {
        map.removeLayer(flowLayerRef.current);
        flowLayerRef.current = null;
      }
    };

    drop();
    // Freshly built layers already carry the current states, and their index is
    // rebuilt as their tiles render.
    lastSignatureRef.current = null;
    featurePropsRef.current.clear();
    if (!showRivers) return;

    const vectorGrid = (
      L as unknown as { vectorGrid?: { protobuf: (url: string, opts: unknown) => L.Layer } }
    ).vectorGrid;
    if (!vectorGrid?.protobuf) return;

    // Panes keep the flow strokes above the base hairline no matter the order
    // in which the two grids finish loading their tiles.
    if (!map.getPane('riversBase')) map.createPane('riversBase').style.zIndex = '410';
    if (!map.getPane('riversFlow')) map.createPane('riversFlow').style.zIndex = '411';

    // leaflet.vectorgrid looks the style up by MVT layer name and has no
    // wildcard, so without this proxy every reach silently falls back to
    // Leaflet's default 3px #3388ff path. Styling is also the one place every
    // rendered feature passes through, so the id → attributes index is built
    // here and later drives in-place restyling.
    const anyLayer = (fn: (p: Record<string, unknown>) => unknown) =>
      new Proxy({} as Record<string, unknown>, {
        get:
          () =>
          (properties: Record<string, unknown>) => {
            const id = featureId(properties);
            if (id) featurePropsRef.current.set(id, properties);
            return fn(properties);
          },
        has: () => true,
      });

    const gridOptions = (pane: string, fn: (p: Record<string, unknown>) => unknown) => ({
      rendererFactory: (L as unknown as { svg: { tile: unknown } }).svg.tile,
      vectorTileLayerStyles: anyLayer(fn),
      // Required for setFeatureStyle, which restyles without refetching tiles.
      getFeatureId: (feature: { properties: Record<string, unknown> }) =>
        featureId(feature.properties),
      pane,
      maxNativeZoom: 13,
      maxZoom: 22,
      minZoom: 1,
      interactive: false,
    });

    try {
      const base = vectorGrid.protobuf(
        RIVERS_MVT_URL,
        gridOptions('riversBase', (p) => baseStyleFor(stationsRef.current, p))
      );
      base.addTo(map);
      riversLayerRef.current = base;

      if (showFlow) {
        const flow = vectorGrid.protobuf(
          RIVERS_MVT_URL,
          gridOptions('riversFlow', (p) => flowStyleFor(stationsRef.current, p))
        );
        flow.addTo(map);
        flowLayerRef.current = flow;
      }
    } catch (err) {
      console.error('No se pudo cargar la capa de ríos:', err);
    }
  }, [showRivers, showFlow]);

  // Recolour the reaches when a river changes state. setFeatureStyle repaints
  // the rendered paths in place; redraw() would refetch every tile, and with
  // levels hovering around a threshold that ran several times a minute.
  // Speed changes need nothing here — they ride on the CSS variables below.
  const statusSignature = stations.map((s) => `${s.config.id}:${s.status}`).join('|');

  useEffect(() => {
    if (lastSignatureRef.current === null) {
      // The layers were just built with these states already applied.
      lastSignatureRef.current = statusSignature;
      return;
    }
    if (lastSignatureRef.current === statusSignature) return;
    lastSignatureRef.current = statusSignature;

    type Restylable = L.Layer & { setFeatureStyle?: (id: string, style: unknown) => void };
    const base = riversLayerRef.current as Restylable | null;
    const flow = flowLayerRef.current as Restylable | null;

    featurePropsRef.current.forEach((properties, id) => {
      base?.setFeatureStyle?.(id, baseStyleFor(stationsRef.current, properties));
      flow?.setFeatureStyle?.(id, flowStyleFor(stationsRef.current, properties));
    });
  }, [statusSignature]);

  /**
   * Animation speed per station, from the velocity its own readings imply.
   * Published as CSS variables so the running animations retime without any
   * of the ~200 reach paths being touched.
   */
  const flowDurations = useMemo(() => {
    const vars: Record<string, string> = {};
    const velocities: number[] = [];

    stations.forEach((station) => {
      const v = station.latest
        ? calculateVelocity(station.latest.levelCm, station.config.settings)
        : 0;
      if (v > 0) velocities.push(v);
      vars[`--flow-dur-${station.config.id}`] = `${flowDuration(
        v,
        station.config.lat,
        currentZoom
      ).toFixed(2)}s`;
    });

    const median = velocities.length
      ? [...velocities].sort((a, b) => a - b)[Math.floor(velocities.length / 2)]
      : 0;
    vars['--flow-dur-net'] = `${flowDuration(median, center[0], currentZoom).toFixed(2)}s`;

    return vars;
  }, [stations, currentZoom, center]);

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
    <div
      className={`relative w-full h-full${VERTEX_ORDER_IS_DOWNSTREAM ? '' : ' rivers--reversed'}`}
      style={flowDurations as React.CSSProperties}
    >
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

              <label
                className={`flex items-center gap-2 text-[12px] cursor-pointer ${
                  showRivers ? 'text-ink-2' : 'text-ink-3 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showFlow && showRivers}
                  disabled={!showRivers}
                  onChange={(e) => setShowFlow(e.target.checked)}
                  className="accent-ink w-3.5 h-3.5"
                />
                Animación aguas abajo
              </label>

              {showRivers && showFlow && (
                <p className="text-[10px] text-ink-3 leading-relaxed border-t border-hairline pt-2">
                  El sentido lo marca el orden de vértices de cada tramo; la velocidad sale del
                  caudal medido en la estación de ese río.
                </p>
              )}
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
