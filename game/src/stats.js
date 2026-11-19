// Pause-screen ledger: the numbers behind a run, kept in one place so
// the menu and the HUD never disagree about what Danny has done.
import { JOBS } from './missions.js';
import { stashBase } from './packages.js';

export function formatClock(total) {
  const whole = Math.floor(total);
  const hours = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  const pad = (n) => (n < 10 ? '0' + n : String(n));
  if (hours > 0) return hours + ':' + pad(mins) + ':' + pad(secs);
  return mins + ':' + pad(secs);
}

function cashStr(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function statRows(sim, record) {
  const packs = sim.packs;
  const rows = [];
  rows.push(['Play time', formatClock(sim.elapsed)]);
  rows.push(['Cash', cashStr(sim.money)]);
  rows.push(['Jobs done', sim.job.finished.length + ' / ' + JOBS.length]);
  rows.push(['Hidden stashes', packs.found + ' / ' + packs.total + ' · $' + stashBase(sim)]);
  rows.push(['Takedowns', String(sim.takedowns)]);
  rows.push(['Motors lifted', String(sim.thefts)]);
  rows.push(['Top speed', Math.round(sim.topSpeed * 2.2) + ' km/h']);
  rows.push(['Rain time', formatClock(sim.weather.rainTime)]);
  rows.push(['Storms weathered', String(sim.weather.storms)]);
  rows.push(['Sky', sim.weather.describe()]);
  return rows;
}
