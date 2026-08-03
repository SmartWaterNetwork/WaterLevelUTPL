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

/**
 * Follows every gauge down to the outlet and reports, for each reach on the
 * way, which gauge governs it and how far below that gauge it lies.
 *
 * Where two gauges both lie upstream of a reach, the nearer one wins: that is
 * the last gauge the water passed, and so the one that describes it.
 */
export function attributeDownstream(
  reaches: ReachNode[],
  drainage: Drainage,
  gauges: GaugePoint[],
  maxSnapPx: number
): Map<SVGPathElement, Attribution> {
  const attribution = new Map<SVGPathElement, Attribution>();

  for (const gauge of gauges) {
    // The reach the station actually stands on, whatever its name claims.
    let seed: ReachNode | null = null;
    let best = maxSnapPx ** 2;
    for (const reach of reaches) {
      const d = squaredDistanceToLine(reach, gauge.x, gauge.y);
      if (d < best) {
        best = d;
        seed = reach;
      }
    }
    if (!seed) continue;

    let reach: ReachNode | null = seed;
    let distanceM = 0;
    const guard = new Set<ReachNode>();

    while (reach && !guard.has(reach)) {
      guard.add(reach);
      const current = attribution.get(reach.path);
      if (!current || distanceM < current.distanceM) {
        attribution.set(reach.path, { stationId: gauge.stationId, distanceM });
      }
      distanceM += reach.lengthM;
      reach = drainage.downstreamOf.get(reach) ?? null;
    }
  }

  return attribution;
}
