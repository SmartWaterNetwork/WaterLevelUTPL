/**
 * Pure geometry over a real surveyed channel cross-section — shared by the
 * 3D view (`ThreeDChannelCanvas`, which draws it) and the flow calculator
 * (`flowCalculator.ts`, which integrates it), so the shape used to *look*
 * right and the shape used to *compute* Q can never drift apart into two
 * different channels.
 *
 * A cross-section is `[offsetM, heightAboveInvertM][]` — see
 * `data/stationCrossSections.ts` for how these are derived from the DEM.
 */
export type CrossSectionPoint = [number, number];

/**
 * Where the real profile crosses a given water height, on both banks —
 * linear interpolation between the two surveyed points straddling the
 * crossing, same as reading a level off a paper cross-section plot.
 *
 * Only the contiguous span *around the channel invert* is kept, expanding
 * outward from it while points stay below the water height. A surveyed
 * transect can have a secondary low point well away from the invert (a
 * terrace, an old channel scar — st-3's profile has exactly this, a shallow
 * dip around 6 m out) that's separately below the water height without
 * being hydraulically connected to the flowing channel at this stage; naively
 * including every submerged point regardless of position would bridge across
 * the dry ground between the two into one wrong, inflated shape.
 * (2026-08: this example profile moved from st-4 to st-3 in a station
 * relabeling — see the note in stationCrossSections.ts.)
 */
export function waterCrossSectionPoints(
  crossSection: CrossSectionPoint[],
  waterHeightM: number
): CrossSectionPoint[] {
  let invertIdx = 0;
  for (let i = 1; i < crossSection.length; i++) {
    if (crossSection[i][1] < crossSection[invertIdx][1]) invertIdx = i;
  }

  let leftIdx = invertIdx;
  while (leftIdx > 0 && crossSection[leftIdx - 1][1] <= waterHeightM) leftIdx--;
  let rightIdx = invertIdx;
  while (rightIdx < crossSection.length - 1 && crossSection[rightIdx + 1][1] <= waterHeightM) rightIdx++;

  const pts: CrossSectionPoint[] = [];

  if (leftIdx > 0) {
    const [x1, h1] = crossSection[leftIdx - 1];
    const [x2, h2] = crossSection[leftIdx];
    const t = (waterHeightM - h1) / (h2 - h1);
    pts.push([x1 + t * (x2 - x1), waterHeightM]);
  } else {
    pts.push([crossSection[0][0], waterHeightM]);
  }

  for (let i = leftIdx; i <= rightIdx; i++) pts.push(crossSection[i]);

  if (rightIdx < crossSection.length - 1) {
    const [x1, h1] = crossSection[rightIdx];
    const [x2, h2] = crossSection[rightIdx + 1];
    const t = (waterHeightM - h1) / (h2 - h1);
    pts.push([x1 + t * (x2 - x1), waterHeightM]);
  } else {
    pts.push([crossSection[crossSection.length - 1][0], waterHeightM]);
  }

  return pts;
}

/** Wetted cross-sectional area (m²) enclosed by the submerged points and the
 *  flat water surface above them — shoelace formula, points implicitly
 *  closed back to the first. */
export function crossSectionArea(points: CrossSectionPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Wetted perimeter (m): the submerged bed and banks only. Consecutive
 *  segment lengths *without* closing the loop — closing it would count the
 *  free water surface as if it were a solid boundary, which it isn't. */
export function crossSectionWettedPerimeter(points: CrossSectionPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    sum += Math.hypot(x2 - x1, y2 - y1);
  }
  return sum;
}
