// enemy.js — düşman türleri ve basit AI durum makinesi.
// idle → chase → attack ↔ return (leash aşılırsa eve döner, train önlenir)

import { CONFIG } from './config.js';
import { makeEntity, tryMove } from './entities.js';

export const ENEMY_TYPES = {
  goblin: { name: 'Goblin', glyph: 'g', color: '#a4e34a', hp: 12, dmg: 3, xp: 8, speed: 2.6 },
  wolf:   { name: 'Kurt',   glyph: 'k', color: '#e0e0e0', hp: 8,  dmg: 2, xp: 5, speed: 4.0 },
  slime:  { name: 'Slime',  glyph: 's', color: '#ea90f2', hp: 20, dmg: 1, xp: 10, speed: 1.4 },
  troll:  { name: 'Troll',  glyph: 'T', color: '#ff5040', hp: 60, dmg: 8, xp: 50, speed: 2.0, elite: true },
};

// Çok karakterli ASCII sprite'lar — satır satır diziler + karakter başına renk.
// Çizimde alt satır entity hücresine gelecek şekilde yerleştirilir.
export const ENEMY_SPRITES = {
  goblin: {
    w: 3, h: 2,
    rows: ['^,^', '<o>'],
    colors: [
      ['#8fd44a', '#6db832', '#8fd44a'],
      ['#a4e34a', '#3a4a1a', '#a4e34a'],
    ],
  },
  wolf: {
    w: 4, h: 2,
    rows: [' ,. ', '<o=='],
    colors: [
      ['#b8b8b8', '#d8d8d8', '#d8d8d8', '#b8b8b8'],
      ['#d8d8d8', '#3a3a3a', '#c8c8c8', '#c8c8c8'],
    ],
  },
  slime: {
    w: 3, h: 2,
    rows: [' _ ', '(*)'],
    colors: [
      ['#ea90f2', '#d877e0', '#ea90f2'],
      ['#d877e0', '#ffd0ff', '#d877e0'],
    ],
  },
  troll: {
    w: 5, h: 3,
    rows: [' ,^, ', '[o o]', '/###\\'],
    colors: [
      ['#3d6a26', '#568a2c', '#3d6a26', '#568a2c', '#3d6a26'],
      ['#6a9f3d', '#ff5040', '#6a9f3d', '#ff5040', '#6a9f3d'],
      ['#568a2c', '#4a7a28', '#4a7a28', '#4a7a28', '#568a2c'],
    ],
  },
};

export function makeEnemy(typeKey, x, y, level) {
  const t = ENEMY_TYPES[typeKey];
  const e = makeEntity('enemy', x, y, t.glyph, t.color);
  e.typeKey = typeKey;
  e.typeName = t.name;
  e.sprite = ENEMY_SPRITES[typeKey];
  e.level = level;
  const bandMult = 1 + 0.30 * Math.max(0, level - 1);
  e.maxHp = Math.round(t.hp * bandMult);
  e.hp = e.maxHp;
  e.dmg = Math.max(1, Math.round(t.dmg * bandMult));
  e.xpValue = t.xp;
  e.speed = t.speed;
  e.elite = !!t.elite;
  e.glyphBg = 'rgba(8, 12, 6, 0.42)';   // terrain üstünde okunabilirlik zeminı
  e.homeX = x;
  e.homeY = y;
  e.state = 'idle';
  e.atkCd = 0;
  e.thinkCd = Math.random();
  e.stunT = 0;
  return e;
}

function stepToward(e, tx, ty, occupied) {
  const dx = tx - e.x, dy = ty - e.y;
  const sx = Math.sign(dx), sy = Math.sign(dy);
  if (sx === 0 && sy === 0) return;
  // önce büyük eksen; engellenirse diğer eksen
  const tryFirst = Math.abs(dx) >= Math.abs(dy);
  const steps = tryFirst ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]];
  for (const [mx, my] of steps) {
    if (mx === 0 && my === 0) continue;
    if (tryMove(e, mx, my, occupied)) return;
  }
}

export function updateEnemy(e, state, dt) {
  e.atkCd = Math.max(0, e.atkCd - dt);
  if (e.stunT > 0) {
    e.stunT = Math.max(0, e.stunT - dt);
    return;   // sersem — ne düşünür ne vurur
  }
  const p = state.player;
  const dx = p.x - e.x, dy = p.y - e.y;
  const dist = Math.abs(dx) + Math.abs(dy);
  const homeDist = Math.abs(e.x - e.homeX) + Math.abs(e.y - e.homeY);

  switch (e.state) {
    case 'idle':
      if (p.hp > 0 && dist <= CONFIG.ENEMY.aggroR) { e.state = 'chase'; break; }
      e.thinkCd -= dt;
      if (e.thinkCd <= 0) {
        e.thinkCd = 0.9 + Math.random() * 1.7;
        if (Math.random() < 0.55) {
          const d = [[0, -1], [0, 1], [-1, 0], [1, 0]][Math.floor(Math.random() * 4)];
          tryMove(e, d[0], d[1], state.occupied);
        }
      }
      break;

    case 'chase':
      if (p.hp <= 0) { e.state = 'return'; break; }
      if (homeDist > CONFIG.ENEMY.leash) { e.state = 'return'; break; }
      if (dist <= 1) { e.state = 'attack'; break; }
      stepToward(e, p.x, p.y, state.occupied);
      break;

    case 'attack':
      if (dist > 1 || p.hp <= 0) { e.state = dist <= CONFIG.ENEMY.aggroR && p.hp > 0 ? 'chase' : 'return'; break; }
      e.facing = [Math.sign(dx) || 1, Math.sign(dy)];
      if (e.atkCd <= 0) {
        e.atkCd = CONFIG.ENEMY.atkCd;
        state.hurtPlayer(e);
      }
      break;

    case 'return':
      if (homeDist <= 1) { e.state = 'idle'; break; }
      stepToward(e, e.homeX, e.homeY, state.occupied);
      if (p.hp > 0 && dist <= CONFIG.ENEMY.aggroR - 1) e.state = 'chase';
      break;
  }
}
