/**
 * Which `redhidrica2023_loja_flujo` reaches — by their `fid` — drain into
 * each station, precomputed once in QGIS from the authoritative source
 * geometry.
 *
 * This used to be computed live in the browser from whatever tile geometry
 * happened to be on screen (downstreamReaches.ts in this folder was the same
 * kind of fix, for the same reason, on the alert/wave trace). It turned out
 * unstable: nearly the whole network is one connected graph, and
 * a small change in rendering precision — a different zoom, a different set
 * of loaded tiles — could reshuffle which large branch counted as
 * "upstream" of a station, so the highlight would grow, shrink or jump
 * around as the map moved. Precomputing it once, from the full-resolution
 * geometry instead of an on-screen approximation, is what actually makes it
 * stable at every zoom.
 *
 * st-1 also needed two fixes beyond the zoom-instability one above: some
 * reaches are stored as several disconnected geometry parts under one fid
 * (Quebrada Pavas was 45 of them, now fids 5801–5845 — see the note below on
 * renumbering), and the join graph only ever read the first part; and at
 * real three-way confluences (e.g. fids 61/81 meeting fid 128) the nearest-
 * neighbour join could pair two tributaries with each other instead of with
 * the reach they both actually flow into. Both are fixed at the source now,
 * not just patched around for st-1.
 *
 * st-3 sits on a desarenador (fids 51/52, a settling structure — see
 * `elemento` on those features and STRUCTURE_COLOR in reachFlow.ts, which is
 * what paints them apart from a natural channel), not a plain headwater
 * tributary, so "upstream" for it isn't a small self-contained catchment
 * like the other three stations. It includes Quebrada Yaguarcuna (fid 22,
 * geometrically confirmed — its end lands within a few metres of the
 * desarenador's start) plus the Malacatos mainstem and everything that
 * drains into it, including the whole of Quebrada El Alumbre's catchment
 * (station 4's own upstream set).
 *
 * Renumbering: the source network (`redhidrica2023_loja_flujo`, published
 * to the same Ellipsis Drive source `redhidrica2023_loja` used to point at)
 * now splits any reach that used to straddle a station boundary — or
 * bundle several disconnected geometry parts under one fid — into its own
 * fid per piece; see downstreamReaches.ts for why. The old fid 133 (Rio
 * Malacatos) is now three fids: 13301 (upstream of st-4's own confluence,
 * unattributed — in st-3's list below), 13302 (st-4's own ~764 m downstream
 * stretch — in st-3's list too, since everything upstream of st-3
 * legitimately includes all of Quebrada El Alumbre's catchment, station 4's
 * own discharge point included), and 13303 (st-3's *own* ~390 m downstream
 * stretch, immediately after the desarenador and before fid 134 — this one
 * is deliberately *not* in st-3's list; see DOWNSTREAM_SEGMENTS in
 * downstreamReaches.ts). A `<path>` still can't render half one colour and
 * half another, and a real warning still wins over the click-driven upstream
 * trace regardless (see the comment in MapPanel.tsx).
 *
 * That splitting also exposed two real errors the whole-fid version
 * couldn't show. First: each station's *own* first downstream fid (12 for
 * st-1, 5301 for st-2, 51 for st-3, 3602 for st-4 — baseDistanceM 0 in
 * DOWNSTREAM_SEGMENTS, i.e. the station's own reach, flowing away from it)
 * was also sitting in that same station's upstream list, a leftover from
 * when the whole undivided fid the station sat on had no upstream/downstream
 * split at all. Second, and specific to st-3: `aguas_abajo_por_estacion`
 * actually declares *four* reaches downstream of it, in order — 51, then
 * 133 (now 13303), then 134, then 135 (now 13501) — but an earlier rebuild
 * of DOWNSTREAM_SEGMENTS dropped the second one by mistake, so 13303 never
 * got claimed as downstream and stayed in this file's st-3 list instead.
 * Since the station's own recorded position falls inside that 390 m reach,
 * the effect of both bugs together was the same: the click-driven highlight
 * overran the station position, into what is actually downstream. Each
 * station's list below excludes its own such fid(s); a fid still appears in
 * *other* stations' lists where it genuinely belongs to their upstream
 * catchment (3602 and 13302 above are both st-4's own reaches, legitimately
 * upstream of st-3).
 *
 * Regenerate this (in QGIS, against `redhidrica2023_loja_flujo`) if a
 * station is moved or a new one is added — see the project at
 * .../VISOR/ProyectoQGIS.qgz for the layers this was derived from
 * (estaciones_visor for station positions, HydroRIVERS_loja_ref to verify
 * flow direction).
 */
export const UPSTREAM_REACH_FIDS: Record<string, number[]> = {
  'st-1': [
    13, 14, 54, 55, 56, 59, 60, 61, 68, 70, 71, 72, 73, 81, 82, 83, 89, 93, 96, 99, 101, 102,
    103, 108, 110, 121, 122, 123, 124, 127, 128, 137, 5801, 5802, 5803, 5804, 5805, 5806, 5807,
    5808, 5809, 5810, 5811, 5812, 5813, 5814, 5815, 5816, 5817, 5818, 5819, 5820, 5821, 5822, 5823,
    5824, 5825, 5826, 5827, 5828, 5829, 5830, 5831, 5832, 5833, 5834, 5835, 5836, 5837, 5838, 5839,
    5840, 5841, 5842, 5843, 5844, 5845, 6401, 6402, 6601, 6602, 6901, 6902, 6903, 6904, 8401, 8402,
    8801, 8802, 11801, 11802, 11803, 49801, 49802, 49803, 49804,
  ],
  'st-2': [5302],
  'st-3': [
    22, 23, 25, 26, 28, 30, 31, 32, 35, 52, 90, 91, 111, 129, 130, 132, 2401, 2402, 3601, 3602,
    13301, 13302,
  ],
  'st-4': [31, 35, 129, 3601],
};
