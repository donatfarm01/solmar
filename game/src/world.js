// Solmar City, grown from a seed: a street grid, blocks of towers, one
// green quarter, a sand strip, parked motors, moving traffic, walkers and
// pickups. The same seed always grows the same town.
import { MAP, VEHICLES, QUARTERS } from './config.js';
import { choose, between } from './random.js';

// Where the upright and crosswise streets run, spaced evenly apart.
export function streetGrid() {
  const upright = [];
  const crosswise = [];
  for (let x = MAP.road / 2; x < MAP.width; x += MAP.block + MAP.road) upright.push(x);
  for (let y = MAP.road / 2; y < MAP.height; y += MAP.block + MAP.road) crosswise.push(y);
  return { upright, crosswise };
}
export function onStreet(x, y) {
  const { upright, crosswise } = streetGrid();
  const edge = MAP.road / 2 + 6;
  const nearUpright = upright.some((rx) => Math.abs(x - rx) < edge);
  const nearCrosswise = crosswise.some((ry) => Math.abs(y - ry) < edge);
  return nearUpright || nearCrosswise;
}
export function closestStreetPoint(x, y) {
  const { upright, crosswise } = streetGrid();
  let bestX = upright[0];
  let bestGap = Infinity;
  for (const rx of upright) {
    const d = Math.abs(x - rx);
    if (d < bestGap) { bestGap = d; bestX = rx; }
  }
  let bestY = crosswise[0];
  bestGap = Infinity;
  for (const ry of crosswise) {
    const d = Math.abs(y - ry);
    if (d < bestGap) { bestGap = d; bestY = ry; }
  }
  // Snap onto whichever street line lies nearer: an upright or a crosswise one.
  if (Math.abs(x - bestX) < Math.abs(y - bestY)) return { x: bestX, y };
  return { x, y: bestY };
}
export function quarterAt(x, y) {
  const found = QUARTERS.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
  return found || QUARTERS[0];
}
export function buildTown(rng) {
  const towers = [];
  const { upright, crosswise } = streetGrid();
  for (let bi = 0; bi < upright.length - 1; bi++) {
    for (let bj = 0; bj < crosswise.length - 1; bj++) {
      const bx = upright[bi] + MAP.road / 2 + 14;
      const by = crosswise[bj] + MAP.road / 2 + 14;
      const bw = MAP.block - 28;
      const bh = MAP.block - 28;
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      // The Palm Park block stays grassy most of the time; the bottom strip is sand.
      if (cx > 0 && cx < 1100 && cy > 800 && cy < 1600 && rng() < 0.8) continue;
      if (cy > 2150) continue;
      const count = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < count; k++) {
        const w = between(rng, 60, bw / count + 40);
        const h = between(rng, 50, bh - 20);
        const x = bx + (k * bw) / count + between(rng, 4, 18);
        const y = by + between(rng, 6, bh - h - 6);
        towers.push({
          x,
          y,
          w: Math.min(w, bw - 10),
          h,
          tint: Math.floor(between(rng, 0, 360)),
          levels: 1 + Math.floor(rng() * 6),
        });
      }
    }
  }
  const parked = [];
  for (let i = 0; i < 26; i++) {
    const rx = choose(rng, upright);
    const ry = choose(rng, crosswise);
    const along = rng() < 0.5;
    const side = rng() < 0.5 ? -30 : 30;
    const facing = rng() < 0.5;
    parked.push({
      x: along ? between(rng, 120, MAP.width - 120) : rx + side,
      y: along ? ry + side : between(rng, 120, MAP.height - 120),
      angle: along ? (facing ? 0 : Math.PI) : (facing ? Math.PI / 2 : -Math.PI / 2),
      kind: Math.floor(rng() * VEHICLES.length),
      velocity: 0,
      occupied: false,
      parked: true,
    });
  }
  const goods = [];
  const sorts = ['health', 'armour', 'ammo', 'cash'];
  for (let i = 0; i < 22; i++) {
    goods.push({
      x: between(rng, 120, MAP.width - 120),
      y: between(rng, 120, MAP.height - 260),
      sort: sorts[i % sorts.length],
      got: false,
      sway: rng() * 6,
    });
  }
  return {
    towers,
    parked,
    goods,
    hospital: { x: 2560, y: 320 },
    precinct: { x: 480, y: 320 },
    beach: { x: 700, y: 2250 },
  };
}
export function hitsStructure(towers, x, y, r) {
  for (const t of towers) {
    const inside = x > t.x - r && x < t.x + t.w + r && y > t.y - r && y < t.y + t.h + r;
    if (inside) return t;
  }
  return null;
}
export function spawnWalkers(rng, n) {
  const crowd = [];
  const tops = ['#e5534b', '#4f8fd0', '#e8b23a', '#7b5fd0', '#2f9e44', '#f2f0e8', '#d08a4f'];
  for (let i = 0; i < n; i++) {
    crowd.push({
      x: between(rng, 80, MAP.width - 80),
      y: between(rng, 80, MAP.height - 200),
      angle: between(rng, 0, 6.28),
      pace: between(rng, 30, 55),
      top: choose(rng, tops),
      panic: 0,
      runX: 0,
      runY: 0,
      paceT: between(rng, 0, 4),
    });
  }
  return crowd;
}
export function spawnDrivers(rng, n) {
  const flow = [];
  const { upright, crosswise } = streetGrid();
  for (let i = 0; i < n; i++) {
    const alongX = rng() < 0.5;
    const rx = choose(rng, upright);
    const ry = choose(rng, crosswise);
    const facing = rng() < 0.5;
    flow.push({
      x: alongX ? between(rng, 100, MAP.width - 100) : rx,
      y: alongX ? ry : between(rng, 100, MAP.height - 100),
      angle: alongX ? (facing ? 0 : Math.PI) : (facing ? Math.PI / 2 : -Math.PI / 2),
      kind: Math.floor(rng() * VEHICLES.length),
      velocity: between(rng, 90, 150),
      occupied: true,
      traffic: true,
      patrol: false,
    });
  }
  return flow;
}
