// rng.js — deterministik üretim primitifleri.
// Dünya ve spawn'lar bu fonksiyonlardan çıkar; aynı seed = aynı dünya.

// 32-bit karışım hash'i. Negatif koordinatlar güvenli (Math.imul + >>>0).
export function hash2i(x, y, seed) {
  let h = (seed ^ Math.imul(x | 0, 0x9E3779B1) ^ Math.imul(y | 0, 0x85EBCA77)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE3D) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

// [0, 1) aralığında deterministik float
export function hash2(x, y, seed) {
  return hash2i(x, y, seed) / 4294967296;
}

// Basit tohumlanabilir PRNG — oyun içi rastgelelik için (spawn sıralaması vb.)
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t) { return t * t * (3 - 2 * t); }

// Kafes noktaları hash2 olan değer gürültüsü, smoothstep aradeğerleme
export function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fraktal gürültü (katmanlı value noise)
export function fbm(x, y, seed, octaves = 3) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}
