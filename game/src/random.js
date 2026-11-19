// Deterministic random numbers (mulberry32). One seed always builds the
// same city, the same traffic and the same pedestrians, so a screenshot
// taken twice shows the same streets.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
export function range(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
