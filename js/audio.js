// audio.js — minik WebAudio bip'leri. Asset yok; AudioContext yalnızca
// kullanıcı jesti (başlat düğmesi) ile oluşturulur/resume edilir.

let ctx = null;
let muted = false;

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function setMuted(v) { muted = v; }
export function isMuted() { return muted; }

function tone(f0, f1, dur, type, gain, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function playSound(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'swing': tone(620, 180, 0.09, 'sawtooth', 0.022); break;
    case 'hit': tone(170, 90, 0.09, 'square', 0.05); break;
    case 'crit': tone(250, 60, 0.16, 'square', 0.06); break;
    case 'hurt': tone(320, 70, 0.22, 'sawtooth', 0.05); break;
    case 'kill': tone(500, 900, 0.12, 'triangle', 0.05); break;
    case 'level':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.12, 'triangle', 0.05, i * 0.09));
      break;
    case 'death': tone(380, 35, 0.9, 'sawtooth', 0.06); break;
  }
}
