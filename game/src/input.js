// Keys and pointer. Held movement keys are read as a set; action keys
// (Enter, Esc, E, F, M, Space) edge-fire into a bitmask the loop drains
// once a frame. The test hooks let an automated driver hold pretend keys
// and fake clicks, so the game can be play-tested headlessly with no
// real keyboard in the room.
export const KEY_OK = 1;
export const KEY_PAUSE = 2;
export const KEY_USE = 4;
export const KEY_HIT = 8;
export const KEY_SOUND = 16;
export function makeControls(canvas) {
  const held = new Set();
  let queued = 0;
  let pointerX = 0;
  let pointerY = 0;
  let pressing = false;
  let shotQueued = false;
  const onDown = (e) => {
    const arrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
    if (arrows.includes(e.key)) e.preventDefault();
    held.add(e.key.toLowerCase());
    if (e.key === 'Enter' || e.key === ' ') queued |= KEY_OK;
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') queued |= KEY_PAUSE;
    if (e.key.toLowerCase() === 'e') queued |= KEY_USE;
    if (e.key.toLowerCase() === 'f') queued |= KEY_HIT;
    if (e.key.toLowerCase() === 'm') queued |= KEY_SOUND;
  };
  const onUp = (e) => held.delete(e.key.toLowerCase());
  const onMove = (e) => {
    const box = canvas.getBoundingClientRect();
    pointerX = e.clientX - box.left;
    pointerY = e.clientY - box.top;
  };
  const onPress = (e) => {
    onMove(e);
    pressing = true;
    shotQueued = true;
  };
  const onRelease = () => { pressing = false; };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  canvas.addEventListener('mousemove', onMove);
  canvas.addEventListener('mousedown', onPress);
  window.addEventListener('mouseup', onRelease);
  return {
    held,
    pointer() { return { x: pointerX, y: pointerY }; },
    drainKeys() {
      const out = queued;
      queued = 0;
      return out;
    },
    drainShot() {
      const out = shotQueued;
      shotQueued = false;
      return out;
    },
    get pressing() { return pressing; },
    heading() {
      let x = 0;
      let y = 0;
      if (held.has('a') || held.has('arrowleft')) x -= 1;
      if (held.has('d') || held.has('arrowright')) x += 1;
      if (held.has('w') || held.has('arrowup')) y -= 1;
      if (held.has('s') || held.has('arrowdown')) y += 1;
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    get sprint() { return held.has('shift'); },
    // Test hooks for the headless play-test driver.
    holdKey(key, on) {
      if (on) held.add(key);
      else held.delete(key);
    },
    fakeClick(x, y) {
      pointerX = x;
      pointerY = y;
      shotQueued = true;
    },
  };
}
