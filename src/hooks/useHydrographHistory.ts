import { useEffect, useRef, useState } from 'react';
import { Reading, StationConfig } from '../types';
import { fetchStationFeeds } from '../lib/thingspeak';
import { feedsToReadings } from '../utils/readings';
import { thingSpeakDateTime } from '../utils/format';

interface HydrographHistoryState {
  readings: Reading[];
  isLoading: boolean;
  error: string | null;
}

export interface HydrographHistory extends HydrographHistoryState {
  reload: () => void;
}

/**
 * On-demand fetch for the hydrograph's period/date picker, kept independent
 * of useStationNetwork's live poll — otherwise viewing "1 mes" of history
 * would get silently overwritten by the next 30 s refresh of "last N" live
 * readings, which always targets the active station at full depth.
 */
export function useHydrographHistory(config: StationConfig, start: Date, end: Date): HydrographHistory {
  const [state, setState] = useState<HydrographHistoryState>({
    readings: [],
    isLoading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const requestIdRef = useRef(0);

  const startMs = start.getTime();
  const endMs = end.getTime();

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    fetchStationFeeds(config, {
      start: thingSpeakDateTime(new Date(startMs)),
      end: thingSpeakDateTime(new Date(endMs)),
    })
      .then((feeds) => {
        if (requestId !== requestIdRef.current) return;
        setState({
          readings: feedsToReadings(feeds, config.settings, config.id),
          isLoading: false,
          error: null,
        });
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        setState({
          readings: [],
          isLoading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }, [config.id, config.remote, config.settings, startMs, endMs, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}
