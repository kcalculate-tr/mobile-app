// Yeni kabuk (TabBarR3) geometrisi — TEK KAYNAK (G11-S2 · G16-S2).
//
// Tasarım: `design/final/FinTabBar-rest|mid|min` (telefon genişliği 393px).
//   · Cam hap: left 16, height 62, radius 31, 4 sekme.
//   · Ayrık "Tara" dairesi: right 16, tam 62 / küçük 52, radius %50.
//   · Küçük (mini) durum: hap → 52x52 tek daireye iner.
//
// G16-S2 (İlter, 6 Kas — telefonda "tab bar fazla yüksekte"): Instagram gibi
// çubuğun alt kenarı home indicator'ın hemen üstünde. Alt boşluk artık
// `insets.bottom + 4` (önce `insets.bottom + 24`); home tuşlu / insets 0
// cihazda 8. Hap, Tara, cam ve rest/mid/min durumları aynı satırda olduğu için
// hepsi aynı miktarda (20 pt) iner. İçerik alt boşluğu da buna göre küçülür.

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
  /** Barın safe-area (home indicator) üstündeki alt boşluğu — en fazla 4. */
  BOTTOM_GAP: 4,
  /** Güvenli alanı olmayan (home tuşlu, insets.bottom = 0) cihazda alt boşluk. */
  BOTTOM_GAP_NO_INSET: 8,
  /** Barın üstünde içerik için nefes payı (son liste öğesi barın altında kalmasın). */
  CONTENT_BREATH: 10,
  /** Sepet hapı ile bar arası boşluk (yüzen sepet çubuğu). */
  GAP: 12,
  /** Hap ile Tara dairesi arası boşluk — FinTabBar-rest: 393 − 16 − 289 − 10 − 62 − 16. */
  SCAN_GAP: 10,
  /** Küçük durumda hap içindeki seçili daire (FinTabBar-min: 44, ikon 22). */
  MINI_INNER: 44,
  MINI_ICON: 22,
  /** Tara ikonu — tam 22 / küçük 18. */
  SCAN_ICON: 22,
  SCAN_ICON_MINI: 18,
  /** Tara etiketi (13 pt, 600). G22-S2 md.2: sekmelerde yazı YOK, yalnız ikon. */
  LABEL_SIZE: 13,
  /** Apple HIG en küçük dokunma alanı (pt) — her sekme hücresi en az bu kadar. */
  MIN_TOUCH: 44,
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
 * Barın alt kenarının ekranın altına uzaklığı (px).
 * insets.bottom > 0 → insets.bottom + 4; home tuşlu cihaz → 8.
 */
export function tabBarBottomOffset(insetsBottom: number): number {
  return insetsBottom > 0
    ? insetsBottom + TAB_BAR_R3.BOTTOM_GAP
    : TAB_BAR_R3.BOTTOM_GAP_NO_INSET;
}

/**
 * Sekme KÖK ekranlarının içerik alt boşluğu (safe-area DAHİL): barın üst
 * kenarı + nefes payı. Yığın ekranları bunu KULLANMAZ — yalnız insets.bottom.
 */
export function tabBarContentInset(insetsBottom: number): number {
  return tabBarBottomOffset(insetsBottom) + TAB_BAR_R3.PILL_HEIGHT + TAB_BAR_R3.CONTENT_BREATH;
}

/**
 * Tab barın kapladığı yükseklik (safe-area insets.bottom HARİÇ), insets > 0
 * cihazlar için: hap (62) + alt boşluk (4) + nefes payı (10) = 76 (önce 96).
 * Yeni kod `tabBarContentInset(insets.bottom)` kullanır (home tuşlu cihazı da doğru verir).
 */
export const TAB_BAR_R3_HEIGHT =
  TAB_BAR_R3.PILL_HEIGHT + TAB_BAR_R3.BOTTOM_GAP + TAB_BAR_R3.CONTENT_BREATH; // 76
