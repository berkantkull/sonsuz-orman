// main.js — oyun durumu, döngü ve sistem kablolaması.
// Kural: main herkesi çağırır; alt modüller birbirini import etmez
// (hooks state üzerinden verilir).

import { CONFIG } from './config.js';
import { Renderer } from './renderer.js';
import { initInput, getMoveIntent, consumeAttack } from './input.js';
import { makeEntity, tryMove, updateMovement, updateSpawns, pruneEnemies, cellKey } from './entities.js';
import { updateEnemy } from './enemy.js';
import { spawnRoster, updateNpc } from './npc.js';
import { tryPlayerAttack, hurtPlayer, npcStrikeEnemy, updateCombatTimers, respawnPlayer } from './combat.js';
import { updateEffects, addEffect } from './effects.js';
import * as chat from './chat.js';
import { UI, setUiTime } from './ui.js';
import * as audio from './audio.js';
import { loadSave, writeSave } from './save.js';
import { pruneChunks, chunkCount } from './world.js';

// --- Durum ---

export const state = {
  phase: 'start',
  time: 0,
  playTime: 0,
  player: null,
  enemies: [],
  npcs: [],
  effects: [],
  occupied: new Map(),
  camera: { x: 0, y: 0 },
  onlineCount: 1,
  debug: false,
  muted: false,
  fps: 0,
};

const renderer = new Renderer(document.getElementById('game'));
let ui = null;

// Hooklar — alt modüller bunlar üzerinden haberleşir
Object.assign(state, {
  addEffect: (fx) => addEffect(state, fx),
  playSound: (n) => audio.playSound(n),
  pushChat: (m) => ui.addChat(m),
  hurtPlayer: (e) => hurtPlayer(state, e),
  npcStrike: (n, e) => npcStrikeEnemy(state, n, e),
  onPlayerLevelUp: () => chat.chatPlayerLevelUp(state, state.player.level),
  onPlayerDeath: (byName) => die(byName),
  onEliteKill: () => chat.chatEliteKill(state),
  onNpcKill: (n, e) => chat.chatNpcKill(state, n, e.typeName),
  onNpcLevelUp: (n) => chat.chatNpcLevelUp(state, n),
  updateOnlineCount: () => {
    state.onlineCount = 1 + state.npcs.filter(n => n.visible).length;
    ui.setOnlineCount(state.onlineCount);
  },
});

// --- Oyuncu kurulumu ---

function makePlayer(name, saved) {
  const p = makeEntity('player', 0, 0, '♞', CONFIG.COLORS.player);
  p.name = name;
  p.level = saved && saved.level ? saved.level : 1;
  p.xpNext = CONFIG.XP_CURVE(p.level);
  p.xp = saved && saved.xp ? Math.min(saved.xp, p.xpNext - 1) : 0;
  p.maxHp = CONFIG.MAXHP(p.level);
  p.hp = p.maxHp;
  p.kills = (saved && saved.kills) || 0;
  p.deaths = (saved && saved.deaths) || 0;
  p.speed = CONFIG.PLAYER.speed;
  p.attackT = 0;
  p.attackAnimT = 0;
  p.hurtT = 0;
  p.lastCombatT = -99;
  return p;
}

function startGame(name, saved) {
  audio.initAudio();
  state.muted = !!(saved && saved.muted);
  audio.setMuted(state.muted);
  ui.setSoundLabel(state.muted);

  state.player = makePlayer(name, saved);
  state.occupied.set(cellKey(0, 0), state.player);
  state.playTime = (saved && saved.playTime) || 0;

  spawnRoster(state);
  chat.initChat(state);
  chat.chatWelcome(state);
  state.updateOnlineCount();

  ui.hideStart();
  state.phase = 'play';
  lastFrameTime = performance.now();
}

function die(byName) {
  state.phase = 'dead';
  state.player.deaths++;
  chat.chatPlayerDeath(state);
  audio.playSound('death');
  ui.showDeath(byName);
}

function respawn() {
  if (state.phase !== 'dead') return;
  respawnPlayer(state);
  ui.hideDeath();
  state.phase = 'play';
}

// --- Güncelleme ---

function update(dt) {
  state.time += dt;
  state.playTime += dt;
  setUiTime(state.time);
  const p = state.player;

  if (state.phase === 'play') {
    const intent = getMoveIntent();
    if (intent) {
      if (p.attackT <= 0) tryMove(p, intent[0], intent[1], state.occupied);
      else p.facing = intent;
    }
    if (consumeAttack()) tryPlayerAttack(state);
  }
  const wasMoving = p.moveT < 1;
  updateMovement(p, dt);
  // Adım tamamlanınca ayağından toz kalkar
  if (wasMoving && p.moveT >= 1 && state.phase === 'play') {
    addEffect(state, { type: 'dmg', x: p.fromX, y: p.fromY, t: 0, dur: 0.45, text: '·', color: '#8a8a6a', rise: 0.3 });
  }

  // Düşmanlar: yalnızca oyuncuya yakın olanlar düşünür
  for (const e of state.enemies) {
    if (Math.abs(e.x - p.x) < 80 && Math.abs(e.y - p.y) < 50 && state.phase === 'play') {
      updateEnemy(e, state, dt);
    }
    updateMovement(e, dt);
  }
  for (const n of state.npcs) {
    updateNpc(n, state, dt, state.time);
    updateMovement(n, dt);
  }

  const c0 = Math.floor((state.camera.x - renderer.cols / 2) / CONFIG.CHUNK) - CONFIG.SPAWN_MARGIN;
  const c1 = Math.floor((state.camera.x + renderer.cols / 2) / CONFIG.CHUNK) + CONFIG.SPAWN_MARGIN;
  const r0 = Math.floor((state.camera.y - renderer.rows / 2) / CONFIG.CHUNK) - CONFIG.SPAWN_MARGIN;
  const r1 = Math.floor((state.camera.y + renderer.rows / 2) / CONFIG.CHUNK) + CONFIG.SPAWN_MARGIN;
  updateSpawns(state, c0, r0, c1, r1, state.time);
  pruneEnemies(state);
  updateEffects(state, dt);
  updateCombatTimers(state, dt);
  if (state.phase === 'play') chat.updateChat(state, dt);

  // Kamera yumuşak takip
  const k = 1 - Math.exp(-CONFIG.CAMERA_LERP * dt);
  state.camera.x += (p.px + 0.5 - state.camera.x) * k;
  state.camera.y += (p.py + 0.5 - state.camera.y) * k;
}

// --- Döngü ---

const STEP = 1 / 60;
let acc = 0;
let lastFrameTime = performance.now();
let fpsAcc = 0, fpsCount = 0, fpsAt = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  if (state.phase === 'start') {
    ui.drawStartPortrait();   // başlangıç ekranında şövalye nefes alır
    return;
  }

  // FPS ölçümü
  fpsAcc += rawDt; fpsCount++;
  if (now - fpsAt > 500) {
    state.fps = Math.round(fpsCount / Math.max(0.001, fpsAcc));
    fpsAcc = 0; fpsCount = 0; fpsAt = now;
  }

  const dt = Math.min(Math.max(rawDt, 0), 0.10);
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 8) {
    update(STEP);
    acc -= STEP;
    steps++;
  }

  renderer.render(state);
  ui.drawPortrait(state);
  ui.updateHUD(state);
  ui.updateMinimap(state, renderer, state.time);
  if (state.debug) {
    const p = state.player;
    ui.setDebug(true,
      `fps ${state.fps} · hücre ${p.x},${p.y} · chunk ${chunkCount()} · glif ${renderer.glyphs.size}` +
      ` · düşman ${state.enemies.length} · npc ${state.npcs.filter(n => n.visible).length}` +
      ` · efekt ${state.effects.length}<br>çevrimiçi ${state.onlineCount} · süre ${Math.floor(state.playTime / 60)}dk`);
  }
}

// --- Bakım zamanlayıcıları ---

setInterval(() => {
  if (state.phase !== 'start') {
    writeSave(state);
    pruneChunks(Math.floor(state.camera.x / CONFIG.CHUNK), Math.floor(state.camera.y / CONFIG.CHUNK));
  }
}, 5000);

window.addEventListener('beforeunload', () => {
  if (state.phase !== 'start') writeSave(state);
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    lastFrameTime = performance.now();
    acc = 0;
  }
});

window.addEventListener('resize', () => renderer.resize());

// --- Başlatma ---

async function boot() {
  await document.fonts.ready;   // portre ölçümü hazır fontla yapılsın
  ui = new UI();
  await renderer.init();

  const saved = loadSave();
  ui.showStart(saved && saved.name ? saved.name : '', (name) => {
    if (state.phase !== 'start') return;   // çift başlatmayı engelle
    startGame(name, saved);
  });
  ui.bindRespawn(respawn);
  ui.bindSound(() => {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    ui.setSoundLabel(state.muted);
  }, !!(saved && saved.muted));

  initInput({
    onDebug: () => {
      state.debug = !state.debug;
      if (!state.debug) ui.setDebug(false);
    },
    onRespawn: respawn,
  });

  requestAnimationFrame(frame);
}

boot();
