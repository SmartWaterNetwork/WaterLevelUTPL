/**
 * Everything the app does with the station catalogue in the database.
 *
 * Reads go through `station_config`, a view that joins the station with its
 * channel and its hydraulics and deliberately leaves out the read key. Writes
 * go to the underlying tables, where the admin-only policies live: a signed-out
 * visitor can call any of these and row-level security will simply refuse.
 */

import { ChannelSettings, StationConfig } from '../types';
import { supabase } from './supabase';
import { StationConfigRow } from './database.types';

/** What the admin form edits. `readApiKey` is write-only — see saveStation. */
export interface StationDraft {
  code: string;
  name: string;
  riverName: string;
  locationLabel: string;
  lat: number;
  lng: number;
  precaucionCm: number;
  alertaCm: number;
  isActive: boolean;
  channelId: string;
  readApiKey: string;
  settings: ChannelSettings;
}

function requireClient() {
  if (!supabase) throw new Error('La aplicación no está conectada a Supabase');
  return supabase;
}

/** A catalogue row, in the shape the rest of the app already speaks. */
export function rowToConfig(row: StationConfigRow): StationConfig {
  return {
    id: row.code ?? String(row.id),
    name: row.name ?? '',
    riverName: row.river_name || row.name || '',
    locationName: row.location_label ?? '',
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    thresholds: {
      precaucion: row.precaucion_cm ?? 58,
      alerta: row.alerta_cm ?? 70,
    },
    isActive: row.is_active ?? true,
    remote: true,
    dbId: row.id ?? undefined,
    settings: {
      channelId: Number(row.channel_id ?? 0),
      // Never sent to the browser; the edge function resolves it.
      apiKey: undefined,
      resultsCount: row.results_count ?? 120,
      autoRefreshInterval: row.refresh_interval_s ?? 30,
      installationHeight: row.installation_height_cm ?? 100,
      sensorMaterial: row.sensor_material ?? 'PP',
      communicationType: row.communication_type ?? '4-20mA',
      levelUnit: row.level_unit ?? 'cm',
      flowUnit: row.flow_unit ?? 'L/s',
      conversionMode: row.conversion_mode ?? 'MANNING',
      channelWidth: row.channel_width_m ?? 0.5,
      channelSlope: row.channel_slope ?? 0.002,
      manningN: row.manning_n ?? 0.013,
      linearFactor: row.linear_factor ?? 2.5,
      weirCrestHeight: row.weir_crest_cm ?? 0,
    },
  };
}

/** The reverse, to seed the form when an existing station is opened. */
export function configToDraft(config: StationConfig): StationDraft {
  return {
    code: config.id,
    name: config.name,
    riverName: config.riverName,
    locationLabel: config.locationName,
    lat: config.lat,
    lng: config.lng,
    precaucionCm: config.thresholds?.precaucion ?? 58,
    alertaCm: config.thresholds?.alerta ?? 70,
    isActive: config.isActive ?? true,
    channelId: String(config.settings.channelId || ''),
    readApiKey: '',
    settings: { ...config.settings },
  };
}

/**
 * The whole catalogue, active stations first.
 *
 * Inactive ones are included so an admin can see and revive them; the dashboard
 * filters them out.
 */
export async function listStations(): Promise<StationConfig[]> {
  const client = requireClient();
  const { data, error } = await client
    .from('station_config')
    .select('*')
    .order('code', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToConfig);
}

/**
 * Creates a station, its channel, its hydraulics and its key in one call.
 *
 * This one goes through an RPC rather than four inserts because it has to be
 * atomic: a station that exists without its calibration would be read with
 * default hydraulics and quietly report the wrong flow.
 */
export async function createStation(draft: StationDraft): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('create_station', {
    p_code: draft.code.trim(),
    p_name: draft.name.trim(),
    p_lat: draft.lat,
    p_lng: draft.lng,
    p_installation_height_cm: draft.settings.installationHeight,
    p_channel_id: draft.channelId.trim(),
    p_river_name: draft.riverName.trim() || undefined,
    p_location_label: draft.locationLabel.trim() || undefined,
    p_precaucion_cm: draft.precaucionCm,
    p_alerta_cm: draft.alertaCm,
    p_read_api_key: draft.readApiKey.trim() || undefined,
    p_conversion_mode: draft.settings.conversionMode,
    p_channel_width_m: draft.settings.channelWidth,
    p_channel_slope: draft.settings.channelSlope,
    p_manning_n: draft.settings.manningN,
    p_weir_crest_cm: draft.settings.weirCrestHeight,
  });

  if (error) throw new Error(error.message);

  // The RPC covers what a station cannot exist without; the rest of the
  // channel and hydraulics settings are applied on top.
  await saveStation(data as number, draft, { includeKey: false });
  return data as number;
}

/**
 * Updates an existing station across its four tables.
 *
 * The read key is written only when the field was filled in: it is never read
 * back into the browser, so an empty box means "leave it alone", not "clear it".
 */
export async function saveStation(
  dbId: number,
  draft: StationDraft,
  opts: { includeKey?: boolean } = {}
): Promise<void> {
  const client = requireClient();
  const { includeKey = true } = opts;
  const s = draft.settings;

  const station = await client
    .from('stations')
    .update({
      code: draft.code.trim(),
      name: draft.name.trim(),
      river_name: draft.riverName.trim() || null,
      location_label: draft.locationLabel.trim() || null,
      installation_height_cm: s.installationHeight,
      precaucion_cm: draft.precaucionCm,
      alerta_cm: draft.alertaCm,
      level_unit: s.levelUnit,
      flow_unit: s.flowUnit,
      sensor_material: s.sensorMaterial,
      communication_type: s.communicationType,
      is_active: draft.isActive,
    })
    .eq('id', dbId);
  if (station.error) throw new Error(station.error.message);

  const channel = await client
    .from('station_channels')
    .update({
      channel_id: draft.channelId.trim(),
      results_count: s.resultsCount,
      refresh_interval_s: s.autoRefreshInterval,
    })
    .eq('station_id', dbId);
  if (channel.error) throw new Error(channel.error.message);

  const hydraulics = await client
    .from('station_hydraulics')
    .update({
      conversion_mode: s.conversionMode,
      channel_width_m: s.channelWidth,
      channel_slope: s.channelSlope,
      manning_n: s.manningN,
      linear_factor: s.linearFactor,
      weir_crest_cm: s.weirCrestHeight ?? 0,
    })
    .eq('station_id', dbId);
  if (hydraulics.error) throw new Error(hydraulics.error.message);

  // The position is a PostGIS point, which the browser cannot assign directly,
  // so it goes through an RPC that builds it from the pair.
  const moved = await client.rpc('move_station', {
    p_station_id: dbId,
    p_lat: draft.lat,
    p_lng: draft.lng,
  });
  if (moved.error) throw new Error(moved.error.message);

  if (includeKey && draft.readApiKey.trim()) {
    const secret = await client
      .from('station_channel_secrets')
      .upsert({ station_id: dbId, read_api_key: draft.readApiKey.trim() });
    if (secret.error) throw new Error(secret.error.message);
  }
}

/**
 * Takes a station out of service without losing its history.
 *
 * Deleting for real is offered separately: alert events point at the station,
 * and an operator who wants it off the map almost never wants the record of
 * what it measured to disappear with it.
 */
export async function deactivateStation(dbId: number): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('stations').update({ is_active: false }).eq('id', dbId);
  if (error) throw new Error(error.message);
}

export async function deleteStation(dbId: number): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('stations').delete().eq('id', dbId);
  if (error) throw new Error(error.message);
}
