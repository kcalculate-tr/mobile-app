// Yeni kabuk (TabBarR3) geometrisi — TEK KAYNAK (G11-S2).
//
// Tasarım: `.claude/night/design/t20/TabBarR3.dc.html` (telefon genişliği 393px).
//   · Cam hap: left 16, bottom 24, height 62, radius 31, 4 sekme.
//   · Ayrık "Tara" dairesi: right 16, bottom 24, tam 62 / küçük 52, radius %50.
//   · Küçük (mini) durum: hap → 52x52 tek daireye iner.
//
// `TAB_BAR_R3_HEIGHT` = tab barın ekranda kapladığı yükseklik (safe-area HARİÇ).
// Ekran listeleri alt boşluğu bunu + insets.bottom ile verir. G11-CONTRACT
// paralel aşamada S3/S4'e `insets.bottom + 96` yazdırır; S6 bu sabite bağlar —
// o yüzden değer 96'da sabittir.

export const TAB_BAR_R3 = {
  /** Cam hap yüksekliği. */
  PILL_HEIGHT: 62,
  /** Cam hap köşe yarıçapı (tam yuvarlak uç). */
  PILL_RADIUS: 31,
  /** İç aktif gösterge (bubble) kenar boşluğu. */
  BUBBLE_PAD: 4,
  /** Aktif gösterge köşe yarıçapı. */
  BUBBLE_RADIUS: 26,
  /** Ekran kenarından boşluk (sol hap, sağ Tara). */
  SIDE_INSET: 16,
  /** Barın safe-area üstündeki alt boşluğu. */
  BOTTOM_GAP: 24,
  /** Hap ile Tara dairesi arası boşluk. */
  GAP: 12,
  /** Tara dairesi — tam durum. */
  SCAN_SIZE: 62,
  /** Tara dairesi — küçük (kaydırınca) durum. */
  SCAN_SIZE_MINI: 52,
  /** Mini durumda hapın indiği tek daire. */
  MINI_SIZE: 52,
  /** Sekme ikonu boyutu. */
  ICON_SIZE: 24,
} as const;

/**
 * Tab barın kapladığı toplam yükseklik (safe-area insets.bottom HARİÇ).
 * İçerik alt boşluğu = `useSafeAreaInsets().bottom + TAB_BAR_R3_HEIGHT`.
 * = hap (62) + alt boşluk (24) + üst nefes payı (10) = 96.
 */
export const TAB_BAR_R3_HEIGHT =
  TAB_BAR_R3.PILL_HEIGHT + TAB_BAR_R3.BOTTOM_GAP + 10; // 96
