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
//
// G15-S2: kart → FinCollectGrid detayı (CollectionCardDetail) + "Tekrar logla"
// (bugüne yeni bir elle kayıt; mevcut meal_consumptions biçimi).
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  CollectionCardDetail,
  CollectionGrid,
  deriveCards,
  loadCollection,
  type CollectionCard,
  type PhotoRecord,
} from '../../../collection';
import { FinScreen, FinHeader } from '../finUi';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { toServerMealType } from '../../../../core/meal/mealType';

export async function relogCard(userId: string, card: CollectionCard, meal: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('meal_consumptions')
    .insert({
      user_id: userId,
      source: 'manual',
      source_ref: null,
      name: card.name,
      meal_type: toServerMealType(meal),
      calories: Math.max(0, Math.round(card.kcal)),
      protein: Math.max(0, Math.round(card.protein_g ?? 0)),
      carbs: Math.max(0, Math.round(card.carbs_g ?? 0)),
      fat: 0,
      note: null,
      consumed_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export default function CollectionScreen({ onBack }: { onBack: () => void }) {
  const { t: tr } = useT();
  const { user } = useAuth();
  const [cards, setCards] = useState<CollectionCard[]>([]);
  const [open, setOpen] = useState<CollectionCard | null>(null);

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

  if (open) {
    return (
      <CollectionCardDetail
        card={open}
        onBack={() => setOpen(null)}
        onRelog={user ? (meal) => relogCard(user.id, open, meal) : undefined}
      />
    );
  }

  return (
    <FinScreen scroll>
      <FinHeader title={tr('collection.title')} onBack={onBack} />
      <View style={{ paddingHorizontal: 16 }}>
        <CollectionGrid cards={cards} onOpen={(c) => setOpen(c)} />
      </View>
    </FinScreen>
  );
}
