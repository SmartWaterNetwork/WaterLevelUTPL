import { CrossSectionPoint } from '../utils/crossSection';

/**
 * Real cross-section of the channel at each station, extracted from the
 * group's own DEM (`D:/DEM_Loja/DEM.tif`, ~3 m resolution, SIRGAS 2000 /
 * UTM 17S). Replaces the generic trapezoid the 3D view (`ThreeDChannelCanvas`)
 * used to draw identically for every station regardless of what the real
 * channel there actually looks like.
 *
 * Method, per station: a transect perpendicular to the local flow direction
 * — taken from the station's own reach in `redhidrica2023_loja_flujo` (the
 * first segment, which starts at the station, for st-1/st-2/st-4; the vertex
 * nearest the station for st-3, since fid 51 there is the desarenador
 * structure's own boundary, not a plain channel line, and doesn't start at
 * the station) — was sampled across the DEM at 1 m steps, ±25–30 m either
 * side. Each pair is `[offsetM, heightAboveInvertM]`: offset is signed
 * distance along the transect from the transect's own lowest point (the true
 * channel invert, usually within a metre or two of the station's raw
 * coordinate but not always exactly on it — st-3's is ~5 m off, consistent
 * with it sitting on a structure rather than a natural centreline); height
 * is metres above that invert. Downsampled to every third raw sample (~3 m,
 * the DEM's native resolution) — finer than that is DEM noise, not real
 * shape.
 *
 * Consumed by `ThreeDChannelCanvas.tsx`, which scales offset and height
 * separately (`HORIZONTAL_SCALE` / `VERTICAL_SCALE` there) — real channels
 * here are 1–2 m deep across 25–30 m of width per side, which at true 1:1
 * scale reads as an almost flat line, so the height axis is deliberately
 * exaggerated relative to the width axis, the same convention cross-section
 * plots in HEC-RAS and similar tools use for the same reason.
 *
 * Regenerate from the DEM (in QGIS, against `redhidrica2023_loja_flujo` for
 * flow direction and `estaciones_visor` for station position) if a station
 * moves, or the DEM is replaced with a better one.
 *
 * 2026-08: field validation found "Estación 01" and "Estación 03" were
 * mislabeled — the site described below as st-1 (a desarenador on Río
 * Malacatos) is physically where the st-1 sensor sits, and what's below as
 * st-3 (the Quebrada Turunuma headwater) is physically where the st-3 sensor
 * sits. The two full cross-sections were swapped between the keys to match;
 * the shapes themselves are untouched, still exactly what was sampled from
 * the DEM at each site — only which station code they're filed under changed.
 * Prose elsewhere in this codebase describing "st-1" or "st-3" by their old
 * river/structure may still reflect the pre-swap labels.
 *
 * 2026-08 (second pass): the same field validation found "Estación 03" and
 * "Estación 04" (as relabeled by the swap above) were also crossed. Swapped
 * st-3 and st-4's cross-sections the same way — values untouched, only the
 * key changed.
 */
export const STATION_CROSS_SECTIONS: Record<string, CrossSectionPoint[]> = {
  'st-1': [
    [-30, 1.458], [-27, 1.45], [-24, 1.452], [-21, 1.464], [-18, 1.484], [-15, 1.502],
    [-12, 1.522], [-9, 1.464], [-6, 1.06], [-3, 0.396], [0, 0], [3, 0.536], [6, 0.536],
    [9, 0.496], [12, 1.568], [15, 1.658], [18, 2.74], [20, 2.838],
  ],
  'st-2': [
    [-25, 7.222], [-22, 7.222], [-19, 7.11], [-16, 6.92], [-13, 5.84], [-10, 4.404],
    [-7, 2.874], [-4, 1.336], [-1, 0.41], [2, 0], [5, 0.622], [8, 1.494], [11, 2.408],
    [14, 3.216], [17, 3.962], [20, 4.652], [23, 5.116], [25, 5.612],
  ],
  'st-3': [
    [-24, 1.924], [-21, 1.866], [-18, 1.884], [-15, 1.846], [-12, 1.704], [-9, 1.722],
    [-6, 1.014], [-3, 0.384], [0, 0], [3, 0.472], [6, 0.148], [9, 0.98], [12, 1.39],
    [15, 1.778], [18, 2.482], [21, 2.884], [24, 3.0], [26, 2.894],
  ],
  'st-4': [
    [-24, 2.888], [-21, 2.03], [-18, 1.594], [-15, 1.59], [-12, 1.352], [-9, 1.364],
    [-6, 1.174], [-3, 0.51], [0, 0], [3, 0.73], [6, 1.01], [9, 1.13], [12, 1.41],
    [15, 1.564], [18, 1.596], [21, 1.628], [24, 1.622], [26, 1.572],
  ],
};
