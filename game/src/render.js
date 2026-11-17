// Canvas renderer: city, cars, people, particles, HUD, minimap and menus.
// Camera follows the player; the world is drawn in world space, HUD in screen space.
import { CITY, CAR_TYPES, DISTRICTS, PALETTE, FONT } from './config.js';
import { roadCenters, districtAt } from './world.js';
import { MISSIONS, missionObjective } from './missions.js';

export const SCREEN_TITLE = 0, SCREEN_PLAY = 1, SCREEN_PAUSED = 2, SCREEN_OVER = 3, SCREEN_BUSTED = 4;
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 1280, H = 720;
  function resize() {
    W = canvas.clientWidth || window.innerWidth; H = canvas.clientHeight || window.innerHeight;
    canvas.width = W; canvas.height = H;
  }
  window.addEventListener('resize', resize); resize();
  function drawCar(x, y, angle, type, color, police) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-24, -12, 48, 26);
    ctx.fillStyle = police ? '#e8e8e8' : color;
    ctx.fillRect(-24, -13, 48, 26);
    ctx.fillStyle = police ? '#2b4acb' : 'rgba(20,30,40,0.85)';
    ctx.fillRect(-8, -11, 16, 22);
    ctx.fillStyle = '#cfe8ff'; ctx.fillRect(14, -10, 5, 20);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-24, -11, 3, 5); ctx.fillRect(-24, 6, 3, 5);
    if (police) { ctx.fillStyle = '#e5534b'; ctx.fillRect(-4, -15, 8, 4); ctx.fillStyle = '#2b4acb'; ctx.fillRect(-4, 11, 8, 4); }
    ctx.restore();
  }
  function drawPerson(x, y, angle, shirt, scared) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 12, 8, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#e8c39a'; ctx.beginPath(); ctx.arc(8, 0, 6, 0, 6.29); ctx.fill();
    if (scared) { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px ' + FONT; ctx.fillText('!', -4, -16); }
    ctx.restore();
  }
  function drawWorld(s, cam, time) {
    const { xs, ys } = roadCenters();
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, CITY.width, CITY.height);
    // Districts tint + beach + park + water
    for (const d of DISTRICTS) { ctx.fillStyle = d.tint + '22'; ctx.fillRect(d.x, d.y, d.w, d.h); }
    ctx.fillStyle = PALETTE.water; ctx.fillRect(0, CITY.height - 90, CITY.width, 90);
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, CITY.height - 130, CITY.width, 40);
    ctx.fillStyle = PALETTE.park; ctx.fillRect(30, 830, 1040, 740);
    // Roads
    ctx.fillStyle = PALETTE.road;
    for (const rx of xs) ctx.fillRect(rx - CITY.road / 2, 0, CITY.road, CITY.height - 130);
    for (const ry of ys) ctx.fillRect(0, ry - CITY.road / 2, CITY.width, CITY.road);
    ctx.strokeStyle = PALETTE.roadLine; ctx.setLineDash([26, 22]); ctx.lineWidth = 3;
    for (const rx of xs) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, CITY.height - 130); ctx.stroke(); }
    for (const ry of ys) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(CITY.width, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // Sidewalks
    ctx.strokeStyle = PALETTE.sidewalk; ctx.lineWidth = 10;
    for (const rx of xs) { ctx.beginPath(); ctx.moveTo(rx - 54, 0); ctx.lineTo(rx - 54, CITY.height - 130); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx + 54, 0); ctx.lineTo(rx + 54, CITY.height - 130); ctx.stroke(); }
    // Buildings
    for (const b of s.city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = `hsl(${b.hue},32%,${38 + b.floors * 3}%)`; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,230,140,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if ((i * 7 + j * 3 + b.floors) % 3 === 0) ctx.fillRect(b.x + 6 + i * 26, b.y + 6 + j * 26, 10, 12);
      }
    }
    // Hospital / precinct markers
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(s.city.hospital.x - 40, s.city.hospital.y - 30, 80, 60);
    ctx.fillStyle = '#e5534b'; ctx.font = 'bold 28px ' + FONT; ctx.fillText('H', s.city.hospital.x - 10, s.city.hospital.y + 10);
    ctx.fillStyle = '#2b4acb'; ctx.fillRect(s.city.precinct.x - 40, s.city.precinct.y - 30, 80, 60);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px ' + FONT; ctx.fillText('PD', s.city.precinct.x - 14, s.city.precinct.y + 7);
    // Pickups
    for (const p of s.city.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(time * 3 + p.bob) * 3;
      ctx.fillStyle = p.kind === 'health' ? '#2f9e44' : p.kind === 'armour' ? '#4f8fd0' : p.kind === 'ammo' ? '#e8b23a' : '#f2c94c';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, 12, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'health' ? '+' : p.kind === 'armour' ? 'A' : p.kind === 'ammo' ? '»' : '$', p.x, p.y + bob + 5);
      ctx.textAlign = 'left';
    }
    // Skid marks
    ctx.strokeStyle = 'rgba(10,10,10,0.5)'; ctx.lineWidth = 4;
    for (const k of s.skids) { ctx.beginPath(); ctx.moveTo(k.x1, k.y1); ctx.lineTo(k.x2, k.y2); ctx.stroke(); }
    // Mission marker (pulsing)
    if (s.mission.active >= 0) {
      const m = MISSIONS[s.mission.active], st = m.steps[s.mission.step];
      if (st && st.x) {
        const r = 18 + Math.sin(time * 5) * 5;
        ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(st.x, st.y, r, 0, 6.29); ctx.stroke();
        ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.moveTo(st.x, st.y - 34); ctx.lineTo(st.x - 10, st.y - 14); ctx.lineTo(st.x + 10, st.y - 14); ctx.fill();
      }
    }
    // Cars
    for (const c of s.cars) drawCar(c.x, c.y, c.angle, c.type, CAR_TYPES[c.type].color, c.police);
    if (s.player.car) { const c = s.player.car; drawCar(c.x, c.y, c.angle, c.type, CAR_TYPES[c.type].color, false); }
    // Pedestrians + cops on foot
    for (const p of s.peds) drawPerson(p.x, p.y, p.angle, p.shirt, p.scared > 0);
    for (const c of s.cops) drawPerson(c.x, c.y, c.angle, '#2b4acb', false);
    // Player on foot
    if (!s.player.car) drawPerson(s.player.x, s.player.y, s.player.angle, PALETTE.player, false);
    // Bullets, particles, floating text
    ctx.fillStyle = '#ffd23a';
    for (const b of s.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 6.29); ctx.fill(); }
    for (const p of s.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.29); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px ' + FONT; ctx.textAlign = 'center';
    for (const f of s.floaters) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    // Day/night tint
    const hour = s.clock;
    if (hour < 6 || hour > 19) { ctx.fillStyle = 'rgba(10,16,48,0.28)'; ctx.fillRect(cam.x - W / 2 - 60, cam.y - H / 2 - 60, W + 120, H + 120); }
    else if (hour > 17) { ctx.fillStyle = 'rgba(230,140,60,0.12)'; ctx.fillRect(cam.x - W / 2 - 60, cam.y - H / 2 - 60, W + 120, H + 120); }
  }
  function drawMinimap(s) {
    const mw = 190, mh = 142, mx = W - mw - 14, my = 14, sx = mw / CITY.width, sy = mh / CITY.height;
    ctx.fillStyle = 'rgba(10,14,20,0.85)'; ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#2e4a2e'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f45';
    const { xs, ys } = roadCenters();
    for (const rx of xs) ctx.fillRect(mx + rx * sx - 2, my, 4, mh);
    for (const ry of ys) ctx.fillRect(mx, my + ry * sy, mw, 4);
    ctx.fillStyle = '#2e7fa8'; ctx.fillRect(mx, my + mh - 8, mw, 8);
    if (s.mission.active >= 0) { const st = MISSIONS[s.mission.active].steps[s.mission.step]; if (st && st.x) { ctx.fillStyle = '#f2c94c'; ctx.beginPath(); ctx.arc(mx + st.x * sx, my + st.y * sy, 5, 0, 6.29); ctx.fill(); } }
    ctx.fillStyle = '#4f8fd0'; for (const c of s.cars) { if (c.police) { ctx.fillStyle = '#2b4acb'; ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4); } }
    ctx.fillStyle = '#e8b23a'; for (const c of s.cars) { if (!c.police) ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2); }
    const px = s.player.car ? s.player.car.x : s.player.x, py = s.player.car ? s.player.car.y : s.player.y;
    ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.arc(mx + px * sx, my + py * sy, 5, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px ' + FONT; ctx.fillText(districtAt(px, py).name, mx, my + mh + 16);
  }
  function drawHUD(s) {
    ctx.fillStyle = PALETTE.panel; ctx.fillRect(12, 12, 250, 108);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(`$${Math.floor(s.cash).toLocaleString('en-US')}`, 24, 38);
    ctx.fillStyle = '#e5534b'; ctx.fillRect(24, 48, 150, 12);
    ctx.fillStyle = '#2f9e44'; ctx.fillRect(24, 48, 150 * Math.max(0, s.player.hp) / 100, 12);
    ctx.fillStyle = '#4f8fd0'; ctx.fillRect(24, 64, 150 * Math.max(0, s.player.armour) / 100, 6);
    ctx.fillStyle = '#fff'; ctx.font = '15px ' + FONT;
    ctx.fillText(`HP ${Math.ceil(s.player.hp)}  Armour ${Math.ceil(s.player.armour)}  Ammo ${s.player.ammo}`, 24, 92);
    ctx.fillStyle = '#f2c94c'; ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted), 24, 116 - 8 + 8);
    // Clock + objective
    const hh = Math.floor(s.clock) % 24, mm = Math.floor((s.clock % 1) * 60);
    ctx.fillStyle = PALETTE.panel; ctx.fillRect(12, 128, 330, 56);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px ' + FONT;
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  ${s.mission.done.length}/6 missions done`, 24, 152);
    ctx.font = '14px ' + FONT; ctx.fillStyle = PALETTE.gold;
    ctx.fillText(missionObjective(s.mission).slice(0, 52), 24, 174);
    if (s.mission.timer > 0) { ctx.fillStyle = '#e5534b'; ctx.font = 'bold 18px ' + FONT; ctx.fillText(`TIME ${Math.ceil(s.mission.timer)}s`, 24, 200); }
    if (s.player.car) {
      const c = s.player.car;
      ctx.fillStyle = PALETTE.panel; ctx.fillRect(W - 220, H - 64, 206, 50);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px ' + FONT;
      ctx.fillText(`${CAR_TYPES[c.type].name}  ${Math.abs(Math.round(c.speed * 2.2))} km/h`, W - 208, H - 32);
    }
    ctx.fillStyle = '#fff'; ctx.font = '13px ' + FONT;
    ctx.fillText('WASD move/drive · E enter car · Click shoot · F punch · Shift run · M mute · Esc pause', 14, H - 12);
    if (s.mission.dialogueT > 0) {
      ctx.fillStyle = 'rgba(8,10,16,0.88)'; ctx.fillRect(W / 2 - 320, H - 150, 640, 64);
      ctx.strokeStyle = PALETTE.gold; ctx.strokeRect(W / 2 - 320, H - 150, 640, 64);
      ctx.fillStyle = '#fff'; ctx.font = '15px ' + FONT;
      ctx.fillText(s.mission.dialogue.slice(0, 90), W / 2 - 306, H - 122);
      ctx.fillText(s.mission.dialogue.slice(90, 180), W / 2 - 306, H - 100);
    }
    drawMinimap(s);
  }
  function drawMenu(s, screen, best) {
    ctx.fillStyle = '#0e1420'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e8b23a'; ctx.font = 'bold 84px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('SOLMAR', W / 2, H / 2 - 110);
    ctx.fillStyle = '#5fb8c9'; ctx.font = 'bold 26px ' + FONT;
    ctx.fillText('SOLMAR CITY — an open-world crime story', W / 2, H / 2 - 66);
    ctx.fillStyle = '#fff'; ctx.font = '20px ' + FONT;
    ctx.fillText('Danny Reyes came to Solmar City for one last job. Steal cars, outrun the police,', W / 2, H / 2 - 20);
    ctx.fillText('run Marla Voss\'s missions and take the harbour score.', W / 2, H / 2 + 8);
    ctx.fillStyle = PALETTE.gold; ctx.font = 'bold 22px ' + FONT;
    if (screen === SCREEN_TITLE) {
      ctx.fillText(s.hasSave ? 'Press ENTER — New Game / Continue (save found)' : 'Press ENTER — New Game', W / 2, H / 2 + 60);
      ctx.fillStyle = '#b8b4a8'; ctx.font = '16px ' + FONT;
      ctx.fillText('WASD move · E enter/exit car · Mouse aim, Click shoot · F punch · Shift run · M mute', W / 2, H / 2 + 96);
      ctx.fillText(`Best cash: $${best.toLocaleString('en-US')} · 6 story missions · Wanted 0–5 stars · Free roam`, W / 2, H / 2 + 122);
      if (s.hasSave) ctx.fillText('Continue loads your saved missions, cash and progress.', W / 2, H / 2 + 148);
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = '#e5534b'; ctx.font = 'bold 40px ' + FONT; ctx.fillText('WASTED', W / 2, H / 2 + 60);
      ctx.fillStyle = '#fff'; ctx.font = '20px ' + FONT; ctx.fillText('Danny wakes up at the hospital, lighter by $200. Press ENTER to try again.', W / 2, H / 2 + 100);
    } else if (screen === SCREEN_BUSTED) {
      ctx.fillStyle = '#2b4acb'; ctx.font = 'bold 40px ' + FONT; ctx.fillText('BUSTED', W / 2, H / 2 + 60);
      ctx.fillStyle = '#fff'; ctx.font = '20px ' + FONT; ctx.fillText('The precinct let Danny go — minus $200. Press ENTER to try again.', W / 2, H / 2 + 100);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 40px ' + FONT; ctx.fillText('PAUSED', W / 2, H / 2 + 60);
      ctx.font = '18px ' + FONT; ctx.fillText('Esc / Enter to resume · M mute · Missions: ' + (s.mission.done.length) + '/6 done', W / 2, H / 2 + 100);
      ctx.fillText('Mission list:', W / 2, H / 2 + 140);
      MISSIONS.forEach((m, i) => ctx.fillText(`${s.mission.done.includes(i) ? '✓' : '·'} ${i + 1}. ${m.title} — $${m.reward}`, W / 2, H / 2 + 168 + i * 24));
    }
    ctx.textAlign = 'left';
  }
  return {
    get width() { return W; }, get height() { return H; },
    draw(s, screen, best, time) {
      ctx.clearRect(0, 0, W, H);
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) { drawMenu(s, screen, best); return; }
      const px = s.player.car ? s.player.car.x : s.player.x, py = s.player.car ? s.player.car.y : s.player.y;
      const shx = (Math.random() - 0.5) * s.shake, shy = (Math.random() - 0.5) * s.shake;
      const camX = Math.max(W / 2, Math.min(CITY.width - W / 2, px)) + shx;
      const camY = Math.max(H / 2, Math.min(CITY.height - H / 2, py)) + shy;
      ctx.save(); ctx.translate(W / 2 - camX, H / 2 - camY);
      drawWorld(s, { x: camX, y: camY }, time);
      ctx.restore();
      if (screen === SCREEN_PAUSED) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H); drawMenu(s, screen, best); return; }
      drawHUD(s);
    },
  };
}
