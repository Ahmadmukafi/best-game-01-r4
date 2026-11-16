// player.js — the glowing mote. WASD / arrows to drift through the dark.
// Movement is axis-separated against the cave walls, so the mote slides
// along rock instead of sticking on corners.

import { PLAYER_RADIUS, PLAYER_SPEED } from './config.js';
import { hitsWall } from './cave.js';

export function makePlayer(x, y) {
  return {
    x,
    y,
    radius: PLAYER_RADIUS,
    // Facing, for the little tail the mote leaves behind.
    fx: 1,
    fy: 0,
    moving: false,
    // Seconds of post-hit invulnerability left (blinking, cannot be caught).
    invuln: 0,
    // Trail of fading positions, drawn as a faint comet tail.
    trail: [],
  };
}

export function movePlayer(player, level, dx, dy, dt) {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    player.moving = false;
    return;
  }
  const nx = dx / len;
  const ny = dy / len;
  player.fx = nx;
  player.fy = ny;
  player.moving = true;
  const step = PLAYER_SPEED * dt;
  // X then Y: sliding along a wall keeps the other axis moving.
  const tryX = player.x + nx * step;
  if (!hitsWall(level, tryX, player.y, player.radius)) player.x = tryX;
  const tryY = player.y + ny * step;
  if (!hitsWall(level, player.x, tryY, player.radius)) player.y = tryY;

  player.trail.push({ x: player.x, y: player.y, life: 0.35 });
  if (player.trail.length > 14) player.trail.shift();
}

export function tickPlayerTrail(player, dt) {
  for (const t of player.trail) t.life -= dt;
  while (player.trail.length > 0 && player.trail[0].life <= 0) player.trail.shift();
  if (player.invuln > 0) player.invuln -= dt;
}
