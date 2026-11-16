// game.js — the state machine: title -> playing -> win / lose, with pause.
// It owns the run (score, lives, time, level) and wires the pieces together:
// input moves the mote, echo spends meter, listeners hunt, shards open the
// exit, the exit opens the next level. Three levels, then the light.

import {
  VIEW_W,
  VIEW_H,
  START_LIVES,
  SHARD_DIST,
  EXIT_DIST,
  SHARD_SCORE,
  LEVEL_CLEAR_SCORE,
  WIN_BONUS,
  INVULN_SECONDS,
  LEVELS,
} from './config.js';
import { mulberry32 } from './random.js';
import { buildLevel } from './cave.js';
import { makePlayer, movePlayer, tickPlayerTrail } from './player.js';
import { makeEcho, canPing, ping, tickEcho } from './echo.js';
import { makeListener, makeStalker, tickListener, tickStalker, anyCatch, nearestPredatorDist } from './listeners.js';
import { makeAudio, unlockAudio, toggleMute, playPing, playShard, playHurt, playClear, playWin, playLose, tickHeartbeat } from './audio.js';
import { makeInput, bindInput, moveVector } from './input.js';
import { attractBrain } from './shots.js';

export function makeGame(canvas, seed) {
  const rng = mulberry32(seed);
  const game = {
    seed,
    rng,
    canvas,
    state: 'title', // title | playing | paused | win | lose
    clock: 0, // visual time, drives pulses and twinkles
    runTime: 0,
    levelTime: 0,
    levelIndex: 0,
    score: 0,
    lives: START_LIVES,
    livesMax: START_LIVES,
    lastPing: null,
    banner: null,
    bannerSub: null,
    bannerT: 0,
    bannerDur: 2.4,
    endStats: null,
    shardsCollectedTotal: 0,
    totalPings: 0,
    frozen: false, // shot mode: no updates, no wall clock
    attract: false,
    attractPingT: 0,
    input: makeInput(),
    audio: makeAudio(),
    level: null,
    player: null,
    echo: makeEcho(),
    predators: [],
  };
  bindInput(game.input, canvas, () => unlockAudio(game.audio));
  loadLevel(game, 0);
  return game;
}

export function loadLevel(game, index) {
  game.levelIndex = index;
  game.level = buildLevel(index, game.rng);
  game.levelTime = 0;
  game.player = makePlayer(game.level.spawn.x, game.level.spawn.y);
  game.echo = makeEcho();
  game.predators = [];
  const def = LEVELS[index];
  for (let i = 0; i < def.listeners; i++) {
    const d = game.level.dens[i];
    game.predators.push(makeListener(d.x, d.y));
  }
  for (let i = 0; i < def.stalkers; i++) {
    const d = game.level.dens[def.listeners + i];
    game.predators.push(makeStalker(d.x, d.y));
  }
  game.lastPing = null;
}

function showBanner(game, text, sub) {
  game.banner = text;
  game.bannerSub = sub || null;
  game.bannerT = 0;
}

export function startRun(game) {
  game.score = 0;
  game.lives = START_LIVES;
  game.runTime = 0;
  game.endStats = null;
  game.attract = false;
  game.input.autoMove = null;
  game.input.autoPing = false;
  game.input.clearPressed();
  loadLevel(game, 0);
  game.state = 'playing';
  showBanner(game, game.level.def.name, game.level.def.subtitle);
}

function finishRun(game, won) {
  const shardsTotal = LEVELS.reduce((n, l) => n + l.shards, 0);
  const currentTaken = game.level ? game.level.shards.filter((s) => s.taken).length : 0;
  // On a win every level was cleared, so the total is exact; on a loss the
  // current level's taken shards count too, not just finished levels.
  const shardsGot = won ? shardsTotal : game.shardsCollectedTotal + currentTaken;
  game.endStats = {
    score: game.score,
    time: game.runTime,
    shards: shardsGot,
    shardsTotal,
    pings: game.echo.pingsUsed + game.totalPings,
    levelReached: won ? 3 : game.levelIndex + 1,
  };
  game.state = won ? 'win' : 'lose';
  game.input.clearPressed();
  if (won) playWin(game.audio);
  else playLose(game.audio);
}

function levelClear(game) {
  const timeBonus = Math.max(0, 240 - Math.floor(game.levelTime) * 4);
  game.score += LEVEL_CLEAR_SCORE + timeBonus;
  game.totalPings = (game.totalPings || 0) + game.echo.pingsUsed;
  game.shardsCollectedTotal = (game.shardsCollectedTotal || 0) + game.level.shards.length;
  if (game.levelIndex + 1 >= LEVELS.length) {
    game.score += WIN_BONUS;
    finishRun(game, true);
    return;
  }
  playClear(game.audio);
  loadLevel(game, game.levelIndex + 1);
  showBanner(game, game.level.def.name, game.level.def.subtitle);
}

function onCaught(game, predator) {
  game.lives--;
  playHurt(game.audio);
  if (game.lives <= 0) {
    finishRun(game, false);
    return;
  }
  // Knockback: shove the mote away from the predator, then give it a
  // few seconds of blinking invulnerability to get away.
  game.player.invuln = INVULN_SECONDS;
  const dx = game.player.x - predator.x;
  const dy = game.player.y - predator.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  for (let step = 0; step < 6; step++) {
    const tx = game.player.x + nx * 14;
    const ty = game.player.y + ny * 14;
    if (tx < 20 || tx > VIEW_W - 20 || ty < 20 || ty > VIEW_H - 20) break;
    game.player.x = tx;
    game.player.y = ty;
  }
  // The predator that caught you slinks back to its den.
  const den = game.level.dens[game.predators.indexOf(predator) % game.level.dens.length];
  predator.x = den.x;
  predator.y = den.y;
  if (predator.kind === 'listener') {
    predator.targetX = null;
    predator.targetY = null;
  }
  showBanner(game, 'TERTANGKAP!', `${game.lives} nyawa tersisa`);
}

function tickPlaying(game, dt) {
  const input = game.input;
  game.runTime += dt;
  game.levelTime += dt;

  // Movement.
  const mv = moveVector(input);
  movePlayer(game.player, game.level, mv.x, mv.y, dt);
  tickPlayerTrail(game.player, dt);

  // Ping: Space, click, or the attract autopilot.
  const wantPing = input.pingPressed() || input.click !== null || input.autoPing;
  if (wantPing) {
    input.click = null;
    input.autoPing = false;
    if (canPing(game.echo)) {
      ping(game.echo, game.player.x, game.player.y);
      game.lastPing = { x: game.player.x, y: game.player.y };
      playPing(game.audio);
    }
  }

  tickEcho(game.echo, dt);

  // Predators.
  for (const p of game.predators) {
    if (p.kind === 'listener') tickListener(game.level, p, game.lastPing, game.player, dt, game.rng);
    else tickStalker(game.level, p, game.echo, game.player, dt);
  }

  // Shard pickup.
  for (const s of game.level.shards) {
    if (s.taken) continue;
    if (Math.hypot(s.x - game.player.x, s.y - game.player.y) < SHARD_DIST) {
      s.taken = true;
      game.score += SHARD_SCORE;
      playShard(game.audio);
    }
  }
  if (!game.level.exit.open && game.level.shards.every((s) => s.taken)) {
    game.level.exit.open = true;
    playClear(game.audio);
    showBanner(game, 'EXIT TERBUKA', 'Ikuti cahaya hijau — keluar dari gua ini');
  }

  // Exit.
  if (game.level.exit.open) {
    const d = Math.hypot(game.level.exit.x - game.player.x, game.level.exit.y - game.player.y);
    if (d < EXIT_DIST) {
      levelClear(game);
      return;
    }
  }

  // Caught?
  if (game.player.invuln <= 0) {
    const catcher = anyCatch(game.predators, game.player);
    if (catcher) onCaught(game, catcher);
  }

  // The heartbeat quickens as anything closes in.
  tickHeartbeat(game.audio, nearestPredatorDist(game.predators, game.player), dt);

  if (game.banner) {
    game.bannerT += dt;
    if (game.bannerT >= game.bannerDur) {
      game.banner = null;
      game.bannerT = 0;
    }
  }
}

function tickTitle(game, dt) {
  // After ~3 s without input, the attract demo plays behind the title.
  if (!game.attract && performance.now() - game.input.lastActivity > 3000) {
    game.attract = true;
    loadLevel(game, 0);
  }
  if (game.attract) {
    attractBrain(game, dt);
    const mv = moveVector(game.input);
    movePlayer(game.player, game.level, mv.x, mv.y, dt);
    tickPlayerTrail(game.player, dt);
    if (game.input.autoPing) {
      game.input.autoPing = false;
      if (canPing(game.echo)) {
        ping(game.echo, game.player.x, game.player.y);
        game.lastPing = { x: game.player.x, y: game.player.y };
      }
    }
    tickEcho(game.echo, dt);
    for (const p of game.predators) {
      if (p.kind === 'listener') tickListener(game.level, p, game.lastPing, game.player, dt, game.rng);
      else tickStalker(game.level, p, game.echo, game.player, dt);
    }
    for (const s of game.level.shards) {
      if (!s.taken && Math.hypot(s.x - game.player.x, s.y - game.player.y) < SHARD_DIST) s.taken = true;
    }
    if (game.level.shards.every((s) => s.taken)) loadLevel(game, 0);
  }
}

export function update(game, dt) {
  // Global keys, in any state.
  if (game.input.mutePressed()) toggleMute(game.audio);
  if (game.state !== 'title' && game.input.restartPressed()) {
    startRun(game);
    return;
  }

  if (game.state === 'title') {
    // Any real input stops the attract demo.
    if (game.input.pressed.size > 0 || game.input.click) {
      game.attract = false;
      game.input.autoMove = null;
      game.input.autoPing = false;
      game.input.click = null;
    }
    if (game.input.startPressed()) {
      startRun(game);
      return;
    }
    tickTitle(game, dt);
    return;
  }

  if (game.state === 'paused') {
    if (game.input.pausePressed()) game.state = 'playing';
    return;
  }

  if (game.state === 'playing') {
    if (game.input.pausePressed()) {
      game.state = 'paused';
      game.input.clearPressed();
      return;
    }
    tickPlaying(game, dt);
    return;
  }

  // win / lose: R restarts (handled above), nothing else ticks.
}
