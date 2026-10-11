// ui.js — DOM'un tek sahibi: HUD, barlar, sohbet paneli, portre, minimap,
// başlangıç ve ölüm ekranları. Canvas'a yalnızca portre/minimap için dokunur.
// Performans kuralı: DOM'a yalnızca değer değiştiğinde yazılır.

import { CONFIG } from './config.js';
import { PORTRAIT, START_LOGO, DEATH_LOGO } from './sprites.js';
import { ensureChunk } from './world.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      name: $('stat-name'), level: $('stat-level'),
      hpFill: $('hp-fill'), hpText: $('hp-text'),
      xpFill: $('xp-fill'), xpText: $('xp-text'),
      kills: $('stat-kills'), deaths: $('stat-deaths'),
      chat: $('chat-lines'),
      online: $('online-count'),
      btnSound: $('btn-sound'),
      start: $('overlay-start'), nameInput: $('name-input'), btnStart: $('btn-start'),
      startLogo: $('start-logo'), startHint: $('start-hint'),
      death: $('overlay-death'), deathLogo: $('death-logo'), deathInfo: $('death-info'),
      btnRespawn: $('btn-respawn'), resetSave: $('reset-save'),
      debug: $('debug'),
    };
    this.cache = {};
    this.lastFrameKey = '';
    this.lastMinimap = 0;
    this.deathTimer = null;

    this.el.startLogo.textContent = START_LOGO.join('\n');
    this.el.deathLogo.textContent = DEATH_LOGO.join('\n');
    this.initPortrait();
  }

  async ready() { await document.fonts.ready; }

  // --- Portre ---

  initPortrait() {
    const probe = document.createElement('canvas').getContext('2d');
    probe.font = `${CONFIG.PORTRAIT_FONT_SIZE}px ${CONFIG.FONT_STACK}`;
    this.pCellW = Math.ceil(probe.measureText('M').width);
    this.pCellH = Math.ceil(CONFIG.PORTRAIT_FONT_SIZE * 1.3);
    this.pDpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const id of ['portrait', 'start-portrait']) {
      const cv = $(id);
      if (!cv) continue;
      cv.style.width = PORTRAIT.width * this.pCellW + 'px';
      cv.style.height = PORTRAIT.height * this.pCellH + 'px';
      cv.width = Math.round(PORTRAIT.width * this.pCellW * this.pDpr);
      cv.height = Math.round(PORTRAIT.height * this.pCellH * this.pDpr);
      if (id === 'portrait') this.pctx = cv.getContext('2d');
      else this.sctx = cv.getContext('2d');
    }
    this.lastFrameKey = '';
    this.lastStartKey = '';
  }

  // Ortak portre boyaması: orman havasında zemin + karakter
  paintPortrait(ctx, frame) {
    const W = PORTRAIT.width, H = PORTRAIT.height;
    const cw = this.pCellW * this.pDpr, chh = this.pCellH * this.pDpr;
    // Zemin: yukarıdan aşağı koyulaşan orman havası
    const grad = ctx.createLinearGradient(0, 0, 0, H * chh);
    grad.addColorStop(0, '#0b1710');
    grad.addColorStop(0.72, '#0a130c');
    grad.addColorStop(1, '#08100a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W * cw, H * chh);
    ctx.font = `${Math.round(CONFIG.PORTRAIT_FONT_SIZE * this.pDpr)}px ${CONFIG.FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = frame.rows[r][c];
        if (ch === ' ') continue;
        ctx.fillStyle = frame.colors[r][c] || '#c9d2da';
        ctx.fillText(ch, (c + 0.5) * cw, (r + 0.5) * chh);
      }
    }
  }

  drawPortrait(state) {
    const p = state.player;
    let anim, idx;
    if (p.attackAnimT > 0) {
      anim = 'attack';
      idx = Math.min(2, Math.floor((0.28 - p.attackAnimT) / 0.08));
    } else if (p.moveT < 1) {
      anim = 'walk';
      idx = Math.floor(state.time * 1000 / PORTRAIT.timings.walk) % 2;
    } else {
      anim = 'idle';
      idx = Math.floor(state.time * 1000 / PORTRAIT.timings.idle) % 2;
    }
    const key = anim + idx;
    if (key === this.lastFrameKey) return;
    this.lastFrameKey = key;
    this.paintPortrait(this.pctx, PORTRAIT.frames[anim][idx]);
  }

  // Başlangıç ekranı: sakin nefes alan şövalye
  drawStartPortrait() {
    if (!this.sctx) return;
    const t = performance.now() / 1000;
    const idx = Math.floor(t * 1000 / PORTRAIT.timings.idle) % 2;
    const key = 'i' + idx;
    if (key === this.lastStartKey) return;
    this.lastStartKey = key;
    this.paintPortrait(this.sctx, PORTRAIT.frames.idle[idx]);
  }

  // --- HUD ---

  set(el, text, key) {
    if (this.cache[key] === text) return;
    this.cache[key] = text;
    el.textContent = text;
  }

  updateHUD(state) {
    const p = state.player;
    if (!p) return;

    this.set(this.el.name, p.name, 'name');
    this.set(this.el.level, 'Sv ' + p.level, 'level');
    this.set(this.el.hpText, `${p.hp}/${p.maxHp}`, 'hpText');
    this.set(this.el.xpText, `${p.xp}/${p.xpNext}`, 'xpText');
    this.set(this.el.kills, 'Kesim: ' + p.kills, 'kills');
    this.set(this.el.deaths, 'Ölüm: ' + p.deaths, 'deaths');

    const hpPct = Math.max(0, Math.round(p.hp / p.maxHp * 100));
    if (this.cache.hpPct !== hpPct) {
      this.cache.hpPct = hpPct;
      this.el.hpFill.style.width = hpPct + '%';
      this.el.hpFill.classList.toggle('low', hpPct <= 25);
    }
    const xpPct = Math.max(0, Math.min(100, Math.round(p.xp / p.xpNext * 100)));
    if (this.cache.xpPct !== xpPct) {
      this.cache.xpPct = xpPct;
      this.el.xpFill.style.width = xpPct + '%';
    }
  }

  setOnlineCount(n) {
    this.set(this.el.online, `Çevrimiçi: ${n}`, 'online');
  }

  // --- Sohbet ---

  addChat(msg) {
    const box = this.el.chat;
    const line = document.createElement('div');
    line.className = 'chat-line ' + (msg.kind || 'npc');

    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;

    const t = document.createElement('span');
    t.className = 'chat-time';
    const mins = Math.floor(stateTime / 60), secs = Math.floor(stateTime % 60);
    t.textContent = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}] `;
    line.appendChild(t);

    if (msg.from) {
      const who = document.createElement('span');
      who.className = 'chat-from';
      who.textContent = msg.from + ': ';
      line.appendChild(who);
    }
    const tx = document.createElement('span');
    tx.textContent = msg.text;
    line.appendChild(tx);

    box.appendChild(line);
    while (box.children.length > CONFIG.CHAT.maxLines) box.removeChild(box.firstChild);
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  // --- Ekranlar ---

  showStart(prefill, onStart) {
    this.el.start.classList.remove('hidden');
    this.el.nameInput.value = prefill || '';
    this.el.btnStart.addEventListener('click', () => {
      const name = (this.el.nameInput.value || '').trim() || 'Şövalye';
      this.el.btnStart.blur();
      onStart(name);
    });
    this.el.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const name = (this.el.nameInput.value || '').trim() || 'Şövalye';
        onStart(name);
      }
    });
    setTimeout(() => this.el.nameInput.focus(), 50);
  }

  hideStart() {
    this.el.start.classList.add('hidden');
  }

  showDeath(byName) {
    this.el.death.classList.remove('hidden');
    this.el.deathInfo.textContent = `Bir ${byName} seni alt etti. Orman bekliyor...`;
    let remain = 3;
    const btn = this.el.btnRespawn;
    const upd = () => {
      btn.textContent = remain > 0 ? `YENİDEN DOĞ (${remain})` : 'YENİDEN DOĞ (SPACE)';
    };
    upd();
    clearInterval(this.deathTimer);
    this.deathTimer = setInterval(() => { remain--; upd(); if (remain <= 0) clearInterval(this.deathTimer); }, 1000);
  }

  hideDeath() {
    clearInterval(this.deathTimer);
    this.el.death.classList.add('hidden');
  }

  bindRespawn(fn) {
    this.el.btnRespawn.addEventListener('click', () => { this.el.btnRespawn.blur(); fn(); });
    this.el.resetSave.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Kayıt silinsin mi? (Seviye ve istatistikler gider)')) {
        localStorage.removeItem(CONFIG.SAVE_KEY);
        location.reload();
      }
    });
  }

  bindSound(fn, initialMuted) {
    this.setSoundLabel(initialMuted);
    this.el.btnSound.addEventListener('click', () => { this.el.btnSound.blur(); fn(); });
  }

  setSoundLabel(muted) {
    this.el.btnSound.textContent = muted ? '♪ ses: kapalı' : '♪ ses: açık';
  }

  setDebug(visible, html) {
    this.el.debug.classList.toggle('hidden', !visible);
    if (visible && html !== undefined) this.el.debug.innerHTML = html;
  }

  // --- Minimap ---

  updateMinimap(state, renderer, now) {
    if (now - this.lastMinimap < 0.5) return;
    this.lastMinimap = now;
    const cv = document.getElementById('minimap');
    const ctx = cv.getContext('2d');
    const size = 160;   // tile kapsama (5x5 chunk)
    const dpr = renderer.dpr;
    if (cv.width !== Math.round(150 * dpr)) {
      cv.width = Math.round(150 * dpr);
      cv.height = Math.round(150 * dpr);
    }
    const px = size / cv.width;
    ctx.fillStyle = '#060a06';
    ctx.fillRect(0, 0, cv.width, cv.height);

    const p = state.player;
    const half = size / 2;
    const CH = CONFIG.CHUNK;
    const pcx = Math.floor(p.px / CH), pcy = Math.floor(p.py / CH);
    for (let cy = pcy - 2; cy <= pcy + 2; cy++) {
      for (let cx = pcx - 2; cx <= pcx + 2; cx++) {
        const ch = ensureChunk(cx, cy);
        const cc = renderer.chunkCanvas(ch);
        const dx = (cx * CH - p.px + half) * px;
        const dy = (cy * CH - p.py + half) * px;
        ctx.drawImage(cc, dx, dy, CH * px, CH * px);
      }
    }
    const dot = (x, y, color, s) => {
      const mx = (x - p.px + half) * px, my = (y - p.py + half) * px;
      if (mx < 0 || my < 0 || mx > cv.width || my > cv.height) return;
      ctx.fillStyle = color;
      ctx.fillRect(mx - s / 2, my - s / 2, s, s);
    };
    for (const e of state.enemies) {
      if (e.hp > 0) dot(e.px, e.py, e.elite ? '#ff6347' : '#b04030', 2.5 * dpr);
    }
    for (const n of state.npcs) {
      if (n.visible) dot(n.px, n.py, '#4ee6e6', 2.5 * dpr);
    }
    dot(p.px, p.py, '#ffd75e', 4 * dpr);
  }
}

// Sohbet zaman damgası main'den beslenir (oyun süresi)
let stateTime = 0;
export function setUiTime(t) { stateTime = t; }
