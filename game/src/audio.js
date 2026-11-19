// Every noise is built live with WebAudio: no sound files, no samples.
// A small chiptune loop (bass, lead, hats) plus one-shot effects for
// gunfire, punches, pickups, crashes, the job jingle, the busted sting,
// a looping motor drone and a two-tone alarm.
export function makeSound() {
  let ac = null;
  let mainBus = null;
  let tuneBus = null;
  let silent = false;
  let tuneClock = null;
  let beat = 0;
  let motorOsc = null;
  let motorGain = null;
  let alarmOsc = null;
  let alarmGain = null;
  const bassNotes = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 49, 0];
  const leadNotes = [220, 261.6, 329.6, 261.6, 220, 0, 196, 246.9, 220, 261.6, 392, 329.6, 293.7, 261.6, 220, 0];
  function setup() {
    if (ac) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ac = new AC();
      mainBus = ac.createGain();
      mainBus.gain.value = 0.5;
      mainBus.connect(ac.destination);
      tuneBus = ac.createGain();
      tuneBus.gain.value = 0.16;
      tuneBus.connect(mainBus);
      motorOsc = ac.createOscillator();
      motorOsc.type = 'sawtooth';
      motorOsc.frequency.value = 55;
      motorGain = ac.createGain();
      motorGain.gain.value = 0;
      motorOsc.connect(motorGain);
      motorGain.connect(mainBus);
      motorOsc.start();
      alarmOsc = ac.createOscillator();
      alarmOsc.type = 'sine';
      alarmOsc.frequency.value = 700;
      alarmGain = ac.createGain();
      alarmGain.gain.value = 0;
      alarmOsc.connect(alarmGain);
      alarmGain.connect(mainBus);
      alarmOsc.start();
      return true;
    } catch {
      return false;
    }
  }
  // One short synthesized blip on the main bus, sliding in pitch if asked.
  function blip(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!setup() || silent) return;
    const t0 = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(mainBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  // One music note on the tune bus.
  function playNote(freq, dur, type, vol) {
    if (!setup() || silent || !tuneBus) return;
    const t0 = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(tuneBus);
    o.start(t0);
    o.stop(t0 + dur);
  }
  function startTune() {
    if (!setup() || tuneClock) return;
    tuneClock = setInterval(() => {
      if (silent) return;
      const b = bassNotes[beat % bassNotes.length];
      const l = leadNotes[beat % leadNotes.length];
      if (b) playNote(b, 0.22, 'triangle', 0.5);
      if (l && beat % 2 === 0) playNote(l, 0.2, 'square', 0.16);
      if (beat % 4 === 2) playNote(1200, 0.03, 'square', 0.05);
      beat += 1;
    }, 170);
  }
  return {
    start() {
      if (setup() && ac.state === 'suspended') ac.resume();
      startTune();
    },
    flipMute() {
      silent = !silent;
      if (mainBus) mainBus.gain.value = silent ? 0 : 0.5;
      return silent;
    },
    get silent() { return silent; },
    gunshot() {
      blip(900, 0.09, 'square', 0.25, 0, 120);
      blip(180, 0.06, 'sawtooth', 0.18, 0, 60);
    },
    thump() { blip(160, 0.08, 'sine', 0.3, 0, 70); },
    collect() {
      blip(660, 0.09, 'sine', 0.25);
      blip(990, 0.14, 'sine', 0.25, 0.08);
    },
    smash() {
      blip(120, 0.25, 'sawtooth', 0.35, 0, 40);
      blip(70, 0.2, 'square', 0.2, 0, 35);
    },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.18, 'triangle', 0.3, i * 0.11)); },
    caught() { [392, 370, 349, 311].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.22, i * 0.22)); },
    alarm(on) {
      if (alarmGain && ac) alarmGain.gain.setTargetAtTime(on && !silent ? 0.035 : 0, ac.currentTime, 0.2);
      if (alarmOsc && ac && on) alarmOsc.frequency.setTargetAtTime(750 + 250 * Math.sin(Date.now() / 350), ac.currentTime, 0.1);
    },
    motor(speed01) {
      if (motorGain && ac) {
        motorGain.gain.setTargetAtTime(silent ? 0 : speed01 * 0.05, ac.currentTime, 0.1);
        motorOsc.frequency.setTargetAtTime(50 + speed01 * 140, ac.currentTime, 0.1);
      }
    },
  };
}
