// All sound is synthesized with WebAudio — no audio files, no samples.
// Original chiptune loop (bass + lead + hats) plus SFX: gunshot, punch, pickup,
// engine hum, siren, crash, mission jingle, busted sting.
export function createAudio() {
  let ctx = null, master = null, musicGain = null, muted = false;
  let musicTimer = null, step = 0, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null;
  const bassLine = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 49, 0];
  const leadLine = [220, 261.6, 329.6, 261.6, 220, 0, 196, 246.9, 220, 261.6, 392, 329.6, 293.7, 261.6, 220, 0];
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
      sirenOsc = ctx.createOscillator(); sirenOsc.type = 'sine'; sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenOsc.connect(sirenGain); sirenGain.connect(master); sirenOsc.start();
      return true;
    } catch { return false; }
  }
  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function note(freq, dur, type, vol) {
    if (!ensure() || muted || !musicGain) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + dur);
  }
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = setInterval(() => {
      if (muted) return;
      const b = bassLine[step % bassLine.length];
      const l = leadLine[step % leadLine.length];
      if (b) note(b, 0.22, 'triangle', 0.5);
      if (l && step % 2 === 0) note(l, 0.2, 'square', 0.16);
      if (step % 4 === 2) note(1200, 0.03, 'square', 0.05);
      step += 1;
    }, 170);
  }
  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
    shoot() { tone(900, 0.09, 'square', 0.25, 0, 120); tone(180, 0.06, 'sawtooth', 0.18, 0, 60); },
    punch() { tone(160, 0.08, 'sine', 0.3, 0, 70); },
    pickup() { tone(660, 0.09, 'sine', 0.25); tone(990, 0.14, 'sine', 0.25, 0.08); },
    crash() { tone(120, 0.25, 'sawtooth', 0.35, 0, 40); tone(70, 0.2, 'square', 0.2, 0, 35); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.3, i * 0.11)); },
    busted() { [392, 370, 349, 311].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.22, i * 0.22)); },
    siren(on) { if (sirenGain && ctx) sirenGain.gain.setTargetAtTime(on && !muted ? 0.035 : 0, ctx.currentTime, 0.2);
      if (sirenOsc && ctx && on) sirenOsc.frequency.setTargetAtTime(750 + 250 * Math.sin(Date.now() / 350), ctx.currentTime, 0.1); },
    engine(speed01) { if (engineGain && ctx) { engineGain.gain.setTargetAtTime(muted ? 0 : speed01 * 0.05, ctx.currentTime, 0.1); engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.1); } },
  };
}
