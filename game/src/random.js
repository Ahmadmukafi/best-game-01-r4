// random.js — a tiny seeded RNG (mulberry32) written from scratch.
// Same seed -> same cave, same shards, same predators: the game is fully
// deterministic, which is what the ?shot= renders and the screenshots need.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helpers that all take the rng explicitly, so no hidden Math.random
// ever leaks into level generation.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function int(rng, min, max) {
  // Inclusive of min, exclusive of max.
  return min + Math.floor(rng() * (max - min));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
