// Solmar — tuning, palette and districts. All original: fictional Solmar City.
export const CITY = { width: 3200, height: 2400, road: 96, block: 304 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar.save.v1';
export const SEED = 20261117;
export const PLAYER = { radius: 14, walk: 170, run: 290, hp: 100, punch: 18, punchRange: 34 };
export const CAR_TYPES = [
  { name: 'Civic', top: 330, accel: 260, turn: 2.9, color: '#e8b23a' },
  { name: 'Sedan', top: 300, accel: 230, turn: 2.6, color: '#4f8fd0' },
  { name: 'Coupe', top: 380, accel: 300, turn: 3.1, color: '#d05454' },
  { name: 'Van', top: 250, accel: 190, turn: 2.2, color: '#8a8f98' },
  { name: 'Taxi', top: 320, accel: 250, turn: 2.8, color: '#f2c94c' },
  { name: 'Sport', top: 430, accel: 340, turn: 3.3, color: '#7b5fd0' },
];
export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1100, h: 800, tint: '#c9a86a' },
  { name: 'Marina Bay', x: 1100, y: 0, w: 1000, h: 800, tint: '#5fb8c9' },
  { name: 'Downtown', x: 2100, y: 0, w: 1100, h: 800, tint: '#8fa3c9' },
  { name: 'Palm Park', x: 0, y: 800, w: 1100, h: 800, tint: '#7fb069' },
  { name: 'Market Row', x: 1100, y: 800, w: 1000, h: 800, tint: '#d08a4f' },
  { name: 'Harbour Heights', x: 2100, y: 800, w: 1100, h: 800, tint: '#b08ac9' },
  { name: 'Beachfront', x: 0, y: 1600, w: 1600, h: 800, tint: '#e8d27a' },
  { name: 'South Docks', x: 1600, y: 1600, w: 1600, h: 800, tint: '#9a8a7a' },
];
export const PALETTE = {
  grass: '#5d8a4a', road: '#33373d', roadLine: '#c9c27a', sidewalk: '#8f8a80',
  building: '#6b5d4f', water: '#2e7fa8', sand: '#e6d194', park: '#4f7d3a',
  player: '#2f9e44', police: '#2b4acb', text: '#f2f0e8', muted: '#b8b4a8',
  panel: 'rgba(12,16,22,0.82)', gold: '#f2c94c', red: '#e5534b',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const WANTED_DECAY = 0.045; // stars per second when unseen
export const MISSION_REWARDS = [250, 400, 600, 800, 1000, 1500];
