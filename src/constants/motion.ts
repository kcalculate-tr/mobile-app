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

/** Süreler (ms). Dört kademe; arası doldurulmaz. */
export const DURATION = {
  /** 120 — dokunma geri bildirimi, küçük ölçek/opaklık sıçraması. */
  instant: 120,
  /** 200 — durum değişimi: görünür/gizli, seçili/seçili değil, renk geçişi. */
  fast: 200,
  /** 280 — giriş/çıkış, çapraz geçiş, liste öğesi belirmesi. */
  base: 280,
  /** 420 — ekran ölçeğinde hareket, ilerleme çubuğu dolumu, vurgu. */
  slow: 420,
  /**
   * 900 — "nefes alan" döngüler (iskelet parıltısı, canlı sipariş nabzı) ve
   * sayı sayma. Bu ikisi aynı kademede, çünkü ikisi de İZLENİR: göz değişimi
   * takip eder, tek karede algılanan bir durum değişimi değildir.
   */
  pulse: 900,
  /** 1400 — bir yüzeyin üzerinden geçen ışık bandı. */
  sweep: 1400,
} as const;

/**
 * Yumuşama eğrileri.
 * - `enter`: dışarıdan gelen hareket hızlı başlar, yavaş oturur.
 * - `exit`: gidiş hızlanarak çıkar.
 * - `move`: iki durum arasında gidip gelen hareket (döngüler dahil).
 */
export const EASING = {
  enter: Easing.out(Easing.cubic),
  exit: Easing.in(Easing.cubic),
  move: Easing.inOut(Easing.quad),
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
