// cave.js — builds one level of the cave from a seeded RNG.
// A level is a tile grid (0 = open, 1 = wall) plus the things in it:
// player spawn, resonance shards, the exit, glowing mushrooms, predator dens.
// Generation guarantees connectivity: every shard and the exit sit on ground
// the player can actually reach from the spawn.

import { COLS, ROWS, TILE, LEVELS } from './config.js';
import { int, range, shuffle } from './random.js';

function idx(x, y) {
  return y * COLS + x;
}

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

// Carve a solid ellipse of wall tiles into the grid.
function paintBlob(grid, rng, cx, cy, rx, ry) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      if (!inBounds(x, y)) continue;
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) grid[idx(x, y)] = 1;
    }
  }
}

// A vertical bar with a gap somewhere: the corridor walls of the deeper levels.
function paintBar(grid, rng, x, gapY, gapH) {
  for (let y = 1; y < ROWS - 1; y++) {
    if (y >= gapY && y < gapY + gapH) continue;
    grid[idx(x, y)] = 1;
  }
}

// Flood fill from (sx, sy) over open tiles. Returns a Set of reachable indices.
function flood(grid, sx, sy) {
  const seen = new Set();
  const stack = [idx(sx, sy)];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (seen.has(cur) || grid[cur] === 1) continue;
    seen.add(cur);
    const x = cur % COLS;
    const y = Math.floor(cur / COLS);
    if (x > 0) stack.push(cur - 1);
    if (x < COLS - 1) stack.push(cur + 1);
    if (y > 0) stack.push(cur - COLS);
    if (y < ROWS - 1) stack.push(cur + COLS);
  }
  return seen;
}

function tileCenter(x, y) {
  return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 };
}

// Manhattan distance in tiles between two grid cells.
function tileDist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function buildLevel(levelIndex, rng) {
  const def = LEVELS[levelIndex];
  const grid = new Uint8Array(COLS * ROWS); // all open

  // The cave mouth: a solid border, the player always spawns inside it.
  for (let x = 0; x < COLS; x++) {
    grid[idx(x, 0)] = 1;
    grid[idx(x, ROWS - 1)] = 1;
  }
  for (let y = 0; y < ROWS; y++) {
    grid[idx(0, y)] = 1;
    grid[idx(COLS - 1, y)] = 1;
  }

  // Scatter rock blobs.
  for (let i = 0; i < def.blobs; i++) {
    paintBlob(
      grid,
      rng,
      range(rng, 3, COLS - 3),
      range(rng, 3, ROWS - 3),
      range(rng, def.blobMinR, def.blobMaxR),
      range(rng, def.blobMinR, def.blobMaxR),
    );
  }

  // Corridor bars on the deeper levels, each with a gap to pass through.
  for (let i = 0; i < def.bars; i++) {
    const x = int(rng, 4, COLS - 4);
    const gapY = int(rng, 2, ROWS - 5);
    paintBar(grid, rng, x, gapY, int(rng, 2, 4));
  }

  // Spawn: top-left open pocket.
  let spawn = { x: 2, y: 2 };
  outer: for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (grid[idx(x, y)] === 0) {
        spawn = { x, y };
        break outer;
      }
    }
  }

  // Anything the flood cannot reach becomes solid rock: the cave stays honest.
  const reachable = flood(grid, spawn.x, spawn.y);
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] === 0 && !reachable.has(i)) grid[i] = 1;
  }

  // Candidate floor tiles, shuffled, for placing things far from the spawn.
  const floor = [];
  for (const i of reachable) floor.push(i);
  const shuffled = shuffle(rng, floor);
  const farTiles = shuffled.filter((i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    return tileDist(x, y, spawn.x, spawn.y) >= 8;
  });
  const nearTiles = shuffled.filter((i) => {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    return tileDist(x, y, spawn.x, spawn.y) >= 4;
  });
  const pool = farTiles.length >= def.shards + 2 ? farTiles : nearTiles;

  // The exit goes on the farthest reachable tile from the spawn.
  let exitTile = pool[0];
  let bestDist = -1;
  for (const i of reachable) {
    const x = i % COLS;
    const y = Math.floor(i / COLS);
    const d = tileDist(x, y, spawn.x, spawn.y);
    if (d > bestDist) {
      bestDist = d;
      exitTile = i;
    }
  }

  // Shards: spread across the reachable floor, never on the exit tile.
  const shards = [];
  const used = new Set([exitTile, idx(spawn.x, spawn.y)]);
  for (const i of pool) {
    if (shards.length >= def.shards) break;
    if (used.has(i)) continue;
    // Keep shards a little apart so the player has to travel.
    let ok = true;
    for (const s of shards) {
      const sx = s.tile % COLS;
      const sy = Math.floor(s.tile / COLS);
      const x = i % COLS;
      const y = Math.floor(i / COLS);
      if (tileDist(x, y, sx, sy) < 3) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    used.add(i);
    const c = tileCenter(i % COLS, Math.floor(i / COLS));
    shards.push({ tile: i, x: c.x, y: c.y, taken: false, phase: rng() * Math.PI * 2 });
  }
  // Fallback: if spacing rules starved the count, fill from any reachable tile.
  if (shards.length < def.shards) {
    for (const i of shuffled) {
      if (shards.length >= def.shards) break;
      if (used.has(i)) continue;
      used.add(i);
      const c = tileCenter(i % COLS, Math.floor(i / COLS));
      shards.push({ tile: i, x: c.x, y: c.y, taken: false, phase: rng() * Math.PI * 2 });
    }
  }

  // Mushrooms: permanent faint lights, so the screen is never pure black.
  const mushrooms = [];
  for (const i of shuffled) {
    if (mushrooms.length >= def.mushrooms) break;
    if (used.has(i)) continue;
    used.add(i);
    const c = tileCenter(i % COLS, Math.floor(i / COLS));
    mushrooms.push({
      x: c.x + range(rng, -10, 10),
      y: c.y + range(rng, -10, 10),
      r: range(rng, 2, 4.5),
      phase: rng() * Math.PI * 2,
    });
  }

  // Predator dens: far from the spawn, on reachable floor.
  const dens = [];
  for (const i of pool) {
    if (dens.length >= def.listeners + def.stalkers) break;
    if (used.has(i)) continue;
    used.add(i);
    const c = tileCenter(i % COLS, Math.floor(i / COLS));
    dens.push({ x: c.x, y: c.y });
  }
  let cursor = dens.length;
  while (dens.length < def.listeners + def.stalkers) {
    const i = shuffled[cursor++ % shuffled.length];
    if (used.has(i)) continue;
    used.add(i);
    const c = tileCenter(i % COLS, Math.floor(i / COLS));
    dens.push({ x: c.x, y: c.y });
  }

  const exitC = tileCenter(exitTile % COLS, Math.floor(exitTile / COLS));
  const spawnC = tileCenter(spawn.x, spawn.y);

  return {
    def,
    index: levelIndex,
    grid,
    spawn: spawnC,
    exit: { x: exitC.x, y: exitC.y, open: false },
    shards,
    mushrooms,
    dens,
    // Per-tile rock shading, fixed at build time so walls look hand-drawn.
    shade: (() => {
      const s = new Float32Array(COLS * ROWS);
      for (let i = 0; i < s.length; i++) s[i] = 0.55 + rng() * 0.45;
      return s;
    })(),
  };
}

// True when the circle at (x, y) with radius r overlaps a wall tile.
export function hitsWall(level, x, y, r) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
      if (level.grid[idx(tx, ty)] === 1) {
        // Closest point of the tile to the circle centre.
        const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
        const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      }
    }
  }
  return false;
}
