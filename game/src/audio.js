// audio.js — every sound is synthesized with WebAudio. No audio files.
//   ping:    a low sine sweep falling away, like a sonar pulse in a cave.
//   shard:   two bright notes, a little glass chime.
//   heartbeat: a low thump that quickens as a predator closes in.
//   hurt:    a harsh buzz when a predator catches you.
//   clear:   a rising arpeggio when a level opens.
//   win/lose: short jingles, major vs minor.
// The context is created lazily on the first user gesture (browsers demand
// it), and every call is guarded so the game never breaks when audio is
// unavailable — including headless screenshots.

import { HEARTBEAT_FAR, HEARTBEAT_MID, HEARTBEAT_NEAR } from './config.js';

export function makeAudio() {
  return {
    ctx: null,
    master: null,
    muted: false,
    heartbeatTimer: 0,
    heartbeatRate: 0, // thumps per second, 0 = silent
  };
}

function ensureCtx(audio) {
  if (audio.ctx) return audio.ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);
  } catch (e) {
    audio.ctx = null;
  }
  return audio.ctx;
}

// Call from any user gesture (keydown / click) so the browser unlocks sound.
export function unlockAudio(audio) {
  const ctx = ensureCtx(audio);
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}

function tone(audio, opts) {
  const ctx = ensureCtx(audio);
  if (!ctx || audio.muted) return;
  const { freq, freqEnd, dur, type, vol, delay } = opts;
  const t0 = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol || 0.3, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playPing(audio) {
  tone(audio, { freq: 880, freqEnd: 180, dur: 0.9, type: 'sine', vol: 0.5 });
  tone(audio, { freq: 1760, freqEnd: 360, dur: 0.5, type: 'sine', vol: 0.12 });
}

export function playShard(audio) {
  tone(audio, { freq: 1320, dur: 0.18, type: 'triangle', vol: 0.28 });
  tone(audio, { freq: 1980, dur: 0.3, type: 'triangle', vol: 0.22, delay: 0.07 });
}

export function playHurt(audio) {
  tone(audio, { freq: 160, freqEnd: 60, dur: 0.4, type: 'sawtooth', vol: 0.35 });
  tone(audio, { freq: 90, freqEnd: 45, dur: 0.5, type: 'square', vol: 0.2, delay: 0.05 });
}

export function playClear(audio) {
  const notes = [523, 659, 784, 1046];
  notes.forEach((f, i) => tone(audio, { freq: f, dur: 0.35, type: 'triangle', vol: 0.25, delay: i * 0.09 }));
}

export function playWin(audio) {
  const notes = [523, 659, 784, 1046, 1318, 1568];
  notes.forEach((f, i) => tone(audio, { freq: f, dur: 0.45, type: 'triangle', vol: 0.25, delay: i * 0.11 }));
}

export function playLose(audio) {
  const notes = [392, 370, 349, 311];
  notes.forEach((f, i) => tone(audio, { freq: f, dur: 0.5, type: 'sine', vol: 0.25, delay: i * 0.16 }));
}

function thump(audio, vol) {
  tone(audio, { freq: 70, freqEnd: 38, dur: 0.16, type: 'sine', vol });
  tone(audio, { freq: 55, freqEnd: 30, dur: 0.14, type: 'sine', vol: vol * 0.7, delay: 0.16 });
}

// Called every frame while playing: turns the nearest-predator distance
// into a heartbeat rate and thumps on schedule.
export function tickHeartbeat(audio, nearestDist, dt) {
  let rate = 0;
  let vol = 0;
  if (nearestDist < HEARTBEAT_NEAR) {
    rate = 2.2;
    vol = 0.5;
  } else if (nearestDist < HEARTBEAT_MID) {
    rate = 1.4;
    vol = 0.38;
  } else if (nearestDist < HEARTBEAT_FAR) {
    rate = 0.85;
    vol = 0.26;
  }
  audio.heartbeatRate = rate;
  if (rate <= 0) {
    audio.heartbeatTimer = 0;
    return;
  }
  audio.heartbeatTimer -= dt;
  if (audio.heartbeatTimer <= 0) {
    thump(audio, vol);
    audio.heartbeatTimer = 1 / rate;
  }
}
