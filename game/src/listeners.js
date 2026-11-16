// listeners.js — the two predators, and the tradeoff at the heart of ECHODEEP.
//   Listener: hears every ping and swims toward where it last sounded. It is
//             slower than you, so a ping far away buys you time — a ping close
//             by calls it down on you.
//   Stalker:  hunts you only in the dark. The instant a sonar ring touches it,
//             it freezes. Ping to freeze the Stalker, and you summon a Listener.
// Both are invisible in the dark: you only ever see them inside revealed ground.

import { LISTENER_SPEED, STALKER_SPEED, PREDATOR_RADIUS, CATCH_DIST } from './config.js';
import { hitsWall } from './cave.js';
import { revealAt } from './echo.js';

export function makeListener(x, y) {
  return {
    kind: 'listener',
    x,
    y,
    radius: PREDATOR_RADIUS,
    // Where the last ping sounded; null until the first ping.
    targetX: null,
    targetY: null,
    // Slow drift while it has nowhere to go.
    wanderA: 0,
    wanderT: 0,
    caught: false,
  };
}

export function makeStalker(x, y) {
  return {
    kind: 'stalker',
    x,
    y,
    radius: PREDATOR_RADIUS,
    frozen: false,
    // Eye glint phase, for the render.
    phase: Math.random() * Math.PI * 2,
    caught: false,
  };
}

// Step one body toward (tx, ty) at `speed`, sliding along walls.
function stepToward(level, body, tx, ty, speed, dt) {
  const dx = tx - body.x;
  const dy = ty - body.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const nx = dx / d;
  const ny = dy / d;
  const step = speed * dt;
  const tryX = body.x + nx * step;
  if (!hitsWall(level, tryX, body.y, body.radius)) body.x = tryX;
  const tryY = body.y + ny * step;
  if (!hitsWall(level, body.x, tryY, body.radius)) body.y = tryY;
}

export function tickListener(level, listener, lastPing, player, dt, rng) {
  if (lastPing) {
    listener.targetX = lastPing.x;
    listener.targetY = lastPing.y;
  }
  if (listener.targetX !== null) {
    const d = Math.hypot(listener.targetX - listener.x, listener.targetY - listener.y);
    if (d > 14) {
      stepToward(level, listener, listener.targetX, listener.targetY, LISTENER_SPEED, dt);
      return;
    }
  }
  // No ping to chase: drift slowly, listening.
  listener.wanderT -= dt;
  if (listener.wanderT <= 0) {
    listener.wanderA = rng() * Math.PI * 2;
    listener.wanderT = 1.5 + rng() * 2;
  }
  stepToward(
    level,
    listener,
    listener.x + Math.cos(listener.wanderA) * 60,
    listener.y + Math.sin(listener.wanderA) * 60,
    LISTENER_SPEED * 0.25,
    dt,
  );
}

export function tickStalker(level, stalker, echo, player, dt) {
  // Frozen while any ring is still expanding, or while the ground under it
  // is lit. The dark is its hunting ground.
  const lit = revealAt(echo, stalker.x, stalker.y) > 0.25;
  stalker.frozen = echo.rings.length > 0 || lit;
  if (stalker.frozen) return;
  stepToward(level, stalker, player.x, player.y, STALKER_SPEED, dt);
}

// True when any predator is touching the player.
export function anyCatch(predators, player) {
  for (const p of predators) {
    if (Math.hypot(p.x - player.x, p.y - player.y) < CATCH_DIST + p.radius * 0.4) return p;
  }
  return null;
}

// How far is the nearest predator? Drives the heartbeat in audio.js.
export function nearestPredatorDist(predators, player) {
  let best = Infinity;
  for (const p of predators) {
    best = Math.min(best, Math.hypot(p.x - player.x, p.y - player.y));
  }
  return best;
}
