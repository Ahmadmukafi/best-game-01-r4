// config.js — every tuning number for ECHODEEP lives here, in one place.
// The cave is a 32x18 grid of 40px tiles: exactly 1280x720, the screenshot size.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

// The player mote: faster than any predator, so escapes are always possible.
export const PLAYER_SPEED = 228;
export const PLAYER_RADIUS = 12;

// Predators: the Listener hunts your last ping, the Stalker hunts you in the dark.
export const LISTENER_SPEED = 148;
export const STALKER_SPEED = 132;
export const PREDATOR_RADIUS = 15;
export const CATCH_DIST = 26;

// Sonar: a ping is a resource. It costs meter, recharges slowly, and its ring
// is the only light you get — and the dinner bell for the Listeners.
export const PING_MAX = 100;
export const PING_COST = 35;
export const PING_RECHARGE = 14; // meter per second
export const PING_MAX_RADIUS = 360;
export const PING_SPEED = 430; // ring expansion, px per second
export const MAX_RINGS = 3;

// Echo memory: revealed ground fades back into black over a few seconds.
export const REVEAL_DECAY = 0.22; // reveal units per second (1.0 -> ~4.5 s)

// Pickups and the exit.
export const SHARD_DIST = 30;
export const EXIT_DIST = 36;
export const SHARD_SCORE = 100;
export const LEVEL_CLEAR_SCORE = 400;
export const WIN_BONUS = 1000;

export const START_LIVES = 3;
export const INVULN_SECONDS = 2.5;

// Heartbeat warning: the closer the nearest predator, the faster the thump.
export const HEARTBEAT_FAR = 340;
export const HEARTBEAT_MID = 220;
export const HEARTBEAT_NEAR = 130;

// One level definition per depth of the cave.
export const LEVELS = [
  {
    name: 'The Mouth',
    subtitle: 'Level 1 — the cave yawns open',
    shards: 4,
    listeners: 1,
    stalkers: 0,
    blobs: 7,
    blobMinR: 1,
    blobMaxR: 3,
    bars: 0,
    mushrooms: 14,
  },
  {
    name: 'The Throat',
    subtitle: 'Level 2 — narrow corridors, two voices listening',
    shards: 6,
    listeners: 2,
    stalkers: 1,
    blobs: 10,
    blobMinR: 1,
    blobMaxR: 3,
    bars: 5,
    mushrooms: 12,
  },
  {
    name: 'The Heart',
    subtitle: 'Level 3 — the maze at the centre of the dark',
    shards: 8,
    listeners: 3,
    stalkers: 2,
    blobs: 15,
    blobMinR: 2,
    blobMaxR: 4,
    bars: 8,
    mushrooms: 10,
  },
];

// Palette: black + cyan + amber + red, nothing else.
export const COLORS = {
  bg: '#04060a',
  wall: '#8fb4d4',
  wallDeep: '#3d5a75',
  ring: '#59e6ff',
  mote: '#c8f6ff',
  moteCore: '#ffffff',
  shard: '#ffb347',
  shardCore: '#ffe9b0',
  listener: '#ff4d5e',
  stalker: '#ff2e63',
  mushroom: '#37e0c8',
  exit: '#7dffb0',
  hud: '#cfe8ff',
  hudDim: '#6f8ba3',
  title: '#dff6ff',
};
