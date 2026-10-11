// npc.js — sahte 'oyuncu' şövalyeler: isim üretimi, dolaşma, ara sıra
// düşmanlara vurma. MMO atmosferinin dünya tarafı (chat tarafı chat.js'te).

import { CONFIG } from './config.js';
import { makeEntity, tryMove, cellKey } from './entities.js';
import { isPassable } from './world.js';

const NAME_PREFIX = ['Kara', 'Gölge', 'Demir', 'Anka', 'Bozkır', 'Efsun', 'Kızıl', 'Gece', 'Fırtına', 'Buz', 'Alev', 'Vahşi'];
const NAME_NOUN = ['Kılıç', 'Şövalye', 'Kartal', 'Kurt', 'Han', 'Bey', 'Sancak', 'Yürek', 'Mızrak', 'Pençe'];

export function makeNpcName(rand) {
  const a = NAME_PREFIX[Math.floor(rand() * NAME_PREFIX.length)];
  const b = NAME_NOUN[Math.floor(rand() * NAME_NOUN.length)];
  const style = Math.floor(rand() * 6);
  if (style === 0) return a + b;
  if (style === 1) return a + b + '99';
  if (style === 2) return 'xX' + a + b + 'Xx';
  if (style === 3) return a + b + '_TR';
  if (style === 4) return a + b + '_1453';
  return a + b + '_' + (10 + Math.floor(rand() * 90));
}

export function makeNpc(x, y, name, level) {
  const n = makeEntity('npc', x, y, '@', CONFIG.COLORS.npc);
  n.name = name;
  n.level = level;
  n.speed = 3.2 + Math.random() * 0.8;
  n.wanderCd = Math.random();
  n.pauseT = Math.random() * 2;
  n.visible = true;
  n.attackCd = 1 + Math.random() * 2;
  n.levelUpAt = 0;   // ilk update'te oyun saatine göre kurulur
  return n;
}

function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

// Oyuncu etrafında geçilebilir bir hücre bul
function findSpotNear(state, minD, maxD) {
  const p = state.player;
  for (let i = 0; i < 40; i++) {
    const ang = Math.random() * Math.PI * 2;
    const d = minD + Math.random() * (maxD - minD);
    const x = Math.round(p.x + Math.cos(ang) * d);
    const y = Math.round(p.y + Math.sin(ang) * d);
    if (isPassable(x, y) && !state.occupied.has(cellKey(x, y))) return [x, y];
  }
  return null;
}

function placeNpc(state, n, x, y) {
  state.occupied.delete(cellKey(n.x, n.y));
  state.occupied.delete(cellKey(n.fromX, n.fromY));
  n.x = x; n.y = y;
  n.fromX = x; n.fromY = y;
  n.px = x; n.py = y;
  n.moveT = 1;
  state.occupied.set(cellKey(x, y), n);
}

export function spawnRoster(state) {
  const used = new Set([state.player.name.toLowerCase()]);
  const [lo, hi] = CONFIG.NPC.activeNear;
  const activeCount = lo + Math.floor(Math.random() * (hi - lo + 1));
  for (let i = 0; i < CONFIG.NPC.rosterSize; i++) {
    let name = makeNpcName(Math.random);
    let guard = 0;
    while (used.has(name.toLowerCase()) && guard++ < 20) name = makeNpcName(Math.random);
    used.add(name.toLowerCase());
    const n = makeNpc(0, 0, name, 2 + Math.floor(Math.random() * 14));
    const spot = i < activeCount ? findSpotNear(state, 6, 16) : null;
    if (spot) {
      placeNpc(state, n, spot[0], spot[1]);
      n.visible = true;
    } else {
      // kenarda bekleyen: görünmez, join olayında sahneye girer
      const far = findSpotNear(state, 10, 18);
      if (far) placeNpc(state, n, far[0], far[1]);
      n.visible = false;
    }
    state.npcs.push(n);
  }
}

export function npcJoin(state, n) {
  const spot = findSpotNear(state, 8, 16);
  if (spot) placeNpc(state, n, spot[0], spot[1]);
  n.visible = true;
}

export function npcLeave(state, n) {
  n.visible = false;
  state.occupied.delete(cellKey(n.x, n.y));
}

export function pickLeavableNpc(state) {
  const vis = state.npcs.filter(n => n.visible);
  return vis.length > 2 ? vis[Math.floor(Math.random() * vis.length)] : null;
}

export function pickJoinableNpc(state) {
  const hidden = state.npcs.filter(n => !n.visible);
  return hidden.length ? hidden[Math.floor(Math.random() * hidden.length)] : null;
}

export function randomVisibleNpc(state) {
  const vis = state.npcs.filter(n => n.visible);
  if (!vis.length) return null;
  // oyuncuya yakın olanlar ağırlıklı
  vis.sort((a, b) => Math.hypot(a.x - state.player.x, a.y - state.player.y) -
                  Math.hypot(b.x - state.player.x, b.y - state.player.y));
  return vis[Math.floor(Math.random() * Math.min(5, vis.length))];
}

export function updateNpc(n, state, dt, now) {
  if (!n.visible) return;
  if (!n.levelUpAt) n.levelUpAt = now + randRange(CONFIG.NPC.levelUp[0], CONFIG.NPC.levelUp[1]);

  // Oyuncudan çok uzaklaştıysa sessizce yakına taşın
  if (Math.hypot(n.x - state.player.x, n.y - state.player.y) > CONFIG.NPC_TELEPORT_DIST) {
    const spot = findSpotNear(state, 14, 22);
    if (spot) placeNpc(state, n, spot[0], spot[1]);
  }

  // Dolaşma: kısa yürüyüşler + duraklamalar
  if (n.pauseT > 0) {
    n.pauseT -= dt;
  } else {
    n.wanderCd -= dt;
    if (n.wanderCd <= 0 && n.moveT >= 1) {
      n.wanderCd = 0.22 + Math.random() * 0.35;
      const d = [[0, -1], [0, 1], [-1, 0], [1, 0]][Math.floor(Math.random() * 4)];
      tryMove(n, d[0], d[1], state.occupied);
      if (Math.random() < 0.22) n.pauseT = 0.4 + Math.random() * 2.2;
    }
  }

  // Yakındaki düşmana ara sıra vurur (görsel şov + chat övünmesi)
  n.attackCd -= dt;
  if (n.attackCd <= 0) {
    n.attackCd = 0.9 + Math.random() * 1.1;
    for (const e of state.enemies) {
      if (e.hp > 0 && Math.abs(e.x - n.x) <= 1 && Math.abs(e.y - n.y) <= 1) {
        state.npcStrike(n, e);
        break;
      }
    }
  }

  // Seviye atlama → chat duyurusu
  if (now >= n.levelUpAt) {
    const [lo, hi] = CONFIG.NPC.levelUp;
    n.levelUpAt = now + randRange(lo, hi);
    n.level++;
    state.onNpcLevelUp(n);
  }
}
