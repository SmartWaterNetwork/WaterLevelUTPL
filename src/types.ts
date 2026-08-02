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
  last_entry_id: number;
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
  title: string;
  message: string;
  type: AlertType;
  value: number;
  unit: string;
  severity: AlertSeverity;
  read: boolean;
}

export interface Station {
  id: string;
  name: string;
  riverName: string;
  locationName: string;
  lat: number;
  lng: number;
  isLiveThingSpeak: boolean;
  channelId?: number;
  apiKey?: string;
  currentLevelCm: number;
  currentFlowLps: number;
  status: 'NORMAL' | 'PRECAUCION' | 'ALERTA';
  lastUpdated: string;
  installationHeightCm: number;
  trend: 'STABLE' | 'RISING' | 'FALLING';
  settings: ChannelSettings;
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
