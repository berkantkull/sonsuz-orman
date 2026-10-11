// save.js — localStorage kaydı. Gizli sekme gibi ortamlarda erişim
// exceptions fırlatabilir; hepsi try/catch içinde, oyun asla bloklanmaz.

import { CONFIG } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d !== 'object' || d === null || typeof d.level !== 'number') return null;
    return d;
  } catch (e) {
    return null;
  }
}

export function writeSave(state) {
  if (!state.player) return;
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify({
      name: state.player.name,
      level: state.player.level,
      xp: Math.round(state.player.xp),
      kills: state.player.kills,
      deaths: state.player.deaths,
      muted: state.muted === true,
      playTime: Math.round(state.playTime),
    }));
  } catch (e) { /* kayıt yok sayılır */ }
}

export function clearSave() {
  try {
    localStorage.removeItem(CONFIG.SAVE_KEY);
  } catch (e) { /* yok sayılır */ }
}
