/**
 * Contributing drainage area per station — the land area whose runoff
 * eventually reaches that station's own point on the network, not the whole
 * river's basin.
 *
 * Derived once in QGIS from a DEM (`D:/DEM_Loja/DEM.tif`, ~3 m resolution,
 * SIRGAS 2000 / UTM 17S, provided by the group) using GRASS r.watershed +
 * r.water.outlet:
 *  - The DEM was processed at a 10 m GRASS region resolution — fine enough
 *    for catchments this size, far cheaper than running at the native 3 m.
 *  - Each station's point (`estaciones_visor` in ProyectoQGIS.qgz) was
 *    snapped to the nearest local flow-accumulation maximum within a 60 m
 *    window. A *wider* window doesn't help here: accumulation only grows
 *    moving downstream, so beyond a small radius the "best" cell just keeps
 *    walking down-channel instead of converging on the one nearest the
 *    station — checked directly (radius 20 m to 60 m gave near-identical
 *    results; 150 m had already drifted).
 *  - r.water.outlet then traced the basin from that snapped point.
 *
 * Cross-checked against the network topology already verified elsewhere in
 * this project (see upstreamReaches.ts / downstreamReaches.ts): station 4's
 * DEM-derived basin falls 100% inside station 3's, and stations 1/2/3 don't
 * overlap each other at all — exactly what the reach-level upstream/
 * downstream lists say should be true. None of the 4 basins touch the DEM's
 * own edge, so the DEM's extent wasn't a limiting factor.
 *
 * The traced polygons live in `cuencas_aporte_por_estacion.gpkg`
 * (VISOR/mapa_fondo, also added as a layer in ProyectoQGIS.qgz) in case they're
 * ever needed on the map; only the area figure is used in the app today.
 *
 * Regenerate if a station moves, or a better DEM becomes available.
 *
 * 2026-08: st-1 and st-3's areas were swapped between the keys below to
 * match a field-validated relabeling — see the same note in
 * stationCrossSections.ts. The figures themselves are untouched.
 */
export const CATCHMENT_AREA_KM2: Record<string, number> = {
  'st-1': 55.02,
  'st-2': 33.3,
  'st-3': 20.69,
  'st-4': 6.55,
};
