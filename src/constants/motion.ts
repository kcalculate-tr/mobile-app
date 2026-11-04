import { Easing } from 'react-native';

/**
 * Hareket (animasyon) tokenları — tek kaynak.
 *
 * 24.09.2026 denetimi: uygulamada 16 ayrı süre değeri (100, 150, 160, 180,
 * 200, 220, 250, 260, 300, 350, 400, 500, 520, 800, 900, 1000), 12 ayrı
 * `speed` ve 11 ayrı `bounciness` vardı; ~45 timing animasyonunun yalnız
 * 6'sında easing belirtilmişti (gerisi RN varsayılanı olan
 * Easing.inOut(Easing.ease) ile gidiyordu). Aynı jest ekrandan ekrana farklı
 * hızda ve farklı yumuşamayla oynuyordu — tek tek bakınca fark edilmiyor,
 * bir arada kullanınca "derli toplu değil" hissi veriyor.
 *
 * Kural: yeni bir animasyon yazarken buradan bir token seç. Buradaki
 * değerlerden biri işini görmüyorsa önce gerçekten yeni bir KATEGORİ mi
 * diye düşün; öyleyse token ekle, değilse en yakınını kullan.
 */

/**
 * Süreler (ms) — FinMoTokens v2'ye hizalı (`design/final/FinMoTokens.dc.html`):
 * `instant 100 · fast 200 · base 300 · slow 500 · story 900+`. `pulse`/`sweep`
 * v2'de "story 900+" bandının takma adlarıdır (mevcut tüketiciler korunur).
 */
export const DURATION = {
  /** 100 — dokunma geri bildirimi, küçük ölçek/opaklık sıçraması (v2 instant). */
  instant: 100,
  /** 200 — durum değişimi, crossfade, kaydet, sheet kapanış (v2 fast). */
  fast: 200,
  /** 300 — giriş/geçiş, liste öğesi belirmesi (v2 base). */
  base: 300,
  /** 500 — ekran ölçeğinde hareket, ilerleme dolumu, vurgu (v2 slow). */
  slow: 500,
  /** 900 — "nefes alan" döngüler, sayı sayma (v2 story). */
  pulse: 900,
  /** 1400 — yüzeyden geçen ışık bandı (v2 story 900+). */
  sweep: 1400,
} as const;

/**
 * Yumuşama eğrileri — FinMoTokens v2 üç eğri. `enter`/`move` korunur; `standard`
 * ve `exit` eklenir. `move` v2'de `standard` ile aynıdır (döngü/yerinde değişim).
 */
export const EASING = {
  /** yerinde değişim, döngü, sabit hız (v2 standard). */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** giriş — dışarıdan gelir, yumuşak oturur (v2 enter). */
  enter: Easing.bezier(0.05, 0.7, 0.1, 1),
  /** çıkış — girişten kısa (v2 exit). */
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
  /** @deprecated → standard (döngüler/yerinde değişim). */
  move: Easing.bezier(0.2, 0, 0, 1),
} as const;

/**
 * Yay (spring) ayarları. İki tane var, bilerek:
 * - `press`: basılma geri bildirimi. Zıplama YOK — buton zıplarsa ucuz durur.
 * - `enter`: bir şeyin sahneye gelişi. Az miktarda zıplama canlılık katar.
 */
export const SPRING = {
  press: { speed: 20, bounciness: 0 },
  enter: { speed: 14, bounciness: 8 },
} as const;

/** Basılı haldeki ölçek — tüm dokunulabilir yüzeylerde aynı. */
export const PRESS_SCALE = 0.97;
