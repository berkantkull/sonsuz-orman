// test_browser.mjs — DOM stub'larıyla main.js'i uçtan uca çalıştırır:
// başlatma, hareket, saldırı, spawn, chat, ölüm/yeniden doğma.
import assert from 'node:assert';

// --- DOM / tarayıcı stub'ları ---

const elements = {};

function makeCtx() {
  return new Proxy({}, {
    get(t, k) {
      if (k === 'measureText') return () => ({ width: 9.6 });
      if (k === 'canvas') return { width: 300, height: 150 };
      if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (!(k in t)) t[k] = () => undefined;
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}

function makeCanvasEl() {
  return {
    tagName: 'CANVAS', width: 300, height: 150, style: {},
    getContext: () => makeCtx(),
    parentElement: { clientWidth: 1200, clientHeight: 700 },
  };
}

function makeEl(id) {
  const el = {
    id, tagName: 'DIV', textContent: '', innerHTML: '', value: '',
    style: {}, children: [], handlers: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(type, fn) { el.handlers[type] = fn; },
    appendChild(c) { el.children.push(c); },
    removeChild(c) { const i = el.children.indexOf(c); if (i >= 0) el.children.splice(i, 1); },
    querySelector(sel) { return (el['_q' + sel] = el['_q' + sel] || makeEl(id + '-' + sel)); },
    blur() {}, focus() {},
    scrollHeight: 0, scrollTop: 0, clientHeight: 0, clientWidth: 0,
  };
  Object.defineProperty(el, 'firstChild', { get: () => el.children[0] || null });
  return el;
}

globalThis.document = {
  getElementById: (id) => elements[id] || (elements[id] = (id === 'game' || id === 'minimap' || id === 'portrait' || id === 'start-portrait' ? makeCanvasEl() : makeEl(id))),
  querySelectorAll: (sel) => (sel === '.skill' ? [makeEl('sk0'), makeEl('sk1'), makeEl('sk2')] : []),
  createElement: (tag) => (tag === 'canvas' ? makeCanvasEl() : makeEl('dyn-' + tag)),
  addEventListener() {},
  fonts: { ready: Promise.resolve() },
  hidden: false,
};

const winHandlers = {};
globalThis.window = {
  devicePixelRatio: 1,
  addEventListener: (t, fn) => { winHandlers[t] = fn; },
  AudioContext: undefined,
};
globalThis.requestAnimationFrame = (cb) => { globalThis.__raf = cb; return 1; };
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const key = (k, down = true) => {
  const h = down ? winHandlers.keydown : winHandlers.keyup;
  h({ key: k, repeat: false, target: { tagName: 'BODY' }, preventDefault() {} });
};

// --- Modülü çalıştır ---

const { state } = await import('./js/main.js');
await new Promise(r => setTimeout(r, 30));   // boot tamamlansın
assert.strictEqual(state.phase, 'start', 'başlangıçta start ekranı');

// Oyunu başlat
elements['btn-start'].handlers.click();
assert.strictEqual(state.phase, 'play', 'buton sonrası oyun başlar');
assert.ok(state.player, 'oyuncu oluştu');
assert.ok(state.npcs.length >= 4, 'npc kadrosu oluştu');

// 10 saniye simüle et
let t = performance.now();
for (let i = 0; i < 600; i++) { t += 16.7; globalThis.__raf(t); }
assert.ok(state.enemies.length > 0, 'düşmanlar spawn oldu');
assert.ok(elements['chat-lines'].children.length > 0, 'chat mesajı geldi');
console.log(`sim: düşman=${state.enemies.length} npc=${state.npcs.filter(n => n.visible).length} chat=${elements['chat-lines'].children.length} çevrimiçi=${state.onlineCount}`);

// Hareket: d basılı tut
key('d');
const x0 = state.player.x;
for (let i = 0; i < 120; i++) { t += 16.7; globalThis.__raf(t); }
key('d', false);
assert.ok(state.player.x > x0 + 2, `sağa hareket etti (${x0} → ${state.player.x})`);
assert.ok(state.camera.x > 1, 'kamera takip etti');

// Saldırı
key(' ');
for (let i = 0; i < 5; i++) { t += 16.7; globalThis.__raf(t); }
assert.ok(state.effects.some(f => f.type === 'slash'), 'slash efekti oluştu');
for (let i = 0; i < 60; i++) { t += 16.7; globalThis.__raf(t); }

// Ölüm → yeniden doğma
state.hurtPlayer({ dmg: 99999, typeName: 'TestDüşman' });
assert.strictEqual(state.phase, 'dead', 'ölüm ekranı');
assert.strictEqual(state.player.deaths, 1, 'ölüm sayacı');
elements['btn-respawn'].handlers.click();
assert.strictEqual(state.phase, 'play', 'yeniden doğdu');
assert.strictEqual(state.player.hp, state.player.maxHp, 'dolu hp');
assert.strictEqual(state.player.x, 0, 'spawn noktasında');

// Uzun süre — istisna yok mu
for (let i = 0; i < 1200; i++) { t += 16.7; globalThis.__raf(t); }
console.log(`sim2: süre=${Math.round(state.playTime)}sn düşman=${state.enemies.length} efekt=${state.effects.length} hp=${state.player.hp}/${state.player.maxHp}`);
assert.ok(state.playTime > 28, 'oyun saati akıyor');

// Görev kutusu doldu mu
assert.ok(elements['quest-name'].textContent.includes('İlk Kan'), 'görev adı görüntüleniyor');

// Görev ilerlemesi: yakına zayıf goblin koy, ona dönüp kes
const { spawnEnemyAt } = await import('./js/entities.js');
let g1 = null;
search: for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1], [1, 1], [-1, -1]]) {
  const cand = spawnEnemyAt(state, state.player.x + dx, state.player.y + dy, 'goblin', 1);
  if (cand) {
    g1 = cand;
    state.player.facing = [Math.sign(dx), Math.sign(dy)];
    break search;
  }
}
assert.ok(g1, 'goblin yerleştirildi');
g1.hp = 1; g1.atkCd = 99;
state.player.attackT = 0;
key(' ');
for (let i = 0; i < 10; i++) { t += 16.7; globalThis.__raf(t); }
assert.ok(elements['quest-progress'].textContent.includes('1/3'), `görev ilerledi: "${elements['quest-progress'].textContent}"`);

// Yetenek: kilitliyken mesaj, açıkken bekleme süresi
state.player.level = 5;
key('2');
for (let i = 0; i < 5; i++) { t += 16.7; globalThis.__raf(t); }
assert.ok(state.player.skillCd[1] > 0, 'Kasırga Kılıç tetiklendi, CD başladı');
key('3');
for (let i = 0; i < 5; i++) { t += 16.7; globalThis.__raf(t); }
assert.ok(state.player.buffT > 0, 'Savaş Narası buffı aktif');

// Rehber: H açar, simülasyon donar, ESC kapatır
key('h');
assert.strictEqual(state.guideOpen, true, 'rehber açıldı');
const tFrozen = state.time;
for (let i = 0; i < 30; i++) { t += 16.7; globalThis.__raf(t); }
assert.strictEqual(state.time, tFrozen, 'rehber açıkken simülasyon dondu');
key('escape');
assert.strictEqual(state.guideOpen, false, 'rehber kapandı');

// Kayıt yazımı
winHandlers.beforeunload();
console.log('\n TARAYICI-SİMÜLASYON TESTLERİ GEÇTİ');
process.exit(0);
