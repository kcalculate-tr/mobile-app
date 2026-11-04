// G12-S6 (entegrasyon) — Tabak koleksiyonu ekranı. S3'ün `collection` modülünü
// Profil'e bağlar (FinPrProfileScreen "Koleksiyon" satırı → bu ekran; önceden
// geçici olarak Rozetler'e gidiyordu). Yerel store'dan katalog atamaları + won
// kimlikleri okunur; CollectionGrid kendi kilitli/boş silüet durumunu çizer.
//
// Dalga 1 kapsamı: fotoğraflı `meal_consumptions` akışı + özel kovadan (user-media)
// imzalı URL türetme HENÜZ YOK — `collection/store.ts` ve S3 LOG'u bunu açıkça
// "Dalga 2'de sunucuya" bırakıyor. Bu yüzden kart akışı şu an yerel store'daki
// atamalarla sınırlı (fotoğraf kaydı eklendikçe Dalga 2'de deriveCards'a beslenir).
// Grid, kazanılmış kart yokken tasarımdaki kilitli silüetleri gösterir — geçerli
// bir "yeni kullanıcı" durumu. Ekran yalnız yeni kabuk (yeni_kabuk) altında açılır.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  CollectionGrid,
  CollectionWon,
  deriveCards,
  loadCollection,
  type CollectionCard,
  type PhotoRecord,
} from '../../../collection';
import { FinScreen, FinHeader } from '../finUi';
import { useT } from '../../../../core/i18n';

export default function CollectionScreen({ onBack }: { onBack: () => void }) {
  const { t: tr } = useT();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [won, setWon] = useState<CollectionCard | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const state = await loadCollection();
      // Dalga 1: fotoğraf kaydı akışı henüz bağlı değil (Dalga 2 — bkz. dosya başı).
      // Mevcut atamalardan türetilebilen kart yoksa grid kilitli silüet gösterir.
      const records: PhotoRecord[] = [];
      const derived = deriveCards(records, state.assignments);
      if (alive) setCards(derived);
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <FinScreen scroll>
      <FinHeader title={tr('collection.title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16 }}>
        <CollectionGrid cards={cards} onOpen={(c) => setWon(c)} />
      </View>
      {won ? (
        <CollectionWon
          visible={!!won}
          card={won}
          onViewCard={() => setWon(null)}
          onShare={() => setWon(null)}
          onClose={() => setWon(null)}
        />
      ) : null}
    </FinScreen>
  );
}
