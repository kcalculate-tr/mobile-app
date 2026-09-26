import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

/**
 * Hemen teslimat haritası — İzmir il silüeti + ilçe pin'leri.
 *
 * ── Silüet ─────────────────────────────────────────────────────────────────
 * Gerçek il sınırı: referans il haritasından kontur çıkarılıp Douglas-Peucker
 * ile 123 noktaya sadeleştirildi. İdari sınır, yani coğrafi olgu.
 *
 * ── Pin konumları ──────────────────────────────────────────────────────────
 * 26.09.2026: konumlar İLTER'İN ÇİZİMİNDEN alındı. Onun çizimindeki piksel
 * koordinatları, il sınırının ortak kutusu üzerinden bu viewBox'a
 * dönüştürüldü. Gerçek enlem/boylam projeksiyonuna göre biraz daha açık ve
 * güneye kaymışlar — bilerek: altı ilçe gerçek ölçekte tuvalin 32 biriminde
 * toplanıyor, telefonda ~34 piksel, yani pin'ler üst üste biniyor. Bu açılma
 * göreli coğrafyayı koruyor (Narlıdere en batıda, Bornova en doğuda,
 * Karabağlar güneyde) ve haritayı okunur kılıyor.
 *
 * ── Etiket yerleşimi ───────────────────────────────────────────────────────
 * Etiket ofsetleri elle değil, çarpışma çözücüyle bulundu: her pin için sekiz
 * aday yön denendi, hiçbir etiketin başka bir etiketle veya herhangi bir
 * pin'le kesişmediği ilk kombinasyon seçildi (en geniş etiketten başlayarak).
 * Elle ayarlanan önceki denemelerde BALÇOVA sürekli NARLIDERE pin'inin,
 * KONAK da BAYRAKLI etiketinin üstüne biniyordu.
 *
 * Yakında açılacak ilçeler (Karşıyaka, Buca, Gaziemir, Menderes, Menemen)
 * bilerek haritada DEĞİL — açık olan bölgeyle karışmasınlar; onlar haritanın
 * altında tek satır not olarak duruyor.
 *
 * Ölçüler viewBox birimindedir: 320 birim ≈ 342 px, yani 1 birim ≈ 1.07 px.
 * Yazı 8.5 birim ≈ 9 px — harita etiketi için normal boy.
 */

const IL_YOLU =
  'M 6.0,214.2 L 6.0,217.0 L 13.3,217.6 L 19.5,223.8 L 26.2,223.8 L 30.1,227.7 L 38.5,229.9 L 47.5,241.2 L 56.5,243.4 L 60.4,227.1 L 76.7,226.0 L 76.7,233.3 L 83.4,235.6 L 90.7,255.2 L 96.3,250.1 L 105.9,249.6 L 114.3,252.9 L 123.8,262.5 L 139.0,263.0 L 142.9,268.7 L 142.3,278.8 L 163.1,275.9 L 179.4,261.9 L 219.7,265.3 L 248.9,256.3 L 276.4,256.3 L 283.1,251.8 L 298.3,249.6 L 314.0,242.8 L 309.0,236.1 L 301.7,214.2 L 285.9,210.3 L 282.6,204.1 L 271.9,208.6 L 259.0,209.2 L 258.5,194.0 L 243.3,196.3 L 232.7,191.8 L 226.5,203.6 L 218.1,205.8 L 208.0,187.9 L 196.2,185.6 L 191.7,181.7 L 187.2,167.7 L 156.4,166.0 L 151.3,163.2 L 147.9,150.8 L 144.0,144.1 L 139.0,143.0 L 138.4,136.8 L 147.9,126.2 L 151.9,108.8 L 167.0,102.6 L 176.6,94.2 L 181.0,84.6 L 172.6,68.9 L 170.9,55.5 L 162.0,32.5 L 149.1,21.2 L 114.3,40.3 L 99.7,56.6 L 91.8,59.4 L 85.1,66.7 L 75.0,70.1 L 81.7,72.3 L 91.3,85.2 L 90.7,88.0 L 80.1,94.7 L 82.9,112.7 L 103.1,109.9 L 105.3,112.7 L 112.0,112.1 L 113.7,118.9 L 93.5,127.8 L 98.0,136.3 L 93.0,140.2 L 83.4,137.4 L 72.2,140.7 L 70.0,143.5 L 70.5,154.8 L 80.6,164.9 L 86.2,164.9 L 83.4,175.0 L 95.2,182.8 L 95.2,189.0 L 104.2,189.6 L 107.5,186.2 L 114.3,185.6 L 123.8,187.9 L 123.3,192.4 L 119.9,194.6 L 109.2,192.9 L 104.2,196.3 L 80.1,201.3 L 73.3,191.2 L 68.3,189.6 L 63.2,198.5 L 59.9,199.1 L 55.9,191.8 L 55.9,186.7 L 60.4,185.1 L 58.7,175.0 L 51.4,168.2 L 44.7,154.8 L 30.7,149.7 L 21.1,155.3 L 23.4,173.8 L 27.9,182.8 L 18.3,190.1 L 21.7,191.8 L 23.4,186.7 L 27.9,188.4 L 33.5,184.5 L 41.9,192.4 L 35.2,191.2 L 37.4,200.8 L 34.6,203.6 L 26.2,204.1 L 25.6,209.2 L 19.5,205.3 L 17.8,198.5 L 13.3,199.7 L 12.2,212.6 Z';

const ZEMIN = '#F7F9F5';
const KARA = '#E4EDDA';
const KARA_CIZGI = '#BCCBAD';
const HIZLI = '#B9EF14';

/** viewBox 320x268 — kap da aynı oranda olmalı. */
const ORAN = 320 / 268;

type Props = { height?: number };

function IzmirTeslimatHaritasi({ height }: Props) {
  return (
    <View
      style={[
        { width: '100%', borderRadius: 16, overflow: 'hidden' },
        // 26.09.2026: sabit yükseklikte harita bazı ekranlarda kenarından
        // kırpılıyordu. Kap viewBox ile aynı oranda olunca SVG ne bant
        // bırakır ne kırpılır.
        height ? { height } : { aspectRatio: ORAN },
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="İzmir haritası. Hemen teslimat yapılan ilçeler: Narlıdere, Balçova, Karabağlar, Konak, Bayraklı, Bornova."
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 16 320 268"
        preserveAspectRatio="xMidYMid meet"
      >
        <Rect x={0} y={16} width={320} height={268} fill={ZEMIN} />
        <Path d={IL_YOLU} fill={KARA} stroke={KARA_CIZGI} strokeWidth={1.1} />

        <Circle cx={93.0} cy={206.6} r={2.7} fill="#111111" />
        <Circle cx={93.0} cy={206.6} r={1.05} fill={HIZLI} />
        <Circle cx={110.2} cy={201.9} r={2.7} fill="#111111" />
        <Circle cx={110.2} cy={201.9} r={1.05} fill={HIZLI} />
        <Circle cx={125.0} cy={215.8} r={2.7} fill="#111111" />
        <Circle cx={125.0} cy={215.8} r={1.05} fill={HIZLI} />
        <Circle cx={127.3} cy={195.2} r={2.7} fill="#111111" />
        <Circle cx={127.3} cy={195.2} r={1.05} fill={HIZLI} />
        <Circle cx={147.8} cy={185.8} r={2.7} fill="#111111" />
        <Circle cx={147.8} cy={185.8} r={1.05} fill={HIZLI} />
        <Circle cx={171.1} cy={180.9} r={2.7} fill="#111111" />
        <Circle cx={171.1} cy={180.9} r={1.05} fill={HIZLI} />

        <SvgText x={87.3} y={209.5} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="end">
          NARLIDERE
        </SvgText>
        <SvgText x={105.0} y={197.0} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="end">
          BALÇOVA
        </SvgText>
        <SvgText x={130.7} y={218.7} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="start">
          KARABAĞLAR
        </SvgText>
        <SvgText x={133.0} y={198.1} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="start">
          KONAK
        </SvgText>
        <SvgText x={142.6} y={180.9} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="end">
          BAYRAKLI
        </SvgText>
        <SvgText x={176.8} y={183.8} fontSize={8.5}
          fontWeight="700" fill="#141414" textAnchor="start">
          BORNOVA
        </SvgText>
      </Svg>
    </View>
  );
}

export default React.memo(IzmirTeslimatHaritasi);
