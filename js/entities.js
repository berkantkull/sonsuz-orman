// entities.js — ortak entity üretimi, hücreler arası interpolasyonlu hareket,
// çarpışma (occupancy haritası) ve düşman spawn yöneticisi.

import { CONFIG } from './config.js';
import { isPassable, ensureChunk, chunkSeed, difficultyBand } from './world.js';
import { mulberry32 } from './rng.js';
import { ENEMY_TYPES, makeEnemy } from './enemy.js';

let nextId = 1;
export const cellKey = (x, y) => x + ',' + y;

export function makeEntity(kind, x, y, glyph, color) {
  return {
    id: nextId++, kind, glyph, color,
    x, y,                       // mantıksal grid hücresi
    px: x, py: y,               // render konumu (float, interpolasyonlu)
    fromX: x, fromY: y, moveT: 1, moveDur: 0.2, speed: 3,
    facing: [0, 1],
    hp: 1, maxHp: 1, level: 1,
    lastHitT: -99,
  };
}

// Hedef hücreye adım dener; engel/işgal varsa sadece yönü günceller.
export function tryMove(e, dx, dy, occupied) {
  e.facing = [dx, dy];
  if (e.moveT < 1) return false;
  const nx = e.x + dx, ny = e.y + dy;
  if (!isPassable(nx, ny)) return false;
  if (occupied.has(cellKey(nx, ny))) return false;
  occupied.delete(cellKey(e.x, e.y));
  occupied.set(cellKey(nx, ny), e);
  e.fromX = e.x; e.fromY = e.y;
  e.x = nx; e.y = ny;
  e.moveT = 0;
  e.moveDur = 1 / e.speed;
  return true;
}

// Görsel konumu mantıksal hücreye doğru kaydırır.
export function updateMovement(e, dt) {
  if (e.moveT < 1) e.moveT = Math.min(1, e.moveT + dt / e.moveDur);
  e.px = e.fromX + (e.x - e.fromX) * e.moveT;
  e.py = e.fromY + (e.y - e.fromY) * e.moveT;
}

// --- Spawn yöneticisi ---
// spawnedChunks eviction'dan etkilenmemek için dünya cache'inden ayrı tutulur.
const spawnedChunks = new Set();
const pendingRespawns = [];   // { cx, cy, x, y, type, level, at }

export function updateSpawns(state, c0, r0, c1, r1, now) {
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      const k = cx + ',' + cy;
      if (spawnedChunks.has(k)) continue;
      spawnedChunks.add(k);
      spawnChunkEnemies(state, cx, cy);
    }
  }
  // Zamanı gelen yeniden doğuşlar
  for (let i = pendingRespawns.length - 1; i >= 0; i--) {
    const r = pendingRespawns[i];
    if (now < r.at) continue;
    pendingRespawns.splice(i, 1);
    if (Math.hypot(r.x - state.player.x, r.y - state.player.y) < 12) {
      r.at = now + 10;   // oyuncunun gözü önünde doğma — ertele
      continue;
    }
    spawnEnemyAt(state, r.x, r.y, r.type, r.level);
  }
}

function bandType(rand, band) {
  const roll = rand();
  if (band >= 3 && roll < 0.10) return 'troll';
  if (band >= 1 && roll < 0.35) return 'wolf';
  if (roll < 0.65) return 'goblin';
  return 'slime';
}

function spawnChunkEnemies(state, cx, cy) {
  const size = CONFIG.CHUNK;
  const centerX = cx * size + size / 2, centerY = cy * size + size / 2;
  const band = difficultyBand(centerX, centerY);
  if (Math.hypot(centerX, centerY) < CONFIG.NO_ENEMY_RADIUS) return;

  const rand = mulberry32(chunkSeed(cx, cy));
  const count = CONFIG.ENEMY.perChunk(band);
  for (let i = 0; i < count; i++) {
    const lx = Math.floor(rand() * size), ly = Math.floor(rand() * size);
    const x = cx * size + lx, y = cy * size + ly;
    spawnEnemyAt(state, x, y, bandType(rand, band), 1 + band + Math.floor(rand() * 2));
  }
}

export function spawnEnemyAt(state, x, y, type, level) {
  if (!isPassable(x, y)) return null;
  if (state.occupied.has(cellKey(x, y))) return null;
  if (Math.hypot(x, y) < CONFIG.NO_ENEMY_RADIUS) return null;   // spawn bölgesi düşmansız
  const e = makeEnemy(type, x, y, level);
  state.enemies.push(e);
  state.occupied.set(cellKey(x, y), e);
  return e;
}

export function scheduleRespawn(e, now) {
  const [lo, hi] = CONFIG.ENEMY.respawn;
  pendingRespawns.push({
    x: e.homeX, y: e.homeY, type: e.typeKey, level: e.level,
    at: now + lo + Math.random() * (hi - lo),
  });
}

// Kameradan çok uzaktaki düşmanları listeden düş; chunk yeniden spawn'a açılır.
export function pruneEnemies(state) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (Math.hypot(e.x - p.x, e.y - p.y) > CONFIG.PRUNE_DIST) {
      state.occupied.delete(cellKey(e.x, e.y));
      // kendi chunk'ını yeniden spawnlanabilir yap (moveT ortasındaysa fromX kullan)
      const gx = e.moveT < 1 ? e.fromX : e.x, gy = e.moveT < 1 ? e.fromY : e.y;
      const size = CONFIG.CHUNK;
      spawnedChunks.delete(Math.floor(gx / size) + ',' + Math.floor(gy / size));
      state.enemies.splice(i, 1);
    }
  }
}

export { ENEMY_TYPES };
