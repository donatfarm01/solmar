// Solmar City: deterministic grid city — roads, blocks, buildings, park, beach,
// parked cars, traffic, pedestrians and pickups, all from a seeded RNG.
import { CITY, CAR_TYPES, DISTRICTS } from './config.js';
import { pick, range } from './random.js';

export function roadCenters() {
  const xs = [], ys = [];
  for (let x = CITY.road / 2; x < CITY.width; x += CITY.block + CITY.road) xs.push(x);
  for (let y = CITY.road / 2; y < CITY.height; y += CITY.block + CITY.road) ys.push(y);
  return { xs, ys };
}
export function isOnRoad(x, y) {
  const { xs, ys } = roadCenters();
  return xs.some((rx) => Math.abs(x - rx) < CITY.road / 2 + 6) || ys.some((ry) => Math.abs(y - ry) < CITY.road / 2 + 6);
}
export function nearestRoadPoint(x, y) {
  const { xs, ys } = roadCenters();
  let bx = xs[0], bd = 1e9;
  for (const rx of xs) { const d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } }
  let by = ys[0]; bd = 1e9;
  for (const ry of ys) { const d = Math.abs(y - ry); if (d < bd) { bd = d; by = ry; } }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}
export function districtAt(x, y) {
  return DISTRICTS.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) || DISTRICTS[0];
}
export function createCity(rng) {
  const buildings = [];
  const { xs, ys } = roadCenters();
  // Blocks between roads: 1-3 buildings each, park block in Palm Park, beach strip at bottom.
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx = xs[bi] + CITY.road / 2 + 14, by = ys[bj] + CITY.road / 2 + 14;
      const bw = CITY.block - 28, bh = CITY.block - 28;
      const cx = bx + bw / 2, cy = by + bh / 2;
      if (cx > 0 && cx < 1100 && cy > 800 && cy < 1600 && rng() < 0.8) continue; // park block stays green
      if (cy > 2150) continue; // beach strip
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const w = range(rng, 60, bw / n + 40), h = range(rng, 50, bh - 20);
        const x = bx + (k * bw) / n + range(rng, 4, 18), y = by + range(rng, 6, bh - h - 6);
        buildings.push({ x, y, w: Math.min(w, bw - 10), h, hue: Math.floor(range(rng, 0, 360)), floors: 1 + Math.floor(rng() * 6) });
      }
    }
  }
  const parked = [];
  for (let i = 0; i < 26; i++) {
    const rx = pick(rng, xs), ry = pick(rng, ys);
    const alongRoad = rng() < 0.5;
    parked.push({
      x: alongRoad ? range(rng, 120, CITY.width - 120) : rx + (rng() < 0.5 ? -30 : 30),
      y: alongRoad ? ry + (rng() < 0.5 ? -30 : 30) : range(rng, 120, CITY.height - 120),
      angle: alongRoad ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      type: Math.floor(rng() * CAR_TYPES.length), speed: 0, driver: false, parked: true,
    });
  }
  const pickups = [];
  const kinds = ['health', 'armour', 'ammo', 'cash'];
  for (let i = 0; i < 22; i++) {
    pickups.push({ x: range(rng, 120, CITY.width - 120), y: range(rng, 120, CITY.height - 260), kind: kinds[i % kinds.length], taken: false, bob: rng() * 6 });
  }
  return { buildings, parked, pickups, hospital: { x: 2560, y: 320 }, precinct: { x: 480, y: 320 }, beach: { x: 700, y: 2250 } };
}
export function collidesBuilding(buildings, x, y, r) {
  for (const b of buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return b;
  }
  return null;
}
export function spawnPeds(rng, n) {
  const peds = [];
  const shirts = ['#e5534b', '#4f8fd0', '#e8b23a', '#7b5fd0', '#2f9e44', '#f2f0e8', '#d08a4f'];
  for (let i = 0; i < n; i++) {
    peds.push({ x: range(rng, 80, CITY.width - 80), y: range(rng, 80, CITY.height - 200), angle: range(rng, 0, 6.28), speed: range(rng, 30, 55), shirt: pick(rng, shirts), scared: 0, fleeX: 0, fleeY: 0, walkT: range(rng, 0, 4) });
  }
  return peds;
}
export function spawnTraffic(rng, n) {
  const cars = [];
  const { xs, ys } = roadCenters();
  for (let i = 0; i < n; i++) {
    const alongX = rng() < 0.5;
    const rx = pick(rng, xs), ry = pick(rng, ys);
    cars.push({
      x: alongX ? range(rng, 100, CITY.width - 100) : rx, y: alongX ? ry : range(rng, 100, CITY.height - 100),
      angle: alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      type: Math.floor(rng() * CAR_TYPES.length), speed: range(rng, 90, 150), driver: true, traffic: true, police: false,
    });
  }
  return cars;
}
