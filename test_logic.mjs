// Saf modüllerin import + davranış testi (DOM gerektirenler hariç)
import assert from 'node:assert';

// 1) rng determinizmi
const { hash2, hash2i, mulberry32, fbm } = await import('./js/rng.js');
assert.strictEqual(hash2(5, -7, 42), hash2(5, -7, 42), 'hash2 deterministik olmali');
assert.ok(hash2(-100, 200, 1) >= 0 && hash2(-100, 200, 1) < 1, 'hash2 aralik [0,1)');
assert.strictEqual(hash2i(0, 0, 0) !== hash2i(0, 1, 0), true, 'farkli koordinat farkli hash');
const r1 = mulberry32(7), r2 = mulberry32(7);
for (let i = 0; i < 10; i++) assert.strictEqual(r1(), r2(), 'mulberry32 deterministik');
assert.ok(fbm(3.5, -2.2, 9) >= 0 && fbm(3.5, -2.2, 9) <= 1, 'fbm aralik');
console.log('rng OK');

// 2) dünya: determinizm, negatif koordinat, spawn geçilebilirliği
const world = await import('./js/world.js');
const t1 = world.getTile(-33, 47), t2 = world.getTile(-33, 47);
assert.strictEqual(t1, t2, 'ayni koordinat ayni tile');
assert.strictEqual(world.isPassable(0, 0), true, 'spawn (0,0) geçilebilir');
let passable = 0, total = 400;
for (let x = -10; x < 10; x++) for (let y = -10; y < 10; y++) {
  if (world.isPassable(x, y)) passable++;
}
assert.ok(passable > total * 0.7, `güvenli bölge çoğunlukla geçilebilir (${passable}/${total})`);
// uzak bölgede tile dağılımı (sonsuz orman üretiliyor mu)
const counts = {};
for (let x = 500; x < 600; x++) for (let y = -800; y < -700; y++) {
  const t = world.getTile(x, y);
  counts[t] = (counts[t] || 0) + 1;
}
assert.ok(Object.keys(counts).length >= 3, 'uzak bölgede çeşitli tile var');
assert.ok(world.difficultyBand(0, 0) === 0 && world.difficultyBand(0, 55) === 2, 'zorluk bandı');
console.log('world OK — uzak bölge tile dağılımı:', counts);

// 3) entities + enemy + combat + chat import zinciri (dairesel import dahil)
await import('./js/entities.js');
const { ENEMY_TYPES, ENEMY_SPRITES, makeEnemy } = await import('./js/enemy.js');
const e = makeEnemy('goblin', 5, 5, 3);
assert.strictEqual(e.hp, e.maxHp, 'düşman dolu hp doğar');
assert.ok(e.maxHp > ENEMY_TYPES.goblin.hp, 'bant çarpanı hp artırır (lvl 3)');
// sprite verisi tutarlı mı (boyutlar, renk ızgarası, plaka)
for (const [k, sp] of Object.entries(ENEMY_SPRITES)) {
  assert.strictEqual(sp.rows.length, sp.h, `${k} satır sayısı`);
  assert.strictEqual(sp.colors.length, sp.h, `${k} renk satır sayısı`);
  sp.rows.forEach((row, i) => {
    assert.strictEqual(row.length, sp.w, `${k} satır ${i} genişliği`);
    assert.strictEqual(sp.colors[i].length, sp.w, `${k} renk ${i} genişliği`);
  });
  assert.ok(typeof sp.plate === 'string', `${k} plaka rengi tanımlı`);
}
console.log('entities/enemy OK');

// 4) npc isim üretimi
const { makeNpcName } = await import('./js/npc.js');
const names = new Set();
for (let i = 0; i < 30; i++) names.add(makeNpcName(Math.random));
assert.ok(names.size > 5, 'isimler çeşitli');
console.log('npc OK — örnek isimler:', [...names].slice(0, 4).join(', '));

// 5) sprites kareleri tutarlı mı (satır sayısı/uzunluk)
const { PORTRAIT } = await import('./js/sprites.js');
for (const [anim, frames] of Object.entries(PORTRAIT.frames)) {
  assert.ok(frames.length >= 2, `${anim} en az 2 kare`);
  for (const f of frames) {
    assert.strictEqual(f.rows.length, PORTRAIT.height, `${anim} satır sayısı`);
    assert.strictEqual(f.colors.length, PORTRAIT.height, `${anim} renk satır sayısı`);
    for (const row of f.rows) assert.strictEqual(row.length, PORTRAIT.width, `${anim} satır genişliği`);
  }
}
console.log('sprites OK');

// 6) chat mesaj havuzları dolu mu
const chatSrc = await import('./js/chat.js');
assert.strictEqual(typeof chatSrc.updateChat, 'function', 'updateChat export');
console.log('chat OK');

console.log('\nTÜM TESTLER GEÇTİ');
