// chat.js — simüle MMO sohbeti: Türkçe mesaj havuzları, mesaj patlamaları,
// join/leave olayları ve oyuncu eylemlerine reaktif mesajlar.

import { CONFIG } from './config.js';
import { randomVisibleNpc, pickJoinableNpc, pickLeavableNpc, npcJoin, npcLeave } from './npc.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));

const GENERAL = [
  'slm', 'iyi oyunlar', 'party kuran var mı', 'lag var mı sizde de', 'afk bi dk',
  'server 1 mi burası', 'bu orman hiç bitmiyor ya', 'kuzeyde kaya var geçilmiyo la',
  'kurt expsi iyiymiş', 'su kenarında güzel farm spotu var', 'bi daha ölürsem klavyeyi kırıcam',
  'bu oyunda gece olmuyor mu', 'goblinler neden hep peşimde', 'yolunu kaybeden bana yazsın',
  'gg', 'afk oluyom yemeyin beni', 'patikadan ayrılmayın tavsiye', 'slime lar yavaş ama dayanıklı',
  'şu ağaçlar bir türlü bitmiyor', 'doğuya gidin orası sakin',
];

const BRAG = [
  '3 seviye atladım az önce', 'trollü tek kestim', '12 goblin bi kestim üst üste',
  'benden iyi şövalye yok bu serverda', 'lvl atlamadan duramıom ben',
];

const HELP = [
  'spawn neresiydi', 'troll nerede çıkıyo', 'kaç level oldunuz',
  'bu patika nereye gidiyo', 'kılıcı nasıl savuruyosunuz', 'goblin kaçıyor napıyım',
];

const WELCOME = [
  'hoşgeldin {name}', 'hoş geldin {name}, iyi oyunlar', '{name} geldi, kurtulduk',
  'yeni mi geldin {name}? körlere dikkat', 'selam {name}',
];

const LEVELUP = [
  'tebrikler {name}', 'gg {name}, lvl {n} oldu', '{name} hızlı ilerliyo bu arada',
  'aferin {name}', '{name} bi dur artık lvl {n} oldu',
];

const DEATH = [
  'başın sağ olsun {name}', 'ayağa kalk {name}, daha çok kılıç sallayacaksın',
  'oldun mu {name}', 'ölüm normaldir {name}, devam', '{name} bi goblin e mi yendi',
];

const ELITE_REACT = [
  '{name} trollü mü kesti?? saygı', 'troll bende de vardı, geçti', 'helal olsun {name}',
];

const NPC_KILL = [
  'bende keserim bölelerini', 'kolaydı', 'xp iyi geldi', 'bundan büyüğünü keserim ben',
];

export function initChat(state) {
  state.chatT = {
    nextAt: state.time + rand(3, 6),
    burst: [],          // [{text, from}] — kuyruktan sırayla düşer
    burstGap: 0,
    nextJoinLeaveAt: state.time + rand(...CONFIG.CHAT.joinLeave),
  };
}

export function updateChat(state, dt) {
  const c = state.chatT;
  c.nextAt -= dt;
  c.nextJoinLeaveAt -= dt;
  c.burstGap -= dt;

  // Patlama kuyruğu
  if (c.burst.length && c.burstGap <= 0) {
    const m = c.burst.shift();
    state.pushChat({ from: m.from, text: m.text, kind: 'npc' });
    c.burstGap = rand(1, 2.2);
    c.nextAt = rand(...CONFIG.CHAT.baseInterval);
  }

  // Normal mesaj zamanı
  if (c.nextAt <= 0) {
    if (Math.random() < CONFIG.CHAT.burstChance) {
      const n = Math.round(rand(...CONFIG.CHAT.burstCount));
      for (let i = 0; i < n; i++) {
        const npc = randomVisibleNpc(state);
        if (!npc) break;
        c.burst.push({ from: npc.name, text: pickMsg() });
      }
      c.burstGap = 0;
    } else {
      const npc = randomVisibleNpc(state);
      if (npc) state.pushChat({ from: npc.name, text: pickMsg(), kind: 'npc' });
    }
    c.nextAt = rand(...CONFIG.CHAT.baseInterval);
  }

  // Join / leave olayı
  if (c.nextJoinLeaveAt <= 0) {
    c.nextJoinLeaveAt = state.time + rand(...CONFIG.CHAT.joinLeave);
    if (Math.random() < 0.5) {
      const n = pickJoinableNpc(state);
      if (n) {
        npcJoin(state, n);
        state.pushChat({ from: null, text: `«${n.name}» oyuna katıldı.`, kind: 'sys' });
      }
    } else {
      const n = pickLeavableNpc(state);
      if (n) {
        npcLeave(state, n);
        state.pushChat({ from: null, text: `«${n.name}» oyundan ayrıldı.`, kind: 'sys' });
      }
    }
    state.updateOnlineCount();
  }
}

function pickMsg() {
  const r = Math.random();
  if (r < 0.70) return pick(GENERAL);
  if (r < 0.85) return pick(HELP);
  return pick(BRAG);
}

// --- Reaktif kancalar (combat/main çağırır) ---

export function chatWelcome(state) {
  const p = state.player;
  setTimeout(() => {
    const npc = randomVisibleNpc(state);
    if (npc) state.pushChat({ from: npc.name, text: fill(pick(WELCOME), { name: p.name }), kind: 'npc' });
  }, rand(4000, 7000));
  setTimeout(() => {
    const npc = randomVisibleNpc(state);
    if (npc) state.pushChat({ from: npc.name, text: fill(pick(WELCOME), { name: p.name }), kind: 'npc' });
  }, rand(9000, 14000));
}

export function chatPlayerLevelUp(state, level) {
  const npc = randomVisibleNpc(state);
  state.pushChat({ from: null, text: `«${state.player.name}» ${level}. seviyeye ulaştı!`, kind: 'sys' });
  if (npc && Math.random() < 0.7) {
    state.pushChat({ from: npc.name, text: fill(pick(LEVELUP), { name: state.player.name, n: level }), kind: 'npc' });
  }
}

export function chatPlayerDeath(state) {
  const npc = randomVisibleNpc(state);
  if (npc && Math.random() < 0.8) {
    state.pushChat({ from: npc.name, text: fill(pick(DEATH), { name: state.player.name }), kind: 'npc' });
  }
}

export function chatEliteKill(state) {
  state.pushChat({ from: null, text: `«${state.player.name}» bir Trollü alt etti!`, kind: 'sys' });
  const npc = randomVisibleNpc(state);
  if (npc) {
    state.pushChat({ from: npc.name, text: fill(pick(ELITE_REACT), { name: state.player.name }), kind: 'npc' });
  }
}

export function chatNpcKill(state, npc, enemyName) {
  if (Math.random() < 0.35) {
    state.pushChat({ from: npc.name, text: pick(NPC_KILL), kind: 'npc' });
  } else if (Math.random() < 0.3) {
    state.pushChat({ from: null, text: `«${npc.name}» bir ${enemyName}ı alt etti.`, kind: 'sys' });
  }
}

export function chatNpcLevelUp(state, npc) {
  state.pushChat({ from: null, text: `«${npc.name}» ${npc.level}. seviyeye ulaştı!`, kind: 'sys' });
}
