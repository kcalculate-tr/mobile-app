// G62-S1 — Değerlendirme girişi: kart + FinEkRateSheet + analitik. İki yüzey:
//  · HomeOrderRatePrompt  — Ana sayfa (TrackerScreen); pencere içindeki en yeni değerlendirilmemiş teslim.
//  · OrderDetailRateEntry — sipariş detayı; yalnız o sipariş.
// Bayrak `siparis_degerlendirme` KAPALIYKEN ikisi de hiçbir şey çizmez ve ağ çağrısı yapmaz (navigasyon kancası da
// kurulmaz) → bugünkü davranış bayt bayt aynı.
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../../../core/AuthContext';
import { useFeature } from '../../../../../core/flags';
import { track } from '../../../../../lib/analytics';
import { formatRateDate, rateOrderLabel, shouldTrackPrompt, submitEventProps, type RateSurface } from '../../model/orderRate';
import {
  dismissPrompt,
  fetchHomeRatePrompt,
  fetchOrderRatePrompt,
  submitOrderRating,
  uploadReviewPhoto,
  type RatePromptOrder,
} from '../../model/orderRateData';
import { useProductImages } from '../orders/useProductImages';
import { useEk } from '../kit';
import { OrderRateCard } from './OrderRateCard';
import { OrderRateSheet, type OrderRateDeps } from './OrderRateSheet';

async function pickPhoto(): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: false,
    quality: 0.7,
    allowsEditing: false,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}

export const DEFAULT_RATE_DEPS: OrderRateDeps = { submit: submitOrderRating, upload: uploadReviewPhoto, pickPhoto };

/** Kart + sayfa. `prompt` null → hiçbir şey. */
export function OrderRateEntry({
  prompt,
  surface,
  onRated,
  onDismiss,
  deps = DEFAULT_RATE_DEPS,
}: {
  prompt: RatePromptOrder | null;
  surface: RateSurface;
  /** Gönderim başarılı + sayfa kapandı → kart kaldırılır. */
  onRated: () => void;
  onDismiss?: () => void;
  deps?: OrderRateDeps;
}) {
  const { lang } = useEk();
  const navigation = useNavigation();
  const img = useProductImages();
  const [open, setOpen] = useState(false);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    setRated(false);
    if (prompt && shouldTrackPrompt(prompt.id, surface)) {
      track('order_rate_prompt', { order_id: String(prompt.id), surface });
    }
  }, [prompt, surface]);

  const close = useCallback(() => {
    setOpen(false);
    if (rated) onRated();
  }, [rated, onRated]);

  if (!prompt) return null;
  const label = rateOrderLabel(prompt);
  return (
    <View>
      {!rated ? (
        <OrderRateCard
          orderLabel={label}
          imageUrl={prompt.firstProductId ? img(prompt.firstProductId) : null}
          onRate={() => setOpen(true)}
          onDismiss={onDismiss}
          testID={`order-rate-card-${surface}`}
        />
      ) : null}
      <OrderRateSheet
        visible={open}
        order={prompt}
        dateLabel={formatRateDate(prompt.deliveredAt, lang)}
        onClose={close}
        deps={deps}
        productImage={(id) => img(id)}
        onSent={(res) => {
          setRated(true);
          track('order_rate_submit', submitEventProps(res.args, surface));
        }}
        onSupport={() => {
          setOpen(false);
          if (rated) onRated();
          (navigation as { navigate: (r: string) => void }).navigate('ProfileSupport');
        }}
      />
    </View>
  );
}

// ── Ana sayfa ──────────────────────────────────────────────────────────────
export function HomeOrderRatePrompt({ deps }: { deps?: OrderRateDeps }) {
  const on = useFeature('siparis_degerlendirme');
  const { user } = useAuth();
  if (!on || !user?.id) return null;
  return <HomeOrderRatePromptInner userId={user.id} deps={deps} />;
}

function HomeOrderRatePromptInner({ userId, deps }: { userId: string; deps?: OrderRateDeps }) {
  const { t } = useEk();
  const [prompt, setPrompt] = useState<RatePromptOrder | null>(null);
  const fallback = t('order_rate.item_fallback');
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchHomeRatePrompt(userId, { fallbackName: fallback })
        .then((p) => {
          if (alive) setPrompt(p);
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [userId, fallback]),
  );
  if (!prompt) return null;
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }} testID="home-order-rate">
      <OrderRateEntry
        prompt={prompt}
        surface="home"
        deps={deps}
        onRated={() => setPrompt(null)}
        onDismiss={() => {
          void dismissPrompt(prompt.id);
          setPrompt(null);
        }}
      />
    </View>
  );
}

// ── Sipariş detayı ─────────────────────────────────────────────────────────
/** Bayrak açık + teslim edildi → bu siparişin istemi. `null` döner ise çağıran v1 kartını da göstermez. */
export function useOrderDetailRatePrompt(orderId: number, status: string | null | undefined, enabled: boolean) {
  const { user } = useAuth();
  const { t } = useEk();
  const [prompt, setPrompt] = useState<RatePromptOrder | null>(null);
  const fallback = t('order_rate.item_fallback');
  useEffect(() => {
    if (!enabled || !user?.id || status !== 'delivered') {
      setPrompt(null);
      return;
    }
    let alive = true;
    fetchOrderRatePrompt(user.id, orderId, { fallbackName: fallback })
      .then((p) => {
        if (alive) setPrompt(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled, user?.id, orderId, status, fallback]);
  return { prompt, clear: () => setPrompt(null) };
}
