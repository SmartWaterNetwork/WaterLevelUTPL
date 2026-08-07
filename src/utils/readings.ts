import { ChannelSettings, Reading, ThingSpeakFeed } from '../types';
import { calculateFlowRate, convertLevelValue, toCentimeters } from './flowCalculator';
import { STATION_CROSS_SECTIONS } from '../data/stationCrossSections';

/** Raw ThingSpeak feed entries -> the derived, time-sorted samples the charts plot. */
export function feedsToReadings(
  feeds: ThingSpeakFeed[],
  settings: ChannelSettings,
  stationId: string
): Reading[] {
  const crossSection = STATION_CROSS_SECTIONS[stationId];
  return feeds
    .map((feed) => {
      const rawValue = Number(feed.field1);
      if (feed.field1 === null || feed.field1 === '' || Number.isNaN(rawValue)) return null;
      const levelCm = toCentimeters(rawValue, settings.sourceUnit);
      const tMs = new Date(feed.created_at).getTime();
      if (Number.isNaN(tMs)) return null;

      return {
        entryId: feed.entry_id,
        iso: feed.created_at,
        tMs,
        levelCm,
        level: Number(convertLevelValue(levelCm, settings.levelUnit).toFixed(2)),
        flow: Number(calculateFlowRate(levelCm, settings, crossSection).toFixed(2)),
        flowLps: Number(
          calculateFlowRate(levelCm, { ...settings, flowUnit: 'L/s' }, crossSection).toFixed(2)
        ),
      } satisfies Reading;
    })
    .filter((r): r is Reading => r !== null)
    .sort((a, b) => a.tMs - b.tMs);
}
