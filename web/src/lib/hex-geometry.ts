/**
 * Geometry for drawing an n×n Cachex board with pointy-top hexagons.
 *
 * Row r = 0 is drawn at the bottom and each row up is shifted half a hex to
 * the right (the same layout as the original `print_board`), so Red's goal
 * edges are the top and bottom rows and Blue's are the slanted left and right
 * sides.
 */
export const SQRT3 = Math.sqrt(3);

export interface Point {
  x: number;
  y: number;
}

export interface BoardGeometry {
  n: number;
  radius: number;
  width: number;
  height: number;
  /** Padding around the outline (for edge bands and glow). */
  pad: number;
  centre: (r: number, q: number) => Point;
  hexPoints: (r: number, q: number, scale?: number) => string;
  /** Outline segments: Red owns top/bottom, Blue owns left/right. */
  edges: { top: Point[]; bottom: Point[]; left: Point[]; right: Point[] };
  outline: Point[];
  viewBox: string;
}

export function boardGeometry(n: number, radius = 10, pad = radius * 1.1): BoardGeometry {
  const w = SQRT3 * radius;
  const centre = (r: number, q: number): Point => ({
    x: pad + w / 2 + w * (q + r / 2),
    y: pad + radius + 1.5 * radius * (n - 1 - r),
  });

  const vertex = (c: Point, k: number, scale = 1): Point => {
    // pointy-top: vertex 0 at the top, clockwise
    const angle = (Math.PI / 180) * (60 * k - 90);
    return { x: c.x + radius * scale * Math.cos(angle), y: c.y + radius * scale * Math.sin(angle) };
  };

  const hexPoints = (r: number, q: number, scale = 1) => {
    const c = centre(r, q);
    return Array.from({ length: 6 }, (_, k) => vertex(c, k, scale))
      .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
      .join(" ");
  };

  // vertices: 0 top, 1 upper-right, 2 lower-right, 3 bottom, 4 lower-left, 5 upper-left
  const top: Point[] = [];
  for (let q = 0; q < n; q++) {
    const c = centre(n - 1, q);
    if (q === 0) top.push(vertex(c, 5));
    top.push(vertex(c, 0), vertex(c, 1));
  }
  const bottom: Point[] = [];
  for (let q = 0; q < n; q++) {
    const c = centre(0, q);
    if (q === 0) bottom.push(vertex(c, 4));
    bottom.push(vertex(c, 3), vertex(c, 2));
  }
  const left: Point[] = [];
  for (let r = 0; r < n; r++) {
    const c = centre(r, 0);
    if (r === 0) left.push(vertex(c, 4));
    left.push(vertex(c, 5));
    if (r < n - 1) left.push(vertex(c, 0));
  }
  const right: Point[] = [];
  for (let r = n - 1; r >= 0; r--) {
    const c = centre(r, n - 1);
    if (r === n - 1) right.push(vertex(c, 1));
    right.push(vertex(c, 2));
    if (r > 0) right.push(vertex(c, 3));
  }

  // closed outline: top (left→right), right (top→bottom), bottom (right→left), left (bottom→top)
  const outline = [
    ...top,
    ...right.slice(1),
    ...bottom.slice().reverse().slice(1),
    ...left.slice(1, -1),
  ];

  const width = pad * 2 + w * n + (w / 2) * (n - 1);
  const height = pad * 2 + radius * 2 + 1.5 * radius * (n - 1);

  return {
    n,
    radius,
    width,
    height,
    pad,
    centre,
    hexPoints,
    edges: { top, bottom, left, right },
    outline,
    viewBox: `0 0 ${width.toFixed(3)} ${height.toFixed(3)}`,
  };
}

export const toPath = (points: Point[], close = false) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" ") +
  (close ? " Z" : "");
