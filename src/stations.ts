import { ChannelSettings, StationConfig } from './types';

/** Defaults shared by every station; each one overrides its channel + geometry. */
const baseSettings: Omit<ChannelSettings, 'channelId' | 'apiKey' | 'installationHeight' | 'channelWidth' | 'channelSlope'> = {
  resultsCount: 120,
  autoRefreshInterval: 30,
  sensorMaterial: 'PP',
  communicationType: '4-20mA',
  levelUnit: 'cm',
  flowUnit: 'L/s',
  conversionMode: 'MANNING',
  manningN: 0.013,
  linearFactor: 2.5,
};

/** The four gauging stations of the Loja network (UTM zone 17S). */
export const STATIONS: StationConfig[] = [
  {
    id: 'st-1',
    name: 'Estación 01',
    riverName: 'Río Malacatos',
    locationName: '699451 E, 9554704 S',
    lat: -4.026679,
    lng: -79.203472,
    settings: {
      ...baseSettings,
      channelId: 3440458,
      apiKey: 'DG5ZMO8WQHQ4D9IK',
      installationHeight: 100,
      channelWidth: 0.5,
      channelSlope: 0.002,
    },
  },
  {
    id: 'st-2',
    name: 'Estación 02',
    riverName: 'Río Zamora',
    locationName: '698471 E, 9559387 S',
    lat: -3.984353,
    lng: -79.212388,
    settings: {
      ...baseSettings,
      channelId: 3425609,
      apiKey: '',
      installationHeight: 120,
      channelWidth: 0.8,
      channelSlope: 0.0025,
    },
  },
  {
    id: 'st-3',
    name: 'Estación 03',
    riverName: 'Quebrada Jipiro',
    locationName: '699558 E, 9555671 S',
    lat: -4.017933,
    lng: -79.202527,
    settings: {
      ...baseSettings,
      channelId: 3440461,
      apiKey: '28SBPW323NCPCT3D',
      installationHeight: 90,
      channelWidth: 0.4,
      channelSlope: 0.003,
    },
  },
  {
    id: 'st-4',
    name: 'Estación 04',
    riverName: 'Río Zamora Norte',
    locationName: '699836 E, 9560901 S',
    lat: -3.970636,
    lng: -79.200127,
    settings: {
      ...baseSettings,
      channelId: 3440462,
      apiKey: '4EFJ92F823NP50SF',
      installationHeight: 130,
      channelWidth: 1.0,
      channelSlope: 0.002,
    },
  },
];

/** Map view that frames all four stations. */
export const NETWORK_CENTER: [number, number] = [-4.0, -79.2035];
export const NETWORK_ZOOM = 13;
