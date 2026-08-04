/**
 * Turns the rendered river paths into a drainage network, so a gauge can be
 * followed downstream through it.
 *
 * Two things about this layer force the approach, both measured on the rendered
 * network rather than assumed:
 *
 * 1. Arc direction is arbitrary. It is drawn for display, not for routing: only
 *    57 of 192 reaches meet the next one head-to-tail, and just as many meet
 *    head-to-head. So direction is not read off the geometry, it is imposed.
 * 2. Junctions are not endpoints. Barely 42% of reach ends coincide with
 *    another end — tributaries join a main stem partway along it. So reaches
 *    are joined by testing each end against the *line* of every other reach,
 *    not against its ends.
 *
 * With the reaches joined, each connected component is rooted at its
 * northernmost point — where it drains, since the basin of Loja drains north,
 * verified against the layer's own named rivers — and a sweep outward from that
 * root leaves every reach pointing at the neighbour below it. From any reach
 * there is then exactly one path down to the outlet, which is what
 * "downstream" means in a dendritic network.
 *
 * Everything is measured in container pixels: that is the one space where the
 * tiles agree, since each draws in its own local coordinates.
 */

export interface ReachNode {
  path: SVGPathElement;
  /** Sampled points along the reach, in container pixels. */
  points: { x: number; y: number }[];
  /** Length of the reach on the ground, in metres. */
  lengthM: number;
  /** Screen y of the northernmost sampled point; smaller is further downstream. */
  northY: number;
}

export interface Attribution {
  /** Station id governing the reach. */
  stationId: string;
  /** Distance from that gauge, following the channel downstream, in metres. */
  distanceM: number;
}

/** How close a reach end has to pass to another reach to count as joined.
 *  In pixels, because what it absorbs is rendering precision: the tiles
 *  quantise to 1/16 px and simplify by zoom. At 5 px, 311 of 358 reaches join
 *  into a single component with none left isolated. */
const JOIN_TOLERANCE_PX = 5;

/** Roughly one sample every this many pixels along a reach. */
const SAMPLE_SPACING_PX = 8;
const MIN_SAMPLES = 4;
const MAX_SAMPLES = 60;

/**
 * Reads the rendered paths into reach nodes. `originX/Y` shifts screen
 * coordinates into the map container's frame.
 */
export function buildReaches(
  paths: Iterable<SVGPathElement>,
  originX: number,
  originY: number,
  metresPerPixel: number
): ReachNode[] {
  const reaches: ReachNode[] = [];

  for (const path of paths) {
    const length = path.getTotalLength();
    const ctm = path.getScreenCTM();
    if (!length || !ctm) continue;

    const samples = Math.min(
      MAX_SAMPLES,
      Math.max(MIN_SAMPLES, Math.round(length / SAMPLE_SPACING_PX))
    );

    const points: { x: number; y: number }[] = [];
    let northY = Infinity;
    for (let i = 0; i <= samples; i++) {
      const p = path.getPointAtLength((length * i) / samples).matrixTransform(ctm);
      const point = { x: p.x - originX, y: p.y - originY };
      points.push(point);
      if (point.y < northY) northY = point.y;
    }

    reaches.push({ path, points, lengthM: length * metresPerPixel, northY });
  }

  return reaches;
}

function squaredDistanceToLine(reach: ReachNode, x: number, y: number): number {
  let best = Infinity;
  for (const p of reach.points) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Projects a point onto a reach's sampled polyline and reports how far along
 * it the closest point falls, measured from `points[0]` in the same units as
 * the points themselves (container pixels).
 */
function projectOntoReach(reach: ReachNode, x: number, y: number): { distSq: number; alongPx: number; totalPx: number } {
  let bestDistSq = Infinity;
  let bestAlong = 0;
  let cumulative = 0;

  for (let i = 0; i < reach.points.length - 1; i++) {
    const a = reach.points[i];
    const b = reach.points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lenSq)) : 0;
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const distSq = (px - x) ** 2 + (py - y) ** 2;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestAlong = cumulative + t * segLen;
    }
    cumulative += segLen;
  }

  return { distSq: bestDistSq, alongPx: bestAlong, totalPx: cumulative };
}

/**
 * Whether a reach's downstream end is its last sampled point rather than its
 * first — the per-reach counterpart to how the network's root is chosen.
 * Needed to turn "distance from points[0]" into "distance in the direction
 * the water actually moves".
 */
function flowsTowardLastPoint(reach: ReachNode, drainage: Drainage): boolean {
  const next = drainage.downstreamOf.get(reach);
  const first = reach.points[0];
  const last = reach.points[reach.points.length - 1];

  if (!next) {
    // This reach is itself an outlet: fall back to the same convention used
    // to root the network — the basin drains north, so downstream is north.
    return last.y <= first.y;
  }
  return squaredDistanceToLine(next, last.x, last.y) <= squaredDistanceToLine(next, first.x, first.y);
}

/** Which reach lies immediately below each one. */
export interface Drainage {
  downstreamOf: Map<ReachNode, ReachNode | null>;
}

/**
 * Joins the reaches and orients them, so every reach knows what is below it.
 */
export function orientNetwork(reaches: ReachNode[]): Drainage {
  const tolerance = JOIN_TOLERANCE_PX ** 2;

  // A reach is joined to another when one of its ends touches that reach's line.
  const neighbours = new Map<ReachNode, Set<ReachNode>>();
  reaches.forEach((reach) => neighbours.set(reach, new Set()));

  const link = (a: ReachNode, b: ReachNode) => {
    neighbours.get(a)!.add(b);
    neighbours.get(b)!.add(a);
  };

  for (const reach of reaches) {
    const ends = [reach.points[0], reach.points[reach.points.length - 1]];
    for (const end of ends) {
      for (const other of reaches) {
        if (other === reach) continue;
        if (squaredDistanceToLine(other, end.x, end.y) <= tolerance) link(reach, other);
      }
    }
  }

  const downstreamOf = new Map<ReachNode, ReachNode | null>();
  const assigned = new Set<ReachNode>();

  for (const start of reaches) {
    if (assigned.has(start)) continue;

    // Collect this connected component.
    const component: ReachNode[] = [];
    const stack = [start];
    assigned.add(start);
    while (stack.length > 0) {
      const reach = stack.pop()!;
      component.push(reach);
      for (const neighbour of neighbours.get(reach)!) {
        if (!assigned.has(neighbour)) {
          assigned.add(neighbour);
          stack.push(neighbour);
        }
      }
    }

    // Root it where it drains: its northernmost reach.
    let root = component[0];
    for (const reach of component) if (reach.northY < root.northY) root = reach;

    // Sweep outward by distance, not by hops. Breadth-first would follow the
    // fewest junctions and cut across the basin; the water follows the shortest
    // *channel*, so the tree has to be built on accumulated length. Each reach
    // then points at the neighbour on its shortest way down to the outlet.
    const distance = new Map<ReachNode, number>([[root, 0]]);
    const settled = new Set<ReachNode>();
    downstreamOf.set(root, null);

    while (settled.size < component.length) {
      let nearest: ReachNode | null = null;
      let nearestDistance = Infinity;
      for (const reach of component) {
        if (settled.has(reach)) continue;
        const d = distance.get(reach);
        if (d !== undefined && d < nearestDistance) {
          nearestDistance = d;
          nearest = reach;
        }
      }
      if (!nearest) break; // the rest is unreachable

      settled.add(nearest);
      for (const neighbour of neighbours.get(nearest)!) {
        if (settled.has(neighbour)) continue;
        const candidate = nearestDistance + neighbour.lengthM;
        if (candidate < (distance.get(neighbour) ?? Infinity)) {
          distance.set(neighbour, candidate);
          downstreamOf.set(neighbour, nearest);
        }
      }
    }
  }

  return { downstreamOf };
}

export interface GaugePoint {
  stationId: string;
  /** Position of the station in container pixels. */
  x: number;
  y: number;
}

/** Where a gauge's walk enters a reach: how far in, and in which direction. */
interface EntryPoint {
  /** Position within the reach, in the downstream direction: 0 at its
   *  upstream end, lengthM at its downstream end. */
  downstreamPosM: number;
  /** Cumulative distance travelled from the gauge to reach this point. */
  distanceM: number;
}

/** Two entries are the same physical junction if their along-reach position
 *  agrees to within this: sampling and floating point, not a real gap. */
const SAME_JUNCTION_M = 2;

/**
 * Follows every gauge down to the outlet and reports, for each reach on the
 * way, which gauge governs it and how far below that gauge it lies.
 *
 * A reach cannot be split for styling — one `<path>` is one colour — so where
 * two gauges' walks both cross the same reach, the whole reach goes to
 * whichever entered it further downstream *within that reach*: that is the
 * one whose water is actually flowing through most of it. Only when both
 * enter at the same point (which is every reach but each gauge's own seed,
 * since the walk always joins the next reach at its own start) does this fall
 * back to whichever gauge is closer overall — the same rule as before.
 */
export function attributeDownstream(
  reaches: ReachNode[],
  drainage: Drainage,
  gauges: GaugePoint[],
  maxSnapPx: number
): Map<SVGPathElement, Attribution> {
  const entries = new Map<SVGPathElement, Map<string, EntryPoint>>();

  for (const gauge of gauges) {
    // The reach the station actually stands on, whatever its name claims.
    let seed: ReachNode | null = null;
    let seedProjection: { distSq: number; alongPx: number; totalPx: number } | null = null;
    let best = maxSnapPx ** 2;
    for (const reach of reaches) {
      const projection = projectOntoReach(reach, gauge.x, gauge.y);
      if (projection.distSq < best) {
        best = projection.distSq;
        seed = reach;
        seedProjection = projection;
      }
    }
    if (!seed || !seedProjection) continue;

    // Where along the seed the gauge itself sits, so only the portion
    // actually downstream of it counts — not the whole reach from its start.
    const seedAlongM =
      seedProjection.totalPx > 0 ? (seedProjection.alongPx / seedProjection.totalPx) * seed.lengthM : 0;
    const seedTowardLast = flowsTowardLastPoint(seed, drainage);
    let entryPosM = seedTowardLast ? seedAlongM : seed.lengthM - seedAlongM;

    let reach: ReachNode | null = seed;
    let distanceM = 0;
    const guard = new Set<ReachNode>();

    while (reach && !guard.has(reach)) {
      guard.add(reach);

      let byGauge = entries.get(reach.path);
      if (!byGauge) {
        byGauge = new Map();
        entries.set(reach.path, byGauge);
      }
      byGauge.set(gauge.stationId, { downstreamPosM: entryPosM, distanceM });

      distanceM += reach.lengthM - entryPosM;
      reach = drainage.downstreamOf.get(reach) ?? null;
      entryPosM = 0; // every subsequent reach is joined at its own upstream end
    }
  }

  const attribution = new Map<SVGPathElement, Attribution>();
  for (const [path, byGauge] of entries) {
    let winner: { stationId: string } & EntryPoint = { stationId: '', downstreamPosM: -Infinity, distanceM: Infinity };
    for (const [stationId, entry] of byGauge) {
      const samePosition = Math.abs(entry.downstreamPosM - winner.downstreamPosM) <= SAME_JUNCTION_M;
      const betterPosition = entry.downstreamPosM > winner.downstreamPosM + SAME_JUNCTION_M;
      const tieBrokenByDistance = samePosition && entry.distanceM < winner.distanceM;
      if (betterPosition || tieBrokenByDistance || winner.stationId === '') {
        winner = { stationId, ...entry };
      }
    }
    attribution.set(path, { stationId: winner.stationId, distanceM: winner.distanceM });
  }

  return attribution;
}
