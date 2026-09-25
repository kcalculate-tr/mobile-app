import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Ellipse, Line, Circle, Text as SvgText } from 'react-native-svg';

/**
 * İzmir teslimat haritası — gerçek il silüeti.
 *
 * 25.09.2026 — şekil nereden geliyor:
 * İzmir il sınırı, referans bir il haritasından konturu çıkarılıp
 * Douglas-Peucker ile 123 noktaya sadeleştirilerek üretildi. Bu bir idari
 * sınır, yani coğrafi olgu; telefon ekranında okunur kalsın diye kasıtlı
 * olarak kabalaştırıldı. Önceki sürümdeki serbest çizim "blob" İzmir'e
 * benzemiyordu.
 *
 * Hemen teslimat bölgesi körfez başının güney ve doğusunda toplanıyor
 * (Konak, Karabağlar, Balçova, Narlıdere + 1 Ekim'den itibaren Bayraklı ve
 * Bornova). İlçe adları haritaya YAZILMIYOR: altı ilçe 320x300'lük bir
 * alanda 30 piksele sığışıyor ve üst üste biniyordu. Adlar haritanın altında
 * rozet olarak, canlı veriden geliyor.
 *
 * Elips bilerek kırpılmıyor: il sınırına clip edildiğinde körfezin ucu
 * yeşilin içinde beyaz bir leke bırakıyor, kusur gibi duruyordu.
 */

const IL_YOLU =
  'M 6.0,214.2 L 6.0,217.0 L 13.3,217.6 L 19.5,223.8 L 26.2,223.8 L 30.1,227.7 L 38.5,229.9 L 47.5,241.2 L 56.5,243.4 L 60.4,227.1 L 76.7,226.0 L 76.7,233.3 L 83.4,235.6 L 90.7,255.2 L 96.3,250.1 L 105.9,249.6 L 114.3,252.9 L 123.8,262.5 L 139.0,263.0 L 142.9,268.7 L 142.3,278.8 L 163.1,275.9 L 179.4,261.9 L 219.7,265.3 L 248.9,256.3 L 276.4,256.3 L 283.1,251.8 L 298.3,249.6 L 314.0,242.8 L 309.0,236.1 L 301.7,214.2 L 285.9,210.3 L 282.6,204.1 L 271.9,208.6 L 259.0,209.2 L 258.5,194.0 L 243.3,196.3 L 232.7,191.8 L 226.5,203.6 L 218.1,205.8 L 208.0,187.9 L 196.2,185.6 L 191.7,181.7 L 187.2,167.7 L 156.4,166.0 L 151.3,163.2 L 147.9,150.8 L 144.0,144.1 L 139.0,143.0 L 138.4,136.8 L 147.9,126.2 L 151.9,108.8 L 167.0,102.6 L 176.6,94.2 L 181.0,84.6 L 172.6,68.9 L 170.9,55.5 L 162.0,32.5 L 149.1,21.2 L 114.3,40.3 L 99.7,56.6 L 91.8,59.4 L 85.1,66.7 L 75.0,70.1 L 81.7,72.3 L 91.3,85.2 L 90.7,88.0 L 80.1,94.7 L 82.9,112.7 L 103.1,109.9 L 105.3,112.7 L 112.0,112.1 L 113.7,118.9 L 93.5,127.8 L 98.0,136.3 L 93.0,140.2 L 83.4,137.4 L 72.2,140.7 L 70.0,143.5 L 70.5,154.8 L 80.6,164.9 L 86.2,164.9 L 83.4,175.0 L 95.2,182.8 L 95.2,189.0 L 104.2,189.6 L 107.5,186.2 L 114.3,185.6 L 123.8,187.9 L 123.3,192.4 L 119.9,194.6 L 109.2,192.9 L 104.2,196.3 L 80.1,201.3 L 73.3,191.2 L 68.3,189.6 L 63.2,198.5 L 59.9,199.1 L 55.9,191.8 L 55.9,186.7 L 60.4,185.1 L 58.7,175.0 L 51.4,168.2 L 44.7,154.8 L 30.7,149.7 L 21.1,155.3 L 23.4,173.8 L 27.9,182.8 L 18.3,190.1 L 21.7,191.8 L 23.4,186.7 L 27.9,188.4 L 33.5,184.5 L 41.9,192.4 L 35.2,191.2 L 37.4,200.8 L 34.6,203.6 L 26.2,204.1 L 25.6,209.2 L 19.5,205.3 L 17.8,198.5 L 13.3,199.7 L 12.2,212.6 Z';

const KARA = '#EDF1E7';
const KARA_CIZGI = '#C7D2B9';
const HIZLI = '#B9EF14';
const HIZLI_CIZGI = '#9FCF13';

type Props = { height?: number };

function IzmirTeslimatHaritasi({ height = 250 }: Props) {
  return (
    <View
      style={{ width: '100%', height }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="İzmir haritası. Körfezin güney ve doğusundaki bölgeye hemen teslimat yapılıyor."
    >
      <Svg width="100%" height="100%" viewBox="0 16 320 268">
        <Path d={IL_YOLU} fill={KARA} stroke={KARA_CIZGI} strokeWidth={1.2} />

        <Ellipse
          cx={126}
          cy={181}
          rx={23}
          ry={14}
          transform="rotate(-14 126 181)"
          fill={HIZLI}
          stroke={HIZLI_CIZGI}
          strokeWidth={1}
        />

        {/* Balon çizgisi — elipsin sağ üst kenarından etikete */}
        <Line x1={144} y1={171} x2={186} y2={136} stroke="#A9B4A0" strokeWidth={1} />
        <Circle cx={144} cy={171} r={1.8} fill="#8FA383" />
        <SvgText x={190} y={134} fontSize={11.5} fontWeight="700" fill="#1A1A1A">
          Hemen teslimat
        </SvgText>
        <SvgText x={190} y={147} fontSize={9.5} fill="#5B6357">
          bölgesi
        </SvgText>

        <SvgText x={52} y={206} fontSize={8} fontWeight="600" fill="#93A5B0">
          İzmir Körfezi
        </SvgText>
      </Svg>
    </View>
  );
}

export default React.memo(IzmirTeslimatHaritasi);
