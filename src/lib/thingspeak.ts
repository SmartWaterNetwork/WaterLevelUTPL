import { StationConfig, ThingSpeakFeed, ThingSpeakResponse } from '../types';
import { describeError, supabase } from './supabase';

export interface FeedQuery {
  /** Most recent N entries. Ignored by ThingSpeak whenever start/end are set. */
  results?: number;
  /** Local "YYYY-MM-DD HH:MM:SS" — see utils/format#thingSpeakDateTime. */
  start?: string;
  end?: string;
}

/**
 * One station's feed, live ("last N") or historical (a start/end window) —
 * the same request shape either way, so the live poll (useStationNetwork)
 * and the hydrograph's date picker (useHydrographHistory) share one path to
 * ThingSpeak instead of two copies of the remote/local branching below.
 */
export async function fetchStationFeeds(config: StationConfig, query: FeedQuery): Promise<ThingSpeakFeed[]> {
  // A station from the database has no key in the browser to fetch with: the
  // edge function holds it and returns only the readings.
  if (config.remote && supabase) {
    const { data, error } = await supabase.functions.invoke<ThingSpeakResponse>('station-feed', {
      body: { station: config.id, ...query },
    });
    if (error) throw new Error(`${config.name}: ${await describeError(error)}`);
    return data?.feeds ?? [];
  }

  const { channelId } = config.settings;
  const apiKey = config.settings.apiKey || '';

  const proxyParams = new URLSearchParams({ channelId: String(channelId) });
  if (apiKey) proxyParams.set('apiKey', apiKey);
  if (query.results) proxyParams.set('results', String(query.results));
  if (query.start) proxyParams.set('start', query.start);
  if (query.end) proxyParams.set('end', query.end);

  let data: ThingSpeakResponse | null = null;
  const res = await fetch(`/api/thingspeak?${proxyParams.toString()}`);

  if (res.ok) {
    data = await res.json();
  } else {
    // The Express proxy is not always in front of us (static hosting, preview
    // builds); fall back to ThingSpeak directly, which allows CORS.
    const directParams = new URLSearchParams();
    if (query.results) directParams.set('results', String(query.results));
    if (query.start) directParams.set('start', query.start);
    if (query.end) directParams.set('end', query.end);
    if (apiKey) directParams.set('api_key', apiKey);
    const directUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json?${directParams.toString()}`;
    const direct = await fetch(directUrl);
    if (!direct.ok) throw new Error(`Canal ${channelId}: ${direct.status} ${direct.statusText}`);
    data = await direct.json();
  }

  return data?.feeds ?? [];
}
