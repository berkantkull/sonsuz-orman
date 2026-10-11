// world.js — sonsuz prosedürel orman: chunk üretimi, tile sınıflandırması,
// görsel varyantlar ve zorluk bantları. Entity'den habersizdir.
//
// Gerçekçilik yaklaşımı: hücreler yalnız glif değil, DOLU ARKA PLAN rengi
// taşır. Orman, siyah zemin üstüne saçılmış harfler değil; kesintisiz bir
// renk dokusu (kanopi, su, toprak) olarak görünür.

import { CONFIG } from './config.js';
import { hash2, hash2i, fbm } from './rng.js';

export const T = {
  GRASS: 0, TALL: 1, TREE: 2, WATER: 3, ROCK: 4, PATH: 5,
};

// Temel türler — yalnız geçilebilirlik. Görsel tileVisual()'dan gelir.
export const TILES = [
  { passable: true },   // GRASS
  { passable: true },   // TALL
  { passable: false },  // TREE
  { passable: false },  // WATER
  { passable: false },  // ROCK
  { passable: true },   // PATH
];

const chunks = new Map();
const key = (cx, cy) => cx + ',' + cy;

// Saf sınıflandırıcı: koordinat → temel tür (varyantsız).
function classify(x, y) {
  const S = CONFIG.WORLD_SEED;
  const dist = Math.sqrt(x * x + y * y);

  // Güvenli başlangıç bölgesi: patika haçı, süs ağaçlar, su yok
  if (dist < CONFIG.SAFE_RADIUS) {
    const onCross = (Math.abs(x) <= 4 && Math.abs(y) <= 1) || (Math.abs(y) <= 4 && Math.abs(x) <= 1);
    if (onCross) return T.PATH;
    if (dist >= 4 && hash2(x, y, S ^ 0xABCD) < 0.02) return T.TREE;
    return T.GRASS;
  }

  const treeN = fbm(x * 0.09, y * 0.09, S, 3);
  const waterN = fbm(x * 0.05, y * 0.028, S ^ 0x55AA, 2);   // y ekseninde ezik → yatay göller
  const pathN = fbm(x * 0.045, y * 0.045, S ^ 0x1234, 2);

  if (waterN < 0.30) return T.WATER;
  if (Math.abs(pathN - 0.5) < 0.016) return T.PATH;
  if (treeN > 0.60) return T.TREE;
  if (hash2(x, y, S ^ 0x7777) < 0.015) return T.ROCK;
  if (treeN > 0.48) return T.TALL;
  return T.GRASS;
}

function generateChunk(cx, cy) {
  const size = CONFIG.CHUNK;
  const tiles = new Uint8Array(size * size);
  for (let ly = 0; ly < size; ly++) {
    for (let lx = 0; lx < size; lx++) {
      tiles[ly * size + lx] = classify(cx * size + lx, cy * size + ly);
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

// --- Görsel katman ---
// Deterministik varyant: aynı hücre her zaman aynı görünür.

const GRASS_BG = ['#0f1d0d', '#12210e', '#0d190c'];
const GRASS_FG = ['#2b4a23', '#33552a', '#243f1e'];
const TREE_FG = ['#2e8f3e', '#43a84f', '#5cbf62'];
const WATER_BG = ['#0f3050', '#123a5c'];
const TREE_BG = '#0d2412';

export function tileVisual(x, y, base) {
  const h = hash2(x, y, CONFIG.WORLD_SEED ^ 0x0DDB);

  if (base === T.GRASS || base === T.TALL) {
    const shade = fbm(x * 0.11, y * 0.11, CONFIG.WORLD_SEED ^ 0x9E21, 2);
    const v = shade < 0.42 ? 0 : shade > 0.62 ? 2 : 1;
    if (base === T.TALL) return { ch: '"', fg: '#3f8f3a', bg: GRASS_BG[v] };
    if (h < 0.10) return { ch: ',', fg: GRASS_FG[v], bg: GRASS_BG[v] };
    if (h < 0.17) return { ch: '\'', fg: GRASS_FG[v], bg: GRASS_BG[v] };
    return { ch: '', fg: GRASS_FG[v], bg: GRASS_BG[v] };
  }

  if (base === T.TREE) {
    return { ch: h < 0.5 ? '♠' : '♣', fg: TREE_FG[Math.floor(h * 6) % 3], bg: TREE_BG };
  }

  if (base === T.WATER) {
    // Kıyı köpüğü: kara komşusu olan su hücresi
    const shore = classify(x + 1, y) !== T.WATER || classify(x - 1, y) !== T.WATER ||
                  classify(x, y + 1) !== T.WATER || classify(x, y - 1) !== T.WATER;
    if (shore) return { ch: '≈', fg: '#8fd0ea', bg: '#1b4a6e' };
    if (h < 0.10) return { ch: '≈', fg: '#4a86b8', bg: WATER_BG[Math.floor(h * 10) % 2] };
    return { ch: '', fg: '#4a86b8', bg: WATER_BG[Math.floor(h * 10) % 2] };
  }

  if (base === T.ROCK) {
    return { ch: '▲', fg: h < 0.4 ? '#9aa2aa' : '#848d95', bg: '#20262b' };
  }

  // PATH
  if (h < 0.30) return { ch: '·', fg: '#6b543a', bg: '#292014' };
  if (h < 0.36) return { ch: ',', fg: '#5a452c', bg: '#292014' };
  return { ch: '', fg: '#6b543a', bg: '#292014' };
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
