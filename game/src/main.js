// main.js — bootstrap and the game loop.
// The loop is a fixed-clamp frame step: update with real delta time (capped
// so a tab switch never teleports the mote), then render. In ?shot= mode
// the scene is posed synchronously at load and the loop only renders it,
// frozen, so the screenshot is deterministic.

import { VIEW_W, VIEW_H } from './config.js';
import { makeGame, update, loadLevel } from './game.js';
import { render } from './render.js';
import { readShotParams, applyShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const { shot, seed } = readShotParams();
const game = makeGame(canvas, seed);
// Debug/testing handle: lets a playtest script read and drive the game
// state (position, shards, lives) from the console. Harmless in play.
window.__game = game;

if (shot) {
  if (shot === 'end') loadLevel(game, 2);
  applyShot(game, shot);
  // One synchronous render right now: the shot must be fully painted
  // before any screenshot, without waiting for animation frames.
  render(ctx, game);
  window.__shotReady = true;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!game.frozen) {
    game.clock += dt;
    update(game, dt);
  }
  render(ctx, game);
  if (!window.__shotReady) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
