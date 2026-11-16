// input.js — keyboard + mouse, nothing else. The game reads this state
// once per frame; edge-triggered actions (ping, pause, restart) are consumed
// by the game loop so one press is exactly one action.

export function makeInput() {
  return {
    keys: new Set(),
    // Edge-triggered presses, set by the listeners, read and cleared by game.
    pressed: new Set(),
    // Mouse click position in canvas pixels (for click-to-ping).
    click: null,
    // Any input at all, for the attract-mode timer on the title screen.
    lastActivity: 0,
    // Synthetic movement from the attract-mode autopilot (dx, dy) or null.
    autoMove: null,
    autoPing: false,
  };
}

const PING_KEYS = ['Space'];
const RESTART_KEYS = ['KeyR'];
const PAUSE_KEYS = ['KeyP'];
const MUTE_KEYS = ['KeyM'];
const START_KEYS = ['Space', 'Enter'];

export function bindInput(input, canvas, onGesture) {
  const note = () => {
    input.lastActivity = performance.now();
    if (onGesture) onGesture();
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    note();
    input.keys.add(e.code);
    input.pressed.add(e.code);
    if (PING_KEYS.includes(e.code) || START_KEYS.includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousedown', (e) => {
    note();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    input.click = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  });
  // Keep the keys the game reads in one place.
  input.wasPressed = (code) => input.pressed.has(code);
  input.consume = (code) => input.pressed.delete(code);
  input.consumeAny = (codes) => {
    for (const c of codes) {
      if (input.pressed.has(c)) {
        input.pressed.delete(c);
        return c;
      }
    }
    return null;
  };
  input.clearPressed = () => input.pressed.clear();
  input.pingPressed = () => input.consumeAny(PING_KEYS);
  input.restartPressed = () => input.consumeAny(RESTART_KEYS);
  input.pausePressed = () => input.consumeAny(PAUSE_KEYS);
  input.mutePressed = () => input.consumeAny(MUTE_KEYS);
  input.startPressed = () => input.consumeAny(START_KEYS);
}

// The held movement vector, from WASD or arrows (or the autopilot).
export function moveVector(input) {
  if (input.autoMove) return input.autoMove;
  let dx = 0;
  let dy = 0;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) dx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) dx += 1;
  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) dy -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) dy += 1;
  return { x: dx, y: dy };
}
