// config.js — oyunun tüm sabitleri ve denge değerleri. Magic number'ların tek evi.

export const CONFIG = {
  CHUNK: 32,

  // Görünür grid, viewport'tan otomatik hesaplanır (hücre boyutuna göre)
  GRID: { minCols: 40, maxCols: 100, minRows: 16, maxRows: 40 },

  FONT_SIZE: 16,
  FONT_STACK: '"Cascadia Mono", Consolas, Menlo, "DejaVu Sans Mono", "Courier New", monospace',
  PORTRAIT_FONT_SIZE: 13,

  WORLD_SEED: 20261011,
  SAFE_RADIUS: 12,        // spawn çevresi: su yok, seyrek ağaç
  NO_ENEMY_RADIUS: 20,    // bu yarıçap içinde düşman doğmaz
  BAND_SIZE: 20,          // zorluk bandı = floor(dist / BAND_SIZE)
  SPAWN_MARGIN: 1,        // düşman spawn'ı için görünür alana eklenen chunk marjı
  PRUNE_DIST: 60,         // tile — ötesindeki düşmanlar listeden düşer
  NPC_TELEPORT_DIST: 40,  // sahte oyuncular bu mesafede yakınlaşır (ılımlı biçimde)

  COLORS: {
    bg: '#0a0f0a',
    player: '#ffd75e',
    playerHalo: '#3d3208',
    npc: '#4ee6e6',
    slash: '#eafffa',
    hitStar: '#fff3b0',
    dmgPlayer: '#ffe9a8',  // düşmana verdiğimiz hasar
    dmgEnemy: '#ff8a7a',   // yediğimiz hasar
    labelNpc: '#7ff0f0',
    labelEnemy: '#ff9a8e',
    ringGold: '#ffd75e',
  },

  PLAYER: {
    speed: 4.5,        // hücre / sn
    atkDur: 0.20,      // saldırı animasyonu süresi
    atkLock: 0.30,     // saldırı sonrası kontrol kilidi
    baseDmg: 5,
    critChance: 0.12,
    critMult: 2,
  },

  // Yetenekler — slot 1/2/3 tuşları. unlockLvl: o seviyede açılır.
  SKILLS: [
    { name: 'Kalkan Darbesi', key: '1', cd: 8, dmg: 4, stun: 2.0, unlockLvl: 2,
      desc: 'Önündeki düşmanlara vurur ve 2 sn sersemletir.' },
    { name: 'Kasırga Kılıç', key: '2', cd: 12, dmgMult: 1.0, unlockLvl: 3,
      desc: 'Etrafındaki 8 yöne aynı anda savurur.' },
    { name: 'Savaş Narası', key: '3', cd: 25, dur: 8, dmgBonus: 0.5, unlockLvl: 5,
      desc: '8 sn boyunca kılıç hasarı +%50.' },
  ],

  ENEMY: {
    aggroR: 7,
    leash: 12,
    atkCd: 1.2,
    respawn: [30, 60],          // sn
    perChunk: (band) => Math.min(2 + band, 6),
  },

  XP_CURVE: (lvl) => Math.round(40 * Math.pow(lvl, 1.6)),
  MAXHP: (lvl) => 20 + (lvl - 1) * 10,

  REGEN: { delay: 5, rate: 1 }, // savaş dışı 5 sn sonra 1 HP/sn

  DEATH_XP_PENALTY: 0.25,       // mevcut seviye ilerlemesinden kesilir
  CAMERA_LERP: 12,              // kamera takip yumuşaklığı (1/sn)
  AUTOSAVE_SEC: 10,
  SAVE_KEY: 'ormanSave_v1',

  CHAT: {
    baseInterval: [5, 14],      // sn — normal mesaj aralığı
    burstChance: 0.20,          // mesaj patlaması olasılığı
    burstCount: [2, 4],
    joinLeave: [120, 300],      // sn
    maxLines: 100,
  },

  NPC: {
    rosterSize: 10,
    activeNear: [4, 6],         // oyuncu civarında gezinen sahte oyuncu sayısı
    levelUp: [90, 240],         // sn — sahte oyuncu seviye atlama aralığı
  },
};
