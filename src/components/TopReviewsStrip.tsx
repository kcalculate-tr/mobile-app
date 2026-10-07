import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Star } from 'phosphor-react-native';
import { COLORS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { vitrinYorumlariniGetir, yorumTarihi, type VitrinYorumu } from '../lib/socialProof';

/**
 * "En İyi Yorumlar" — anasayfada, Sana Özel Teklifler'in hemen üstünde,
 * yatay kaydırmalı şerit.
 *
 * VERİ YOKSA HİÇBİR ŞEY ÇİZMEZ. Yer tutucu, örnek yorum ya da "henüz yorum
 * yok" kutusu göstermiyoruz: boş şerit, sahte şeritten iyidir ve anasayfada
 * yer kaplamaz.
 *
 * Hangi yorumlar gelir (sunucudaki en_iyi_yorumlar kuralı):
 *   · is_approved = true — yani Boss panel → Yorumlar'dan ONAYLANMIŞ
 *   · yorum metni dolu (yalnız yıldız verenler girmez)
 *   · 4 yıldız ve üzeri
 *
 * 26.09.2026 durumu: 8 değerlendirmenin 2'si yazılı, HİÇBİRİ onaylı değil —
 * şerit şu an görünmüyor. Onaylandıkça kendiliğinden dolar.
 *
 * Ad maskeleme sunucuda: "Fırat Beyde" → "Fırat B." Başka müşterilerin tam
 * adını uygulamada yayımlamıyoruz.
 */

function YorumKarti({ yorum }: { yorum: VitrinYorumu }) {
  return (
    <View style={s.kart}>
      <View style={s.yildizlar}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={13}
            weight={i < yorum.rating ? 'fill' : 'regular'}
            color={i < yorum.rating ? '#F5A623' : '#D8D8D8'}
          />
        ))}
      </View>
      <Text style={s.metin} numberOfLines={4}>{yorum.yorum}</Text>
      <View style={s.alt}>
        <Text style={s.ad} numberOfLines={1}>{yorum.ad}</Text>
        {yorum.tarih ? <Text style={s.tarih}>{yorumTarihi(yorum.tarih)}</Text> : null}
      </View>
    </View>
  );
}

function TopReviewsStrip() {
  const [yorumlar, setYorumlar] = useState<VitrinYorumu[]>([]);

  useEffect(() => {
    let gecerli = true;
    vitrinYorumlariniGetir(12).then((liste) => {
      if (gecerli) setYorumlar(liste);
    });
    return () => { gecerli = false; };
  }, []);

  if (yorumlar.length === 0) return null;

  return (
    <View style={s.bolum}>
      <Text style={s.baslik}>En İyi Yorumlar</Text>
      <FlatList
        horizontal
        data={yorumlar}
        keyExtractor={(y) => String(y.id)}
        renderItem={({ item }) => <YorumKarti yorum={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.liste}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        // Şerit kısa (en fazla 12 kart) — sanallaştırma penceresini daraltmak
        // kaydırmada boş kart gösteriyordu.
        initialNumToRender={12}
      />
    </View>
  );
}

export default React.memo(TopReviewsStrip);

const s = StyleSheet.create({
  // 07.10.2026: baslik anasayfadaki diger bolum basliklariyla UYUSMUYORDU —
  // 20px/800ExtraBold, harf araligi yok; "Sana Ozel Teklifler" ise
  // TYPOGRAPHY.size.lg (16) / 700Bold / letterSpacing -0.4. Yan yana
  // durduklari icin fark bariz goruluyordu. HomeScreen'deki sectionTitle ile
  // birebir ayni degerlere cekildi.
  bolum: { marginTop: SPACING.lg, marginBottom: SPACING['2xl'] },
  baslik: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    letterSpacing: -0.4,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  liste: { paddingHorizontal: SPACING.lg },
  kart: {
    width: 244,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 132,
  },
  yildizlar: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  metin: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
  },
  alt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  ad: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.secondary,
  },
  tarih: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.tertiary,
    flexShrink: 0,
  },
});
