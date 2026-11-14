// G39-S1 md.3 / G52-S1 md.1 — "Kcalculate AI" işareti: Kcalculate logosu + bir boşluk + "AI" (isteğe bağlı
// aynı satırda ek: "Koç" / "Coach"). Marka işareti/başlık konumundaki TÜM kullanımlar bu bileşenden geçer
// (Paywall, abonelik sonucu, Koç Ana sayfa kartı, Koç sohbet başlığı, Koç tanıtımı, Profil AI grubu).
//  • "AI" Bricolage Grotesque Bold; BÜYÜK HARF yüksekliği logo yüksekliğine eşit:
//    font cap-height 660/1000 (OS/2 sCapHeight, BricolageGrotesque_700Bold.ttf) →
//    fontSize = height / 0.66. Taban çizgisi logonun alt kenarına oturur (logo kırpılmış
//    viewBox, inişsiz harfler): satır yüksekliği = ascender+descender (1,2 em), alt
//    boşluk = descender (0,27 em) negatif kenar boşluğuyla geri alınır.
//  • Logo ile "AI" arası BİR BOŞLUK: aynı fontun boşluk karakteri genişliği (hmtx: 230/1000 em).
//  • Yerine geçtiği yazının cap-height'ı: `kcalAiHeightFor(fontSize, 'heading' | 'body')`
//    (Bricolage 0,66 · Plus Jakarta Sans 0,745 — OS/2 sCapHeight).
//  • Renk tema metin rengi (Light siyah · Dark beyaz) ya da çağıranın verdiği renk (lime kartta siyah).
//  • Dynamic Type: logo + "AI" birlikte, tek parça büyür (yazı tipi ölçeği, en çok 1,3×) — orantı
//    bozulmaz; dar alanda satır kırılır (küçültme yok).
//  • VoiceOver: tek öğe, varsayılan "Kcalculate AI".
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import { BrandLogo, useTheme } from '../../../core/design';

const CAP = 0.66;
const ASC = 0.93;
const DESC = 0.27;
/** Bricolage Grotesque Bold boşluk karakteri genişliği (em). */
const SPACE = 0.23;
/** Yazı tiplerinin cap-height oranı (OS/2 sCapHeight / unitsPerEm). */
export const CAP_HEIGHT = { heading: 0.66, body: 0.745 } as const;
/** Dynamic Type üst sınırı (başlık/kart kuralı). */
export const KCAL_AI_MAX_SCALE = 1.3;
export const KCAL_AI_LABEL = 'Kcalculate AI';

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Yerine geçtiği yazının cap-height'ı → işaret yüksekliği. */
export function kcalAiHeightFor(fontSize: number, family: keyof typeof CAP_HEIGHT = 'heading') {
  return r1(fontSize * CAP_HEIGHT[family]);
}

export function kcalAiMetrics(height: number) {
  const fontSize = r1(height / CAP);
  return {
    fontSize,
    lineHeight: r1(fontSize * (ASC + DESC)),
    marginBottom: -r1(fontSize * DESC),
    gap: r1(fontSize * SPACE),
  };
}

export function KcalAiMark({
  height = 16,
  color,
  label,
  suffix,
  role = 'text',
  style,
  testID = 'kcalai-mark',
}: {
  height?: number;
  color?: string;
  /** VoiceOver etiketi (varsayılan "Kcalculate AI"). */
  label?: string;
  /** "AI"dan sonra aynı satırda, aynı fontla (ör. "Koç"). */
  suffix?: string;
  /** Başlık yerine duruyorsa 'header' (VoiceOver başlık özelliği). */
  role?: 'text' | 'header';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const ink = color ?? t.color.ink;
  const h = r1(height * Math.min(fontScale || 1, KCAL_AI_MAX_SCALE));
  const m = kcalAiMetrics(h);
  return (
    <View
      style={[styles.row, { columnGap: m.gap }, style]}
      accessible
      accessibilityRole={role}
      accessibilityLabel={label ?? KCAL_AI_LABEL}
      testID={testID}
    >
      <BrandLogo name="kcalculate" height={h} color={ink} decorative testID={`${testID}-logo`} />
      <Text
        allowFontScaling={false}
        style={[styles.ai, { color: ink, fontSize: m.fontSize, lineHeight: m.lineHeight, marginBottom: m.marginBottom }]}
        testID={`${testID}-ai`}
      >
        {suffix ? `AI ${suffix}` : 'AI'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', flexShrink: 1 },
  ai: { fontFamily: 'BricolageGrotesque_700Bold', includeFontPadding: false, flexShrink: 1 },
});
