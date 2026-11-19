// Keyboard and mouse. Movement keys are read as a held set; action keys
// (Enter, Esc, E, F, M, Space) are edge-triggered into a bitmask the game
// loop consumes once per frame. The test hooks let an automated driver
// pretend keys are held and clicks happen, so the game can be play-tested
// headlessly without a real keyboard.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let shootQueued = false;
  const down = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key === 'Enter' || e.key === ' ') actions |= ACTION_CONFIRM;
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') actions |= ACTION_PAUSE;
    if (e.key.toLowerCase() === 'e') actions |= ACTION_ENTER;
    if (e.key.toLowerCase() === 'f') actions |= ACTION_PUNCH;
    if (e.key.toLowerCase() === 'm') actions |= ACTION_MUTE;
  };
  const up = (e) => keys.delete(e.key.toLowerCase());
  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  };
  const press = (e) => {
    move(e);
    mouseDown = true;
    shootQueued = true;
  };
  const release = () => { mouseDown = false; };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('mousedown', press);
  window.addEventListener('mouseup', release);
  return {
    keys,
    mouse() { return { x: mouseX, y: mouseY }; },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    takeShoot() {
      const s = shootQueued;
      shootQueued = false;
      return s;
    },
    get mouseDown() { return mouseDown; },
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x && y) { x *= 0.7071; y *= 0.7071; }
      return { x, y };
    },
    get run() { return keys.has('shift'); },
    // Test hooks for the headless play-test driver.
    testHold(key, on) {
      if (on) keys.add(key);
      else keys.delete(key);
    },
    testClick(x, y) {
      mouseX = x;
      mouseY = y;
      shootQueued = true;
    },
  };
}
