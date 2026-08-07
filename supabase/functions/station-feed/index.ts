/**
 * Telemetry proxy: resolves a station code to its channel and read key, and
 * returns the feed.
 *
 * It exists because of where the key lives. `station_channel_secrets` is
 * admin-only, so the browser — which visits the dashboard signed out — cannot
 * read it. Not every channel is public either: of the four in Loja, channel
 * 3440462 answers `-1` without its key. So something with the service role has
 * to sit in the middle, and this is it. The key never appears in the response.
 *
 * Deployed with `verify_jwt`, so a caller needs at least the project's
 * publishable key — the same one the dashboard already ships.
 */

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/** ThingSpeak's own ceiling for a single call. */
const MAX_RESULTS = 8000;
const DEFAULT_RESULTS = 60;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** PostgREST returns an embedded one-to-one as an object or a single-item array. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface StationRow {
  id: number;
  is_active: boolean;
  station_channels: { provider: string; channel_id: string } | { provider: string; channel_id: string }[] | null;
  station_channel_secrets: { read_api_key: string | null } | { read_api_key: string | null }[] | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  let code = url.searchParams.get('station') ?? '';
  let results = Number(url.searchParams.get('results') ?? 0);
  let start = url.searchParams.get('start') ?? '';
  let end = url.searchParams.get('end') ?? '';

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    if (typeof body.station === 'string') code = body.station;
    if (body.results !== undefined) results = Number(body.results);
    if (typeof body.start === 'string') start = body.start;
    if (typeof body.end === 'string') end = body.end;
  }

  if (!code) return json({ error: 'Falta el código de la estación' }, 400);

  // A date range asks ThingSpeak for everything in the window, not "the last
  // N" — an explicit `results` still caps it, but the small live-poll default
  // has no business truncating a month of history down to 60 points.
  const hasRange = Boolean(start || end);
  results = Math.min(Math.max(Math.trunc(results) || (hasRange ? MAX_RESULTS : DEFAULT_RESULTS), 1), MAX_RESULTS);

  const { data, error } = await admin
    .from('stations')
    .select('id, is_active, station_channels(provider, channel_id), station_channel_secrets(read_api_key)')
    .eq('code', code)
    .maybeSingle<StationRow>();

  if (error) return json({ error: 'No se pudo leer la estación', detail: error.message }, 500);
  if (!data) return json({ error: `No existe la estación ${code}` }, 404);
  if (!data.is_active) return json({ error: `La estación ${code} está dada de baja` }, 409);

  const channel = one(data.station_channels);
  if (!channel) return json({ error: `La estación ${code} no tiene canal configurado` }, 409);
  if (channel.provider !== 'thingspeak') {
    return json({ error: `Proveedor no soportado: ${channel.provider}` }, 501);
  }

  const apiKey = one(data.station_channel_secrets)?.read_api_key ?? '';

  const feedUrl = new URL(`https://api.thingspeak.com/channels/${channel.channel_id}/feeds.json`);
  feedUrl.searchParams.set('results', String(results));
  if (start) feedUrl.searchParams.set('start', start);
  if (end) feedUrl.searchParams.set('end', end);
  if (apiKey) feedUrl.searchParams.set('api_key', apiKey);

  const upstream = await fetch(feedUrl).catch(() => null);
  if (!upstream || !upstream.ok) {
    // A private channel asked for without its key answers 400 with the body
    // `-1`; say so rather than passing an empty feed off as "no readings".
    return json(
      {
        error: `ThingSpeak rechazó el canal ${channel.channel_id}`,
        status: upstream?.status ?? 0,
      },
      502
    );
  }

  const feed = await upstream.json().catch(() => null);
  if (!feed) return json({ error: 'Respuesta ilegible de ThingSpeak' }, 502);

  return json(feed);
});
