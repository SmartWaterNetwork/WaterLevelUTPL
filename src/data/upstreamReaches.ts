/**
 * Which `redhidrica2023_loja` reaches — by their `fid` — drain into each
 * station, precomputed once in QGIS from the authoritative source geometry.
 *
 * This used to be computed live in the browser from whatever tile geometry
 * happened to be on screen (see riverNetwork.ts's attributeDownstream for
 * that approach, still used for the downstream/alert trace). For upstream it
 * turned out unstable: nearly the whole network is one connected graph, and
 * a small change in rendering precision — a different zoom, a different set
 * of loaded tiles — could reshuffle which large branch counted as
 * "upstream" of a station, so the highlight would grow, shrink or jump
 * around as the map moved. Precomputing it once, from the full-resolution
 * geometry instead of an on-screen approximation, is what actually makes it
 * stable at every zoom.
 *
 * Regenerate this (in QGIS, against `redhidrica2023_loja`) if a station is
 * moved or a new one is added — see the project at
 * .../VISOR/ProyectoQGIS.qgz for the layers this was derived from
 * (estaciones_visor for station positions, HydroRIVERS_loja_ref to verify
 * flow direction).
 */
export const UPSTREAM_REACH_FIDS: Record<string, number[]> = {
  'st-1': [12, 13, 14, 54, 55, 56, 72, 73, 93, 96, 101, 102, 103, 108, 110],
  'st-2': [53],
  'st-3': [51, 52],
  'st-4': [31, 35, 36, 129],
};
