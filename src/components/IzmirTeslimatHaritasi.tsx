import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Text as SvgText, Circle, G } from 'react-native-svg';

/**
 * İzmir teslimat bölgeleri — ŞEMATİK harita.
 *
 * 25.09.2026 — tasarım kararı: bu bir ilçe atlası DEĞİL. Amacı tek bakışta
 * "iki farklı teslimat bölgesi var" mesajını vermek. 15 ilçe adını haritaya
 * sığdırmaya çalışmak telefon ekranında okunmaz hâle getiriyordu; bunun yerine
 * harita ŞEKLİ ve en çok müşterinin bulunduğu 9 ilçeyi gösteriyor, altındaki
 * liste tam ve yetkili kaynak olarak duruyor.
 *
 * Etiketlenen 9 ilçe kayıtlı adreslerin %86'sını kapsıyor
 * (Konak 85, Karabağlar 78, Karşıyaka 43, Bornova 38, Buca 25, Balçova 24,
 * Bayraklı 22, Çiğli 16, Narlıdere 6).
 *
 * Harita SABİT — veritabanındaki bölgelere göre kendini çizmiyor. Altındaki
 * liste canlı veriden geliyor; çelişki olmaması için harita yalnız kaba
 * coğrafyayı ve iki katmanı gösteriyor, "hangi ilçe açık" kararını vermiyor.
 */

const HIZLI_DOLGU = '#B9EF14';   // marka yeşili
const PLANLI_DOLGU = '#E7ECE0';  // soluk yeşilimsi gri
const PLANLI_CIZGI = '#C9D4BC';
const DENIZ = '#D8E6EE';
const YAZI = '#1A1A1A';
const YAZI_SOLUK = '#5B6357';

type Props = { height?: number };

function IzmirTeslimatHaritasi({ height = 210 }: Props) {
  return (
    <View style={{ width: '100%', height }} accessible
      accessibilityRole="image"
      accessibilityLabel="İzmir teslimat bölgeleri haritası: körfezin güneyindeki Konak, Karabağlar, Balçova ve Narlıdere'ye bugün teslimat yapılıyor; çevredeki diğer ilçelere gün seçerek teslimat yapılıyor.">
      <Svg width="100%" height="100%" viewBox="0 0 320 300">
        {/* Kara — planlı teslimat bölgesi */}
        <Path
          d="M 44,14 C 124,2 248,6 290,32 C 312,62 314,150 298,214
             C 278,282 178,296 94,286 C 28,276 6,220 10,150 C 12,80 16,26 44,14 Z"
          fill={PLANLI_DOLGU}
          stroke={PLANLI_CIZGI}
          strokeWidth={1.5}
        />

        {/* İzmir Körfezi — batıdan içeri giren kama */}
        <Path
          d="M 8,104 L 152,132 L 198,146 L 152,160 L 8,198 Z"
          fill={DENIZ}
        />

        {/* Hızlı teslimat çekirdeği — körfez başının güneybatısı */}
        <Path
          d="M 98,170 C 142,159 198,159 228,174 C 242,198 236,226 212,238
             C 172,250 118,246 96,228 C 84,208 86,180 98,170 Z"
          fill={HIZLI_DOLGU}
        />

        {/* Hızlı teslimat ilçeleri */}
        <G>
          <SvgText x={132} y={190} fontSize={11} fontWeight="700" fill={YAZI} textAnchor="middle">Balçova</SvgText>
          <SvgText x={198} y={188} fontSize={11} fontWeight="700" fill={YAZI} textAnchor="middle">Konak</SvgText>
          <SvgText x={128} y={222} fontSize={11} fontWeight="700" fill={YAZI} textAnchor="middle">Narlıdere</SvgText>
          <SvgText x={196} y={222} fontSize={11} fontWeight="700" fill={YAZI} textAnchor="middle">Karabağlar</SvgText>
        </G>

        {/* Planlı teslimat ilçelerinden en kalabalık olanlar */}
        <G>
          <Circle cx={168} cy={30} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={168} y={46} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Menemen</SvgText>

          <Circle cx={104} cy={64} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={104} y={80} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Çiğli</SvgText>

          <Circle cx={182} cy={84} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={182} y={100} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Karşıyaka</SvgText>

          <Circle cx={258} cy={96} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={256} y={112} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Bayraklı</SvgText>

          <Circle cx={268} cy={158} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={266} y={174} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Bornova</SvgText>

          <Circle cx={256} cy={224} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={254} y={240} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Buca</SvgText>

          <Circle cx={168} cy={256} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={168} y={272} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Gaziemir</SvgText>

          <Circle cx={54} cy={224} r={2.5} fill={YAZI_SOLUK} />
          <SvgText x={54} y={240} fontSize={10} fontWeight="600" fill={YAZI_SOLUK} textAnchor="middle">Urla</SvgText>
        </G>

        {/* Körfez etiketi */}
        <SvgText x={72} y={156} fontSize={9} fontWeight="600" fill="#6E8794" textAnchor="middle">
          İzmir Körfezi
        </SvgText>
      </Svg>
    </View>
  );
}

export default React.memo(IzmirTeslimatHaritasi);
