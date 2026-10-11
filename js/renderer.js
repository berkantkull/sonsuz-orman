// renderer.js — glyph atlas + chunk zemin cache'i ile canvas render.
// Performans ilkesi: ana frame'de fillText YOK (yalnızca az sayıda isim
// etiketi için); her şey önceden çizilmiş glif canvas'larından drawImage.
//
// Gerçekçilik: her hücre dolu bir arka plan rengi taşır (terrain dokusu),
// su üstünde zamanla gezinen ışıltı, ormanda süzülen ateşböcekleri var.

import { CONFIG } from './config.js';
import { ensureChunk, tileVisual, T } from './world.js';
import { hash2 } from './rng.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cols = 60;
    this.rows = 24;
    this.cellW = 10;   // CSS px — font ölçümünden gelir
    this.cellH = 20;
    this.cw = 20;      // device px hücre adımı (cellW * dpr, yuvarlanmış)
    this.chh = 40;
    this.glyphs = new Map();   // "karakter|ön|arka" -> offscreen canvas
    this.camX = 0;             // görünür alanın sol üstü (tile, float)
    this.camY = 0;
    this.fireflies = [];
    for (let i = 0; i < 16; i++) {
      this.fireflies.push({
        ph: hash2(i, 1, 77) * Math.PI * 2,
        sp: 0.12 + hash2(i, 2, 77) * 0.22,
        ax: 10 + hash2(i, 3, 77) * 26,
        ay: 6 + hash2(i, 4, 77) * 14,
        ox: (hash2(i, 5, 77) - 0.5) * 40,
        oy: (hash2(i, 6, 77) - 0.5) * 24,
      });
    }
  }

  async init() {
    await document.fonts.ready;
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `${CONFIG.FONT_SIZE}px ${CONFIG.FONT_STACK}`;
    this.cellW = Math.ceil(probe.measureText('M').width);
    this.cellH = Math.ceil(CONFIG.FONT_SIZE * 1.3);
    this.cw = Math.ceil(this.cellW * this.dpr);
    this.chh = Math.ceil(this.cellH * this.dpr);
    this.labelFont = `${Math.round(11 * this.dpr)}px ${CONFIG.FONT_STACK}`;
    this.resize();
  }

  resize() {
    const wrap = this.canvas.parentElement;
    if (!wrap) return;
    this.cols = clamp(Math.floor(wrap.clientWidth / this.cellW), CONFIG.GRID.minCols, CONFIG.GRID.maxCols);
    this.rows = clamp(Math.floor(wrap.clientHeight / this.cellH), CONFIG.GRID.minRows, CONFIG.GRID.maxRows);
    const w = this.cols * this.cellW, h = this.rows * this.cellH;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.ctx = this.canvas.getContext('2d');
  }

  // Glif: karakter + ön plan + (isteğe bağlı) dolu arka plan.
  glyph(ch, fg, bg) {
    const k = ch + '|' + fg + '|' + (bg || '');
    let g = this.glyphs.get(k);
    if (!g) {
      g = document.createElement('canvas');
      g.width = this.cw;
      g.height = this.chh;
      const c = g.getContext('2d');
      if (bg) {
        c.fillStyle = bg;
        c.fillRect(0, 0, this.cw, this.chh);
      }
      if (ch) {
        c.font = `${Math.round(CONFIG.FONT_SIZE * this.dpr)}px ${CONFIG.FONT_STACK}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = fg;
        c.fillText(ch, this.cw / 2, this.chh / 2 + this.dpr);
      }
      this.glyphs.set(k, g);
    }
    return g;
  }

  // Chunk zeminini kendi canvas'ına bir kez çizer; frame'de blitlenir.
  chunkCanvas(ch) {
    if (ch.canvas) return ch.canvas;
    const size = CONFIG.CHUNK;
    const cv = document.createElement('canvas');
    cv.width = size * this.cw;
    cv.height = size * this.chh;
    const c = cv.getContext('2d');
    for (let ly = 0; ly < size; ly++) {
      for (let lx = 0; lx < size; lx++) {
        const base = ch.tiles[ly * size + lx];
        const v = tileVisual(ch.cx * size + lx, ch.cy * size + ly, base);
        c.drawImage(this.glyph(v.ch, v.fg, v.bg), lx * this.cw, ly * this.chh);
      }
    }
    ch.canvas = cv;
    return cv;
  }

  sx(wx) { return Math.round((wx - this.camX) * this.cw); }
  sy(wy) { return Math.round((wy - this.camY) * this.chh); }

  render(state) {
    const { ctx, canvas, cols, rows } = this;
    this.camX = state.camera.x - cols / 2;
    this.camY = state.camera.y - rows / 2;
    const time = state.time;

    ctx.fillStyle = CONFIG.COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1) Zemin: görünür chunk canvas'ları + su ışıltısı
    const size = CONFIG.CHUNK;
    const c0 = Math.floor(this.camX / size), c1 = Math.floor((this.camX + cols) / size);
    const r0 = Math.floor(this.camY / size), r1 = Math.floor((this.camY + rows) / size);
    ctx.globalAlpha = 1;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const ch = ensureChunk(cx, cy);
        ctx.drawImage(this.chunkCanvas(ch), this.sx(cx * size), this.sy(cy * size));
        // Su ışıltısı: her su hücresinden bir kısmı zamanla parlar
        ctx.globalAlpha = 0.5;
        for (let ly = 0; ly < size; ly++) {
          const wy = cy * size + ly;
          if (wy < this.camY - 1 || wy > this.camY + rows) continue;
          for (let lx = 0; lx < size; lx++) {
            const wx = cx * size + lx;
            if (wx < this.camX - 1 || wx > this.camX + cols) continue;
            if (ch.tiles[ly * size + lx] !== T.WATER) continue;
            const ph = hash2(wx, wy, 0x5E1);
            if ((time * 0.55 + ph * 7) % 6 < 1) {
              ctx.drawImage(this.glyph('≈', '#bfe6f5'), this.sx(wx), this.sy(wy));
            }
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    // 2) Görünürlük sınırındaki entity'ler (y-sort)
    const vis = [];
    const margin = 2;
    for (const e of state.enemies) {
      if (e.hp > 0 && e.px > this.camX - margin && e.px < this.camX + cols + margin &&
          e.py > this.camY - margin && e.py < this.camY + rows + margin) vis.push(e);
    }
    for (const n of state.npcs) {
      if (n.visible && n.px > this.camX - margin && n.px < this.camX + cols + margin &&
          n.py > this.camY - margin && n.py < this.camY + rows + margin) vis.push(n);
    }
    const p = state.player;
    if (p.hp > 0) vis.push(p);
    vis.sort((a, b) => a.py - b.py);

    // 3) Oyuncu altı halo
    if (p.hp > 0) {
      ctx.fillStyle = CONFIG.COLORS.playerHalo;
      ctx.fillRect(this.sx(p.px), this.sy(p.py), this.cw, this.chh);
    }

    // 4) Entity glifleri
    for (const e of vis) {
      const color = e === p
        ? (p.hurtT > 0 ? '#ff6a5e' : (time % 0.8 < 0.4 ? CONFIG.COLORS.player : '#e8b23a'))
        : e.color;
      ctx.drawImage(this.glyph(e.glyph, color, e.glyphBg), this.sx(e.px), this.sy(e.py));
    }

    // 5) Efektler: slash flaşları, isabet yıldızları, hasar sayıları, halkalar
    for (const fx of state.effects) {
      const k = fx.t / fx.dur;
      ctx.globalAlpha = 1 - k * 0.6;
      if (fx.type === 'slash') {
        for (const cell of fx.cells) {
          ctx.drawImage(this.glyph(fx.chars[Math.floor(k * fx.chars.length)] || '*', CONFIG.COLORS.slash, 'rgba(10,16,10,0.35)'),
            this.sx(cell[0]), this.sy(cell[1]));
        }
      } else if (fx.type === 'star') {
        ctx.drawImage(this.glyph('*', CONFIG.COLORS.hitStar, 'rgba(10,16,10,0.35)'), this.sx(fx.x), this.sy(fx.y));
      } else if (fx.type === 'dmg') {
        const rise = k * (fx.rise !== undefined ? fx.rise : 1.0);
        const text = fx.text;
        for (let i = 0; i < text.length; i++) {
          ctx.drawImage(this.glyph(text[i], fx.color, 'rgba(8,12,8,0.45)'),
            this.sx(fx.x + 0.5 - text.length / 2 + i), this.sy(fx.y - rise));
        }
      } else if (fx.type === 'ring') {
        const rr = Math.floor(k * 3) + 1;
        const glyphs = ['*', 'o', '.', ' '];
        for (let dx = -rr; dx <= rr; dx++) {
          for (let dy = -rr; dy <= rr; dy++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue;
            const ch2 = glyphs[Math.min(rr, 3)];
            ctx.globalAlpha = 1 - k;
            ctx.drawImage(this.glyph(ch2, fx.color), this.sx(fx.x + dx), this.sy(fx.y + dy));
          }
        }
      }
    }
    ctx.globalAlpha = 1;

    // 6) Ateşböcekleri: kamera çevresinde süzülen, nabız gibi parlayan noktalar
    const cxT = state.camera.x, cyT = state.camera.y;
    for (const f of this.fireflies) {
      const wx = cxT + f.ox + Math.sin(time * f.sp + f.ph) * f.ax;
      const wy = cyT + f.oy + Math.cos(time * f.sp * 1.3 + f.ph) * f.ay;
      const tw = 0.5 + 0.5 * Math.sin(time * 2.2 + f.ph * 3);
      ctx.globalAlpha = 0.14 + 0.30 * tw;
      ctx.drawImage(this.glyph('·', '#ffe98a'), this.sx(wx), this.sy(wy));
    }
    ctx.globalAlpha = 1;

    // 7) İsim etiketleri (az sayıda; fillText burada kabul edilebilir)
    ctx.font = this.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const e of vis) {
      if (e.kind === 'npc') {
        this.drawLabel(ctx, e.name, CONFIG.COLORS.labelNpc, e.px, e.py);
      } else if (e.kind === 'enemy' && time - e.lastHitT < 3) {
        this.drawLabel(ctx, e.typeName + ' ' + e.level, CONFIG.COLORS.labelEnemy, e.px, e.py);
      }
    }
    ctx.textAlign = 'left';
  }

  drawLabel(ctx, text, color, px, py) {
    const x = this.sx(px + 0.5);
    const y = this.sy(py) - Math.round(6 * this.dpr);
    const w = Math.round(ctx.measureText(text).width);
    ctx.fillStyle = 'rgba(6, 10, 6, 0.72)';
    ctx.fillRect(x - w / 2 - 2 * this.dpr, y, w + 4 * this.dpr, Math.round(12 * this.dpr));
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
}
