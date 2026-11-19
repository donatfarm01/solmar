// Canvas painter: the town, its motors and people, sparks, the HUD with
// its map, and the menu screens. The camera trails the hero; the world
// paints in world space, the HUD in screen space.
import { MAP, VEHICLES, QUARTERS, COLORS, TYPEFACE } from './config.js';
import { streetGrid, quarterAt } from './world.js';
import { JOBS, jobObjective } from './missions.js';
import { statRows } from './stats.js';
import { skyName } from './weather.js';
import { nearestStash } from './packages.js';

export const VIEW_TITLE = 0;
export const VIEW_PLAY = 1;
export const VIEW_PAUSED = 2;
export const VIEW_OVER = 3;
export const VIEW_BUSTED = 4;

export function makePainter(canvas) {
  const ctx = canvas.getContext('2d');
  let vw = 1280;
  let vh = 720;
  function fit() {
    vw = canvas.clientWidth || window.innerWidth;
    vh = canvas.clientHeight || window.innerHeight;
    canvas.width = vw;
    canvas.height = vh;
  }
  window.addEventListener('resize', fit);
  fit();

  function rect(x, y, w, h) { ctx.fillRect(x, y, w, h); }
  function disc(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.29);
    ctx.fill();
  }
  function say(str, x, y) { ctx.fillText(str, x, y); }

  function paintCar(x, y, angle, kind, color, patrol) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (kind === 6) {
      paintBike(color);
      ctx.restore();
      return;
    }
    const body = patrol ? '#e8e8e8' : color;
    const cabin = patrol ? '#2b4acb' : 'rgba(20,30,40,0.85)';
    const panels = [
      ['rgba(0,0,0,0.35)', -24, -12, 48, 26],
      [body, -24, -13, 48, 26],
      [cabin, -8, -11, 16, 22],
      ['#cfe8ff', 14, -10, 5, 20],
      ['#ffd23a', -24, -11, 3, 5],
      ['#ffd23a', -24, 6, 3, 5],
    ];
    for (const [fill, px, py, w, h] of panels) {
      ctx.fillStyle = fill;
      rect(px, py, w, h);
    }
    if (patrol) {
      ctx.fillStyle = '#e5534b';
      rect(-4, -15, 8, 4);
      ctx.fillStyle = '#2b4acb';
      rect(-4, 11, 8, 4);
    }
    ctx.restore();
  }
  function paintBike(color) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 20, 7, 0, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = '#1c1f24';
    disc(-13, 0, 6);
    disc(13, 0, 6);
    ctx.fillStyle = '#c8ccd2';
    disc(-13, 0, 2.5);
    disc(13, 0, 2.5);
    ctx.strokeStyle = '#c8ccd2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-13, -6);
    ctx.lineTo(-13, 6);
    ctx.moveTo(13, -6);
    ctx.lineTo(13, 6);
    ctx.stroke();
    ctx.fillStyle = color;
    rect(-16, -3, 32, 6);
    ctx.fillStyle = 'rgba(20,30,40,0.9)';
    rect(-4, -4, 10, 8);
    ctx.fillStyle = '#ffd23a';
    rect(15, -2, 3, 4);
    ctx.fillStyle = '#e5534b';
    rect(-17, -2, 2, 4);
    ctx.fillStyle = '#2f9e44';
    disc(2, 0, 4);
  }
  function paintWalker(x, y, angle, top, panic) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 12, 8, 0, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = top;
    disc(0, 0, 11);
    ctx.fillStyle = '#e8c39a';
    disc(8, 0, 6);
    if (panic) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px ' + TYPEFACE;
      say('!', -4, -16);
    }
    ctx.restore();
  }
  function paintStashes(s, time) {
    const near = nearestStash(s);
    if (near) {
      const beam = near.spot;
      ctx.fillStyle = 'rgba(242, 201, 76, 0.10)';
      rect(beam.x - 6, beam.y - 260, 12, 260);
    }
    for (const spot of s.packs.list) {
      if (spot.taken) continue;
      const bob = Math.sin(time * 3 + spot.id * 1.7) * 3;
      ctx.fillStyle = 'rgba(242, 201, 76, 0.25)';
      disc(spot.x, spot.y + bob, 20);
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(spot.x, spot.y + bob - 12);
      ctx.lineTo(spot.x + 9, spot.y + bob);
      ctx.lineTo(spot.x, spot.y + bob + 12);
      ctx.lineTo(spot.x - 9, spot.y + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 13px ' + TYPEFACE;
      say('$', spot.x - 4, spot.y + bob + 5);
      ctx.save();
      ctx.translate(spot.x, spot.y + bob);
      ctx.rotate(time * 2 + spot.id);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      rect(-1, -7, 2, 14);
      rect(-7, -1, 14, 2);
      ctx.restore();
    }
  }
  function paintSky(s) {
    const w = s.weather;
    if (w.wet > 0.05) {
      ctx.fillStyle = 'rgba(8, 14, 26, ' + (0.14 * w.wet) + ')';
      rect(0, 0, vw, vh);
    }
    if (w.wet > 0.02) {
      const count = Math.floor(w.drops.length * w.wet);
      ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < count; k++) {
        const d = w.drops[k];
        const x = d.fx * vw;
        const y = d.fy * vh;
        const len = d.fl * vh;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.12, y + len);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(174, 194, 224, 0.35)';
      for (let k = 0; k < count; k++) {
        const d = w.drops[k];
        if (d.fy < 0.92) continue;
        ctx.beginPath();
        ctx.ellipse(d.fx * vw, d.fy * vh, 7, 2.5, 0, 0, 6.29);
        ctx.stroke();
      }
    }
    if (w.flash > 0) {
      ctx.fillStyle = 'rgba(255, 255, 240, ' + (w.flash * 0.16) + ')';
      rect(0, 0, vw, vh);
    }
    ctx.fillStyle = 'rgba(10,14,20,0.65)';
    rect(vw - 404, 188, 380, 96);
    ctx.fillStyle = '#f2f0e8';
    ctx.font = '16px ' + TYPEFACE;
    ctx.textAlign = 'right';
    say(skyName(w.mode) + '  ·  Stashes ' + s.packs.found + '/' + s.packs.total, vw - 24, 200);
    const near = nearestStash(s);
    if (near) {
      say('Nearest stash ' + Math.round(near.dist) + 'm ' + near.dir, vw - 24, 224);
    }
    const next = w.forecast();
    say('Next: ' + skyName(next.mode) + ' in ' + Math.ceil(next.seconds) + 's', vw - 24, 248);
    if (w.mode !== 0) {
      ctx.fillStyle = '#b8b4a8';
      say(w.tip(), vw - 24, 272);
      ctx.fillStyle = '#f2f0e8';
    }
    ctx.textAlign = 'left';
  }
  function paintTown(s, cam, time) {
    const { upright, crosswise } = streetGrid();
    ctx.fillStyle = COLORS.grass;
    rect(0, 0, MAP.width, MAP.height);
    // Quarter washes, then the sand, the water and the green.
    for (const q of QUARTERS) {
      ctx.fillStyle = q.tint + '22';
      rect(q.x, q.y, q.w, q.h);
    }
    ctx.fillStyle = COLORS.water;
    rect(0, MAP.height - 90, MAP.width, 90);
    ctx.fillStyle = COLORS.sand;
    rect(0, MAP.height - 130, MAP.width, 40);
    ctx.fillStyle = COLORS.park;
    rect(30, 830, 1040, 740);
    // Streets with dashed centre lines, then pavements.
    ctx.fillStyle = COLORS.road;
    for (const rx of upright) rect(rx - MAP.road / 2, 0, MAP.road, MAP.height - 130);
    for (const ry of crosswise) rect(0, ry - MAP.road / 2, MAP.width, MAP.road);
    ctx.strokeStyle = COLORS.roadLine;
    ctx.setLineDash([26, 22]);
    ctx.lineWidth = 3;
    for (const rx of upright) {
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx, MAP.height - 130);
      ctx.stroke();
    }
    for (const ry of crosswise) {
      ctx.beginPath();
      ctx.moveTo(0, ry);
      ctx.lineTo(MAP.width, ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = COLORS.sidewalk;
    ctx.lineWidth = 10;
    for (const rx of upright) {
      ctx.beginPath();
      ctx.moveTo(rx - 54, 0);
      ctx.lineTo(rx - 54, MAP.height - 130);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rx + 54, 0);
      ctx.lineTo(rx + 54, MAP.height - 130);
      ctx.stroke();
    }
    // Towers: shade, coloured body, lit windows.
    for (const t of s.town.towers) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      rect(t.x + 5, t.y + 6, t.w, t.h);
      ctx.fillStyle = `hsl(${t.tint},32%,${38 + t.levels * 3}%)`;
      rect(t.x, t.y, t.w, t.h);
      ctx.fillStyle = 'rgba(255,230,140,0.75)';
      const cols = Math.max(1, Math.floor(t.w / 26));
      const rows = Math.max(1, Math.floor(t.h / 26));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const lit = (i * 7 + j * 3 + t.levels) % 3 === 0;
          if (lit) rect(t.x + 6 + i * 26, t.y + 6 + j * 26, 10, 12);
        }
      }
    }
    // Hospital and precinct, the two respawn landmarks.
    ctx.fillStyle = '#e8e8e8';
    rect(s.town.hospital.x - 40, s.town.hospital.y - 30, 80, 60);
    ctx.fillStyle = '#e5534b';
    ctx.font = 'bold 28px ' + TYPEFACE;
    say('H', s.town.hospital.x - 10, s.town.hospital.y + 10);
    ctx.fillStyle = '#2b4acb';
    rect(s.town.precinct.x - 40, s.town.precinct.y - 30, 80, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px ' + TYPEFACE;
    say('PD', s.town.precinct.x - 14, s.town.precinct.y + 7);
    // Pickups bob gently so they read as collectables.
    for (const g of s.town.goods) {
      if (g.got) continue;
      const bob = Math.sin(time * 3 + g.sway) * 3;
      const tint = g.sort === 'health' ? '#2f9e44' : g.sort === 'armour' ? '#4f8fd0' : g.sort === 'ammo' ? '#e8b23a' : '#f2c94c';
      const mark = g.sort === 'health' ? '+' : g.sort === 'armour' ? 'A' : g.sort === 'ammo' ? '»' : '$';
      ctx.fillStyle = tint;
      disc(g.x, g.y + bob, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px ' + TYPEFACE;
      ctx.textAlign = 'center';
      say(mark, g.x, g.y + bob + 5);
      ctx.textAlign = 'left';
    }
    // Skid marks left by hard driving.
    ctx.strokeStyle = 'rgba(10,10,10,0.5)';
    ctx.lineWidth = 4;
    for (const m of s.marks) {
      ctx.beginPath();
      ctx.moveTo(m.x1, m.y1);
      ctx.lineTo(m.x2, m.y2);
      ctx.stroke();
    }
    // Throbbing gold marker over the current job objective.
    if (s.job.current >= 0) {
      const job = JOBS[s.job.current];
      const stage = job.stages[s.job.stage];
      if (stage && stage.x) {
        const r = 18 + Math.sin(time * 5) * 5;
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(stage.x, stage.y, r, 0, 6.29);
        ctx.stroke();
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.moveTo(stage.x, stage.y - 34);
        ctx.lineTo(stage.x - 10, stage.y - 14);
        ctx.lineTo(stage.x + 10, stage.y - 14);
        ctx.fill();
      }
    }
    // Motors, then the hero's motor, then people, then the hero on foot.
    for (const c of s.autos) paintCar(c.x, c.y, c.angle, c.kind, VEHICLES[c.kind].color, c.patrol);
    if (s.hero.ride) {
      const c = s.hero.ride;
      paintCar(c.x, c.y, c.angle, c.kind, VEHICLES[c.kind].color, false);
    }
    for (const p of s.walkers) paintWalker(p.x, p.y, p.angle, p.top, p.panic > 0);
    for (const c of s.officers) paintWalker(c.x, c.y, c.angle, '#2b4acb', false);
    if (!s.hero.ride) paintWalker(s.hero.x, s.hero.y, s.hero.angle, COLORS.player, false);
    // Shots, sparks and floating score text.
    ctx.fillStyle = '#ffd23a';
    for (const b of s.shots) disc(b.x, b.y, 3);
    for (const p of s.sparks) {
      ctx.globalAlpha = Math.max(0, p.life / p.span);
      ctx.fillStyle = p.color;
      disc(p.x, p.y, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px ' + TYPEFACE;
    ctx.textAlign = 'center';
    for (const f of s.labels) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      say(f.words, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    // Time-of-day tint: night blue, dusk orange.
    const tod = s.hour;
    if (tod < 6 || tod > 19) {
      ctx.fillStyle = 'rgba(10,16,48,0.28)';
      rect(cam.x - vw / 2 - 60, cam.y - vh / 2 - 60, vw + 120, vh + 120);
    } else if (tod > 17) {
      ctx.fillStyle = 'rgba(230,140,60,0.12)';
      rect(cam.x - vw / 2 - 60, cam.y - vh / 2 - 60, vw + 120, vh + 120);
    }
  }
  function paintMap(s) {
    const mw = 190;
    const mh = 142;
    const mx = vw - mw - 14;
    const my = 14;
    const sx = mw / MAP.width;
    const sy = mh / MAP.height;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    rect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2e4a2e';
    rect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f45';
    const { upright, crosswise } = streetGrid();
    for (const rx of upright) rect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of crosswise) rect(mx, my + ry * sy, mw, 4);
    ctx.fillStyle = '#2e7fa8';
    rect(mx, my + mh - 8, mw, 8);
    if (s.job.current >= 0) {
      const stage = JOBS[s.job.current].stages[s.job.stage];
      if (stage && stage.x) {
        ctx.fillStyle = '#f2c94c';
        disc(mx + stage.x * sx, my + stage.y * sy, 5);
      }
    }
    ctx.fillStyle = '#2b4acb';
    for (const c of s.autos) {
      if (c.patrol) rect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#e8b23a';
    for (const c of s.autos) {
      if (!c.patrol) rect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
    }
    const px = s.hero.ride ? s.hero.ride.x : s.hero.x;
    const py = s.hero.ride ? s.hero.ride.y : s.hero.y;
    ctx.fillStyle = '#2f9e44';
    disc(mx + px * sx, my + py * sy, 5);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px ' + TYPEFACE;
    say(quarterAt(px, py).name, mx, my + mh + 16);
  }
  function paintHud(s) {
    ctx.fillStyle = COLORS.panel;
    rect(12, 12, 250, 108);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px ' + TYPEFACE;
    say(`$${Math.floor(s.money).toLocaleString('en-US')}`, 24, 38);
    ctx.fillStyle = '#e5534b';
    rect(24, 48, 150, 12);
    ctx.fillStyle = '#2f9e44';
    rect(24, 48, 150 * Math.max(0, s.hero.health) / 100, 12);
    ctx.fillStyle = '#4f8fd0';
    rect(24, 64, 150 * Math.max(0, s.hero.armor) / 100, 6);
    ctx.fillStyle = '#fff';
    ctx.font = '15px ' + TYPEFACE;
    say(`HP ${Math.ceil(s.hero.health)}  Armour ${Math.ceil(s.hero.armor)}  Ammo ${s.hero.rounds}`, 24, 92);
    ctx.fillStyle = '#f2c94c';
    ctx.font = 'bold 22px ' + TYPEFACE;
    say('★'.repeat(s.heat) + '☆'.repeat(5 - s.heat), 24, 116);
    // Clock, job count and the current objective.
    const hh = Math.floor(s.hour) % 24;
    const mm = Math.floor((s.hour % 1) * 60);
    ctx.fillStyle = COLORS.panel;
    rect(12, 128, 330, 56);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px ' + TYPEFACE;
    say(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + s.job.finished.length + '/' + JOBS.length + ' jobs done', 24, 152);
    ctx.font = '14px ' + TYPEFACE;
    ctx.fillStyle = COLORS.gold;
    say(jobObjective(s.job).slice(0, 52), 24, 174);
    if (s.job.countdown > 0) {
      ctx.fillStyle = COLORS.panel;
      rect(12, 190, 150, 30);
      ctx.fillStyle = '#e5534b';
      ctx.font = 'bold 18px ' + TYPEFACE;
      say(`TIME ${Math.ceil(s.job.countdown)}s`, 24, 212);
    }
    if (s.hero.ride) {
      const c = s.hero.ride;
      ctx.fillStyle = COLORS.panel;
      rect(vw - 220, vh - 64, 206, 50);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px ' + TYPEFACE;
      say(`${VEHICLES[c.kind].name}  ${Math.abs(Math.round(c.velocity * 2.2))} km/h`, vw - 208, vh - 32);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '13px ' + TYPEFACE;
    say('WASD move/drive · E enter car · Click shoot · F punch · Shift run · M mute · Esc pause', 14, vh - 12);
    if (s.job.speechT > 0) {
      ctx.fillStyle = 'rgba(8,10,16,0.88)';
      rect(vw / 2 - 320, vh - 150, 640, 64);
      ctx.strokeStyle = COLORS.gold;
      ctx.strokeRect(vw / 2 - 320, vh - 150, 640, 64);
      ctx.fillStyle = '#fff';
      ctx.font = '15px ' + TYPEFACE;
      // Word-wrap the speech into two lines instead of cutting words in half.
      const words = s.job.speech.split(' ');
      const lines = ['', ''];
      let li = 0;
      for (const w of words) {
        if (ctx.measureText(lines[li] + ' ' + w).width > 600 && li === 0) li = 1;
        lines[li] += (lines[li] ? ' ' : '') + w;
      }
      say(lines[0], vw / 2 - 306, vh - 122);
      say(lines[1], vw / 2 - 306, vh - 100);
    }
    paintMap(s);
  }
  function paintMenu(s, view, record) {
    ctx.fillStyle = '#0e1420';
    rect(0, 0, vw, vh);
    ctx.fillStyle = '#e8b23a';
    ctx.font = 'bold 84px ' + TYPEFACE;
    ctx.textAlign = 'center';
    say('SOLMAR', vw / 2, vh / 2 - 110);
    ctx.fillStyle = '#5fb8c9';
    ctx.font = 'bold 26px ' + TYPEFACE;
    say('SOLMAR CITY — an open-world crime story', vw / 2, vh / 2 - 66);
    ctx.fillStyle = '#fff';
    ctx.font = '20px ' + TYPEFACE;
    say('Danny Reyes rolled into Solmar City for one final score. Steal motors, outrun the law,', vw / 2, vh / 2 - 20);
    say('run Marla Voss\'s jobs and take the harbour score.', vw / 2, vh / 2 + 8);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 22px ' + TYPEFACE;
    if (view === VIEW_TITLE) {
      say(s.saved ? 'Press ENTER — New Game / Continue (save found)' : 'Press ENTER — New Game', vw / 2, vh / 2 + 60);
      ctx.fillStyle = '#b8b4a8';
      ctx.font = '16px ' + TYPEFACE;
      say('WASD move · E enter/exit car · Mouse aim, Click shoot · F punch · Shift run · M mute', vw / 2, vh / 2 + 96);
      say('Best cash: $' + record.toLocaleString('en-US') + ' · 9 story jobs · Heat 0–5 stars · Free roam', vw / 2, vh / 2 + 122);
      if (s.saved) say('Continue loads your saved jobs, cash and progress.', vw / 2, vh / 2 + 148);
    } else if (view === VIEW_OVER) {
      ctx.fillStyle = '#e5534b';
      ctx.font = 'bold 40px ' + TYPEFACE;
      say('WASTED', vw / 2, vh / 2 + 60);
      ctx.fillStyle = '#fff';
      ctx.font = '20px ' + TYPEFACE;
      say('Danny wakes up at the hospital, lighter by $200. Press ENTER to try again.', vw / 2, vh / 2 + 100);
    } else if (view === VIEW_BUSTED) {
      ctx.fillStyle = '#2b4acb';
      ctx.font = 'bold 40px ' + TYPEFACE;
      say('BUSTED', vw / 2, vh / 2 + 60);
      ctx.fillStyle = '#fff';
      ctx.font = '20px ' + TYPEFACE;
      say('The precinct let Danny go — minus $200. Press ENTER to try again.', vw / 2, vh / 2 + 100);
    } else if (view === VIEW_PAUSED) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 40px ' + TYPEFACE;
      say('PAUSED', vw / 2, vh / 2 + 60);
      ctx.font = '18px ' + TYPEFACE;
      say('Esc / Enter to resume · M mute · Jobs: ' + s.job.finished.length + '/' + JOBS.length + ' done', vw / 2, vh / 2 + 100);
      ctx.font = 'bold 20px ' + TYPEFACE;
      say('Job list:', vw / 2 - 300, vh / 2 + 140);
      say('Run stats:', vw / 2 + 300, vh / 2 + 140);
      ctx.font = '16px ' + TYPEFACE;
      JOBS.forEach((job, i) => say(`${s.job.finished.includes(i) ? '✓' : '·'} ${i + 1}. ${job.name} — $${job.pay}`, vw / 2 - 300, vh / 2 + 168 + i * 19));
      statRows(s, record).forEach((row, i) => say(row[0] + ': ' + row[1], vw / 2 + 300, vh / 2 + 168 + i * 19));
    }
    ctx.textAlign = 'left';
  }
  return {
    get width() { return vw; },
    get height() { return vh; },
    draw(s, view, record, time) {
      ctx.clearRect(0, 0, vw, vh);
      if (view === VIEW_TITLE || view === VIEW_OVER || view === VIEW_BUSTED) {
        paintMenu(s, view, record);
        return;
      }
      const px = s.hero.ride ? s.hero.ride.x : s.hero.x;
      const py = s.hero.ride ? s.hero.ride.y : s.hero.y;
      const shx = (Math.random() - 0.5) * s.jolt;
      const shy = (Math.random() - 0.5) * s.jolt;
      const camX = Math.max(vw / 2, Math.min(MAP.width - vw / 2, px)) + shx;
      const camY = Math.max(vh / 2, Math.min(MAP.height - vh / 2, py)) + shy;
      ctx.save();
      ctx.translate(vw / 2 - camX, vh / 2 - camY);
      paintTown(s, { x: camX, y: camY }, time);
      paintStashes(s, time);
      ctx.restore();
      paintSky(s);
      if (view === VIEW_PAUSED) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        rect(0, 0, vw, vh);
        paintMenu(s, view, record);
        return;
      }
      paintHud(s);
    },
  };
}
