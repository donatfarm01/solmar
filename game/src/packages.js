// Hidden stashes: twelve unmarked drops scattered over the road grid.
// A stash is a small gold cache left by runners who never came back
// for it. Walk or drive over one and Danny pockets the cash. Found
// stashes stay found across visits, the way a best score does, so the
// hunt is a slow one across many drives, not a single afternoon.
import { streetGrid } from './world.js';
import { gap } from './random.js';

const STASH_KEY = 'solmar.packs.v1';
const STASH_COUNT = 12;
const STASH_VALUE = 150;
const STASH_REACH = 46;

function readFound() {
  try {
    const raw = window.localStorage.getItem(STASH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistFound(packs) {
  try {
    const ids = [];
    for (const spot of packs.list) {
      if (spot.taken) ids.push(spot.id);
    }
    window.localStorage.setItem(STASH_KEY, JSON.stringify(ids));
  } catch {
    // Storage off: stashes last this visit only.
  }
}

export function makePackages(rng) {
  const grid = streetGrid();
  const crossings = [];
  for (const gx of grid.upright) {
    for (const gy of grid.crosswise) crossings.push({ x: gx, y: gy });
  }
  let i = crossings.length - 1;
  while (i > 0) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = crossings[i];
    crossings[i] = crossings[j];
    crossings[j] = tmp;
    i -= 1;
  }
  const kept = crossings.slice(0, STASH_COUNT);
  const foundIds = readFound();
  const packs = {
    list: kept.map((spot, id) => ({
      id,
      x: spot.x,
      y: spot.y,
      taken: foundIds.includes(id),
    })),
    total: STASH_COUNT,
    found: 0,
    value: STASH_VALUE,
    streak: 0,
    lastAt: -1000,
  };
  let counted = 0;
  for (const spot of packs.list) {
    if (spot.taken) counted += 1;
  }
  packs.found = counted;
  return packs;
}

export function stepPackages(sim) {
  const hero = sim.hero;
  const px = hero.ride ? hero.ride.x : hero.x;
  const py = hero.ride ? hero.ride.y : hero.y;
  for (const spot of sim.packs.list) {
    if (spot.taken) continue;
    if (gap(px, py, spot.x, spot.y) >= STASH_REACH) continue;
    spot.taken = true;
    sim.packs.found += 1;
    const gapSince = sim.elapsed - sim.packs.lastAt;
    if (gapSince < 60) sim.packs.streak += 1;
    else sim.packs.streak = 1;
    sim.packs.lastAt = sim.elapsed;
    const bonus = sim.packs.streak > 1 ? 25 * (sim.packs.streak - 1) : 0;
    const amount = STASH_VALUE + bonus;
    sim.money += amount;
    persistFound(sim.packs);
    return { spot, amount };
  }
  return null;
}

export function stashBase(sim) {
  return sim.packs.found * sim.packs.value;
}

export function nearestStash(sim) {
  const hero = sim.hero;
  const px = hero.ride ? hero.ride.x : hero.x;
  const py = hero.ride ? hero.ride.y : hero.y;
  let best = null;
  let bestGap = Infinity;
  for (const spot of sim.packs.list) {
    if (spot.taken) continue;
    const d = gap(px, py, spot.x, spot.y);
    if (d < bestGap) {
      bestGap = d;
      best = spot;
    }
  }
  if (!best) return null;
  const dx = best.x - px;
  const dy = best.y - py;
  const dirs = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const ang = Math.atan2(dy, dx);
  const slot = Math.round(ang / (Math.PI / 4));
  const dir = dirs[((slot % 8) + 8) % 8];
  return { spot: best, dist: bestGap, dir };
}
