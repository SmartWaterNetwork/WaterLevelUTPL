export interface ThingSpeakFeed {
  created_at: string;
  entry_id: number;
  field1: string | null;
}

export interface ThingSpeakChannel {
  id: number;
  name: string;
  description: string;
  latitude: string;
  longitude: string;
  field1: string;
  created_at: string;
  updated_at: string;
  last_entry_id: number | null;
}

export interface ThingSpeakResponse {
  channel: ThingSpeakChannel;
  feeds: ThingSpeakFeed[];
}

export type AlertType =
  | 'MAX_LEVEL'
  | 'MIN_LEVEL'
  | 'MAX_FLOW'
  | 'MIN_FLOW'
  | 'RATE_OF_CHANGE'
  | 'SENSOR_OFFLINE';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertConfig {
  id: string;
  name: string;
  type: AlertType;
  threshold: number; // Value in active unit (cm or L/s or minutes)
  enabled: boolean;
  severity: AlertSeverity;
  pushNotification: boolean;
  soundAlert: boolean;
}

export interface AlertLogItem {
  id: string;
  timestamp: string;
  stationName: string;
  title: string;
  message: string;
  type: AlertType;
  value: number;
  unit: string;
  severity: AlertSeverity;
  read: boolean;
}

export type LevelUnit = 'cm' | 'm' | 'mm' | 'in';
export type FlowUnit = 'L/s' | 'm3/s' | 'm3/h' | 'GPM';
export type ConversionMode = 'MANNING' | 'WEIR' | 'LINEAR' | 'DIRECT';

export interface ChannelSettings {
  channelId: number;
  apiKey?: string;
  resultsCount: number;
  autoRefreshInterval: number; // in seconds
  installationHeight: number; // in cm (OC height)
  sensorMaterial: 'PP' | 'STAINLESS';
  communicationType: '4-20mA' | 'RS485_MODBUS';
  levelUnit: LevelUnit;
  flowUnit: FlowUnit;
  conversionMode: ConversionMode;
  // Hydraulics parameters for Manning / Open Channel
  channelWidth: number; // in meters
  channelSlope: number; // e.g. 0.001
  manningN: number; // e.g. 0.013 for smooth concrete
  linearFactor: number; // Flow = level * linearFactor
}

/** Level thresholds (cm) that decide a station's state. */
export interface LevelThresholds {
  precaucion: number;
  alerta: number;
}

/** Static description of a gauging station. Live values are never stored here. */
export interface StationConfig {
  id: string;
  name: string; // "Estación 01"
  riverName: string; // "Río Malacatos"
  locationName: string; // UTM reference
  lat: number;
  lng: number;
  settings: ChannelSettings;
  /** Per-station overrides; falls back to the network defaults in theme.ts. */
  thresholds?: LevelThresholds;
  /** False for a station taken out of service: kept on record, off the map. */
  isActive?: boolean;
  /**
   * Set when the station came from the database. Its telemetry is fetched
   * through the edge function, which holds the read key; a bundled station
   * carries its own key and goes through the Express proxy.
   */
  remote?: boolean;
  /** Database primary key. Only present on remote stations. */
  dbId?: number;
}

/** One telemetry sample, with the derived values the UI actually plots. */
export interface Reading {
  entryId: number;
  iso: string;
  tMs: number;
  /** Raw sensor value, always centimetres. */
  levelCm: number;
  /** Level converted to the configured display unit. */
  level: number;
  /** Flow derived from levelCm, in the configured flow unit. */
  flow: number;
}

export type Trend = 'RISING' | 'FALLING' | 'STABLE';

/** Everything the UI needs to render one station, derived from its feed. */
export interface StationState {
  config: StationConfig;
  readings: Reading[];
  latest: Reading | null;
  status: 'NORMAL' | 'PRECAUCION' | 'ALERTA' | 'OFFLINE';
  trend: Trend;
  /** True when the newest reading is older than the staleness window. */
  isStale: boolean;
  isLoading: boolean;
  /** Set when the channel answered but carries no readings at all. */
  isEmpty: boolean;
  error: string | null;
}
