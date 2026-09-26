import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Circle, Rect, Text as SvgText } from 'react-native-svg';

/**
 * Hemen teslimat haritası — İzmir körfez bölgesi, pin'li.
 *
 * ── Ölçek neden il geneli değil (26.09.2026) ───────────────────────────────
 * İl geneli görünümde altı ilçenin gerçek konumu 320 birimlik tuvalin 32
 * biriminde toplanıyordu; telefonda bu ~34 piksel, yani altı pin üst üste
 * biniyordu. Bu yüzden viewBox körfez çevresine yakınlaştırıldı. Körfez
 * İzmir'in en tanınan şekli olduğu için harita yakınken de İzmir olarak
 * okunuyor. Silüetin kendisi hâlâ gerçek il sınırı (referans haritadan
 * kontur çıkarılıp Douglas-Peucker ile sadeleştirildi; idari sınır = coğrafi
 * olgu).
 *
 * ── Pin konumları: gerçek + 1.7 kat açılmış ────────────────────────────────
 * Pin'ler ilçelerin enlem/boylamından projekte edildi, sonra kümenin
 * ağırlık merkezine göre 1.7 kat AÇILDI. Kartografyada standart bir yöntem:
 * göreli coğrafya korunuyor (Narlıdere en batıda, Bornova en doğuda,
 * Karabağlar güneyde) ama pin'ler birbirine yapışmıyor. Bu bir navigasyon
 * haritası değil, "hangi bölgeye gidiyoruz" sorusunun cevabı.
 *
 * Yakında açılacak ilçeler (Karşıyaka, Buca, Gaziemir, Menderes, Menemen)
 * bilerek haritada DEĞİL — açık olan bölgeyle karışmasınlar; onlar
 * haritanın altında tek satır not olarak duruyor.
 *
 * Ölçüler viewBox birimindedir: 112 birim genişlik ≈ 342 px, yani 1 birim
 * ≈ 3 px. Yazı boyutu 3.9 birim ≈ 12 px.
 */

const IL_YOLU =
  'M 6.0,214.2 L 6.0,217.0 L 13.3,217.6 L 19.5,223.8 L 26.2,223.8 L 30.1,227.7 L 38.5,229.9 L 47.5,241.2 L 56.5,243.4 L 60.4,227.1 L 76.7,226.0 L 76.7,233.3 L 83.4,235.6 L 90.7,255.2 L 96.3,250.1 L 105.9,249.6 L 114.3,252.9 L 123.8,262.5 L 139.0,263.0 L 142.9,268.7 L 142.3,278.8 L 163.1,275.9 L 179.4,261.9 L 219.7,265.3 L 248.9,256.3 L 276.4,256.3 L 283.1,251.8 L 298.3,249.6 L 314.0,242.8 L 309.0,236.1 L 301.7,214.2 L 285.9,210.3 L 282.6,204.1 L 271.9,208.6 L 259.0,209.2 L 258.5,194.0 L 243.3,196.3 L 232.7,191.8 L 226.5,203.6 L 218.1,205.8 L 208.0,187.9 L 196.2,185.6 L 191.7,181.7 L 187.2,167.7 L 156.4,166.0 L 151.3,163.2 L 147.9,150.8 L 144.0,144.1 L 139.0,143.0 L 138.4,136.8 L 147.9,126.2 L 151.9,108.8 L 167.0,102.6 L 176.6,94.2 L 181.0,84.6 L 172.6,68.9 L 170.9,55.5 L 162.0,32.5 L 149.1,21.2 L 114.3,40.3 L 99.7,56.6 L 91.8,59.4 L 85.1,66.7 L 75.0,70.1 L 81.7,72.3 L 91.3,85.2 L 90.7,88.0 L 80.1,94.7 L 82.9,112.7 L 103.1,109.9 L 105.3,112.7 L 112.0,112.1 L 113.7,118.9 L 93.5,127.8 L 98.0,136.3 L 93.0,140.2 L 83.4,137.4 L 72.2,140.7 L 70.0,143.5 L 70.5,154.8 L 80.6,164.9 L 86.2,164.9 L 83.4,175.0 L 95.2,182.8 L 95.2,189.0 L 104.2,189.6 L 107.5,186.2 L 114.3,185.6 L 123.8,187.9 L 123.3,192.4 L 119.9,194.6 L 109.2,192.9 L 104.2,196.3 L 80.1,201.3 L 73.3,191.2 L 68.3,189.6 L 63.2,198.5 L 59.9,199.1 L 55.9,191.8 L 55.9,186.7 L 60.4,185.1 L 58.7,175.0 L 51.4,168.2 L 44.7,154.8 L 30.7,149.7 L 21.1,155.3 L 23.4,173.8 L 27.9,182.8 L 18.3,190.1 L 21.7,191.8 L 23.4,186.7 L 27.9,188.4 L 33.5,184.5 L 41.9,192.4 L 35.2,191.2 L 37.4,200.8 L 34.6,203.6 L 26.2,204.1 L 25.6,209.2 L 19.5,205.3 L 17.8,198.5 L 13.3,199.7 L 12.2,212.6 Z';

const DENIZ = '#F2F6F8';
const KARA = '#E9F0E1';
const KARA_CIZGI = '#C2D0B4';
const HIZLI = '#B9EF14';

type Props = { height?: number };

function IzmirTeslimatHaritasi({ height = 232 }: Props) {
  return (
    <View
      style={{ width: '100%', height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="İzmir körfezi haritası. Hemen teslimat yapılan ilçeler: Narlıdere, Balçova, Karabağlar, Konak, Bayraklı, Bornova."
    >
      <Svg width="100%" height="100%" viewBox="74 148 112 78">
        <Rect x={74} y={148} width={112} height={78} fill={DENIZ} />
        <Path d={IL_YOLU} fill={KARA} stroke={KARA_CIZGI} strokeWidth={0.39} />

        <SvgText x={84} y={197} fontSize={3.3} fontWeight="600" fill="#93A8B4" textAnchor="middle">
          İzmir Körfezi
        </SvgText>

        <Circle cx={96.5} cy={188.0} r={1.8} fill="#111111" />
        <Circle cx={96.5} cy={188.0} r={0.72} fill={HIZLI} />
        <Circle cx={111.0} cy={189.3} r={1.8} fill="#111111" />
        <Circle cx={111.0} cy={189.3} r={0.72} fill={HIZLI} />
        <Circle cx={121.0} cy={197.0} r={1.8} fill="#111111" />
        <Circle cx={121.0} cy={197.0} r={0.72} fill={HIZLI} />
        <Circle cx={129.7} cy={180.7} r={1.8} fill="#111111" />
        <Circle cx={129.7} cy={180.7} r={0.72} fill={HIZLI} />
        <Circle cx={140.0} cy={168.8} r={1.8} fill="#111111" />
        <Circle cx={140.0} cy={168.8} r={0.72} fill={HIZLI} />
        <Circle cx={151.1} cy={166.6} r={1.8} fill="#111111" />
        <Circle cx={151.1} cy={166.6} r={0.72} fill={HIZLI} />

        <SvgText x={96.5} y={184.4} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="middle">
          Narlıdere
        </SvgText>
        <SvgText x={111.0} y={194.9} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="middle">
          Balçova
        </SvgText>
        <SvgText x={121.0} y={202.6} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="middle">
          Karabağlar
        </SvgText>
        <SvgText x={129.7} y={177.1} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="middle">
          Konak
        </SvgText>
        <SvgText x={143.0} y={170.4} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="start">
          Bayraklı
        </SvgText>
        <SvgText x={151.1} y={163.0} fontSize={3.9} fontWeight="700"
          fill="#1A1A1A" textAnchor="middle">
          Bornova
        </SvgText>
      </Svg>
    </View>
  );
}

export default React.memo(IzmirTeslimatHaritasi);
