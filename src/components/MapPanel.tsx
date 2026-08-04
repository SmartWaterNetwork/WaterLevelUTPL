import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.vectorgrid';
import { StationState } from '../types';
import { status as statusColor, statusLabel } from '../theme';
import {
  WAVE_PERIOD_S,
  isRaised,
  reachColors,
  reachWeight,
  statusOf,
  velocityOf,
  waveDelaySeconds,
} from '../utils/reachFlow';
import {
  attributeDownstream,
  buildReaches,
  orientNetwork,
  GaugePoint,
  JOIN_TOLERANCE_PX,
} from '../utils/riverNetwork';
import { UPSTREAM_REACH_FIDS } from '../data/upstreamReaches';
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

/**
 * Recovers the first valid public Mapbox token if an env var is malformed
 * (for example duplicated as "pk...pk...").
 */
function normalizeMapboxToken(raw: string): string {
  const value = raw.trim();
  if (!value) return '';

  const firstPk = value.indexOf('pk.');
  if (firstPk < 0) return '';

  const secondPk = value.indexOf('pk.', firstPk + 3);
  const candidate = (secondPk >= 0 ? value.slice(firstPk, secondPk) : value.slice(firstPk)).trim();

  // Keep the checks intentionally light: we only need to avoid obviously
  // broken values and let the existing OSM fallback handle empty tokens.
  return candidate.startsWith('pk.') && candidate.length > 20 ? candidate : '';
}

const MAPBOX_TOKEN = normalizeMapboxToken(
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_MAPBOX_TOKEN ?? ''
);

const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noreferrer">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const RIVERS_MVT_URL =
  'https://api.ellipsis-drive.com/v3/ogc/mvt/c001410b-232a-43c7-945a-2989b88f0a6d/{z}/{x}/{y}?timestampId=6890e507-e7e8-45c7-82c8-0c411563fc5d&token=epat_g6H3SbsolcBukmxPlYifqUkp5BdyUYK3e4n09WUeT1GlXP1lUFAwIDfR1JN6fRjh';

/** A station further than this from any reach is not on the mapped network. */
const MAX_SNAP_PX = 40;

/**
 * The finest zoom the river tiles are actually fetched at (verified against
 * the tile source: it 400s past 14) — every further zoom just re-scales this
 * tile with a CSS transform rather than fetching new geometry. That transform
 * is what MAX_SNAP_PX, JOIN_TOLERANCE_PX and every reach's stroke-width are
 * tuned against, so both need converting away from raw screen pixels at
 * whatever zoom the map happens to be at — see zoomCorrection below.
 */
const RIVERS_MAX_NATIVE_ZOOM = 14;

/** Lowercase and strip diacritics so "Río" matches the layer's "Rio". */
function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Ground resolution of the Web Mercator tile grid, in metres per pixel. */
function metresPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

/** Stable identity of a reach, so it can be restyled without a refetch. */
function featureId(properties: Record<string, unknown>): string {
  return String(properties?.id ?? properties?.fid ?? properties?.objectid ?? '');
}

/**
 * Maps each currently-rendered reach `<path>` to its source `fid`, so
 * UPSTREAM_REACH_FIDS (computed once in QGIS against the same source layer)
 * can be looked up directly instead of re-deriving the network live.
 *
 * leaflet.vectorgrid doesn't expose per-feature properties for a non-
 * interactive layer through any public API — `getFeatureId` only feeds its
 * own internal cache, keyed by whatever that callback returns (a UUID here,
 * not the fid; see the note on featureId above). This reads that cache
 * directly. It's undocumented, but it's the only way to get the fid back
 * without making the layer interactive just to read data off it.
 */
function collectFeatureFids(layer: L.Layer): Map<SVGPathElement, number> {
  const byPath = new Map<SVGPathElement, number>();
  const vectorTiles = (
    layer as unknown as {
      _vectorTiles?: Record<
        string,
        { _features?: Record<string, { feature: { properties?: Record<string, unknown>; _path?: unknown } }> }
      >;
    }
  )._vectorTiles;
  if (!vectorTiles) return byPath;

  for (const tileKey in vectorTiles) {
    const features = vectorTiles[tileKey]._features;
    if (!features) continue;
    for (const key in features) {
      const { properties, _path } = features[key].feature;
      const fid = properties?.fid;
      if (_path instanceof SVGPathElement && typeof fid === 'number') {
        byPath.set(_path, fid);
      }
    }
  }
  return byPath;
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

/**
 * How a reach is drawn from its attributes alone, the way hydrographic maps
 * draw it: solid for a perennial course, dashed when it only runs seasonally,
 * dotted where the channel is culverted. Which gauge governs it, and whether it
 * is under warning, is decided later by `applyReachStates` — that needs the
 * reach's position on the network, which the style callback is never given.
 */
function reachStyleFor(properties: Record<string, unknown>) {
  const kind = reachKind(properties);

  if (kind === 'INTERMITENTE') {
    return {
      weight: 1.1,
      color: '#a9c4d8',
      opacity: 0.75,
      fill: false,
      dashArray: '3 4',
      className: 'river-reach river-reach--seasonal',
    };
  }
  if (kind === 'EMBAULADO') {
    return {
      weight: 1.1,
      color: '#b3b1a8',
      opacity: 0.8,
      fill: false,
      dashArray: '1 3',
      className: 'river-reach river-reach--culverted',
    };
  }
  return {
    weight: 1.5,
    color: '#9dc0dd',
    opacity: 0.9,
    fill: false,
    dashArray: undefined,
    className: 'river-reach river-reach--perennial',
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
  const pulse = isRaised(statusOf(station)) && station.config.settings.conversionMode === 'WEIR';
  // `color` doubles as the pulse ring's currentColor — see structureAlertPulse.
  const dot = `<span class="station-marker__dot${pulse ? ' station-marker__dot--structure-alert' : ''}" style="background:${color};color:${color}"></span>`;

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
  const [showWave, setShowWave] = useState(true);
  const [layersOpen, setLayersOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // Callbacks registered on Leaflet layers outlive a render, so read live data
  // through refs instead of closing over it.
  const stationsRef = useRef(stations);
  stationsRef.current = stations;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const showWaveRef = useRef(showWave);
  showWaveRef.current = showWave;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  /**
   * Follows each gauge downstream through the network and marks what it covers.
   *
   * Reaches under a gauge reporting Precaución or Alerta take its colour and
   * carry a crest that leaves the gauge and travels down the channel; every
   * other reach keeps the quiet hairline and stays still, so any movement on
   * the map means a warning and points at where the water is heading.
   *
   * The style callback cannot do this: it is handed a reach's attributes but
   * never its position, and position is the only thing that says which gauge
   * is upstream of it.
   *
   * Clicking a station adds a second, independent trace, in the opposite
   * direction: every reach upstream of that point — what the reading actually
   * represents — takes the same blue a calm reach uses at its crest
   * (`river-reach--upstream`, in index.css). It runs regardless of whether the
   * station currently has a reading, since it describes the network's shape,
   * not a live warning, and a real warning elsewhere always overrides it so a
   * click can never paint over a signal that matters.
   */
  const applyReachStates = useCallback(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const paths = container.querySelectorAll<SVGPathElement>('path.river-reach');
    if (paths.length === 0) return;

    const bounds = container.getBoundingClientRect();
    const lat = map.getCenter().lat;
    const zoom = map.getZoom();
    const mpp = metresPerPixel(lat, zoom);

    // Tiles past RIVERS_MAX_NATIVE_ZOOM are the native tile re-scaled with a
    // CSS transform, not new geometry — so a reach rendered at zoom 17 is
    // literally the zoom-14 tile blown up 8x. A fixed pixel tolerance would
    // therefore mean a different real-world distance (and different join and
    // snap decisions, appearing and disappearing reaches) depending on how far
    // past 14 the map happens to be zoomed. Scaling every pixel constant by
    // the ratio between zoom-14 and current metres-per-pixel keeps them
    // anchored to the same real-world distance at any zoom.
    const zoomCorrection = metresPerPixel(lat, RIVERS_MAX_NATIVE_ZOOM) / mpp;
    const joinTolerancePx = JOIN_TOLERANCE_PX * zoomCorrection;
    const maxSnapPx = MAX_SNAP_PX * zoomCorrection;

    // The same re-scaling inflates every stroke-width past zoom 14, since it's
    // drawn on the tile *before* the CSS transform enlarges it. Shrinking the
    // weight we ask for by exactly that factor cancels it out, so a line looks
    // the same width at zoom 20 as it does at zoom 14.
    const weightCompensation = Math.pow(2, Math.min(0, RIVERS_MAX_NATIVE_ZOOM - zoom));

    const reaches = buildReaches(paths, bounds.left, bounds.top, mpp);
    const drainage = orientNetwork(reaches, joinTolerancePx);

    // Only gauges that are actually saying something drive the network; a
    // station with no reading has nothing to propagate.
    const gauges: GaugePoint[] = stationsRef.current
      .filter((s) => s.latest !== null)
      .map((s) => {
        const point = map.latLngToContainerPoint([s.config.lat, s.config.lng]);
        return { stationId: s.config.id, x: point.x, y: point.y };
      });

    const attribution = attributeDownstream(reaches, drainage, gauges, maxSnapPx);

    // Precomputed (see src/data/upstreamReaches.ts) rather than derived from
    // this same on-screen geometry, unlike everything above: a live version
    // of this turned out to reshuffle unpredictably with zoom, because almost
    // the whole network is one connected graph and small rendering precision
    // differences could flip which large branch counted as "upstream".
    const upstreamFids = new Set(UPSTREAM_REACH_FIDS[activeIdRef.current] ?? []);
    const fidByPath = upstreamFids.size > 0 && riversLayerRef.current
      ? collectFeatureFids(riversLayerRef.current)
      : null;

    reaches.forEach(({ path }) => {
      const attributed = attribution.get(path);
      const station = attributed
        ? stationsRef.current.find((s) => s.config.id === attributed.stationId)
        : undefined;

      const status = statusOf(station);
      const raised = isRaised(status);

      // A real warning always wins: the click-driven upstream trace only gets
      // to recolour a reach that has nothing more important to say.
      const fid = fidByPath?.get(path);
      const isUpstream = !raised && fid !== undefined && upstreamFids.has(fid);
      const { rest, crest } = reachColors(status);
      const restColour = isUpstream ? crest : rest;
      const weight = (raised ? reachWeight(status) : isUpstream ? 2 : reachWeight(status)) * weightCompensation;

      path.classList.toggle('river-reach--upstream', isUpstream);
      path.style.setProperty('--reach-rest', restColour);
      path.style.setProperty('--reach-crest', crest);
      path.style.setProperty('--reach-weight', `${weight}px`);

      // A station on a weir or settling structure isn't reporting an open
      // channel: its level reflects the structure's own state (silting up,
      // an outlet choked with debris) rather than a flood wave in transit, so
      // sending a crest travelling downstream from it would show movement
      // that isn't happening. Its own marker carries that warning instead —
      // see the station-markers effect below.
      const isStructure = station?.config.settings.conversionMode === 'WEIR';
      const velocity = velocityOf(station);
      const animate = showWaveRef.current && isRaised(status) && velocity > 0 && attributed && !isStructure;

      if (!animate) {
        path.classList.remove('river-reach--wave');
        path.style.removeProperty('animation-delay');
        return;
      }

      path.classList.add('river-reach--wave');
      path.style.animationDelay = `${waveDelaySeconds(attributed.distanceM, velocity).toFixed(2)}s`;
    });
  }, []);

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

    const vectorGrid = (
      L as unknown as { vectorGrid?: { protobuf: (url: string, opts: unknown) => L.Layer } }
    ).vectorGrid;
    if (!vectorGrid?.protobuf) return;

    try {
      const layer = vectorGrid.protobuf(RIVERS_MVT_URL, {
        rendererFactory: (L as unknown as { svg: { tile: unknown } }).svg.tile,
        // leaflet.vectorgrid looks the style up by MVT layer name and has no
        // wildcard, so without this proxy every reach silently falls back to
        // Leaflet's default 3px #3388ff path.
        vectorTileLayerStyles: new Proxy({} as Record<string, unknown>, {
          get: () => reachStyleFor,
          has: () => true,
        }),
        getFeatureId: (feature: { properties: Record<string, unknown> }) =>
          featureId(feature.properties),
        maxNativeZoom: RIVERS_MAX_NATIVE_ZOOM,
        maxZoom: 22,
        minZoom: 1,
        interactive: false,
      });

      // Newly rendered tiles arrive unstyled by the pass, so run it as they land.
      layer.on('load', applyReachStates);
      layer.addTo(map);
      riversLayerRef.current = layer;
    } catch (err) {
      console.error('No se pudo cargar la capa de ríos:', err);
    }
  }, [showRivers, applyReachStates]);

  // Re-run the pass on new readings, a new selection, and whenever the view
  // brings in new tiles.
  useEffect(() => {
    applyReachStates();
  }, [stations, activeId, showWave, currentZoom, applyReachStates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = () => applyReachStates();
    map.on('moveend zoomend', handler);
    return () => {
      map.off('moveend zoomend', handler);
    };
  }, [applyReachStates]);

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

    // Pan only when the station is off-screen, and never zoom in: the reaches a
    // station speaks for run for kilometres, and tightening the view would cut
    // the very trace the selection is meant to show.
    const target = L.latLng(station.config.lat, station.config.lng);
    if (!map.getBounds().pad(-0.15).contains(target)) {
      map.panTo(target, { duration: 0.6 });
    }
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
      className="relative w-full h-full"
      style={{ '--wave-period': `${WAVE_PERIOD_S}s` } as React.CSSProperties}
    >
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Layer controls */}
      <div className="absolute top-3 right-3 z-20">
        {layersOpen ? (
          <div className="w-56 bg-surface border border-hairline rounded-lg shadow-sm animate-fadeIn">
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
                  checked={showWave && showRivers}
                  disabled={!showRivers}
                  onChange={(e) => setShowWave(e.target.checked)}
                  className="accent-ink w-3.5 h-3.5"
                />
                Propagación aguas abajo
              </label>

              {showRivers && showWave && (
                <p className="text-[10px] text-ink-3 leading-relaxed border-t border-hairline pt-2">
                  Cuando una estación entra en Precaución o Alerta, su tramo aguas abajo se tiñe y
                  una onda lo recorre en el sentido de la corriente. Sin aviso, la red está quieta.
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
        <p className="text-[10px] text-ink-3 mt-1.5 pt-1.5 border-t border-hairline">
          El color cubre el tramo aguas abajo de cada estación · al hacer clic se resalta lo que
          drena aguas arriba
        </p>
      </div>

      {!MAPBOX_TOKEN && (
        <div className="absolute top-3 left-3 z-20 bg-surface border border-hairline rounded-lg px-3 py-2 text-[11px] text-ink-2 shadow-sm max-w-xs">
          Sin <code>VITE_MAPBOX_TOKEN</code>: se está usando OpenStreetMap como mapa base.
        </div>
      )}
    </div>
  );
};
