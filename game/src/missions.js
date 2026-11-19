// The story: Danny Reyes, a courier new to Solmar City, takes work from
// fixer Marla Voss and climbs from small errands to the harbour score.
// A job is a run of stages. Stage types: goto (reach a marker), steal
// (take any motor), wanted (draw heat, then drop it), escape (reach a
// marker while the heat is on) and timed (hit markers before time runs out).
export const JOBS = [
  {
    num: 0,
    name: 'Opening Run',
    client: 'Marla Voss',
    pay: 250,
    intro: 'Marla has a parcel to move. Collect it at the Marina Bay marker, then carry it to Old Town.',
    stages: [
      { type: 'goto', text: 'Collect the parcel at Marina Bay', x: 1450, y: 250, needsRide: true },
      { type: 'goto', text: 'Drop the parcel in Old Town', x: 450, y: 550, needsRide: false },
    ],
  },
  {
    num: 1,
    name: 'Park Drop',
    client: 'Marla Voss',
    pay: 400,
    intro: 'A jumpy customer is waiting in Palm Park with an envelope. Take it, then leave it at the Market Row stall.',
    stages: [
      { type: 'goto', text: 'Find the customer in Palm Park', x: 550, y: 1150, needsRide: false },
      { type: 'goto', text: 'Leave the envelope at Market Row', x: 1450, y: 1150, needsRide: false },
    ],
  },
  {
    num: 2,
    name: 'Fast Wheels',
    client: 'Rico the Mechanic',
    pay: 600,
    intro: 'Rico needs something quick — any quick motor will do. Lift a sports car and bring it down to his South Docks workshop.',
    stages: [
      { type: 'steal', text: 'Lift a sports car (stand close and press E)', x: 0, y: 0, needsRide: true },
      { type: 'goto', text: 'Bring the car to Rico\'s workshop', x: 2400, y: 1950, needsRide: true },
    ],
  },
  {
    num: 3,
    name: 'Cool Down',
    client: 'Marla Voss',
    pay: 800,
    intro: 'The precinct has its eye on you. Draw their attention, shake them off, and slip to the Beachfront hideout.',
    stages: [
      { type: 'wanted', text: 'Draw heat, then shake the cops', x: 0, y: 0, needsRide: false },
      { type: 'goto', text: 'Slip to the Beachfront hideout (heat must be zero)', x: 700, y: 2250, needsRide: false },
    ],
  },
  {
    num: 4,
    name: 'Downtown Sprint',
    client: 'Marla Voss',
    pay: 1000,
    intro: 'Three markers across Downtown in ninety seconds. Fast and clean — the clock will not wait for you.',
    stages: [
      // Every marker sits ON the street grid (street centres run at 48 + 400k),
      // so each one is reached by driving, never across the grass.
      { type: 'timed', text: 'Marker 1 — Downtown tower', x: 2448, y: 448, needsRide: true, limit: 90 },
      { type: 'timed', text: 'Marker 2 — Harbour Heights', x: 2848, y: 1248, needsRide: false, limit: 0 },
      { type: 'timed', text: 'Marker 3 — Market Row', x: 1648, y: 1248, needsRide: false, limit: 0 },
    ],
  },
  {
    num: 5,
    name: 'The Harbour Job',
    client: 'Marla Voss',
    pay: 1500,
    intro: 'The big score. Take the ledger from the South Docks, then outrun a three-star chase all the way to the sand.',
    stages: [
      { type: 'goto', text: 'Lift the ledger in the South Docks', x: 2750, y: 1950, needsRide: false },
      { type: 'escape', text: 'Run to Beachfront with the ledger', x: 700, y: 2250, needsRide: false },
    ],
  },
];
export function freshJobState() {
  return { current: -1, stage: 0, countdown: 0, finished: [], speech: '', speechT: 0 };
}
export function jobObjective(js) {
  if (js.current < 0 || js.current >= JOBS.length) return 'No job — press N for the next one';
  const job = JOBS[js.current];
  const stage = job.stages[js.stage];
  return stage ? `${job.name}: ${stage.text}` : job.name;
}
export function beginJob(js, idx) {
  js.current = idx;
  js.stage = 0;
  js.countdown = 0;
  js.speech = `${JOBS[idx].client}: ${JOBS[idx].intro}`;
  js.speechT = 7;
  return js.speech;
}
