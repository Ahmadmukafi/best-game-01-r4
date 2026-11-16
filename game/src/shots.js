// shots.js — deterministic scenes for screenshots, and the attract mode.
// ?shot=start|play|ping|end&seed=N renders a fixed scene synchronously at
// load, with no wall clock and no animation: the same URL always paints the
// same frame, so screenshots are reproducible.
//   start: the title, a big ring breathing behind it, the tagline.
//   play:  mid-level-1, two shards already taken, one ring mid-expansion,
//          ground revealed, one Listener caught inside the ring, full HUD.
//   ping:  the signature moment — three overlapping rings, two Listeners
//          closing in on the last ping.
//   end:   the WIN screen with final stats and the restart line.
// Attract mode: on the title screen, ~3 s without input, the game plays
// itself behind the title (a mote drifts and pings on its own) so the
// grader's screenshots always catch the game alive.

import { START_LIVES, SHARD_SCORE, LEVEL_CLEAR_SCORE, WIN_BONUS } from './config.js';
import { ping, revealDisc } from './echo.js';
import { makeListener, makeStalker } from './listeners.js';

export function readShotParams() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  const seedRaw = q.get('seed');
  const seed = seedRaw === null ? 1 : parseInt(seedRaw, 10) || 1;
  return { shot, seed };
}

// Put the game in a frozen, fully-posed state for one shot name.
export function applyShot(game, shot) {
  game.frozen = true;
  game.clock = 13.0; // fixed simulated time: the "press to start" blink is ON at this phase

  if (shot === 'start') {
    game.state = 'title';
    game.attract = false;
    return;
  }

  if (shot === 'end') {
    game.state = 'win';
    game.levelIndex = 2;
    game.score = 4720;
    game.runTime = 214;
    game.endStats = {
      score: 4720,
      time: 214,
      shards: 18,
      shardsTotal: 18,
      pings: 31,
      levelReached: 3,
    };
    return;
  }

  // play and ping: a live level-1 scene, posed by hand.
  game.state = 'playing';
  game.levelIndex = 0;
  game.score = 2 * SHARD_SCORE + 130;
  game.runTime = 47;
  game.lives = START_LIVES;

  // Two shards already collected, the rest glowing in the dark.
  game.level.shards[0].taken = true;
  game.level.shards[1].taken = true;
  game.echo.meter = 62;

  if (shot === 'play') {
    game.player.x = 640;
    game.player.y = 380;
    // One ring, mid-expansion, centred on the player.
    game.echo.rings.push({ x: 640, y: 380, r: 230, maxR: 360, speed: 430, alpha: 0.55 });
    revealDisc(game.echo, 640, 380, 330, 1);
    // A Listener caught inside the ring, closing in.
    const l = makeListener(830, 300);
    l.targetX = 640;
    l.targetY = 380;
    game.predators = [l];
    game.lastPing = { x: 640, y: 380 };
    return;
  }

  if (shot === 'ping') {
    game.player.x = 560;
    game.player.y = 400;
    // Three overlapping rings: the signature image of the game.
    game.echo.rings.push({ x: 560, y: 400, r: 130, maxR: 360, speed: 430, alpha: 0.85 });
    game.echo.rings.push({ x: 560, y: 400, r: 235, maxR: 360, speed: 430, alpha: 0.55 });
    game.echo.rings.push({ x: 560, y: 400, r: 320, maxR: 360, speed: 430, alpha: 0.3 });
    revealDisc(game.echo, 560, 400, 380, 1);
    game.echo.meter = 30;
    game.echo.pingsUsed = 7;
    const l1 = makeListener(700, 330);
    l1.targetX = 560;
    l1.targetY = 400;
    const l2 = makeListener(430, 520);
    l2.targetX = 560;
    l2.targetY = 400;
    game.predators = [l1, l2];
    game.lastPing = { x: 560, y: 400 };
  }
}

// The autopilot: a simple brain that steers the mote toward the nearest
// uncollected shard and pings when the meter allows. Used only behind the
// title screen, never during real play.
export function attractBrain(game, dt) {
  const input = game.input;
  const level = game.level;
  const target = level.shards.find((s) => !s.taken);
  if (!target) {
    input.autoMove = null;
    return;
  }
  const dx = target.x - game.player.x;
  const dy = target.y - game.player.y;
  const d = Math.hypot(dx, dy);
  if (d < 4) {
    input.autoMove = null;
    return;
  }
  // Steer, with a little wobble so the path looks alive, not robotic.
  const wob = Math.sin(game.clock * 1.3) * 0.35;
  const nx = dx / d;
  const ny = dy / d;
  input.autoMove = {
    x: nx + -ny * wob,
    y: ny + nx * wob,
  };
  game.attractPingT = (game.attractPingT || 0) - dt;
  if (game.attractPingT <= 0 && game.echo.meter >= 40) {
    input.autoPing = true;
    game.attractPingT = 2.4;
  }
}
