import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChannelSettings,
  Reading,
  StationConfig,
  StationState,
  ThingSpeakFeed,
  ThingSpeakResponse,
  Trend,
} from '../types';
import { calculateFlowRate, convertLevelValue } from '../utils/flowCalculator';
import { STALE_AFTER_MS, levelToStatus } from '../theme';

/** Points pulled for the stations you are not currently looking at. */
const BACKGROUND_POINTS = 60;

/** A rise or fall smaller than this (cm) over the window still reads as stable. */
const TREND_DEADBAND_CM = 0.5;

async function fetchFeeds(settings: ChannelSettings, results: number): Promise<ThingSpeakFeed[]> {
  const { channelId } = settings;
  const apiKey = settings.apiKey || '';
  const proxyUrl = `/api/thingspeak?channelId=${channelId}&apiKey=${apiKey}&results=${results}`;

  let data: ThingSpeakResponse | null = null;
  const res = await fetch(proxyUrl);

  if (res.ok) {
    data = await res.json();
  } else {
    // The Express proxy is not always in front of us (static hosting, preview
    // builds); fall back to ThingSpeak directly, which allows CORS.
    const directUrl =
      `https://api.thingspeak.com/channels/${channelId}/feeds.json?results=${results}` +
      (apiKey ? `&api_key=${apiKey}` : '');
    const direct = await fetch(directUrl);
    if (!direct.ok) throw new Error(`Canal ${channelId}: ${direct.status} ${direct.statusText}`);
    data = await direct.json();
  }

  return data?.feeds ?? [];
}

/** Feeds -> the derived, sorted samples the charts plot. */
function toReadings(feeds: ThingSpeakFeed[], settings: ChannelSettings): Reading[] {
  return feeds
    .map((feed) => {
      const levelCm = Number(feed.field1);
      if (feed.field1 === null || feed.field1 === '' || Number.isNaN(levelCm)) return null;
      const tMs = new Date(feed.created_at).getTime();
      if (Number.isNaN(tMs)) return null;

      return {
        entryId: feed.entry_id,
        iso: feed.created_at,
        tMs,
        levelCm,
        level: Number(convertLevelValue(levelCm, settings.levelUnit).toFixed(2)),
        flow: Number(calculateFlowRate(levelCm, settings).toFixed(2)),
      } satisfies Reading;
    })
    .filter((r): r is Reading => r !== null)
    .sort((a, b) => a.tMs - b.tMs);
}

/** Compares the mean of the two halves of the window. */
function computeTrend(readings: Reading[]): Trend {
  if (readings.length < 4) return 'STABLE';
  const mid = Math.floor(readings.length / 2);
  const mean = (arr: Reading[]) => arr.reduce((sum, r) => sum + r.levelCm, 0) / arr.length;
  const delta = mean(readings.slice(mid)) - mean(readings.slice(0, mid));
  if (delta > TREND_DEADBAND_CM) return 'RISING';
  if (delta < -TREND_DEADBAND_CM) return 'FALLING';
  return 'STABLE';
}

interface ChannelData {
  feeds: ThingSpeakFeed[];
  loading: boolean;
  error: string | null;
  /** The channel answered at least once. Distinguishes "empty" from "not asked yet". */
  fetched: boolean;
}

const emptyChannel: ChannelData = { feeds: [], loading: true, error: null, fetched: false };

export interface StationNetwork {
  stations: StationState[];
  active: StationState;
  activeId: string;
  setActiveId: (id: string) => void;
  /** Per-station overrides applied on top of the static config. */
  updateSettings: (stationId: string, settings: ChannelSettings) => void;
  refresh: () => void;
  /** True while any channel is in flight. */
  isRefreshing: boolean;
  /** False when every channel failed — i.e. the browser or server is offline. */
  isOnline: boolean;
  lastSyncedAt: number | null;
}

/**
 * Polls every station in the network and derives the state the UI renders.
 *
 * The active station is fetched at its full configured depth; the rest use a
 * shorter window, which is all the side-panel sparklines need.
 */
export function useStationNetwork(configs: StationConfig[]): StationNetwork {
  const [overrides, setOverrides] = useState<Record<string, ChannelSettings>>({});
  const [channels, setChannels] = useState<Record<string, ChannelData>>(() =>
    Object.fromEntries(configs.map((c) => [c.id, emptyChannel]))
  );
  const [activeId, setActiveId] = useState<string>(configs[0].id);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  /** Config with any user override applied. */
  const resolved = useMemo<StationConfig[]>(
    () => configs.map((c) => (overrides[c.id] ? { ...c, settings: overrides[c.id] } : c)),
    [configs, overrides]
  );

  // Read inside the polling loop so the interval never closes over stale config.
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const load = useCallback(async (stationIds?: string[]) => {
    const targets = resolvedRef.current.filter((c) => !stationIds || stationIds.includes(c.id));

    setChannels((prev) => {
      const next = { ...prev };
      targets.forEach((c) => {
        next[c.id] = { ...(next[c.id] ?? emptyChannel), loading: true };
      });
      return next;
    });

    await Promise.all(
      targets.map(async (config) => {
        const points =
          config.id === activeIdRef.current
            ? config.settings.resultsCount
            : Math.min(config.settings.resultsCount, BACKGROUND_POINTS);

        try {
          const feeds = await fetchFeeds(config.settings, points);
          setChannels((prev) => ({
            ...prev,
            [config.id]: { feeds, loading: false, error: null, fetched: true },
          }));
        } catch (err) {
          setChannels((prev) => ({
            ...prev,
            [config.id]: {
              feeds: prev[config.id]?.feeds ?? [],
              loading: false,
              error: err instanceof Error ? err.message : String(err),
              fetched: true,
            },
          }));
        }
      })
    );

    setLastSyncedAt(Date.now());
  }, []);

  // Initial load plus the polling loop. The shortest configured interval wins.
  const pollSeconds = useMemo(
    () => Math.max(10, Math.min(...resolved.map((c) => c.settings.autoRefreshInterval))),
    [resolved]
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), pollSeconds * 1000);
    return () => clearInterval(timer);
  }, [load, pollSeconds]);

  // Refetch the newly selected station at full depth right away.
  useEffect(() => {
    void load([activeId]);
  }, [activeId, load]);

  // Drives the "hace N minutos" labels and the staleness flag without a refetch.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const stations = useMemo<StationState[]>(
    () =>
      resolved.map((config) => {
        const channel = channels[config.id] ?? emptyChannel;
        const readings = toReadings(channel.feeds, config.settings);
        const latest = readings.length > 0 ? readings[readings.length - 1] : null;
        const isStale = latest !== null && now - latest.tMs > STALE_AFTER_MS;

        return {
          config,
          readings,
          latest,
          status: latest ? levelToStatus(latest.levelCm) : 'OFFLINE',
          trend: computeTrend(readings),
          isStale,
          isLoading: channel.loading,
          isEmpty: channel.fetched && channel.error === null && readings.length === 0,
          error: channel.error,
        };
      }),
    [resolved, channels, now]
  );

  const active = stations.find((s) => s.config.id === activeId) ?? stations[0];

  const updateSettings = useCallback(
    (stationId: string, settings: ChannelSettings) => {
      setOverrides((prev) => ({ ...prev, [stationId]: settings }));
      // Pull again with the new depth/channel so the change is visible at once.
      window.setTimeout(() => void load([stationId]), 0);
    },
    [load]
  );

  const isRefreshing = stations.some((s) => s.isLoading);
  const isOnline = stations.some((s) => s.error === null);

  return {
    stations,
    active,
    activeId,
    setActiveId,
    updateSettings,
    refresh: () => void load(),
    isRefreshing,
    isOnline,
    lastSyncedAt,
  };
}
