// quests.js — ardışık görev zinciri. Son görev tekrarlanır: ormanın
// koruyucusu olmak bitmez, sadece derinleşir.

import { CONFIG } from './config.js';

export const QUESTS = [
  { name: 'İlk Kan',            desc: '3 Goblin kes',                type: 'kill', enemy: 'goblin', target: 3,  xp: 60 },
  { name: 'Ormanın Yabanı',     desc: '5 Kurt kes',                  type: 'kill', enemy: 'wolf',   target: 5,  xp: 130 },
  { name: 'Balçık Temizliği',   desc: '4 Slime kes',                 type: 'kill', enemy: 'slime',  target: 4,  xp: 190 },
  { name: 'Dev Avcısı',         desc: '1 Troll kes',                 type: 'kill', enemy: 'troll',  target: 1,  xp: 420 },
  { name: 'Yükselen Şövalye',   desc: '8. seviyeye ulaş',            type: 'level', target: 8,                 xp: 300 },
  { name: 'Ormanın Koruyucusu', desc: '10 düşman kes (herhangi)',    type: 'kill', enemy: 'any',    target: 10, xp: 260, repeat: true },
];

export function initQuests(state) {
  state.questIdx = 0;
  state.questCount = 0;
  announceQuest(state);
}

function announceQuest(state) {
  const q = QUESTS[state.questIdx];
  state.pushChat({ from: null, text: `Yeni görev: ${q.name} — ${q.desc}`, kind: 'sys' });
  state.onQuestChanged();
}

function completeQuest(state) {
  const q = QUESTS[state.questIdx];
  state.pushChat({ from: null, text: `Görev tamamlandı: ${q.name} (+${q.xp} XP)`, kind: 'sys' });
  state.gainXp(q.xp);
  state.addEffect({ type: 'ring', x: state.player.x, y: state.player.y, t: 0, dur: 0.9, color: '#7ff0f0' });
  if (q.repeat) {
    state.questCount = 0;
  } else {
    state.questIdx = Math.min(state.questIdx + 1, QUESTS.length - 1);
    state.questCount = 0;
  }
  announceQuest(state);
}

// Oyuncu bir düşman kestiğinde combat çağırır
export function onEnemyKilled(state, e) {
  const q = QUESTS[state.questIdx];
  if (q.type !== 'kill') return;
  if (q.enemy !== 'any' && q.enemy !== e.typeKey) return;
  state.questCount++;
  if (state.questCount >= q.target) completeQuest(state);
  else state.onQuestChanged();
}

// Seviye atlarkinde main çağırır
export function onLevelQuest(state, level) {
  const q = QUESTS[state.questIdx];
  if (q.type !== 'level') return;
  if (level >= q.target) completeQuest(state);
}

export function questInfo(state) {
  const q = QUESTS[state.questIdx];
  const prog = q.type === 'kill'
    ? `${Math.min(state.questCount, q.target)}/${q.target}${q.enemy === 'any' ? ' düşman' : ''}`
    : `Sv ${state.player.level}/${q.target}`;
  return { name: q.name, desc: q.desc, prog };
}
