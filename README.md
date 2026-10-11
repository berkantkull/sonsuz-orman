# SONSUZ ORMAN

Tarayıcıda çalışan ASCII art MMORPG deneyimi. Elinde kılıcı olan bir orta çağ
şövalyesi, sonsuz prosedürel bir ormanda dolaşır; goblin, kurt, slime ve
troll'lerden Experience kazanarak seviye atlar. Etrafta diğer "oyuncular"
dolaşır, sohbet kanalı akar.

https://berkantkull.github.io/sonsuz-orman/

## Özellikler

- **Sonsuz dünya**: Deterministik hash + fBm gürültüsüyle üretilen orman;
  aynı seed'de herkes aynı ormanı görür. Ağaçlar, göller, patikalar, kayalar.
- **ASCII render motoru**: Canvas 2D üzerinde glyph atlası + chunk zemin
  cache'i — 100×40 hücrelik grid 60fps'te akar.
- **Gerçek zamanlı dövüş**: WASD/ok ile hareket, SPACE ile üç hücrelik yay
  şeklinde kılıç savurması, kritik vuruşlar, uçan hasar sayıları.
- **RPG sistemi**: XP, seviye atlama, savaş dışı rejenerasyon, ölüm cezası
  ve spawn'da yeniden doğma.
- **Simüle MMO**: İsimli sahte şövalyeler ormanda gezer, Türkçe sohbet akar,
  join/leave duyuruları yapılır, seviye atlayınca tebrik ederler.
- **Zorluk bantları**: Spawn'dan uzaklaştıkça düşmanlar güçlenir; band 3+
  bölgede troller (elite) görünür.
- **Kayıt**: Seviye/istatistikler localStorage'da tutulur.

## Kontroller

| Tuş | İşlev |
|---|---|
| `W A S D` / ok tuşları | Hareket |
| `SPACE` | Kılıç salla |
| `F1` | Debug bilgisi |

## Yerel çalıştırma

ES modules `file://` üzerinden çalışmadığı için basit bir HTTP sunucusu gerekir:

```
node serve.mjs        # http://localhost:8642
```

## Testler

```
node test_logic.mjs       # saf modül testleri (dünya, rng, sprites)
node test_browser.mjs     # DOM stub'lı uçtan uca simülasyon
```

## GitHub Pages deploy

1. Bu repoyu GitHub'a push et.
2. Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)`.
3. Birkaç dakika içinde `https://kullanici.github.io/repo-adi/` adresinde yayında.

Not: Tüm dosya adları küçük harftir (Pages Linux'ta case-sensitive) ve yollar
göreliidir — ek yapılandırma gerekmez.

## Teknoloji

Sıfır bağımlılık, build aracı yok: düz HTML/CSS/JS (ES modules). Ses WebAudio
ile anlık sentezlenir; resim/font dosyası yoktur. Denge değerlerinin tamamı
`js/config.js` içindedir.
