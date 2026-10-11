// world.js — sonsuz prosedürel orman: chunk üretimi, tile sorguları, zorluk bantları.
// Entity'den habersizdir; sadece dünya verisi.

import { CONFIG } from './config.js';
import { hash2, hash2i, fbm } from './rng.js';

export const T = {
  GRASS_A: 0, GRASS_B: 1, GRASS_C: 2, TALL: 3, TREE: 4, WATER_A: 5, WATER_B: 6, ROCK: 7, PATH: 8,
};

// Glif + renk + geçilebilirlik. Render bu tabloyu kullanır.
export const TILES = [
  { glyph: '.', color: '#233d1e', passable: true },   // GRASS_A
  { glyph: ',', color: '#1d351a', passable: true },   // GRASS_B
  { glyph: '.', color: '#2a4724', passable: true },   // GRASS_C
  { glyph: '"', color: '#3f7a35', passable: true },   // uzun ot (kozmetik)
  { glyph: 'Y', color: '#3fae53', passable: false },  // ağaç
  { glyph: '~', color: '#2b6a9e', passable: false },  // su
  { glyph: '~', color: '#3577ad', passable: false },  // su (parlak varyant)
  { glyph: '^', color: '#8f9490', passable: false },  // kaya
  { glyph: '·', color: '#8a6f4a', passable: true },   // patika
];

const chunks = new Map();
const key = (cx, cy) => cx + ',' + cy;

function grassVariant(x, y) {
  const shade = fbm(x * 0.11, y * 0.11, CONFIG.WORLD_SEED ^ 0x9E21, 2);
  const dotted = hash2(x, y, CONFIG.WORLD_SEED ^ 0x00FF) < 0.5;
  if (shade < 0.4) return dotted ? T.GRASS_B : T.GRASS_A;
  if (shade > 0.62) return dotted ? T.GRASS_A : T.GRASS_C;
  return dotted ? T.GRASS_C : T.GRASS_B;
}

function genTile(x, y) {
  const S = CONFIG.WORLD_SEED;
  const dist = Math.sqrt(x * x + y * y);

  // Güvenli başlangıç bölgesi: patika haçı, süs ağaçlar, su yok
  if (dist < CONFIG.SAFE_RADIUS) {
    const onCross = (Math.abs(x) <= 4 && Math.abs(y) <= 1) || (Math.abs(y) <= 4 && Math.abs(x) <= 1);
    if (onCross) return T.PATH;
    if (dist >= 4 && hash2(x, y, S ^ 0xABCD) < 0.02) return T.TREE;
    return grassVariant(x, y);
  }

  const treeN = fbm(x * 0.09, y * 0.09, S, 3);
  const waterN = fbm(x * 0.05, y * 0.028, S ^ 0x55AA, 2);   // y ekseninde ezik → yatay göller
  const pathN = fbm(x * 0.045, y * 0.045, S ^ 0x1234, 2);

  if (waterN < 0.30) return hash2(x, y, S ^ 0x0BB5) < 0.35 ? T.WATER_B : T.WATER_A;
  if (Math.abs(pathN - 0.5) < 0.016) return T.PATH;
  if (treeN > 0.60) return T.TREE;
  if (hash2(x, y, S ^ 0x7777) < 0.015) return T.ROCK;
  if (treeN > 0.48 && treeN <= 0.58) return T.TALL;
  return grassVariant(x, y);
}

function generateChunk(cx, cy) {
  const size = CONFIG.CHUNK;
  const tiles = new Uint8Array(size * size);
  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      tiles[ly * size + lx] = genTile(cx * size + lx, cy * size + ly);
    }
  }
  return { cx, cy, tiles, canvas: null };
}

export function ensureChunk(cx, cy) {
  const k = key(cx, cy);
  let ch = chunks.get(k);
  if (!ch) {
    ch = generateChunk(cx, cy);
    chunks.set(k, ch);
  }
  return ch;
}

export function getTile(x, y) {
  const size = CONFIG.CHUNK;
  const cx = Math.floor(x / size), cy = Math.floor(y / size);
  const ch = ensureChunk(cx, cy);
  return ch.tiles[(y - cy * size) * size + (x - cx * size)];
}

export function isPassable(x, y) {
  return TILES[getTile(x, y)].passable;
}

// Kameradan çok uzak chunk'ları at (yeniden üretim ucuz, deterministik).
export function pruneChunks(camCx, camCy, keepDist = 4) {
  for (const [k, ch] of chunks) {
    if (Math.abs(ch.cx - camCx) > keepDist || Math.abs(ch.cy - camCy) > keepDist) {
      chunks.delete(k);
    }
  }
}

export function chunkCount() { return chunks.size; }

// Zorluk bandı — spawn'dan uzaklaştıkça artar
export function difficultyBand(x, y) {
  return Math.floor(Math.sqrt(x * x + y * y) / CONFIG.BAND_SIZE);
}

// Chunk'a ait deterministik tohum (spawn çeşitliliği için)
export function chunkSeed(cx, cy) {
  return hash2i(cx, cy, CONFIG.WORLD_SEED ^ 0x5EED);
}
