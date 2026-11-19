// Seeded chance (mulberry32). Feed it one seed and it always deals the
// same streets, the same parked motors and the same crowds, so a scene
// photographed twice is the same scene.
export function makeRng(seed) {
  let state = seed | 0;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    const rolled = (mixed ^ (mixed >>> 14)) >>> 0;
    return rolled / 4294967296;
  }
  return next;
}
export function choose(rng, list) {
  const slot = Math.floor(rng() * list.length);
  return list[slot];
}
export function between(rng, low, high) {
  return low + rng() * (high - low);
}
export function bound(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}
export function gap(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
export function headingTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
