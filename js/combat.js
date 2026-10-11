// combat.js — hasar çözümü, XP/seviye, ölüm/yeniden doğma, rejenerasyon.

import { CONFIG } from './config.js';
import { cellKey, scheduleRespawn } from './entities.js';

// Oyuncu saldırısı: bakılan yönün 3 ön hücresine yay
export function tryPlayerAttack(state) {
  const p = state.player;
  if (p.hp <= 0 || p.attackT > 0) return;
  p.attackT = CONFIG.PLAYER.atkLock;
  p.attackAnimT = 0.28;   // portre animasyonu (3 kare x ~80ms)

  const [dx, dy] = p.facing;
  const perpX = dy, perpY = -dx;
  const cells = [];
  for (const i of [-1, 0, 1]) {
    cells.push([p.x + dx + perpX * i, p.y + dy + perpY * i]);
  }
  state.addEffect({ type: 'slash', cells, chars: ['\\', '|', '/'], t: 0, dur: 0.18 });
  state.playSound('swing');

  for (const [cx, cy] of cells) {
    const target = state.occupied.get(cellKey(cx, cy));
    if (target && target.kind === 'enemy' && target.hp > 0) {
      hitEnemy(state, target);
    }
  }
}

function hitEnemy(state, e) {
  const p = state.player;
  let dmg = CONFIG.PLAYER.baseDmg + p.level + Math.floor(Math.random() * 4);
  const crit = Math.random() < CONFIG.PLAYER.critChance;
  if (crit) dmg = Math.round(dmg * CONFIG.PLAYER.critMult);
  applyDamage(state, e, dmg, crit, CONFIG.COLORS.dmgPlayer);
  e.state = 'chase';   // vurulan düşman uyanır
  state.playSound(crit ? 'crit' : 'hit');
  if (e.hp <= 0) killEnemyByPlayer(state, e);
}

// NPC'nin vuruşu (görsel şov; ölürse chat'te övünür)
export function npcStrikeEnemy(state, n, e) {
  const dmg = 4 + n.level * 2 + Math.floor(Math.random() * 5);
  const [dx, dy] = [Math.sign(e.x - n.x) || 1, Math.sign(e.y - n.y)];
  const perpX = dy, perpY = -dx;
  state.addEffect({
    type: 'slash',
    cells: [[n.x + dx, n.y + dy], [n.x + dx + perpX, n.y + dy + perpY], [n.x + dx - perpX, n.y + dy - perpY]],
    chars: ['\\', '|', '/'], t: 0, dur: 0.18,
  });
  applyDamage(state, e, dmg, false, CONFIG.COLORS.dmgPlayer);
  if (e.hp <= 0) {
    state.occupied.delete(cellKey(e.x, e.y));
    scheduleRespawn(e, state.time);
    state.addEffect({ type: 'star', x: e.x, y: e.y, t: 0, dur: 0.3 });
    state.onNpcKill(n, e);
    pruneFromList(state, e);
  }
}

function applyDamage(state, e, dmg, crit, color) {
  e.hp -= dmg;
  e.lastHitT = state.time;
  state.player.lastCombatT = state.time;
  state.addEffect({
    type: 'dmg', x: e.x, y: e.y, t: 0, dur: 0.7,
    text: (crit ? '*' : '-') + dmg, color,
  });
  state.addEffect({ type: 'star', x: e.x, y: e.y, t: 0, dur: 0.25 });
}

function killEnemyByPlayer(state, e) {
  state.occupied.delete(cellKey(e.x, e.y));
  scheduleRespawn(e, state.time);
  state.addEffect({ type: 'star', x: e.x, y: e.y, t: 0, dur: 0.3 });
  state.player.kills++;
  gainXp(state, e.xpValue + e.level * 2);
  state.playSound('kill');
  if (e.elite) state.onEliteKill(e.typeName);
  pruneFromList(state, e);
}

function pruneFromList(state, e) {
  const i = state.enemies.indexOf(e);
  if (i >= 0) state.enemies.splice(i, 1);
}

export function gainXp(state, amount) {
  const p = state.player;
  p.xp += amount;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = CONFIG.XP_CURVE(p.level);
    p.maxHp = CONFIG.MAXHP(p.level);
    p.hp = p.maxHp;
    state.addEffect({ type: 'ring', x: p.x, y: p.y, t: 0, dur: 0.9, color: CONFIG.COLORS.ringGold });
    state.onPlayerLevelUp(p.level);
    state.playSound('level');
  }
}

export function hurtPlayer(state, e) {
  const p = state.player;
  if (p.hp <= 0) return;
  const dmg = Math.max(1, Math.round(e.dmg * (0.8 + Math.random() * 0.4)));
  p.hp -= dmg;
  p.hurtT = 0.3;
  p.lastCombatT = state.time;
  state.addEffect({ type: 'dmg', x: p.x, y: p.y, t: 0, dur: 0.7, text: '-' + dmg, color: CONFIG.COLORS.dmgEnemy });
  state.playSound('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    state.onPlayerDeath(e.typeName);
  }
}

export function updateCombatTimers(state, dt) {
  const p = state.player;
  p.attackT = Math.max(0, p.attackT - dt);
  p.attackAnimT = Math.max(0, (p.attackAnimT || 0) - dt);
  p.hurtT = Math.max(0, (p.hurtT || 0) - dt);
  if (p.hp > 0 && p.hp < p.maxHp && state.time - p.lastCombatT > CONFIG.REGEN.delay) {
    p.regenAcc = (p.regenAcc || 0) + dt * CONFIG.REGEN.rate;
    if (p.regenAcc >= 1) {
      const n = Math.floor(p.regenAcc);
      p.regenAcc -= n;
      p.hp = Math.min(p.maxHp, p.hp + n);
    }
  }
}

export function respawnPlayer(state) {
  const p = state.player;
  // Spawn hücresini boşalt (kaçırılmış bir düşman varsa uzaklaştır)
  const squatter = state.occupied.get(cellKey(0, 0));
  if (squatter && squatter.kind === 'enemy') {
    state.occupied.delete(cellKey(0, 0));
    squatter.x = squatter.homeX; squatter.y = squatter.homeY;
    squatter.px = squatter.homeX; squatter.py = squatter.homeY;
    squatter.fromX = squatter.homeX; squatter.fromY = squater.homeY;
    state.occupied.set(cellKey(squatter.homeX, squatter.homeY), squatter);
  }
  state.occupied.delete(cellKey(p.x, p.y));
  state.occupied.delete(cellKey(p.fromX, p.fromY));
  p.x = 0; p.y = 0;
  p.px = 0; p.py = 0;
  p.fromX = 0; p.fromY = 0;
  p.moveT = 1;
  p.hp = p.maxHp;
  p.xp = Math.max(0, Math.round(p.xp - p.xpNext * CONFIG.DEATH_XP_PENALTY));
  p.hurtT = 0;
  state.occupied.set(cellKey(0, 0), p);
}
