// input.js — klavye durumu. Hareket update döngüsünde okunur (event içinde
// değil): aynı anda basılı tuşlar arasında "son basılan" öncelik kazanır.

const DIRS = {
  w: [0, -1], arrowup: [0, -1],
  s: [0, 1], arrowdown: [0, 1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

const heldOrder = [];   // basılma sırasına göre yön tuşları
let attackQueued = false;
const skillQueue = [];  // basılan yetenek slotları (1/2/3)
let onExtra = null;     // { onDebug, onRespawn, onGuide } — main tarafından bağlanır

function norm(e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(); }

export function initInput(extras) {
  onExtra = extras || {};
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    const k = norm(e);
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    if (e.repeat) return;
    if (DIRS[k]) {
      const i = heldOrder.indexOf(k);
      if (i >= 0) heldOrder.splice(i, 1);
      heldOrder.push(k);
    } else if (k === ' ') {
      attackQueued = true;
      if (onExtra.onRespawn) onExtra.onRespawn();   // ölüm ekranında SPACE = yeniden doğ
    } else if (k === '1' || k === '2' || k === '3') {
      const slot = Number(k) - 1;
      if (!skillQueue.includes(slot)) skillQueue.push(slot);
    } else if (k === 'h') {
      if (onExtra.onGuide) onExtra.onGuide();
    } else if (k === 'escape') {
      if (onExtra.onGuideClose) onExtra.onGuideClose();
    } else if (k === 'f1') {
      e.preventDefault();
      if (onExtra.onDebug) onExtra.onDebug();
    } else if (k === 'enter') {
      if (onExtra.onRespawn) onExtra.onRespawn();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = norm(e);
    const i = heldOrder.indexOf(k);
    if (i >= 0) heldOrder.splice(i, 1);
  });
  window.addEventListener('blur', () => {
    heldOrder.length = 0;
  });
}

// Son basılan yönü döndürür: [dx, dy] ya da null
export function getMoveIntent() {
  for (let i = heldOrder.length - 1; i >= 0; i--) {
    const d = DIRS[heldOrder[i]];
    if (d) return d;
  }
  return null;
}

export function consumeAttack() {
  const v = attackQueued;
  attackQueued = false;
  return v;
}

// Sıradaki yetenek slotunu döndürür (yoksa null)
export function consumeSkill() {
  return skillQueue.length ? skillQueue.shift() : null;
}
