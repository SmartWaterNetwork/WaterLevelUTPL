import { useCallback, useEffect, useMemo, useState } from 'react';
import { StationConfig } from '../types';
import { STATIONS } from '../stations';
import { isSupabaseConfigured } from '../lib/supabase';
import { listStations } from '../lib/stationsApi';

export interface StationCatalog {
  /** In service — what the dashboard draws. */
  stations: StationConfig[];
  /** Including those taken out of service — what the admin panel lists. */
  allStations: StationConfig[];
  /** Where the list came from, so the UI can say so rather than imply it. */
  source: 'supabase' | 'local';
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * The station catalogue, from the database when there is one.
 *
 * Without Supabase credentials the app runs off the bundled list exactly as it
 * did before, so it still starts from a clean checkout. If the catalogue is
 * configured but unreachable it falls back to the same list rather than
 * emptying the map — but the error is surfaced, never swallowed: a dashboard
 * quietly showing four stations that are no longer the four stations is worse
 * than one that says it lost contact.
 */
export function useStationCatalog(): StationCatalog {
  const [allStations, setAllStations] = useState<StationConfig[]>(
    isSupabaseConfigured ? [] : STATIONS
  );
  const [source, setSource] = useState<'supabase' | 'local'>(
    isSupabaseConfigured ? 'supabase' : 'local'
  );
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setIsLoading(true);
    try {
      const rows = await listStations();
      setAllStations(rows);
      setSource('supabase');
      setError(null);
    } catch (err) {
      setAllStations(STATIONS);
      setSource('local');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stations = useMemo(
    () => allStations.filter((s) => s.isActive !== false),
    [allStations]
  );

  return { stations, allStations, source, isLoading, error, reload };
}
