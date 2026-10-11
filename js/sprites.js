// sprites.js — şövalye portre kareleri, logo ve düz metin sanatı.
// Kareler bir karakter+renk ızgarası üzerine parça parça "yerleştirilerek"
// kurulur; böylece elle hizalama hatası olamaz.
//
// Izgara: 28 sütun x 19 satır. Şövalye merkez ekseni sütun 10.
// Miğfer: satır 4-9, kol 4-16. Gövde: satır 10-13, kol 3-17.
// Bacaklar: satır 14-17. Kılıç: sağ tarafta, kol 18-27 arası.

const W = 28, H = 19;

const C = {
  plume: '#e05555',
  steel: '#c9d2da',
  steelDark: '#8d99a6',
  visor: '#20262e',
  belt: '#7a5a34',
  gold: '#ffd75e',
  blade: '#e9f3ff',
  boots: '#6b7480',
  spark: '#fff3b0',
};

function builder() {
  const chars = Array.from({ length: H }, () => Array(W).fill(' '));
  const colors = Array.from({ length: H }, () => Array(W).fill(null));
  return {
    // Boşluk karakteri hiçbir şeyi ezmez: parçalar üst üste şeffak bindirilir.
    put(row, col, str, color) {
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch !== ' ') {
          chars[row][col + i] = ch;
          colors[row][col + i] = color;
        }
      }
    },
    frame() {
      return { rows: chars.map(r => r.join('')), colors };
    },
  };
}

// --- Parçalar (ox: yürüyüş salınımında tüm üst gövdenin kayması) ---

function helm(b, ox, pose) {
  // Sorguç: tepe, direk ve sağa akan flama
  b.put(2, 10 + ox, pose === 'b' ? ';' : ',', C.plume);
  b.put(3, 10 + ox, pose === 'b' ? '|/' : '|\\', C.plume);
  // Miğfer gövdesi (basık büyük miğfer)
  b.put(4, 4 + ox, '______|_\\____', C.steel);
  b.put(5, 4 + ox, '/           \\', C.steel);
  b.put(6, 4 + ox, '|           |', C.steel);
  b.put(7, 4 + ox, '|   [   ]   |', C.steel);
  b.put(8, 4 + ox, '|   [___]   |', C.steel);
  b.put(9, 4 + ox, '|___________|', C.steel);
  // Vizör yarığı ('b' karesinde göz kırpma varyantı)
  b.put(7, 9 + ox, pose === 'b' ? '-_-' : '===', C.visor);
}

function torso(b, ox) {
  // Omuz taperi → pauldronlar → göğüs
  b.put(10, 5 + ox, '_/', C.steel);
  b.put(10, 14 + ox, '\\_', C.steel);
  b.put(11, 3 + ox, '/             \\', C.steel);
  b.put(12, 3 + ox, '|             |', C.steel);
  // Göğüsteki kızıl haç nişanı (T haç)
  b.put(11, 9 + ox, '+++', C.plume);
  b.put(12, 10 + ox, '+', C.plume);
  // Kemer + altın toka
  b.put(13, 3 + ox, '|____[_+_]____|', C.belt);
  b.put(13, 10 + ox, '+', C.gold);
}

function legsStanceA(b) {
  b.put(14, 6, '|  |   |  |', C.steelDark);
  b.put(15, 6, '|  |   |  |', C.steelDark);
  b.put(16, 4, '__|  |___|  |__', C.steelDark);
  b.put(17, 3, '|__|         |__|', C.boots);
}

function legsStanceB(b) {
  // Dar duruş — yürüyüşün ikinci ayağı
  b.put(14, 7, '|  | |  |', C.steelDark);
  b.put(15, 7, '|  | |  |', C.steelDark);
  b.put(16, 5, '__|  |_|  |__', C.steelDark);
  b.put(17, 5, '|__|     |__|', C.boots);
}

// --- Kılıç pozları ---

function swordIdle(b, ox, glint) {
  for (let r = 4; r <= 11; r++) b.put(r, 22 + ox, '#', C.blade);
  if (glint) b.put(5, 22 + ox, '*', C.spark);
  b.put(12, 20 + ox, '--+--', C.gold);   // siper
  b.put(13, 18 + ox, '____', C.steel);   // kola uzanan kıskaç
  b.put(13, 22 + ox, '|', C.belt);       // kabza
  b.put(14, 22 + ox, 'o', C.gold);       // topuz
}

function swordRaised(b) {
  // Yüksek kaldırılmış — saldırı hazırlığı
  for (let r = 0; r <= 7; r++) b.put(r, 23, '#', C.blade);
  b.put(8, 21, '--+--', C.gold);
  b.put(9, 23, '|', C.belt);
  b.put(10, 23, 'o', C.gold);
  b.put(9, 22, '<', C.steel);   // kavrayan el
  b.put(10, 21, '/', C.steel);
  b.put(11, 20, '/', C.steel);  // kalkan kol
}

function swordSwing(b) {
  // Yatay savurma
  b.put(11, 22, '=====>', C.blade);
  b.put(10, 21, '|', C.gold);
  b.put(11, 21, '+', C.gold);
  b.put(12, 21, '|', C.gold);
  b.put(11, 20, '#', C.steel);            // yumruk
  b.put(9, 24, "''", C.steelDark);        // hız çizgileri
  b.put(13, 24, "''", C.steelDark);
}

function swordFollow(b) {
  // Aşağı iniş — vuruş sonrası
  b.put(12, 20, '#', C.steel);
  b.put(12, 21, '+', C.gold);
  b.put(12, 22, '\\', C.blade);
  b.put(13, 23, '\\', C.blade);
  b.put(14, 24, '\\', C.blade);
  b.put(15, 26, '*', C.spark);
}

// --- Kareler ---

function makeFrame(parts) {
  const b = builder();
  for (const p of parts) p(b);
  return b.frame();
}

const idleA = makeFrame([b => helm(b, 0, 'a'), b => torso(b, 0), legsStanceA, b => swordIdle(b, 0, false)]);
const idleB = makeFrame([b => helm(b, 0, 'b'), b => torso(b, 0), legsStanceA, b => swordIdle(b, 0, true)]);
const walkA = makeFrame([b => helm(b, 0, 'a'), b => torso(b, 0), legsStanceA, b => swordIdle(b, 0, false)]);
const walkB = makeFrame([b => helm(b, 1, 'a'), b => torso(b, 1), legsStanceB, b => swordIdle(b, 1, false)]);
const atkA = makeFrame([b => helm(b, 0, 'a'), b => torso(b, 0), legsStanceA, swordRaised]);
const atkB = makeFrame([b => helm(b, 0, 'a'), b => torso(b, 0), legsStanceB, swordSwing]);
const atkC = makeFrame([b => helm(b, 0, 'b'), b => torso(b, 0), legsStanceA, swordFollow]);

export const PORTRAIT = {
  width: W,
  height: H,
  frames: { idle: [idleA, idleB], walk: [walkA, walkB], attack: [atkA, atkB, atkC] },
  timings: { idle: 400, walk: 130, attack: 80 },
};

// --- Ekran sanatı (DOM <pre> içinde gösterilir) ---

export const START_LOGO = [
  '   ____     ___    _   _   ____    _   _   _____       ___    ____    __  __    ____    _   _  ',
  '  / ___|   / _ \\  | \\ | | / ___|  | | | | |__  /      / _ \\  |  _ \\  |  \\/  |  / __ \\  | \\ | | ',
  '  \\___ \\  | | | | |  \\| | \\___ \\  | | | |   / /      | | | | | |_) | | |\\/| | | |__| | |  \\| | ',
  '   ___) | | |_| | | |\\  |  ___) | | |_| |  / /_      | |_| | |  _ <  | |  | | |  __  | | |\\  | ',
  '  |____/   \\___/  |_| \\_| |____/   \\___/  /____|      \\___/  |_| \\_\\ |_|  |_| |_|  |_| |_| \\_| ',
];

export const DEATH_LOGO = [
  ' ██ ██   ██     ██████    ██ ██   ██   ██ ',
  ' ██ ██   ██     ██  ██    ██ ██   ██   ██ ',
  ' ██████  ██     ██████   ██████  ██   ██ ',
  ' ██  ██  ██     ██       ██  ██  ██   ██ ',
  ' ██  ██  ██████ ██       ██  ██   █████  ',
];
