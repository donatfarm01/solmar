// Story missions for Solmar. Danny Reyes, a courier driver new to Solmar City,
// takes jobs from fixer Marla Voss and climbs from errands to the big harbour score.
// Each mission is a list of steps: go to a marker (on foot or in a car), pick up,
// deliver, survive, or hit checkpoints against a timer.
export const MISSIONS = [
  {
    id: 0, title: 'First Fare', giver: 'Marla Voss', reward: 250,
    brief: 'Marla needs a package run. Drive to the Marina Bay marker and pick up the parcel.',
    steps: [
      { kind: 'goto', label: 'Drive to Marina Bay pickup', x: 1450, y: 250, needCar: true },
      { kind: 'goto', label: 'Deliver the parcel to Old Town', x: 450, y: 550, needCar: false },
    ],
  },
  {
    id: 1, title: 'Park Handoff', giver: 'Marla Voss', reward: 400,
    brief: 'A nervous client waits in Palm Park. Collect the envelope, then drop it at the Market Row stall.',
    steps: [
      { kind: 'goto', label: 'Meet the client in Palm Park', x: 550, y: 1150, needCar: false },
      { kind: 'goto', label: 'Deliver to Market Row', x: 1450, y: 1150, needCar: false },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', giver: 'Rico the Mechanic', reward: 600,
    brief: 'Rico wants a fast car, any fast car. Steal a sports car and bring it to his garage in the South Docks.',
    steps: [
      { kind: 'steal', label: 'Steal a car (press E near one)', x: 0, y: 0, needCar: true },
      { kind: 'goto', label: 'Deliver the car to Rico\'s garage', x: 2400, y: 1950, needCar: true },
    ],
  },
  {
    id: 3, title: 'Lose the Heat', giver: 'Marla Voss', reward: 800,
    brief: 'The precinct is watching. Get noticed, then lose the cops and reach the Beachfront safe house.',
    steps: [
      { kind: 'wanted', label: 'Raise your wanted level, then lose the cops', x: 0, y: 0, needCar: false },
      { kind: 'goto', label: 'Reach the Beachfront safe house (wanted must be 0)', x: 700, y: 2250, needCar: false },
    ],
  },
  {
    id: 4, title: 'Downtown Dash', giver: 'Marla Voss', reward: 1000,
    brief: 'Three checkpoints across Downtown, 90 seconds. Drive fast, drive clean — the clock does not wait.',
    steps: [
      { kind: 'timed', label: 'Checkpoint 1 — Downtown tower', x: 2400, y: 350, needCar: true, time: 90 },
      { kind: 'timed', label: 'Checkpoint 2 — Harbour Heights', x: 2750, y: 1150, needCar: false, time: 0 },
      { kind: 'timed', label: 'Checkpoint 3 — Market Row', x: 1450, y: 1150, needCar: false, time: 0 },
    ],
  },
  {
    id: 5, title: 'The Harbour Score', giver: 'Marla Voss', reward: 1500,
    brief: 'The big one. Grab the ledger from the South Docks, then outrun a three-star response to the beach.',
    steps: [
      { kind: 'goto', label: 'Grab the ledger at the South Docks', x: 2750, y: 1950, needCar: false },
      { kind: 'escape', label: 'Escape to Beachfront with the ledger', x: 700, y: 2250, needCar: false },
    ],
  },
];
export function createMissionState() {
  return { active: -1, step: 0, timer: 0, done: [], dialogue: '', dialogueT: 0 };
}
export function missionObjective(ms) {
  if (ms.active < 0 || ms.active >= MISSIONS.length) return 'No mission — press N for the next job';
  const m = MISSIONS[ms.active];
  const s = m.steps[ms.step];
  return s ? `${m.title}: ${s.label}` : m.title;
}
export function startMission(ms, idx) {
  ms.active = idx; ms.step = 0; ms.timer = 0;
  ms.dialogue = `${MISSIONS[idx].giver}: ${MISSIONS[idx].brief}`;
  ms.dialogueT = 7;
  return ms.dialogue;
}
