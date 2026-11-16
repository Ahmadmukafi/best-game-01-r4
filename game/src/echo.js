// echo.js — the sonar. A ping spends echo meter and throws an expanding
// ring out from the player. Everything the ring passes over is revealed,
// then fades back into black over a few seconds ("echo memory").
// The ring is also the dinner bell: see listeners.js.

import {
  COLS,
  ROWS,
  TILE,
  PING_MAX,
  PING_COST,
  PING_RECHARGE,
  PING_MAX_RADIUS,
  PING_SPEED,
  MAX_RINGS,
  REVEAL_DECAY,
} from './config.js';

export function makeEcho() {
  return {
    meter: PING_MAX,
    rings: [], // {x, y, r, maxR, speed, alpha}
    // Per-tile reveal, 0 (black) to 1 (fully lit). Decays slowly.
    reveal: new Float32Array(COLS * ROWS),
    pingsUsed: 0,
  };
}

export function canPing(echo) {
  return echo.meter >= PING_COST && echo.rings.length < MAX_RINGS;
}

export function ping(echo, x, y) {
  if (!canPing(echo)) return false;
  echo.meter -= PING_COST;
  echo.pingsUsed++;
  echo.rings.push({ x, y, r: 12, maxR: PING_MAX_RADIUS, speed: PING_SPEED, alpha: 1 });
  return true;
}

// Reveal every tile whose centre the ring has passed. A tile lights the
// moment the ring crosses it, and stays lit while the ring is near.
function revealUnderRing(echo, ring) {
  const rTiles = Math.ceil(ring.r / TILE) + 1;
  const cx = Math.floor(ring.x / TILE);
  const cy = Math.floor(ring.y / TILE);
  for (let ty = cy - rTiles; ty <= cy + rTiles; ty++) {
    for (let tx = cx - rTiles; tx <= cx + rTiles; tx++) {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      const d = Math.hypot(px - ring.x, py - ring.y);
      if (d <= ring.r) {
        const i = ty * COLS + tx;
        // The ring's edge is brightest; the interior keeps a strong glow.
        const edge = 1 - Math.max(0, ring.r - d) / 90;
        echo.reveal[i] = Math.max(echo.reveal[i], Math.min(1, 0.55 + 0.45 * edge));
      }
    }
  }
}

export function tickEcho(echo, dt) {
  echo.meter = Math.min(PING_MAX, echo.meter + PING_RECHARGE * dt);
  for (let i = echo.rings.length - 1; i >= 0; i--) {
    const ring = echo.rings[i];
    ring.r += ring.speed * dt;
    ring.alpha = Math.max(0, 1 - ring.r / ring.maxR);
    revealUnderRing(echo, ring);
    if (ring.r >= ring.maxR) echo.rings.splice(i, 1);
  }
  for (let i = 0; i < echo.reveal.length; i++) {
    if (echo.reveal[i] > 0) {
      echo.reveal[i] = Math.max(0, echo.reveal[i] - REVEAL_DECAY * dt);
    }
  }
}

// How lit is the ground at a point? Predators show only where it is lit.
export function revealAt(echo, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return 0;
  return echo.reveal[ty * COLS + tx];
}

// Instantly light a disc (used by the deterministic ?shot= scenes).
export function revealDisc(echo, x, y, radius, strength) {
  const rTiles = Math.ceil(radius / TILE) + 1;
  const cx = Math.floor(x / TILE);
  const cy = Math.floor(y / TILE);
  for (let ty = cy - rTiles; ty <= cy + rTiles; ty++) {
    for (let tx = cx - rTiles; tx <= cx + rTiles; tx++) {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) continue;
      const px = tx * TILE + TILE / 2;
      const py = ty * TILE + TILE / 2;
      const d = Math.hypot(px - x, py - y);
      if (d <= radius) {
        const i = ty * COLS + tx;
        echo.reveal[i] = Math.max(echo.reveal[i], strength * (1 - (d / radius) * 0.45));
      }
    }
  }
}
