import type { TextStyle } from 'react-native';

/**
 * Yazı sistemi.
 *
 * İki aile:
 *  - Başlıklar: Bricolage Grotesque (display/title/heading). Karakterli,
 *    sıkışık grotesk; yalnız büyük boylarda kullanılır.
 *  - Gövde: Plus Jakarta Sans (body/caption + tüm UI metni). Paket zaten var,
 *    App.tsx yüklüyor.
 *
 * Ölçek 5 kademe: display > title > heading > body > caption.
 *
 * Dynamic Type: her kademe `allowFontScaling: true` ile gelir (erişilebilirlik).
 * Ancak kontrolsüz büyüme düzeni kırar, bu yüzden her kademeye bir
 * `maxFontSizeMultiplier` tavanı koyarız — başlıklar az büyür (zaten büyük,
 * taşarsa satır kırılır), gövde daha çok büyür (okunabilirlik önemli).
 */

export const fontFamily = {
  // Başlık ailesi (Bricolage) — fonts.ts ile yüklenir.
  headingRegular: 'BricolageGrotesque_400Regular',
  headingMedium: 'BricolageGrotesque_500Medium',
  headingSemibold: 'BricolageGrotesque_600SemiBold',
  headingBold: 'BricolageGrotesque_700Bold',
  headingExtrabold: 'BricolageGrotesque_800ExtraBold',

  // Gövde ailesi (Plus Jakarta Sans) — App.tsx yüklüyor.
  bodyRegular: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemibold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export type TypeScaleKey = 'display' | 'title' | 'heading' | 'body' | 'caption';

/**
 * Her kademe tam bir TextStyle verir (fontFamily dahil). `maxFontSizeMultiplier`
 * stil değil prop olduğundan ayrıca `scaleCap` olarak da dışa veriyoruz; metin
 * yardımcısı (Text bileşeni) ikisini birlikte uygular.
 */
export interface TypeScaleEntry {
  style: TextStyle;
  /** <Text maxFontSizeMultiplier={...}> için tavan. */
  scaleCap: number;
}

export const type: Record<TypeScaleKey, TypeScaleEntry> = {
  display: {
    style: {
      fontFamily: fontFamily.headingExtrabold,
      fontSize: 40,
      lineHeight: 44,
      letterSpacing: -0.5,
    },
    scaleCap: 1.2,
  },
  title: {
    style: {
      fontFamily: fontFamily.headingBold,
      fontSize: 28,
      lineHeight: 32,
      letterSpacing: -0.3,
    },
    scaleCap: 1.3,
  },
  heading: {
    style: {
      fontFamily: fontFamily.headingSemibold,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.2,
    },
    scaleCap: 1.4,
  },
  body: {
    style: {
      fontFamily: fontFamily.bodyRegular,
      fontSize: 16,
      lineHeight: 24,
    },
    scaleCap: 1.6,
  },
  caption: {
    style: {
      fontFamily: fontFamily.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
    },
    scaleCap: 1.6,
  },
} as const;

/**
 * FinComponents rolleri (Final tek ölçü kaynağı: tipografi 24 / 20 / 20 / 17 / 15 / 13).
 * `type` genel ölçek kademesidir; `role` ise Final panolarındaki EKRAN rolleridir
 * (ana başlık, bölüm, alt sayfa başlığı, gövde, küçük gövde, yardımcı). Aynı font
 * ailelerini kullanır; yeni renk/font sistemi KURMAZ.
 */
export type RoleKey =
  | 'screenTitle' // Ana başlık · 24
  | 'section' // Bölüm · 20
  | 'sheetTitle' // Alt sayfa · 20
  | 'body' // Gövde · 17
  | 'bodySm' // Gövde · 15
  | 'helper'; // Yardımcı · 13

export const role: Record<RoleKey, TypeScaleEntry> = {
  screenTitle: {
    style: { fontFamily: fontFamily.headingBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
    scaleCap: 1.3,
  },
  section: {
    style: { fontFamily: fontFamily.headingSemibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
    scaleCap: 1.4,
  },
  sheetTitle: {
    style: { fontFamily: fontFamily.headingSemibold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
    scaleCap: 1.4,
  },
  body: {
    style: { fontFamily: fontFamily.bodyRegular, fontSize: 17, lineHeight: 24 },
    scaleCap: 1.6,
  },
  bodySm: {
    style: { fontFamily: fontFamily.bodyRegular, fontSize: 15, lineHeight: 22 },
    scaleCap: 1.6,
  },
  helper: {
    style: { fontFamily: fontFamily.bodyMedium, fontSize: 13, lineHeight: 18 },
    scaleCap: 1.6,
  },
} as const;

/**
 * En büyük Dynamic Type boyunda kırılma kuralı (bileşenlerin uyması için not):
 *  - Başlıklar (display/title/heading): tek satıra ZORLAMA; `numberOfLines`
 *    verme, satır kırılsın. `scaleCap` düşük tutuldu ki taşma sınırlı kalsın.
 *  - Gövde/caption: serbest büyüsün, kap içinde sarmalasın.
 *  - Lime rozet/pill gibi sabit yükseklikli öğelerde yazı büyürse yükseklik de
 *    büyümeli (sabit height yerine minHeight + padding).
 */
export const DYNAMIC_TYPE_RULES = {
  headingsAllowWrap: true,
  pillsUseMinHeight: true,
} as const;
