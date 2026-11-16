// render.js — everything the eye sees, drawn on one canvas.
// The cave is almost totally black. Light comes only from: sonar rings,
// the echo memory of ground a ring already passed, the player's own glow,
// mushrooms, shards and the exit. Predators are red silhouettes that exist
// only inside the light — in the dark, only the heartbeat warns you.

import { VIEW_W, VIEW_H, TILE, COLS, ROWS, COLORS, PING_MAX } from './config.js';
import { revealAt } from './echo.js';

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// Mix two #rrggbb colours by t (0 = a, 1 = b).
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g = Math.round(((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t);
  const bl = Math.round((pa & 255) + ((pb & 255) - (pa & 255)) * t);
  return `rgb(${r},${g},${bl})`;
}

function drawWalls(ctx, game) {
  const { level, echo } = game;
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const i = ty * COLS + tx;
      if (level.grid[i] !== 1) continue;
      const rev = echo.reveal[i];
      if (rev < 0.02) continue;
      const shade = level.shade[i];
      const bright = rev * (0.35 + 0.65 * shade);
      ctx.fillStyle = mix(COLORS.bg, COLORS.wall, bright);
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      // One speck of lighter rock per tile, placed by the fixed shade.
      if (rev > 0.25) {
        ctx.fillStyle = mix(COLORS.bg, COLORS.wallDeep, rev * shade);
        const sx = tx * TILE + 8 + shade * 20;
        const sy = ty * TILE + 10 + (1 - shade) * 18;
        ctx.fillRect(sx, sy, 5, 4);
      }
    }
  }
}

function drawMushrooms(ctx, game) {
  const t = game.clock;
  for (const m of game.level.mushrooms) {
    const pulse = 0.55 + 0.35 * Math.sin(t * 1.6 + m.phase);
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 26);
    glow.addColorStop(0, `rgba(55,224,200,${0.28 * pulse})`);
    glow.addColorStop(1, 'rgba(55,224,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(m.x - 26, m.y - 26, 52, 52);
    ctx.fillStyle = `rgba(120,255,230,${0.75 * pulse})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, game) {
  const { exit } = game.level;
  const rev = revealAt(game.echo, exit.x, exit.y);
  if (rev < 0.05 && !exit.open) return;
  const t = game.clock;
  const pulse = exit.open ? 0.75 + 0.25 * Math.sin(t * 3) : 0.3;
  const alpha = exit.open ? 1 : rev;
  const glow = ctx.createRadialGradient(exit.x, exit.y, 0, exit.x, exit.y, 64);
  glow.addColorStop(0, `rgba(125,255,176,${0.5 * pulse * alpha})`);
  glow.addColorStop(1, 'rgba(125,255,176,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(exit.x - 64, exit.y - 64, 128, 128);
  // A stone ring with a bright doorway.
  ctx.strokeStyle = `rgba(125,255,176,${0.9 * alpha})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(220,255,235,${0.9 * alpha})`;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 9 + 2 * Math.sin(t * 3), 0, Math.PI * 2);
  ctx.fill();
  if (exit.open) {
    ctx.fillStyle = `rgba(220,255,235,${0.95 * alpha})`;
    ctx.font = `600 13px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x, exit.y - 30);
  }
}

function drawShards(ctx, game) {
  const t = game.clock;
  for (const s of game.level.shards) {
    if (s.taken) continue;
    const rev = revealAt(game.echo, s.x, s.y);
    if (rev < 0.08) continue;
    const bob = Math.sin(t * 2 + s.phase) * 3;
    const a = clamp01(rev * 1.2);
    const glow = ctx.createRadialGradient(s.x, s.y + bob, 0, s.x, s.y + bob, 34);
    glow.addColorStop(0, `rgba(255,179,71,${0.5 * a})`);
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 34, s.y + bob - 34, 68, 68);
    // Amber diamond.
    ctx.save();
    ctx.translate(s.x, s.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = `rgba(255,179,71,${0.95 * a})`;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.fillStyle = `rgba(255,233,176,${0.95 * a})`;
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
}

function predatorVisibility(game, p) {
  let vis = revealAt(game.echo, p.x, p.y);
  for (const ring of game.echo.rings) {
    const d = Math.hypot(p.x - ring.x, p.y - ring.y);
    if (d <= ring.r) vis = Math.max(vis, 0.35 + 0.65 * ring.alpha);
  }
  return clamp01(vis);
}

function drawListener(ctx, game, p) {
  const vis = predatorVisibility(game, p);
  if (vis < 0.04) return;
  const t = game.clock;
  const r = p.radius;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = vis;
  // Spiky ear-ring: the thing that hears you.
  ctx.fillStyle = COLORS.listener;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.4;
    const rr = i % 2 === 0 ? r + 7 : r - 2;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5c0a12';
  ctx.beginPath();
  ctx.arc(0, 0, r - 5, 0, Math.PI * 2);
  ctx.fill();
  // Two pale eyes, always looking at you.
  const look = Math.atan2(game.player.y - p.y, game.player.x - p.x);
  ctx.fillStyle = '#ffd7db';
  for (const s of [-1, 1]) {
    const ex = Math.cos(look) * 4 + Math.cos(look + Math.PI / 2) * s * 5;
    const ey = Math.sin(look) * 4 + Math.sin(look + Math.PI / 2) * s * 5;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStalker(ctx, game, p) {
  const vis = predatorVisibility(game, p);
  if (vis < 0.04) return;
  const t = game.clock;
  const r = p.radius;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = vis;
  // A tall thin wraith.
  ctx.fillStyle = p.frozen ? '#8fb8d8' : COLORS.stalker;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.62, r * 1.15, Math.sin(t * 0.8 + p.phase) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b0210';
  ctx.beginPath();
  ctx.ellipse(0, -2, r * 0.4, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes: two slits that glow red in the dark.
  ctx.fillStyle = '#ff5b6e';
  for (const s of [-1, 1]) {
    ctx.fillRect(s * 5 - 1.6, -6, 3.2, 6);
  }
  if (p.frozen) {
    // Frozen solid: a cyan ring says "your ping holds it".
    ctx.strokeStyle = 'rgba(89,230,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, game) {
  const p = game.player;
  const blink = p.invuln > 0 && Math.floor(game.clock * 12) % 2 === 0;
  // Comet trail.
  for (const tr of p.trail) {
    const a = Math.max(0, tr.life / 0.35) * 0.35;
    ctx.fillStyle = `rgba(89,230,255,${a})`;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Own glow: the mote is the one light you carry.
  const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 58);
  glow.addColorStop(0, 'rgba(120,230,255,0.34)');
  glow.addColorStop(1, 'rgba(120,230,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(p.x - 58, p.y - 58, 116, 116);
  if (!blink) {
    ctx.fillStyle = COLORS.mote;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.moteCore;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRings(ctx, game) {
  for (const ring of game.echo.rings) {
    const a = Math.max(0, ring.alpha);
    ctx.strokeStyle = `rgba(89,230,255,${0.9 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(89,230,255,${0.28 * a})`;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, Math.max(0, ring.r - 14), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawHud(ctx, game) {
  const level = game.level;
  const total = level.shards.length;
  const got = level.shards.filter((s) => s.taken).length;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Echo meter, top-left.
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = `600 13px ${SANS}`;
  ctx.fillText('ECHO', 18, 30);
  ctx.fillStyle = '#0c2233';
  ctx.fillRect(18, 38, 190, 12);
  const frac = game.echo.meter / PING_MAX;
  ctx.fillStyle = frac >= 0.35 ? COLORS.ring : COLORS.shard;
  ctx.fillRect(18, 38, 190 * frac, 12);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = `12px ${SANS}`;
  ctx.fillText('SPACE / klik = ping', 18, 68);

  // Lives, bottom-left.
  ctx.fillStyle = COLORS.hud;
  ctx.font = `600 15px ${SANS}`;
  ctx.fillText('NYAWA', 18, VIEW_H - 44);
  for (let i = 0; i < game.livesMax; i++) {
    ctx.fillStyle = i < game.lives ? '#ff5b6e' : '#274052';
    ctx.beginPath();
    ctx.arc(26 + i * 26, VIEW_H - 22, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shards, bottom-centre-left.
  ctx.fillStyle = COLORS.shard;
  ctx.font = `600 17px ${SANS}`;
  ctx.fillText(`◆  ${got} / ${total} shard`, 150, VIEW_H - 26);
  if (level.exit.open) {
    ctx.fillStyle = COLORS.exit;
    ctx.fillText('EXIT TERBUKA — MENUJU CAHAYA HIJAU', 300, VIEW_H - 26);
  }

  // Level + score + time, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.hud;
  ctx.font = `600 16px ${SANS}`;
  ctx.fillText(`${level.def.name}  ·  Level ${game.levelIndex + 1}/3`, VIEW_W - 18, 30);
  ctx.font = `15px ${SANS}`;
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(`SKOR ${game.score}`, VIEW_W - 18, 52);
  ctx.fillText(`WAKTU ${formatTime(game.runTime)}`, VIEW_W - 18, 72);

  // Mute hint, bottom-right.
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = `12px ${SANS}`;
  ctx.fillText(`M: suara ${game.audio.muted ? 'mati' : 'hidup'}   ·   P: jeda   ·   R: ulang`, VIEW_W - 18, VIEW_H - 22);
  ctx.textAlign = 'left';
}

export function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

function drawTitle(ctx, game) {
  // A slow, huge ring breathes behind the title — the cave is listening.
  const t = game.clock;
  const r = 180 + 90 * Math.sin(t * 0.5);
  ctx.strokeStyle = `rgba(89,230,255,${0.16 + 0.08 * Math.sin(t * 0.5)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(VIEW_W / 2, 330, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(89,230,255,0.08)';
  ctx.beginPath();
  ctx.arc(VIEW_W / 2, 330, r * 1.6, 0, Math.PI * 2);
  ctx.stroke();

  centerText(ctx, 'ECHODEEP', 250, `700 110px ${SERIF}`, COLORS.title);
  centerText(ctx, 'Setiap ping menyingkap gua — dan memanggil mereka.', 310, `italic 24px ${SERIF}`, '#9fd8ef');
  centerText(ctx, 'Gua ini gelap total. Satu-satunya cahaya adalah suaramu.', 360, `18px ${SANS}`, COLORS.hudDim);
  centerText(ctx, 'Kumpulkan semua resonance shard, lalu capai exit sebelum mereka menangkapmu.', 388, `18px ${SANS}`, COLORS.hudDim);
  centerText(ctx, 'Ping membekukan Stalker — tapi memanggil Listener ke suaramu.', 416, `18px ${SANS}`, '#ffb3ba');

  ctx.font = `600 17px ${SANS}`;
  ctx.fillStyle = COLORS.hud;
  ctx.textAlign = 'center';
  ctx.fillText('WASD / ←↑→↓  bergerak      SPACE / klik  ping      P  jeda      M  suara      R  ulang', VIEW_W / 2, 480);
  ctx.fillText('3 level  ·  3 nyawa  ·  echo meter terbatas', VIEW_W / 2, 512);

  const blink = Math.floor(t * 1.6) % 2 === 0;
  if (blink) centerText(ctx, 'TEKAN SPASI UNTUK MASUK', 590, `700 26px ${SANS}`, COLORS.ring);
  centerText(ctx, 'ECHODEEP — an original sonar-cave game', 690, `13px ${SANS}`, '#41586c');
}

function drawEndScreen(ctx, game, won) {
  ctx.fillStyle = 'rgba(2,4,7,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (won) {
    centerText(ctx, 'CAHAYA DITEMUKAN', 210, `700 72px ${SERIF}`, '#c8ffe2');
    centerText(ctx, 'Kamu keluar dari gua — dan gua membiarkanmu pergi.', 268, `italic 22px ${SERIF}`, '#9fd8ef');
  } else {
    centerText(ctx, 'GELAP MENELANMU', 210, `700 72px ${SERIF}`, '#ff8b96');
    centerText(ctx, 'Suara terakhir itu milik mereka.', 268, `italic 22px ${SERIF}`, '#c98a92');
  }
  const stats = game.endStats;
  const lines = [
    `SKOR AKHIR   ${stats.score}`,
    `WAKTU   ${formatTime(stats.time)}`,
    `SHARD   ${stats.shards} / ${stats.shardsTotal}`,
    `PING   ${stats.pings} kali`,
    `LEVEL TERCAPAI   ${stats.levelReached} / 3`,
  ];
  lines.forEach((line, i) => {
    centerText(ctx, line, 350 + i * 38, `600 21px ${SANS}`, COLORS.hud);
  });
  const blink = Math.floor(game.clock * 1.6) % 2 === 0;
  if (blink) centerText(ctx, 'TEKAN R UNTUK MAIN LAGI', 590, `700 26px ${SANS}`, COLORS.ring);
}

function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(2,4,7,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  centerText(ctx, 'JEDA', 300, `700 64px ${SERIF}`, COLORS.title);
  centerText(ctx, 'Gua menunggu. Mereka juga.', 360, `italic 20px ${SERIF}`, '#9fd8ef');
  centerText(ctx, 'P — lanjut    ·    R — mulai dari awal', 430, `18px ${SANS}`, COLORS.hud);
}

function drawBanner(ctx, game) {
  if (!game.banner) return;
  const a = clamp01(game.bannerT / 0.4) * clamp01((game.bannerDur - game.bannerT) / 0.5);
  ctx.save();
  ctx.globalAlpha = clamp01(a);
  centerText(ctx, game.banner, 320, `700 52px ${SERIF}`, COLORS.title);
  if (game.bannerSub) centerText(ctx, game.bannerSub, 368, `18px ${SANS}`, COLORS.hud);
  ctx.restore();
}

// The vignette: the edges of the world are always darker than the centre.
function drawVignette(ctx) {
  const g = ctx.createRadialGradient(
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.32,
    VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function render(ctx, game) {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (game.state === 'title') {
    // The attract demo plays dimly behind the title when it is running.
    if (game.attract) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawWalls(ctx, game);
      drawMushrooms(ctx, game);
      drawShards(ctx, game);
      for (const p of game.predators) {
        if (p.kind === 'listener') drawListener(ctx, game, p);
        else drawStalker(ctx, game, p);
      }
      drawPlayer(ctx, game);
      drawRings(ctx, game);
      ctx.restore();
    }
    drawTitle(ctx, game);
    return;
  }

  drawWalls(ctx, game);
  drawMushrooms(ctx, game);
  drawExit(ctx, game);
  drawShards(ctx, game);
  for (const p of game.predators) {
    if (p.kind === 'listener') drawListener(ctx, game, p);
    else drawStalker(ctx, game, p);
  }
  drawPlayer(ctx, game);
  drawRings(ctx, game);
  drawVignette(ctx);
  // No HUD on the end screens: the win/lose panel carries the stats.
  if (game.state !== 'win' && game.state !== 'lose') drawHud(ctx, game);
  // No banner on the end screens either: a leftover "TERTANGKAP!" would
  // print over the win/lose text.
  if (game.state === 'playing' || game.state === 'paused') drawBanner(ctx, game);

  if (game.state === 'paused') drawPause(ctx, game);
  if (game.state === 'win' || game.state === 'lose') drawEndScreen(ctx, game, game.state === 'win');
}
