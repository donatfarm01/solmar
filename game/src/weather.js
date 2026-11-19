// Solmar sky: a slow weather wheel that rolls clear mornings into grey
// afternoons and then rain, and clears again after the storm passes.
// It runs on its own seeded chance stream, so the same drive always
// meets the same storm at the same minute, and a fresh save starts
// under the same blue sky every time.
const SKY_CLEAR = 0;
const SKY_GREY = 1;
const SKY_RAIN = 2;
const SKY_DRIZZLE = 3;

const DROP_COUNT = 120;

export function skyName(mode) {
  if (mode === SKY_RAIN) return 'Rain';
  if (mode === SKY_DRIZZLE) return 'Drizzle';
  if (mode === SKY_GREY) return 'Overcast';
  return 'Clear';
}

export function makeWeather(rng) {
  const drops = [];
  let drop = 0;
  while (drop < DROP_COUNT) {
    drops.push({
      fx: rng(),
      fy: rng(),
      fl: 0.02 + rng() * 0.03,
      fs: 0.9 + rng() * 0.6,
      sl: -0.05 + rng() * 0.1,
    });
    drop += 1;
  }
  const sky = {
    mode: SKY_CLEAR,
    timer: 55 + rng() * 35,
    wet: 0,
    gust: 0.01,
    flash: 0,
    rainTime: 0,
    storms: 0,
    boltIn: 6 + rng() * 8,
    drops,
    grip() {
      return 1 - 0.18 * sky.wet;
    },
    describe() {
      if (sky.mode === SKY_RAIN) return 'Rain hammering the streets';
      if (sky.mode === SKY_DRIZZLE) return 'Light drizzle on the rooftops';
      if (sky.mode === SKY_GREY) return 'Grey clouds gathering';
      return 'Clear skies over Solmar';
    },
    forecast() {
      if (sky.mode === SKY_CLEAR) return { mode: SKY_GREY, seconds: sky.timer };
      if (sky.mode === SKY_GREY) return { mode: SKY_DRIZZLE, seconds: sky.timer };
      if (sky.mode === SKY_DRIZZLE) return { mode: SKY_RAIN, seconds: sky.timer };
      return { mode: SKY_CLEAR, seconds: sky.timer };
    },
    tip() {
      if (sky.mode === SKY_RAIN) return 'Wet roads — braking distances grow';
      if (sky.mode === SKY_DRIZZLE) return 'Drizzle on the rooftops, grip is fading';
      if (sky.mode === SKY_GREY) return 'Grey skies — rain is on its way';
      return 'Clear skies — full grip, full speed';
    },
    force(next) {
      sky.mode = next;
      sky.flash = 0;
      sky.boltIn = 6 + rng() * 8;
      if (next === SKY_RAIN) {
        sky.timer = 25 + rng() * 20;
        sky.wet = 1;
        sky.gust = 0.08;
        for (const d of sky.drops) d.fy = rng();
      } else if (next === SKY_DRIZZLE) {
        sky.timer = 20 + rng() * 15;
        sky.wet = 0.6;
        sky.gust = 0.05;
      } else if (next === SKY_GREY) {
        sky.timer = 30 + rng() * 20;
        sky.wet = 0.35;
        sky.gust = 0.03;
      } else {
        sky.timer = 55 + rng() * 35;
        sky.wet = 0;
        sky.gust = 0.01;
      }
    },
    advance(dt) {
      sky.timer -= dt;
      if (sky.timer <= 0) {
        if (sky.mode === SKY_CLEAR) {
          sky.mode = SKY_GREY;
          sky.timer = 30 + rng() * 20;
        } else if (sky.mode === SKY_GREY) {
          sky.mode = SKY_DRIZZLE;
          sky.timer = 20 + rng() * 15;
        } else if (sky.mode === SKY_DRIZZLE) {
          sky.mode = SKY_RAIN;
          sky.timer = 25 + rng() * 20;
        } else {
          sky.mode = SKY_CLEAR;
          sky.timer = 55 + rng() * 35;
          sky.storms += 1;
        }
      }
      const wantWet = sky.mode === SKY_RAIN ? 1 : sky.mode === SKY_DRIZZLE ? 0.6 : sky.mode === SKY_GREY ? 0.35 : 0;
      const wantGust = sky.mode === SKY_RAIN ? 0.08 : sky.mode === SKY_DRIZZLE ? 0.05 : sky.mode === SKY_GREY ? 0.03 : 0.01;
      const step = 0.6 * dt;
      if (sky.wet + step < wantWet) sky.wet += step;
      else if (sky.wet - step > wantWet) sky.wet -= step;
      else sky.wet = wantWet;
      const gstep = 0.05 * dt;
      if (sky.gust + gstep < wantGust) sky.gust += gstep;
      else if (sky.gust - gstep > wantGust) sky.gust -= gstep;
      else sky.gust = wantGust;
      if (sky.wet > 0.02) {
        for (const d of sky.drops) {
          d.fy += d.fs * dt * (0.35 + 0.65 * sky.wet);
          d.fx += (d.sl + sky.gust) * dt;
          if (d.fy > 1.05) {
            d.fy = -0.05;
            d.fx = rng();
          }
          if (d.fx > 1.05) d.fx -= 1.1;
          else if (d.fx < -0.05) d.fx += 1.1;
        }
      }
      if (sky.mode === SKY_RAIN) {
        sky.rainTime += dt;
        sky.boltIn -= dt;
        if (sky.boltIn <= 0) {
          sky.flash = 1;
          sky.boltIn = 4 + rng() * 9;
        }
      }
      if (sky.flash > 0) {
        sky.flash -= 2.2 * dt;
        if (sky.flash < 0) sky.flash = 0;
      }
    },
  };
  return sky;
}
