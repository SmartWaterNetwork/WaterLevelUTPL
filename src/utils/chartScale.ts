/**
 * Vertical scale for the hydrograph plots.
 *
 * Two things go wrong when a gauge is quiet, and they compound. Recharts picks
 * a domain that hugs the data, so a river sitting at 46.2–46.4 cm gets ticks
 * 0.05 cm apart; and a formatter with a fixed number of decimals then rounds
 * every one of them to the same label, leaving an axis that reads 46, 46, 46,
 * 46. The plot looks like a storm and the axis says nothing.
 *
 * So the domain and the labels are decided together: a nice round step is
 * chosen first, and the number of decimals follows from it, which is the only
 * way the ticks are guaranteed to be distinguishable.
 */

/** Roughly how many labelled gridlines to aim for on a ~190 px tall plot. */
const TARGET_TICKS = 4;

/**
 * Narrowest window the axis will show, as a fraction of the reading.
 *
 * Below this the series is drawn flat rather than magnified. A stilling well
 * wobbling by 2 mm is not a flood, and stretching that across the panel would
 * say it was — the axis has to keep the change legible *and* proportionate.
 */
const MIN_SPAN_RATIO = 0.02;

/** Guards against a pathological step producing an endless tick list. */
const MAX_TICKS = 12;

/** Rounds a step up to 1, 2, 5 or 10 times a power of ten. */
function niceStep(raw: number): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const fraction = raw / base;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

/**
 * Decimals needed to print a step without two ticks colliding.
 * Derived from the step rather than fixed, which is the actual fix: a step of
 * 0.5 needs one decimal, a step of 5 needs none.
 */
function decimalsFor(step: number): number {
  if (step >= 1) return 0;
  return Math.min(4, Math.ceil(-Math.log10(step)));
}

export interface VerticalScale {
  domain: [number, number];
  ticks: number[];
  /** Decimals for the tick labels; the tooltip keeps its own precision. */
  decimals: number;
}

/**
 * Domain, ticks and label precision for a series. Returns null when there is
 * nothing to measure, so the caller can leave Recharts to its own devices.
 */
export function verticalScale(values: number[]): VerticalScale | null {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return null;

  let min = Math.min(...finite);
  let max = Math.max(...finite);

  // Widen a flat or near-flat series to a minimum window, so the line sits
  // inside the panel instead of being stretched to fill it.
  const magnitude = Math.max(Math.abs(min), Math.abs(max));
  const minSpan = magnitude > 0 ? magnitude * MIN_SPAN_RATIO : 1;
  if (max - min < minSpan) {
    const middle = (min + max) / 2;
    min = middle - minSpan / 2;
    max = middle + minSpan / 2;
  }

  const step = niceStep((max - min) / TARGET_TICKS);
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;

  const count = Math.round((high - low) / step);
  if (!Number.isFinite(count) || count < 1 || count > MAX_TICKS) return null;

  // Built from the index rather than by repeated addition: adding 0.1 twelve
  // times drifts, and the labels would come out as 0.30000000000000004.
  const ticks = Array.from({ length: count + 1 }, (_, i) => low + i * step);

  return { domain: [low, high], ticks, decimals: decimalsFor(step) };
}
