// Solmar — boot and loop. Fixed 1/60 s ticks. Views: title, play,
// paused, wasted, busted. The hero walks or drives; traffic and walkers
// share the streets; the law answers the heat; combat, pickups, six story
// jobs and a localStorage save round it out.
// ?shot=title|driving|wanted|mission stages one scene for a screenshot and
// sets window.__shotReady once the frame is drawn.
import { MAP, TICK, SAVE_SLOT, WORLD_SEED, HERO, VEHICLES, HEAT_FADE } from './config.js';
import { makeRng, bound, gap, headingTo } from './random.js';
import { buildTown, hitsStructure, spawnWalkers, spawnDrivers, closestStreetPoint } from './world.js';
import { JOBS, freshJobState, beginJob } from './missions.js';
import { makeSound } from './audio.js';
import { makeControls, KEY_OK, KEY_PAUSE, KEY_USE, KEY_HIT, KEY_SOUND } from './input.js';
import { makePainter, VIEW_TITLE, VIEW_PLAY, VIEW_PAUSED, VIEW_OVER, VIEW_BUSTED } from './render.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : WORLD_SEED;
const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const painter = makePainter(canvas);
const controls = makeControls(canvas);
const sound = makeSound();

function freshSim() {
  const town = buildTown(makeRng(seed));
  const autos = town.parked.map((c) => ({ ...c, integrity: 100 }));
  for (const c of spawnDrivers(makeRng(seed + 7), 14)) autos.push({ ...c, integrity: 100 });
  return {
    town,
    autos,
    walkers: spawnWalkers(makeRng(seed + 13), 26),
    officers: [],
    shots: [],
    sparks: [],
    labels: [],
    marks: [],
    hero: { x: 480, y: 480, angle: 0, health: 100, armor: 0, rounds: 60, ride: null, velocity: 0 },
    money: 150,
    heat: 0,
    heatLevel: 0,
    hour: 9.5,
    elapsed: 0,
    jolt: 0,
    job: freshJobState(),
    saved: false,
    record: 0,
    takedowns: 0,
    thefts: 0,
  };
}
let sim = freshSim();
let view = VIEW_TITLE;
let record = 0;
let bank = 0;
let prev = performance.now();
let elapsed = 0;
let lawClock = 0;
let crowdClock = 0;
let storeClock = 0;

function wrapAngle(d) {
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
function fetchSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_SLOT);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function storeSave() {
  try {
    window.localStorage.setItem(SAVE_SLOT, JSON.stringify({
      cash: sim.money,
      hp: sim.hero.health,
      ammo: sim.hero.rounds,
      armour: sim.hero.armor,
      x: sim.hero.x,
      y: sim.hero.y,
      done: sim.job.finished,
      active: sim.job.current,
      best: record,
    }));
  } catch {
    // Storage off: progress lasts this visit only.
  }
}
function applySave() {
  const s = fetchSave();
  if (!s) return false;
  sim.money = s.cash ?? 150;
  sim.hero.health = s.hp ?? 100;
  sim.hero.rounds = s.ammo ?? 60;
  sim.hero.armor = s.armour ?? 0;
  sim.hero.x = s.x ?? 480;
  sim.hero.y = s.y ?? 480;
  sim.job.finished = s.done ?? [];
  record = s.best ?? 0;
  if (typeof s.active === 'number' && s.active >= 0 && !sim.job.finished.includes(s.active)) {
    beginJob(sim.job, s.active);
  }
  return true;
}
try {
  record = Number.parseInt(window.localStorage.getItem('solmar.best') ?? '0', 10) || 0;
} catch {
  record = 0;
}
sim.saved = !!fetchSave();
if (sim.money > record) record = sim.money;

function statusLine(msg) { statusEl.textContent = msg; }
function addLabel(x, y, words, color) {
  sim.labels.push({ x, y, words, color: color || '#f2c94c', life: 1.6 });
}
function addSparks(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    sim.sparks.push({
      x, y,
      dx: (Math.random() - 0.5) * 220,
      dy: (Math.random() - 0.5) * 220,
      life: 0.5,
      span: 0.5,
      size: 3 + Math.random() * 3,
      color,
    });
  }
}
function raiseHeat(n, why) {
  sim.heat = bound(sim.heat + n, 0, 5);
  sim.heatLevel = 1;
  if (n > 0) addLabel(sim.hero.x, sim.hero.y - 24, `WANTED +${n} — ${why}`, '#e5534b');
}
function closestAuto(x, y, maxD) {
  let pick = null;
  let bestGap = maxD;
  for (const c of sim.autos) {
    const d = gap(x, y, c.x, c.y);
    if (d < bestGap) { bestGap = d; pick = c; }
  }
  return pick;
}
function useAuto() {
  const h = sim.hero;
  if (h.ride) {
    const c = h.ride;
    h.ride = null;
    h.x = c.x + 40;
    h.y = c.y;
    h.angle = c.angle;
    c.velocity = 0;
    statusLine('On foot.');
    return;
  }
  const c = closestAuto(h.x, h.y, 70);
  if (!c) {
    statusLine('No car nearby.');
    return;
  }
  if (c.occupied) {
    // Taking an occupied motor: its driver bails and runs, and the
    // theft puts a star on the hero.
    c.occupied = false;
    raiseHeat(1, 'car theft');
    sim.thefts += 1;
    sim.walkers.push({
      x: c.x + 30, y: c.y, angle: 0, pace: 120, top: '#e5534b',
      panic: 3, runX: c.x + 200, runY: c.y, paceT: 0,
    });
    addLabel(c.x, c.y - 30, 'CAR STOLEN!', '#e5534b');
    sound.smash();
  }
  sim.autos.splice(sim.autos.indexOf(c), 1);
  h.ride = c;
  h.x = c.x;
  h.y = c.y;
  sound.collect();
  statusLine(`Driving a ${VEHICLES[c.kind].name}.`);
}
function fire() {
  const h = sim.hero;
  if (h.rounds <= 0) {
    addLabel(h.x, h.y - 24, 'NO AMMO', '#e5534b');
    return;
  }
  h.rounds -= 1;
  sound.gunshot();
  const m = controls.pointer();
  const sx = h.ride ? h.ride.x : h.x;
  const sy = h.ride ? h.ride.y : h.y;
  const camX = Math.max(painter.width / 2, Math.min(MAP.width - painter.width / 2, sx));
  const camY = Math.max(painter.height / 2, Math.min(MAP.height - painter.height / 2, sy));
  const wx = m.x + camX - painter.width / 2;
  const wy = m.y + camY - painter.height / 2;
  const a = headingTo(sx, sy, wx, wy);
  sim.shots.push({
    x: sx + Math.cos(a) * 24,
    y: sy + Math.sin(a) * 24,
    dx: Math.cos(a) * 720,
    dy: Math.sin(a) * 720,
    life: 0.6,
  });
  if (sim.heat < 1) raiseHeat(1, 'firing a weapon');
}
function strike() {
  const h = sim.hero;
  if (h.ride) return;
  sound.thump();
  for (const ped of sim.walkers) {
    if (gap(h.x, h.y, ped.x, ped.y) < HERO.punchRange + 12) {
      ped.panic = 3;
      ped.runX = ped.x + (ped.x - h.x) * 3;
      ped.runY = ped.y + (ped.y - h.y) * 3;
      addSparks(ped.x, ped.y, '#fff', 6);
      raiseHeat(1, 'assault');
      addLabel(ped.x, ped.y - 20, 'WHAM!', '#fff');
    }
  }
  for (const cop of sim.officers) {
    if (gap(h.x, h.y, cop.x, cop.y) < HERO.punchRange + 12) {
      cop.health -= HERO.punch;
      addSparks(cop.x, cop.y, '#2b4acb', 8);
      raiseHeat(1, 'attacking police');
    }
  }
}
function hurtHero(dmg) {
  const h = sim.hero;
  if (h.armor > 0) {
    const soaked = Math.min(h.armor, dmg * 0.6);
    h.armor -= soaked;
    dmg -= soaked;
  }
  h.health -= dmg;
  sim.jolt = Math.max(sim.jolt, 8);
  if (h.health <= 0) flatlined();
}
function flatlined() {
  sound.caught();
  sim.money = Math.max(0, sim.money - 200);
  sim.hero.health = 100;
  sim.hero.armor = 0;
  sim.hero.ride = null;
  sim.hero.x = sim.town.hospital.x;
  sim.hero.y = sim.town.hospital.y + 80;
  sim.heat = 0;
  sim.officers = [];
  sim.shots = [];
  storeSave();
  view = VIEW_OVER;
  statusLine('Wasted. You wake up at Solmar General Hospital, $200 lighter.');
}
function arrested() {
  sound.caught();
  sim.money = Math.max(0, sim.money - 200);
  sim.hero.health = 100;
  sim.hero.ride = null;
  sim.hero.x = sim.town.precinct.x;
  sim.hero.y = sim.town.precinct.y + 80;
  sim.heat = 0;
  sim.officers = [];
  sim.shots = [];
  storeSave();
  view = VIEW_BUSTED;
  statusLine('Busted. The precinct lets you go, $200 lighter.');
}
function finishJob() {
  const job = JOBS[sim.job.current];
  sim.money += job.pay;
  sim.job.finished.push(job.num);
  addLabel(sim.hero.x, sim.hero.y - 30, `+$${job.pay} — ${job.name} COMPLETE`, '#2f9e44');
  sound.fanfare();
  statusLine(`Mission complete: ${job.name}. +$${job.pay}.`);
  sim.job.current = -1;
  sim.job.stage = 0;
  sim.job.countdown = 0;
  sim.job.speech = `${job.client}: Good driving, Danny. $${job.pay} is yours. Press N for the next job.`;
  sim.job.speechT = 6;
  if (sim.money > record) {
    record = sim.money;
    try {
      window.localStorage.setItem('solmar.best', String(record));
    } catch {
      // ignore
    }
  }
  storeSave();
}
function tickJob(dt) {
  const js = sim.job;
  if (js.current < 0) return;
  const job = JOBS[js.current];
  const stage = job.stages[js.stage];
  if (!stage) return;
  const px = sim.hero.ride ? sim.hero.ride.x : sim.hero.x;
  const py = sim.hero.ride ? sim.hero.ride.y : sim.hero.y;
  if (stage.type === 'timed' && js.stage === 0 && js.countdown <= 0) js.countdown = stage.limit;
  if (js.countdown > 0) {
    js.countdown -= dt;
    if (js.countdown <= 0) {
      js.speech = 'Marla Voss: Too slow — that job is gone. Press N to try again.';
      js.speechT = 6;
      js.current = -1;
      js.stage = 0;
      return;
    }
  }
  if (stage.type === 'steal') {
    if (sim.hero.ride) {
      js.stage += 1;
      js.speech = 'Rico: That\'s the one. Now bring it down to my shop.';
      js.speechT = 5;
    }
    return;
  }
  if (stage.type === 'wanted') {
    if (sim.heat >= 2 && js.stage === 0) {
      js.stage = 1;
      js.speech = 'Marla Voss: Now shake them and reach the hideout.';
      js.speechT = 5;
    }
    return;
  }
  if (stage.type === 'escape') {
    if (gap(px, py, stage.x, stage.y) < 70) finishJob();
    return;
  }
  if (stage.type === 'goto' || stage.type === 'timed') {
    const missingRide = stage.needsRide && !sim.hero.ride;
    if (gap(px, py, stage.x, stage.y) < 70 && !missingRide) {
      // Job 3: the hideout will not take you while the law is on you.
      if (stage.type === 'goto' && job.num === 3 && js.stage === 1 && sim.heat > 0) {
        js.speech = 'Marla Voss: Not with the law on your tail — shake them first!';
        js.speechT = 4;
        return;
      }
      js.stage += 1;
      if (js.stage >= job.stages.length) finishJob();
      else {
        sound.collect();
        js.speech = JOBS[sim.job.current].stages[js.stage].text;
        js.speechT = 5;
      }
    }
  }
}
function driveRide(dt) {
  const h = sim.hero;
  const c = h.ride;
  const spec = VEHICLES[c.kind];
  const fwd = controls.held.has('w') || controls.held.has('arrowup');
  const back = controls.held.has('s') || controls.held.has('arrowdown');
  const steer = (controls.held.has('a') || controls.held.has('arrowleft') ? -1 : 0)
    + (controls.held.has('d') || controls.held.has('arrowright') ? 1 : 0);
  if (fwd) c.velocity += spec.accel * dt;
  if (back) c.velocity -= spec.accel * 0.8 * dt;
  c.velocity = bound(c.velocity, -spec.top * 0.45, spec.top);
  if (!fwd && !back) c.velocity *= Math.pow(0.4, dt);
  const going = c.velocity >= 0 ? 1 : -1;
  c.angle += steer * spec.turn * dt * going * Math.min(1, Math.abs(c.velocity) / 120);
  const nx = c.x + Math.cos(c.angle) * c.velocity * dt;
  const ny = c.y + Math.sin(c.angle) * c.velocity * dt;
  if (hitsStructure(sim.town.towers, nx, ny, 22)) {
    if (Math.abs(c.velocity) > 160) {
      sound.smash();
      sim.jolt = 12;
      addSparks(c.x, c.y, '#888', 10);
      hurtHero(6);
    }
    c.velocity *= -0.25;
    sim.marks.push({ x1: c.x, y1: c.y, x2: nx, y2: ny });
    if (sim.marks.length > 80) sim.marks.shift();
  } else {
    c.x = bound(nx, 40, MAP.width - 40);
    c.y = bound(ny, 40, MAP.height - 140);
  }
  h.x = c.x;
  h.y = c.y;
  h.angle = c.angle;
  if (Math.abs(c.velocity) > 240 && steer) {
    sim.marks.push({ x1: c.x, y1: c.y, x2: c.x - Math.cos(c.angle) * 20, y2: c.y - Math.sin(c.angle) * 20 });
  }
  sound.motor(Math.abs(c.velocity) / 430);
  // Running a walker over is a crime, and it shows.
  for (const ped of sim.walkers) {
    if (gap(c.x, c.y, ped.x, ped.y) < 26 && Math.abs(c.velocity) > 60) {
      ped.panic = 3;
      ped.runX = ped.x + 300;
      addSparks(ped.x, ped.y, '#e5534b', 8);
      raiseHeat(1, 'hit a pedestrian');
      hurtHero(0);
    }
  }
}
function walkHero(dt) {
  const h = sim.hero;
  const dir = controls.heading();
  const m = controls.pointer();
  const pace = controls.sprint ? HERO.run : HERO.walk;
  const nx = h.x + dir.x * pace * dt;
  const ny = h.y + dir.y * pace * dt;
  if (!hitsStructure(sim.town.towers, nx, h.y, HERO.radius)) h.x = bound(nx, 20, MAP.width - 20);
  if (!hitsStructure(sim.town.towers, h.x, ny, HERO.radius)) h.y = bound(ny, 20, MAP.height - 150);
  if (dir.x || dir.y) h.angle = Math.atan2(dir.y, dir.x);
  sound.motor(0);
  // On foot the hero aims at the pointer.
  const camX = Math.max(painter.width / 2, Math.min(MAP.width - painter.width / 2, h.x));
  const camY = Math.max(painter.height / 2, Math.min(MAP.height - painter.height / 2, h.y));
  h.aimAngle = headingTo(h.x, h.y, m.x + camX - painter.width / 2, m.y + camY - painter.height / 2);
}
function tickHero(dt) {
  if (sim.hero.ride) driveRide(dt);
  else walkHero(dt);
  const h = sim.hero;
  // Pickups: health, armour, ammo, cash.
  for (const g of sim.town.goods) {
    if (!g.got && gap(h.x, h.y, g.x, g.y) < 30) {
      g.got = true;
      sound.collect();
      if (g.sort === 'health') {
        h.health = Math.min(100, h.health + 40);
        addLabel(g.x, g.y - 20, '+40 HP', '#2f9e44');
      }
      if (g.sort === 'armour') {
        h.armor = Math.min(100, h.armor + 50);
        addLabel(g.x, g.y - 20, '+50 ARMOUR', '#4f8fd0');
      }
      if (g.sort === 'ammo') {
        h.rounds += 30;
        addLabel(g.x, g.y - 20, '+30 AMMO', '#e8b23a');
      }
      if (g.sort === 'cash') {
        sim.money += 50;
        addLabel(g.x, g.y - 20, '+$50', '#f2c94c');
      }
    }
  }
}
function tickFlow(dt) {
  for (const c of sim.autos) {
    if (c.patrol) continue;
    // Traffic hugs the streets: steer toward the nearest street line, hold speed.
    const rp = closestStreetPoint(c.x, c.y);
    const target = Math.abs(c.x - rp.x) < Math.abs(c.y - rp.y)
      ? (c.x > rp.x ? Math.PI : 0)
      : (c.y > rp.y ? Math.PI / 2 : -Math.PI / 2);
    const diff = wrapAngle(target - c.angle);
    c.angle += bound(diff, -1.4 * dt, 1.4 * dt);
    if (!c.traffic) continue;
    c.velocity = 120;
    c.x += Math.cos(c.angle) * c.velocity * dt;
    c.y += Math.sin(c.angle) * c.velocity * dt;
    if (c.x < 60 || c.x > MAP.width - 60 || c.y < 60 || c.y > MAP.height - 160) c.angle += Math.PI;
  }
}
function tickWalkers(dt) {
  for (const ped of sim.walkers) {
    if (ped.panic > 0) {
      ped.panic -= dt;
      const a = headingTo(ped.x, ped.y, ped.runX, ped.runY);
      ped.x += Math.cos(a) * 130 * dt;
      ped.y += Math.sin(a) * 130 * dt;
      ped.angle = a;
    } else {
      ped.paceT -= dt;
      if (ped.paceT <= 0) {
        ped.paceT = 2 + Math.random() * 3;
        ped.angle = Math.random() * 6.28;
      }
      const nx = ped.x + Math.cos(ped.angle) * ped.pace * dt;
      const ny = ped.y + Math.sin(ped.angle) * ped.pace * dt;
      const blocked = hitsStructure(sim.town.towers, nx, ny, 10);
      const inside = nx > 20 && nx < MAP.width - 20 && ny > 20 && ny < MAP.height - 150;
      if (!blocked && inside) {
        ped.x = nx;
        ped.y = ny;
      } else {
        ped.angle += Math.PI / 2;
      }
    }
    // Gunfire nearby sends walkers running.
    if (sim.shots.length && gap(ped.x, ped.y, sim.hero.x, sim.hero.y) < 220 && ped.panic <= 0) {
      ped.panic = 2;
      ped.runX = ped.x + (ped.x - sim.hero.x);
      ped.runY = ped.y + (ped.y - sim.hero.y);
    }
  }
  crowdClock -= dt;
  if (crowdClock <= 0 && sim.walkers.length < 30) {
    crowdClock = 4;
    sim.walkers.push({
      x: bound(sim.hero.x + (Math.random() < 0.5 ? -500 : 500), 60, MAP.width - 60),
      y: bound(sim.hero.y + (Math.random() < 0.5 ? -400 : 400), 60, MAP.height - 160),
      angle: Math.random() * 6.28,
      pace: 40,
      top: '#4f8fd0',
      panic: 0,
      runX: 0,
      runY: 0,
      paceT: 1,
    });
  }
}
function tickLaw(dt) {
  // Heat cools when no law unit can see the hero; officers chase, ram and
  // arrest. More stars mean more units and faster pursuit motors.
  const px = sim.hero.ride ? sim.hero.ride.x : sim.hero.x;
  const py = sim.hero.ride ? sim.hero.ride.y : sim.hero.y;
  const spotted = sim.officers.some((c) => gap(c.x, c.y, px, py) < 420)
    || sim.autos.some((c) => c.patrol && gap(c.x, c.y, px, py) < 500);
  if (sim.heat > 0 && !spotted) {
    sim.heatLevel -= HEAT_FADE * dt;
    if (sim.heatLevel <= 0) {
      sim.heat = Math.max(0, sim.heat - 1);
      sim.heatLevel = 1;
      addLabel(px, py - 30, 'Heat cooling…', '#b8b4a8');
    }
  } else if (spotted) {
    sim.heatLevel = 1;
  }
  const wantCops = sim.heat >= 1 ? Math.min(2 + sim.heat, 6) : 0;
  lawClock -= dt;
  if (sim.heat > 0 && lawClock <= 0) {
    lawClock = 2.5;
    if (sim.autos.filter((c) => c.patrol).length < Math.ceil(wantCops / 2)) {
      sim.autos.push({
        x: bound(px + 600, 60, MAP.width - 60),
        y: bound(py - 400, 60, MAP.height - 160),
        angle: 0, kind: 1, velocity: 0, occupied: true, patrol: true, integrity: 100, ramClock: 0,
      });
    } else if (sim.officers.length < wantCops) {
      sim.officers.push({ x: px + 300, y: py + 200, angle: 0, pace: 150, top: '#2b4acb', health: 40 });
    }
  }
  if (sim.heat === 0) {
    sim.officers = sim.officers.filter((c) => gap(c.x, c.y, px, py) > 700);
  }
  sound.alarm(sim.heat > 0);
  if (sim.heat === 0) {
    // No heat: pursuit motors drive off and leave the map once they are far
    // enough away; they never chase or ram a hero who is not wanted.
    for (const c of sim.autos) {
      if (!c.patrol) continue;
      const away = headingTo(px, py, c.x, c.y);
      c.angle = away;
      c.velocity = 220;
      c.x += Math.cos(away) * c.velocity * dt;
      c.y += Math.sin(away) * c.velocity * dt;
    }
    sim.autos = sim.autos.filter((c) => !c.patrol || gap(c.x, c.y, px, py) < 800);
    return;
  }
  for (const c of sim.autos) {
    if (!c.patrol) continue;
    c.ramClock = Math.max(0, (c.ramClock || 0) - dt);
    const a = headingTo(c.x, c.y, px, py);
    const diff = wrapAngle(a - c.angle);
    c.angle += bound(diff, -2.4 * dt, 2.4 * dt);
    c.velocity = bound(c.velocity + 320 * dt, 0, 300 + sim.heat * 22);
    c.x += Math.cos(c.angle) * c.velocity * dt;
    c.y += Math.sin(c.angle) * c.velocity * dt;
    if (gap(c.x, c.y, px, py) < 46) {
      if (sim.hero.ride) {
        sim.hero.ride.velocity *= 0.5;
        sim.jolt = 10;
        // A ram hurts at most once per 0.8 s of contact: without the
        // cooldown a pinned motor loses 240 HP a second and the hero is
        // wasted before they can react.
        if (c.ramClock <= 0) {
          sound.smash();
          hurtHero(4);
          c.ramClock = 0.8;
        }
      } else {
        hurtHero(10 * dt * 6);
      }
      // Use the hero's LIVE position here: hurtHero may have wasted the
      // hero, which teleports them to the hospital — the pre-ram px/py
      // would otherwise bust a hero who is already 1,900 tiles away.
      if (view === VIEW_PLAY && !sim.hero.ride
        && gap(c.x, c.y, sim.hero.x, sim.hero.y) < 30) arrested();
    }
  }
  for (const cop of sim.officers) {
    if (cop.health <= 0) {
      addSparks(cop.x, cop.y, '#2b4acb', 10);
      sim.officers.splice(sim.officers.indexOf(cop), 1);
      raiseHeat(1, 'downed a cop');
      continue;
    }
    if (sim.heat === 0) continue;
    const a = headingTo(cop.x, cop.y, px, py);
    cop.angle = a;
    cop.x += Math.cos(a) * cop.pace * dt;
    cop.y += Math.sin(a) * cop.pace * dt;
    if (gap(cop.x, cop.y, px, py) < 26) {
      if (sim.hero.ride) {
        // A foot officer cannot arrest a driver.
      } else {
        hurtHero(14 * dt);
        if (gap(cop.x, cop.y, px, py) < 20 && sim.hero.health < 30) arrested();
      }
    }
  }
}
function tickShots(dt) {
  for (const b of sim.shots) {
    b.x += b.dx * dt;
    b.y += b.dy * dt;
    b.life -= dt;
    for (const ped of sim.walkers) {
      if (gap(b.x, b.y, ped.x, ped.y) < 16) {
        ped.panic = 3;
        ped.runX = ped.x + b.dx;
        ped.runY = ped.y + b.dy;
        addSparks(ped.x, ped.y, '#e5534b', 8);
        b.life = 0;
        raiseHeat(1, 'hit a pedestrian');
      }
    }
    for (const cop of sim.officers) {
      if (gap(b.x, b.y, cop.x, cop.y) < 16) {
        cop.health -= 25;
        addSparks(b.x, b.y, '#2b4acb', 8);
        b.life = 0;
      }
    }
    for (const c of sim.autos) {
      if (c.patrol && gap(b.x, b.y, c.x, c.y) < 24) {
        c.integrity -= 20;
        addSparks(b.x, b.y, '#888', 6);
        b.life = 0;
        if (c.integrity <= 0) {
          addSparks(c.x, c.y, '#e5534b', 20);
          sim.autos.splice(sim.autos.indexOf(c), 1);
          raiseHeat(1, 'destroyed a police car');
        }
      }
    }
  }
  sim.shots = sim.shots.filter((b) => b.life > 0);
  for (const p of sim.sparks) {
    p.x += p.dx * dt;
    p.y += p.dy * dt;
    p.life -= dt;
  }
  sim.sparks = sim.sparks.filter((p) => p.life > 0);
  for (const f of sim.labels) {
    f.y -= 24 * dt;
    f.life -= dt;
  }
  sim.labels = sim.labels.filter((f) => f.life > 0);
}
function tick(dt) {
  elapsed += dt;
  sim.elapsed = elapsed;
  sim.hour = (9.5 + elapsed / 240) % 24;
  sim.jolt = Math.max(0, sim.jolt - 40 * dt);
  if (sim.job.speechT > 0) sim.job.speechT -= dt;
  if (view !== VIEW_PLAY) return;
  tickHero(dt);
  tickFlow(dt);
  tickWalkers(dt);
  tickLaw(dt);
  tickShots(dt);
  tickJob(dt);
  storeClock -= dt;
  if (storeClock <= 0) {
    storeClock = 20;
    storeSave();
  }
  // Motor-vs-motor bumps: both motors slow, hard hits shake the camera.
  const allAutos = sim.hero.ride ? [...sim.autos, sim.hero.ride] : sim.autos;
  for (let i = 0; i < allAutos.length; i++) {
    for (let j = i + 1; j < allAutos.length; j++) {
      const a = allAutos[i];
      const b = allAutos[j];
      if (gap(a.x, a.y, b.x, b.y) < 42) {
        a.velocity *= 0.6;
        b.velocity *= 0.6;
        if (Math.abs(a.velocity) > 120 || Math.abs(b.velocity) > 120) {
          sound.smash();
          sim.jolt = 8;
        }
      }
    }
  }
}
function beginPlay(fresh) {
  if (fresh) {
    sim = freshSim();
    sim.saved = !!fetchSave();
  } else if (fetchSave()) {
    applySave();
  }
  view = VIEW_PLAY;
  bank = 0;
  if (!sim.job.current || sim.job.current < 0) {
    const next = JOBS.findIndex((job, i) => !sim.job.finished.includes(i));
    if (next >= 0) beginJob(sim.job, next);
  }
  statusLine('Playing Solmar. Follow the gold marker.');
}
function drainInputs() {
  const a = controls.drainKeys();
  if (a & KEY_SOUND) {
    const m = sound.flipMute();
    statusLine(m ? 'Muted.' : 'Sound on.');
  }
  if (a & KEY_OK) {
    sound.start();
    if (view === VIEW_TITLE) beginPlay(sim.saved);
    else if (view === VIEW_OVER || view === VIEW_BUSTED) beginPlay(false);
    else if (view === VIEW_PAUSED) view = VIEW_PLAY;
  }
  if (a & KEY_PAUSE) {
    if (view === VIEW_PLAY) {
      view = VIEW_PAUSED;
      statusLine('Paused.');
    } else if (view === VIEW_PAUSED) {
      view = VIEW_PLAY;
    }
  }
  if (view === VIEW_PLAY) {
    if (a & KEY_USE) useAuto();
    if (a & KEY_HIT) strike();
    if (controls.held.has('n')) {
      const next = JOBS.findIndex((job, i) => !sim.job.finished.includes(i));
      if (next >= 0 && sim.job.current !== next) {
        beginJob(sim.job, next);
        sound.fanfare();
      }
    }
  }
  if (view === VIEW_PLAY && controls.drainShot()) fire();
}
function loop(now) {
  requestAnimationFrame(loop);
  bank += Math.min((now - prev) / 1000, 0.25);
  prev = now;
  drainInputs();
  if (view === VIEW_TITLE || view === VIEW_PLAY) {
    while (bank >= TICK && (view === VIEW_TITLE || view === VIEW_PLAY)) {
      tick(TICK);
      bank -= TICK;
    }
  } else {
    bank = 0;
  }
  painter.draw(sim, view, record, elapsed);
}
// Screenshot staging: one deterministic scene per shot name, drawn twice so
// the canvas is settled before the driver captures it.
function stageScene(name) {
  sim = freshSim();
  if (name === 'title') {
    view = VIEW_TITLE;
  } else if (name === 'driving') {
    view = VIEW_PLAY;
    const c = sim.autos[0];
    sim.autos.splice(0, 1);
    sim.hero.ride = c;
    c.x = 1200;
    c.y = 448;
    c.angle = 0;
    c.velocity = 260;
    sim.hero.x = c.x;
    sim.hero.y = c.y;
    beginJob(sim.job, 0);
    for (let i = 0; i < 18; i++) tick(TICK);
  } else if (name === 'wanted') {
    view = VIEW_PLAY;
    sim.hero.x = 1450;
    sim.hero.y = 550;
    sim.heat = 3;
    sim.heatLevel = 1;
    sim.officers.push({ x: 1560, y: 640, angle: 0, pace: 150, top: '#2b4acb', health: 40 });
    sim.autos.push({
      x: 1650, y: 448, angle: Math.PI, kind: 1, velocity: 200,
      occupied: true, patrol: true, integrity: 100,
    });
    // Fleeing walkers ring the hero, kept off the hero's own tile.
    sim.walkers.forEach((p, i) => {
      const a = (i / sim.walkers.length) * 6.283;
      const r = 140 + (i % 5) * 55;
      p.x = 1450 + Math.cos(a) * r;
      p.y = 550 + Math.sin(a) * r * 0.7;
      p.panic = 2;
      p.runX = p.x + Math.cos(a) * 300;
      p.runY = p.y + Math.sin(a) * 300;
    });
    for (let i = 0; i < 20; i++) tick(TICK);
  } else if (name === 'mission') {
    view = VIEW_PLAY;
    beginJob(sim.job, 4);
    const c = sim.autos[2];
    sim.autos.splice(2, 1);
    sim.hero.ride = c;
    c.x = 1800;
    c.y = 448;
    c.angle = 0;
    c.velocity = 200;
    sim.hero.x = c.x;
    sim.hero.y = c.y;
    sim.job.countdown = 82;
    for (let i = 0; i < 15; i++) tick(TICK);
  }
  painter.draw(sim, view, record, elapsed);
  painter.draw(sim, view, record, elapsed);
  window.__shotReady = true;
}
window.__solmar = {
  get state() { return sim; },
  get screen() { return view; },
  start(fresh) {
    sound.start();
    beginPlay(fresh);
  },
  enterCar: useAuto,
  shoot: fire,
  punch: strike,
  addWanted: raiseHeat,
  startMission: (i) => beginJob(sim.job, i),
  input: controls,
  setWanted(n) {
    sim.heat = n;
    sim.heatLevel = 1;
  },
  teleport(x, y) {
    sim.hero.x = x;
    sim.hero.y = y;
    if (sim.hero.ride) {
      sim.hero.ride.x = x;
      sim.hero.ride.y = y;
    }
  },
};
if (shot) stageScene(shot);
else requestAnimationFrame(loop);
