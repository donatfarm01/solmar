// Solmar — boot and game loop. Fixed 1/60 s steps. Screens: title, play,
// paused, wasted, busted. The player walks or drives; traffic and
// pedestrians share the streets; police answer the wanted level; combat,
// pickups, six story missions and a localStorage save round it out.
// ?shot=title|driving|wanted|mission stages one scene for a screenshot and
// sets window.__shotReady when the frame is drawn.
import { CITY, STEP, SAVE_KEY, SEED, PLAYER, CAR_TYPES, WANTED_DECAY } from './config.js';
import { createRandom, clamp, dist, angleTo } from './random.js';
import { createCity, collidesBuilding, spawnPeds, spawnTraffic, isOnRoad, nearestRoadPoint } from './world.js';
import { MISSIONS, createMissionState, startMission, missionObjective } from './missions.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MUTE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_BUSTED } from './render.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED;
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

function newState() {
  const city = createCity(createRandom(seed));
  const cars = city.parked.map((c) => ({ ...c, hp: 100 }));
  for (const c of spawnTraffic(createRandom(seed + 7), 14)) cars.push({ ...c, hp: 100 });
  return {
    city,
    cars,
    peds: spawnPeds(createRandom(seed + 13), 26),
    cops: [],
    bullets: [],
    particles: [],
    floaters: [],
    skids: [],
    player: { x: 480, y: 480, angle: 0, hp: 100, armour: 0, ammo: 60, car: null, speed: 0 },
    cash: 150,
    wanted: 0,
    wantedHeat: 0,
    clock: 9.5,
    time: 0,
    shake: 0,
    mission: createMissionState(),
    hasSave: false,
    best: 0,
    kills: 0,
    carsStolen: 0,
  };
}
let state = newState();
let screen = SCREEN_TITLE;
let best = 0;
let accumulator = 0;
let last = performance.now();
let time = 0;
let policeSpawnT = 0;
let pedSpawnT = 0;
let saveT = 0;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      hp: state.player.hp,
      ammo: state.player.ammo,
      armour: state.player.armour,
      x: state.player.x,
      y: state.player.y,
      done: state.mission.done,
      active: state.mission.active,
      best,
    }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}
function loadSave() {
  const s = readSave();
  if (!s) return false;
  state.cash = s.cash ?? 150;
  state.player.hp = s.hp ?? 100;
  state.player.ammo = s.ammo ?? 60;
  state.player.armour = s.armour ?? 0;
  state.player.x = s.x ?? 480;
  state.player.y = s.y ?? 480;
  state.mission.done = s.done ?? [];
  best = s.best ?? 0;
  if (typeof s.active === 'number' && s.active >= 0 && !state.mission.done.includes(s.active)) {
    startMission(state.mission, s.active);
  }
  return true;
}
try {
  best = Number.parseInt(window.localStorage.getItem('solmar.best') ?? '0', 10) || 0;
} catch {
  best = 0;
}
state.hasSave = !!readSave();
if (state.cash > best) best = state.cash;

function announce(msg) { status.textContent = msg; }
function floater(x, y, text, color) {
  state.floaters.push({ x, y, text, color: color || '#f2c94c', life: 1.6 });
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 220,
      vy: (Math.random() - 0.5) * 220,
      life: 0.5,
      max: 0.5,
      size: 3 + Math.random() * 3,
      color,
    });
  }
}
function addWanted(n, why) {
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.wantedHeat = 1;
  if (n > 0) floater(state.player.x, state.player.y - 24, `WANTED +${n} — ${why}`, '#e5534b');
}
function nearestCar(x, y, maxD) {
  let bestC = null;
  let bd = maxD;
  for (const c of state.cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; bestC = c; }
  }
  return bestC;
}
function enterCar() {
  const p = state.player;
  if (p.car) {
    const c = p.car;
    p.car = null;
    p.x = c.x + 40;
    p.y = c.y;
    p.angle = c.angle;
    c.speed = 0;
    announce('On foot.');
    return;
  }
  const c = nearestCar(p.x, p.y, 70);
  if (!c) {
    announce('No car nearby.');
    return;
  }
  if (c.driver) {
    // Stealing an occupied car: the driver bails out and flees, and the
    // theft puts a star on the player.
    c.driver = false;
    addWanted(1, 'car theft');
    state.carsStolen += 1;
    state.peds.push({
      x: c.x + 30, y: c.y, angle: 0, speed: 120, shirt: '#e5534b',
      scared: 3, fleeX: c.x + 200, fleeY: c.y, walkT: 0,
    });
    floater(c.x, c.y - 30, 'CAR STOLEN!', '#e5534b');
    audio.crash();
  }
  state.cars.splice(state.cars.indexOf(c), 1);
  p.car = c;
  p.x = c.x;
  p.y = c.y;
  audio.pickup();
  announce(`Driving a ${CAR_TYPES[c.type].name}.`);
}
function shoot() {
  const p = state.player;
  if (p.ammo <= 0) {
    floater(p.x, p.y - 24, 'NO AMMO', '#e5534b');
    return;
  }
  p.ammo -= 1;
  audio.shoot();
  const m = input.mouse();
  const sx = p.car ? p.car.x : p.x;
  const sy = p.car ? p.car.y : p.y;
  const camX = Math.max(renderer.width / 2, Math.min(CITY.width - renderer.width / 2, sx));
  const camY = Math.max(renderer.height / 2, Math.min(CITY.height - renderer.height / 2, sy));
  const wx = m.x + camX - renderer.width / 2;
  const wy = m.y + camY - renderer.height / 2;
  const a = angleTo(sx, sy, wx, wy);
  state.bullets.push({
    x: sx + Math.cos(a) * 24,
    y: sy + Math.sin(a) * 24,
    vx: Math.cos(a) * 720,
    vy: Math.sin(a) * 720,
    life: 0.6,
  });
  if (state.wanted < 1) addWanted(1, 'firing a weapon');
}
function punch() {
  const p = state.player;
  if (p.car) return;
  audio.punch();
  for (const ped of state.peds) {
    if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange + 12) {
      ped.scared = 3;
      ped.fleeX = ped.x + (ped.x - p.x) * 3;
      ped.fleeY = ped.y + (ped.y - p.y) * 3;
      burst(ped.x, ped.y, '#fff', 6);
      addWanted(1, 'assault');
      floater(ped.x, ped.y - 20, 'WHAM!', '#fff');
    }
  }
  for (const cop of state.cops) {
    if (dist(p.x, p.y, cop.x, cop.y) < PLAYER.punchRange + 12) {
      cop.hp -= PLAYER.punch;
      burst(cop.x, cop.y, '#2b4acb', 8);
      addWanted(1, 'attacking police');
    }
  }
}
function hitPlayer(dmg) {
  const p = state.player;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, dmg * 0.6);
    p.armour -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  state.shake = Math.max(state.shake, 8);
  if (p.hp <= 0) wasted();
}
function wasted() {
  audio.busted();
  state.cash = Math.max(0, state.cash - 200);
  state.player.hp = 100;
  state.player.armour = 0;
  state.player.car = null;
  state.player.x = state.city.hospital.x;
  state.player.y = state.city.hospital.y + 80;
  state.wanted = 0;
  state.cops = [];
  state.bullets = [];
  writeSave();
  screen = SCREEN_OVER;
  announce('Wasted. You wake up at Solmar General Hospital, $200 lighter.');
}
function busted() {
  audio.busted();
  state.cash = Math.max(0, state.cash - 200);
  state.player.hp = 100;
  state.player.car = null;
  state.player.x = state.city.precinct.x;
  state.player.y = state.city.precinct.y + 80;
  state.wanted = 0;
  state.cops = [];
  state.bullets = [];
  writeSave();
  screen = SCREEN_BUSTED;
  announce('Busted. The precinct lets you go, $200 lighter.');
}
function completeMission() {
  const m = MISSIONS[state.mission.active];
  state.cash += m.reward;
  state.mission.done.push(m.id);
  floater(state.player.x, state.player.y - 30, `+$${m.reward} — ${m.title} COMPLETE`, '#2f9e44');
  audio.jingle();
  announce(`Mission complete: ${m.title}. +$${m.reward}.`);
  state.mission.active = -1;
  state.mission.step = 0;
  state.mission.timer = 0;
  state.mission.dialogue = `${m.giver}: Nice work, Danny. $${m.reward} is yours. Press N for the next job.`;
  state.mission.dialogueT = 6;
  if (state.cash > best) {
    best = state.cash;
    try {
      window.localStorage.setItem('solmar.best', String(best));
    } catch {
      // ignore
    }
  }
  writeSave();
}
function stepMission(dt) {
  const ms = state.mission;
  if (ms.active < 0) return;
  const m = MISSIONS[ms.active];
  const st = m.steps[ms.step];
  if (!st) return;
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  if (st.kind === 'timed' && ms.step === 0 && ms.timer <= 0) ms.timer = st.time;
  if (ms.timer > 0) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      ms.dialogue = 'Marla Voss: Too slow — the job fell through. Press N to retry.';
      ms.dialogueT = 6;
      ms.active = -1;
      ms.step = 0;
      return;
    }
  }
  if (st.kind === 'steal') {
    if (state.player.car) {
      ms.step += 1;
      ms.dialogue = 'Rico: That\'s the one. Now bring it to my garage.';
      ms.dialogueT = 5;
    }
    return;
  }
  if (st.kind === 'wanted') {
    if (state.wanted >= 2 && ms.step === 0) {
      ms.step = 1;
      ms.dialogue = 'Marla Voss: Now lose them and get to the safe house.';
      ms.dialogueT = 5;
    }
    return;
  }
  if (st.kind === 'escape') {
    if (dist(px, py, st.x, st.y) < 70) completeMission();
    return;
  }
  if (st.kind === 'goto' || st.kind === 'timed') {
    const needCar = st.needCar && !state.player.car;
    if (dist(px, py, st.x, st.y) < 70 && !needCar) {
      // Mission 3: the safe house will not take you while the cops are on you.
      if (st.kind === 'goto' && m.id === 3 && ms.step === 1 && state.wanted > 0) {
        ms.dialogue = 'Marla Voss: Not while the cops are on you — lose them first!';
        ms.dialogueT = 4;
        return;
      }
      ms.step += 1;
      if (ms.step >= m.steps.length) completeMission();
      else {
        audio.pickup();
        ms.dialogue = MISSIONS[ms.active].steps[ms.step].label;
        ms.dialogueT = 5;
      }
    }
  }
}
function stepPlayer(dt) {
  const p = state.player;
  const dir = input.direction();
  const m = input.mouse();
  if (p.car) {
    const c = p.car;
    const spec = CAR_TYPES[c.type];
    const fwd = input.keys.has('w') || input.keys.has('arrowup');
    const back = input.keys.has('s') || input.keys.has('arrowdown');
    const steer = (input.keys.has('a') || input.keys.has('arrowleft') ? -1 : 0)
      + (input.keys.has('d') || input.keys.has('arrowright') ? 1 : 0);
    if (fwd) c.speed += spec.accel * dt;
    if (back) c.speed -= spec.accel * 0.8 * dt;
    c.speed = clamp(c.speed, -spec.top * 0.45, spec.top);
    if (!fwd && !back) c.speed *= Math.pow(0.4, dt);
    const dirSign = c.speed >= 0 ? 1 : -1;
    c.angle += steer * spec.turn * dt * dirSign * Math.min(1, Math.abs(c.speed) / 120);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (collidesBuilding(state.city.buildings, nx, ny, 22)) {
      if (Math.abs(c.speed) > 160) {
        audio.crash();
        state.shake = 12;
        burst(c.x, c.y, '#888', 10);
        hitPlayer(6);
      }
      c.speed *= -0.25;
      state.skids.push({ x1: c.x, y1: c.y, x2: nx, y2: ny });
      if (state.skids.length > 80) state.skids.shift();
    } else {
      c.x = clamp(nx, 40, CITY.width - 40);
      c.y = clamp(ny, 40, CITY.height - 140);
    }
    p.x = c.x;
    p.y = c.y;
    p.angle = c.angle;
    if (Math.abs(c.speed) > 240 && steer) {
      state.skids.push({ x1: c.x, y1: c.y, x2: c.x - Math.cos(c.angle) * 20, y2: c.y - Math.sin(c.angle) * 20 });
    }
    audio.engine(Math.abs(c.speed) / 430);
    // Running a pedestrian over is a crime, and it shows.
    for (const ped of state.peds) {
      if (dist(c.x, c.y, ped.x, ped.y) < 26 && Math.abs(c.speed) > 60) {
        ped.scared = 3;
        ped.fleeX = ped.x + 300;
        burst(ped.x, ped.y, '#e5534b', 8);
        addWanted(1, 'hit a pedestrian');
        hitPlayer(0);
      }
    }
  } else {
    const speed = input.run ? PLAYER.run : PLAYER.walk;
    const nx = p.x + dir.x * speed * dt;
    const ny = p.y + dir.y * speed * dt;
    if (!collidesBuilding(state.city.buildings, nx, p.y, PLAYER.radius)) p.x = clamp(nx, 20, CITY.width - 20);
    if (!collidesBuilding(state.city.buildings, p.x, ny, PLAYER.radius)) p.y = clamp(ny, 20, CITY.height - 150);
    if (dir.x || dir.y) p.angle = Math.atan2(dir.y, dir.x);
    audio.engine(0);
    // On foot the player aims at the mouse.
    const camX = Math.max(renderer.width / 2, Math.min(CITY.width - renderer.width / 2, p.x));
    const camY = Math.max(renderer.height / 2, Math.min(CITY.height - renderer.height / 2, p.y));
    p.aim = angleTo(p.x, p.y, m.x + camX - renderer.width / 2, m.y + camY - renderer.height / 2);
  }
  // Pickups: health, armour, ammo, cash.
  for (const pk of state.city.pickups) {
    if (!pk.taken && dist(p.x, p.y, pk.x, pk.y) < 30) {
      pk.taken = true;
      audio.pickup();
      if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        floater(pk.x, pk.y - 20, '+40 HP', '#2f9e44');
      }
      if (pk.kind === 'armour') {
        p.armour = Math.min(100, p.armour + 50);
        floater(pk.x, pk.y - 20, '+50 ARMOUR', '#4f8fd0');
      }
      if (pk.kind === 'ammo') {
        p.ammo += 30;
        floater(pk.x, pk.y - 20, '+30 AMMO', '#e8b23a');
      }
      if (pk.kind === 'cash') {
        state.cash += 50;
        floater(pk.x, pk.y - 20, '+$50', '#f2c94c');
      }
    }
  }
}
function stepTraffic(dt) {
  for (const c of state.cars) {
    if (c.police) continue;
    // Traffic hugs the roads: steer toward the nearest road line, hold speed.
    const rp = nearestRoadPoint(c.x, c.y);
    const target = Math.abs(c.x - rp.x) < Math.abs(c.y - rp.y)
      ? (c.x > rp.x ? Math.PI : 0)
      : (c.y > rp.y ? Math.PI / 2 : -Math.PI / 2);
    let diff = target - c.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    c.angle += clamp(diff, -1.4 * dt, 1.4 * dt);
    if (!c.traffic) continue;
    c.speed = 120;
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (c.x < 60 || c.x > CITY.width - 60 || c.y < 60 || c.y > CITY.height - 160) c.angle += Math.PI;
  }
}
function stepPeds(dt) {
  for (const ped of state.peds) {
    if (ped.scared > 0) {
      ped.scared -= dt;
      const a = angleTo(ped.x, ped.y, ped.fleeX, ped.fleeY);
      ped.x += Math.cos(a) * 130 * dt;
      ped.y += Math.sin(a) * 130 * dt;
      ped.angle = a;
    } else {
      ped.walkT -= dt;
      if (ped.walkT <= 0) {
        ped.walkT = 2 + Math.random() * 3;
        ped.angle = Math.random() * 6.28;
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
      if (!collidesBuilding(state.city.buildings, nx, ny, 10) && nx > 20 && nx < CITY.width - 20 && ny > 20 && ny < CITY.height - 150) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.angle += Math.PI / 2;
      }
    }
    // Gunfire nearby sends pedestrians running.
    if (state.bullets.length && dist(ped.x, ped.y, state.player.x, state.player.y) < 220 && ped.scared <= 0) {
      ped.scared = 2;
      ped.fleeX = ped.x + (ped.x - state.player.x);
      ped.fleeY = ped.y + (ped.y - state.player.y);
    }
  }
  pedSpawnT -= dt;
  if (pedSpawnT <= 0 && state.peds.length < 30) {
    pedSpawnT = 4;
    state.peds.push({
      x: clamp(state.player.x + (Math.random() < 0.5 ? -500 : 500), 60, CITY.width - 60),
      y: clamp(state.player.y + (Math.random() < 0.5 ? -400 : 400), 60, CITY.height - 160),
      angle: Math.random() * 6.28,
      speed: 40,
      shirt: '#4f8fd0',
      scared: 0,
      fleeX: 0,
      fleeY: 0,
      walkT: 1,
    });
  }
}
function stepPolice(dt) {
  // Heat cools when no police unit can see the player; cops chase, ram and
  // arrest. More stars mean more units and faster pursuit cars.
  const px = state.player.car ? state.player.car.x : state.player.x;
  const py = state.player.car ? state.player.car.y : state.player.y;
  const seen = state.cops.some((c) => dist(c.x, c.y, px, py) < 420)
    || state.cars.some((c) => c.police && dist(c.x, c.y, px, py) < 500);
  if (state.wanted > 0 && !seen) {
    state.wantedHeat -= WANTED_DECAY * dt;
    if (state.wantedHeat <= 0) {
      state.wanted = Math.max(0, state.wanted - 1);
      state.wantedHeat = 1;
      floater(px, py - 30, 'Heat cooling…', '#b8b4a8');
    }
  } else if (seen) {
    state.wantedHeat = 1;
  }
  const wantCops = state.wanted >= 1 ? Math.min(2 + state.wanted, 6) : 0;
  policeSpawnT -= dt;
  if (state.wanted > 0 && policeSpawnT <= 0) {
    policeSpawnT = 2.5;
    if (state.cars.filter((c) => c.police).length < Math.ceil(wantCops / 2)) {
      state.cars.push({
        x: clamp(px + 600, 60, CITY.width - 60),
        y: clamp(py - 400, 60, CITY.height - 160),
        angle: 0, type: 1, speed: 0, driver: true, police: true, hp: 100,
      });
    } else if (state.cops.length < wantCops) {
      state.cops.push({ x: px + 300, y: py + 200, angle: 0, speed: 150, shirt: '#2b4acb', hp: 40 });
    }
  }
  if (state.wanted === 0) {
    state.cops = state.cops.filter((c) => dist(c.x, c.y, px, py) > 700);
  }
  audio.siren(state.wanted > 0);
  for (const c of state.cars) {
    if (!c.police) continue;
    const a = angleTo(c.x, c.y, px, py);
    let diff = a - c.angle;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    c.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    c.speed = clamp(c.speed + 320 * dt, 0, 300 + state.wanted * 22);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    if (dist(c.x, c.y, px, py) < 46) {
      if (state.player.car) {
        state.player.car.speed *= 0.5;
        state.shake = 10;
        audio.crash();
        hitPlayer(4);
      } else {
        hitPlayer(10 * dt * 6);
      }
      if (!state.player.car && dist(c.x, c.y, px, py) < 30) busted();
    }
  }
  for (const cop of state.cops) {
    const a = angleTo(cop.x, cop.y, px, py);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.speed * dt;
    cop.y += Math.sin(a) * cop.speed * dt;
    if (dist(cop.x, cop.y, px, py) < 26) {
      if (state.player.car) {
        // A foot cop cannot arrest a driver.
      } else {
        hitPlayer(14 * dt);
        if (dist(cop.x, cop.y, px, py) < 20 && state.player.hp < 30) busted();
      }
    }
    if (cop.hp <= 0) {
      burst(cop.x, cop.y, '#2b4acb', 10);
      state.cops.splice(state.cops.indexOf(cop), 1);
      addWanted(1, 'downed a cop');
    }
  }
}
function stepBullets(dt) {
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const ped of state.peds) {
      if (dist(b.x, b.y, ped.x, ped.y) < 16) {
        ped.scared = 3;
        ped.fleeX = ped.x + b.vx;
        ped.fleeY = ped.y + b.vy;
        burst(ped.x, ped.y, '#e5534b', 8);
        b.life = 0;
        addWanted(1, 'hit a pedestrian');
      }
    }
    for (const cop of state.cops) {
      if (dist(b.x, b.y, cop.x, cop.y) < 16) {
        cop.hp -= 25;
        burst(b.x, b.y, '#2b4acb', 8);
        b.life = 0;
      }
    }
    for (const c of state.cars) {
      if (c.police && dist(b.x, b.y, c.x, c.y) < 24) {
        c.hp -= 20;
        burst(b.x, b.y, '#888', 6);
        b.life = 0;
        if (c.hp <= 0) {
          burst(c.x, c.y, '#e5534b', 20);
          state.cars.splice(state.cars.indexOf(c), 1);
          addWanted(1, 'destroyed a police car');
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floaters) {
    f.y -= 24 * dt;
    f.life -= dt;
  }
  state.floaters = state.floaters.filter((f) => f.life > 0);
}
function step(dt) {
  time += dt;
  state.time = time;
  state.clock = (9.5 + time / 240) % 24;
  state.shake = Math.max(0, state.shake - 40 * dt);
  if (state.mission.dialogueT > 0) state.mission.dialogueT -= dt;
  if (screen !== SCREEN_PLAY) return;
  stepPlayer(dt);
  stepTraffic(dt);
  stepPeds(dt);
  stepPolice(dt);
  stepBullets(dt);
  stepMission(dt);
  saveT -= dt;
  if (saveT <= 0) {
    saveT = 20;
    writeSave();
  }
  // Car-vs-car bumps: both cars slow, hard hits shake the camera.
  const allCars = state.player.car ? [...state.cars, state.player.car] : state.cars;
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const a = allCars[i];
      const b = allCars[j];
      if (dist(a.x, a.y, b.x, b.y) < 42) {
        a.speed *= 0.6;
        b.speed *= 0.6;
        if (Math.abs(a.speed) > 120 || Math.abs(b.speed) > 120) {
          audio.crash();
          state.shake = 8;
        }
      }
    }
  }
}
function startGame(fresh) {
  if (fresh) {
    state = newState();
    state.hasSave = !!readSave();
  } else if (readSave()) {
    loadSave();
  }
  screen = SCREEN_PLAY;
  accumulator = 0;
  if (!state.mission.active || state.mission.active < 0) {
    const next = MISSIONS.findIndex((m, i) => !state.mission.done.includes(i));
    if (next >= 0) startMission(state.mission, next);
  }
  announce('Playing Solmar. Follow the gold marker.');
}
function handleActions() {
  const a = input.takeActions();
  if (a & ACTION_MUTE) {
    const m = audio.toggleMute();
    announce(m ? 'Muted.' : 'Sound on.');
  }
  if (a & ACTION_CONFIRM) {
    audio.unlock();
    if (screen === SCREEN_TITLE) startGame(state.hasSave);
    else if (screen === SCREEN_OVER || screen === SCREEN_BUSTED) startGame(false);
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  if (a & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
    }
  }
  if (screen === SCREEN_PLAY) {
    if (a & ACTION_ENTER) enterCar();
    if (a & ACTION_PUNCH) punch();
    if (input.keys.has('n')) {
      const next = MISSIONS.findIndex((m, i) => !state.mission.done.includes(i));
      if (next >= 0 && state.mission.active !== next) {
        startMission(state.mission, next);
        audio.jingle();
      }
    }
  }
  if (screen === SCREEN_PLAY && input.takeShoot()) shoot();
}
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, 0.25);
  last = now;
  handleActions();
  if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(STEP);
      accumulator -= STEP;
    }
  } else {
    accumulator = 0;
  }
  renderer.draw(state, screen, best, time);
}
// Screenshot staging: one deterministic scene per shot name, drawn twice so
// the canvas is settled before the driver captures it.
function stageShot(name) {
  state = newState();
  if (name === 'title') {
    screen = SCREEN_TITLE;
  } else if (name === 'driving') {
    screen = SCREEN_PLAY;
    const c = state.cars[0];
    state.cars.splice(0, 1);
    state.player.car = c;
    c.x = 1200;
    c.y = 448;
    c.angle = 0;
    c.speed = 260;
    state.player.x = c.x;
    state.player.y = c.y;
    startMission(state.mission, 0);
    for (let i = 0; i < 18; i++) step(STEP);
  } else if (name === 'wanted') {
    screen = SCREEN_PLAY;
    state.player.x = 1450;
    state.player.y = 550;
    state.wanted = 3;
    state.wantedHeat = 1;
    state.cops.push({ x: 1560, y: 640, angle: 0, speed: 150, shirt: '#2b4acb', hp: 40 });
    state.cars.push({
      x: 1650, y: 448, angle: Math.PI, type: 1, speed: 200,
      driver: true, police: true, hp: 100,
    });
    // Fleeing pedestrians ring the player, kept off the player's own tile.
    state.peds.forEach((p, i) => {
      const a = (i / state.peds.length) * 6.283;
      const r = 140 + (i % 5) * 55;
      p.x = 1450 + Math.cos(a) * r;
      p.y = 550 + Math.sin(a) * r * 0.7;
      p.scared = 2;
      p.fleeX = p.x + Math.cos(a) * 300;
      p.fleeY = p.y + Math.sin(a) * 300;
    });
    for (let i = 0; i < 20; i++) step(STEP);
  } else if (name === 'mission') {
    screen = SCREEN_PLAY;
    startMission(state.mission, 4);
    const c = state.cars[2];
    state.cars.splice(2, 1);
    state.player.car = c;
    c.x = 1800;
    c.y = 448;
    c.angle = 0;
    c.speed = 200;
    state.player.x = c.x;
    state.player.y = c.y;
    state.mission.timer = 82;
    for (let i = 0; i < 15; i++) step(STEP);
  }
  renderer.draw(state, screen, best, time);
  renderer.draw(state, screen, best, time);
  window.__shotReady = true;
}
window.__solmar = {
  get state() { return state; },
  get screen() { return screen; },
  start(fresh) {
    audio.unlock();
    startGame(fresh);
  },
  enterCar,
  shoot,
  punch,
  addWanted,
  startMission: (i) => startMission(state.mission, i),
  input,
  setWanted(n) {
    state.wanted = n;
    state.wantedHeat = 1;
  },
  teleport(x, y) {
    state.player.x = x;
    state.player.y = y;
    if (state.player.car) {
      state.player.car.x = x;
      state.player.car.y = y;
    }
  },
};
if (shot) stageShot(shot);
else requestAnimationFrame(frame);
