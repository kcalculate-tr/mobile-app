// eatkcal v2 (G13-S2 md.6) — Sipariş detayı (FinEkOrderDetail).
//
// Veri: bugünkü OrderDetailScreen'in sorgusu (ordersData.fetchOrderDetail) +
// mevcut getOrderModifications (src/lib/orders.ts) + canlı güncelleme için
// mevcut subscribeToOrder (src/lib/activeOrder.ts).
// Aksiyonlar YALNIZ mevcut fonksiyonlarla:
//  - "Tekrar sipariş ver" → reorderToCart (src/lib/reorder.ts) → EkCart
//  - "Değerlendir" → fetchPendingFeedbackOrder + submitOrderReview
//    (src/lib/orderFeedback.ts; HomeScreen'in OrderFeedbackModal akışıyla aynı
//    alanlar: genel puan 1–5, isteğe bağlı yorum, ürün bazında beğeni).
//    Panodaki Lezzet / Teslimat / Kalori uyumu alt puanları mevcut şemada
//    (reviews: rating + comment) YOK → o satırlar gösterilmez.
//  - Değişiklik talebi (iptal/tarih/adres) → bugünkü OrderDetail ekranı (aynı
//    kurallar orada; v2 yeni talep mantığı yazmaz).
//  - Destek: Ara tel:02323322100 · Talep oluştur → ProfileSupport.
// FinMoDeliver (uygulanabilir kısmı): ekran açıkken sipariş "delivered" olursa
// son aşama noktası sıçrar + success haptik (usePop; azaltılmışta yalnız haptik).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useAuth } from '../../../../core/AuthContext';
import { haptic, usePop } from '../../../../core/design';
import {
  ArrowCounterClockwise,
  CreditCard,
  Headset,
  MapPin,
  Phone,
  Star,
  ThumbsDown,
  ThumbsUp,
  WarningCircle,
} from '../../../../components/icons';
import { formatSupabaseErrorForDevLog } from '../../../../lib/supabaseErrors';
import { getOrderModifications, type OrderModification } from '../../../../lib/orders';
import { subscribeToOrder } from '../../../../lib/activeOrder';
import { reorderToCart } from '../../../../lib/reorder';
import {
  fetchPendingFeedbackOrder,
  submitOrderReview,
  type ItemFeedbackMap,
  type PendingFeedbackOrder,
} from '../../../../lib/orderFeedback';
import { track } from '../../../../lib/analytics';
import { useCartStore } from '../../../../store/cartStore';
import { CachedImage } from '../../../../components/CachedImage';
import { useProductImages } from '../ui/orders/useProductImages';
import { useEkNav, type EkNavList } from '../nav';
import { EkCard, EkHeader, EkScreen, EkSkeleton, ekType, money, useEk } from '../ui/kit';
import { EkInkButton, EkStateCard, OrderStatusBadge } from '../ui/orders/OrdersParts';
import {
  DETAIL_STEPS,
  canReorder,
  canReview,
  detailLines,
  isTerminalStatus,
  orderCodeLabel,
  pastOrderFromRow,
  reachedStepIndex,
  stepTimes,
  type DetailStep,
} from '../model/orders';
import { fetchOrderDetail, type OrderDetailRow } from '../model/ordersData';
import { formatOrderDate } from './EkOrdersScreen';

const SUPPORT_TEL = 'tel:02323322100';

const STEP_KEY: Record<DetailStep, string> = {
  received: 'eatkcal.v2.order_detail.step_received',
  preparing: 'eatkcal.v2.order_detail.step_preparing',
  on_way: 'eatkcal.v2.order_detail.step_on_way',
  delivered: 'eatkcal.v2.order_detail.step_delivered',
};

function formatTime(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function EkOrderDetailScreen() {
  const navigation = useEkNav();
  const route = useRoute<RouteProp<EkNavList, 'EkOrderDetail'>>();
  const { orderId } = route.params;
  const { c, t, lang } = useEk();
  const { user } = useAuth();
  const addItem = useCartStore((s) => s.addItem);

  const [order, setOrder] = useState<OrderDetailRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mods, setMods] = useState<OrderModification[]>([]);
  const [feedback, setFeedback] = useState<PendingFeedbackOrder | null>(null);
  const [reordering, setReordering] = useState(false);
  const [reorderNote, setReorderNote] = useState('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setOrder(await fetchOrderDetail(orderId));
    } catch (err: unknown) {
      if (__DEV__) console.warn(`[ek-order-detail] load: ${formatSupabaseErrorForDevLog(err)}`);
      setFailed(true);
    } finally {
      setLoading(false);
    }
    try {
      setMods(await getOrderModifications(String(orderId)));
    } catch (err: unknown) {
      if (__DEV__) console.warn(`[ek-order-detail] modifications: ${formatSupabaseErrorForDevLog(err)}`);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Değerlendirme uygunluğu — mevcut kuralın tek kaynağı fetchPendingFeedbackOrder.
  const status = order?.status;
  useEffect(() => {
    if (!user?.id || status !== 'delivered') {
      setFeedback(null);
      return;
    }
    let mounted = true;
    fetchPendingFeedbackOrder(user.id)
      .then((p) => {
        if (mounted) setFeedback(p);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [user?.id, status]);

  // Canlı durum (Realtime) — değişince aynı sorguyla yeniden çek.
  const { style: deliverPopStyle, pop } = usePop();
  const prevStatus = useRef<string | undefined>(undefined);
  const liveId = order && !isTerminalStatus(order.status) ? order.id : null;
  useEffect(() => {
    if (liveId == null) return;
    return subscribeToOrder(liveId, () => {
      void load();
    });
  }, [liveId, load]);
  useEffect(() => {
    if (prevStatus.current && prevStatus.current !== 'delivered' && status === 'delivered') pop();
    prevStatus.current = status;
  }, [status, pop]);

  const lines = useMemo(() => (order ? detailLines(order) : []), [order]);
  const productImg = useProductImages();

  const handleReorder = useCallback(async () => {
    if (!order) return;
    setReordering(true);
    setReorderNote('');
    try {
      const res = await reorderToCart(pastOrderFromRow(order), addItem);
      if (res.added === 0) {
        haptic('warning');
        setReorderNote(t('eatkcal.v2.order_detail.reorder_none'));
        return;
      }
      haptic('success');
      track('reorder_from_order_detail', { order_id: order.id, added: res.added, ui: 'ek_v2' });
      if (res.unavailable.length > 0) {
        setReorderNote(t('eatkcal.v2.order_detail.reorder_unavailable', { names: res.unavailable.join(', ') }));
      }
      navigation.navigate('EkCart');
    } catch {
      haptic('warning');
      setReorderNote(t('eatkcal.v2.order_detail.reorder_error'));
    } finally {
      setReordering(false);
    }
  }, [order, addItem, navigation, t]);

  const header = (
    <EkHeader title={t('eatkcal.v2.order_detail.title')} onBack={() => navigation.goBack()} right={<View style={{ width: 44 }} />} />
  );

  if (loading) {
    return (
      <EkScreen header={header}>
        <View style={styles.body}>
          <EkSkeleton height={48} width="60%" />
          <EkSkeleton height={160} radius={20} />
          <EkSkeleton height={120} radius={20} />
        </View>
      </EkScreen>
    );
  }

  if (failed || !order) {
    return (
      <EkScreen header={header}>
        <View style={[styles.body, { marginTop: 120 }]}>
          <EkStateCard
            icon={<WarningCircle size={24} color={c.ink} />}
            title={t('eatkcal.v2.order_detail.error_title')}
            body={t('eatkcal.v2.orders.error_body')}
            action={t('eatkcal.v2.order_detail.error_action')}
            onAction={() => {
              setLoading(true);
              void load();
            }}
            testID="ek-order-detail-error"
          />
        </View>
      </EkScreen>
    );
  }

  const reached = reachedStepIndex(order.status);
  const times = stepTimes(order);
  const latestMod = mods[0] ?? null;
  const isPickup = order.delivery_method === 'pickup';

  return (
    <EkScreen header={header} testID="ek-order-detail">
      <View style={styles.body}>
        {/* Kod · tarih · tutar · durum */}
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[ekType.h20, { fontSize: 22, lineHeight: 27, color: c.ink }]} numberOfLines={1}>
              {orderCodeLabel(order)}
            </Text>
            <Text style={[ekType.c13, { color: c.secondary }]}>
              {t('eatkcal.v2.orders.row_meta', {
                date: formatOrderDate(order.created_at, lang),
                amount: money(order.total_amount),
              })}
            </Text>
          </View>
          <OrderStatusBadge status={order.status} />
        </View>

        {/* Aşamalar — yalnız takip edilen durumlarda (onaylandı → teslim). */}
        {reached >= 0 ? (
          <EkCard testID="ek-order-timeline">
            {DETAIL_STEPS.map((step, i) => {
              const done = i <= reached;
              const last = i === DETAIL_STEPS.length - 1;
              const time = times[step];
              const dot = (
                <View
                  style={[styles.dot, { backgroundColor: done ? c.accentLine : c.line }]}
                  accessibilityElementsHidden
                />
              );
              return (
                <View key={step} style={[styles.step, !last && { paddingBottom: 16 }]} accessibilityLabel={t(STEP_KEY[step])}>
                  {!last ? (
                    <View style={[styles.stepLine, { backgroundColor: i < reached ? c.accentLine : c.line }]} />
                  ) : null}
                  {last && step === 'delivered' ? <Animated.View style={deliverPopStyle}>{dot}</Animated.View> : dot}
                  <View style={styles.stepText}>
                    <Text
                      style={[
                        { fontSize: 14, lineHeight: 19 },
                        done
                          ? { fontFamily: 'PlusJakartaSans_700Bold', color: c.ink }
                          : { fontFamily: 'PlusJakartaSans_500Medium', color: c.secondary },
                      ]}
                    >
                      {t(STEP_KEY[step])}
                    </Text>
                    {time ? (
                      <Text style={[ekType.c13, { color: c.secondary }]}>{formatTime(time, lang)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </EkCard>
        ) : null}

        {/* Değişiklik talebi durumu (mevcut veri). */}
        {latestMod ? (
          <EkCard>
            <Text style={[ekType.b15s, { color: latestMod.status === 'rejected' ? c.danger : c.ink }]}>
              {t(`eatkcal.v2.order_detail.mod_banner.${latestMod.type}.${latestMod.status}`)}
            </Text>
            {latestMod.status === 'rejected' && latestMod.reject_reason ? (
              <Text style={[ekType.c13, { color: c.secondary, marginTop: 4 }]}>
                {t('eatkcal.v2.order_detail.mod_reason', { reason: latestMod.reject_reason })}
              </Text>
            ) : null}
          </EkCard>
        ) : null}

        {/* Ürünler */}
        {lines.length > 0 ? (
          <EkCard style={{ gap: 10 }}>
            <Text style={[ekType.h20, { color: c.ink }]} accessibilityRole="header">
              {t('eatkcal.v2.order_detail.items_title')}
            </Text>
            {lines.map((line, i) => (
              <View key={`${line.name}-${i}`} style={styles.lineRow}>
                {productImg(line.productId) ? (
                  <CachedImage uri={productImg(line.productId)!} style={styles.lineThumb} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.b14, { color: c.ink }]}>{`${line.name} ×${line.quantity}`}</Text>
                  {line.summary ? (
                    <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={2}>
                      {line.summary}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.b14, ekType.num, { color: c.ink }]}>{money(line.totalPrice)}</Text>
              </View>
            ))}
          </EkCard>
        ) : null}

        {/* Adres + ödeme */}
        <EkCard style={{ gap: 10 }}>
          {order.address ? (
            <View style={styles.lineRow}>
              <View style={[styles.mapTile, { backgroundColor: c.line }]} accessibilityElementsHidden>
                <MapPin size={20} color={c.ink} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ekType.c13, { color: c.secondary }]}>
                  {t(isPickup ? 'eatkcal.v2.order_detail.pickup_label' : 'eatkcal.v2.order_detail.address_label')}
                </Text>
                <Text style={[styles.b14, { color: c.ink }]} numberOfLines={2}>
                  {order.address}
                </Text>
              </View>
            </View>
          ) : null}
          <View style={styles.payRow}>
            <CreditCard size={20} color={c.ink} />
            <Text style={[styles.r14, { color: c.ink, flex: 1 }]}>{t('eatkcal.v2.order_detail.paid_label')}</Text>
            <Text style={[styles.b14, ekType.num, { color: c.ink }]}>{money(order.total_amount)}</Text>
          </View>
        </EkCard>

        {canReorder(order.status) ? (
          <View style={{ gap: 6 }}>
            <EkInkButton
              label={t('eatkcal.v2.order_detail.reorder')}
              onPress={handleReorder}
              disabled={reordering}
              icon={<ArrowCounterClockwise size={18} color={reordering ? c.secondary : c.surface} />}
              testID="ek-order-reorder"
            />
            {reorderNote ? <Text style={[ekType.c13, { color: c.secondary, textAlign: 'center' }]}>{reorderNote}</Text> : null}
          </View>
        ) : null}

        {canReview(order.id, feedback) && feedback ? (
          <ReviewCard
            feedback={feedback}
            onDone={() => setFeedback(null)}
          />
        ) : null}

        {/* Değişiklik talepleri bugünkü ekranda (aynı kurallar). */}
        {!isTerminalStatus(order.status) ? (
          <Pressable
            onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
            accessibilityRole="button"
            style={styles.textBtn}
            testID="ek-order-change-request"
          >
            <Text style={[ekType.c13s, { color: c.accentLine }]}>{t('eatkcal.v2.order_detail.change_request')}</Text>
          </Pressable>
        ) : null}

        {/* Destek */}
        <EkCard style={{ gap: 10 }}>
          <Text style={[ekType.h20, { color: c.ink }]} accessibilityRole="header">
            {t('eatkcal.v2.order_detail.support_title')}
          </Text>
          <View style={styles.supportRow}>
            <Pressable
              onPress={() => {
                haptic('selection');
                void Linking.openURL(SUPPORT_TEL);
              }}
              accessibilityRole="button"
              testID="ek-order-call"
              style={[styles.supportBtn, { backgroundColor: c.accent }]}
            >
              <Phone size={18} color={c.onAccent} weight="fill" />
              <Text style={[ekType.b15s, { color: c.onAccent }]}>{t('eatkcal.v2.order_detail.support_call')}</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('ProfileSupport')}
              accessibilityRole="button"
              testID="ek-order-ticket"
              style={[styles.supportBtn, { borderWidth: 1, borderColor: c.line }]}
            >
              <Headset size={18} color={c.ink} />
              <Text style={[ekType.b15s, { color: c.ink }]} numberOfLines={1}>
                {t('eatkcal.v2.order_detail.support_ticket')}
              </Text>
            </Pressable>
          </View>
          <Text style={[ekType.c13, { color: c.secondary, textAlign: 'center' }]}>
            {t('eatkcal.v2.order_detail.support_line')}
          </Text>
        </EkCard>
      </View>
    </EkScreen>
  );
}

/** Değerlendirme kartı — OrderFeedbackModal + HomeScreen.handleSubmitFeedback ile aynı alanlar. */
function ReviewCard({ feedback, onDone }: { feedback: PendingFeedbackOrder; onDone: () => void }) {
  const { c, t } = useEk();
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [itemFeedback, setItemFeedback] = useState<ItemFeedbackMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // OrderFeedbackModal.toggleItem ile aynı: aynı oya tekrar basınca kaldırılır.
  const toggleItem = (productId: number, liked: boolean) => {
    haptic('selection');
    setItemFeedback((prev) => {
      const next = { ...prev };
      if (next[productId] === liked) delete next[productId];
      else next[productId] = liked;
      return next;
    });
  };

  const submit = async () => {
    if (!user?.id || rating === 0 || submitting) return;
    setSubmitting(true);
    setMessage('');
    const res = await submitOrderReview({
      orderId: feedback.id,
      userId: user.id,
      rating,
      comment,
      items: feedback.items,
      itemFeedback,
    });
    setSubmitting(false);
    if (res.ok) {
      haptic('success');
      track('order_review_submitted', {
        order_id: feedback.id,
        rating,
        item_votes: Object.keys(itemFeedback).length,
      });
      setMessage(t('eatkcal.v2.order_detail.review_sent'));
      setTimeout(onDone, 1200);
    } else {
      haptic('warning');
      setMessage(t('eatkcal.v2.order_detail.review_error'));
    }
  };

  return (
    <EkCard style={{ gap: 10 }} testID="ek-order-review">
      <Text style={[ekType.h20, { color: c.ink }]} accessibilityRole="header">
        {t('eatkcal.v2.order_detail.review_title')}
      </Text>
      <View style={styles.rateRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.b14, { color: c.ink }]}>{t('eatkcal.v2.order_detail.review_overall')}</Text>
          <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.order_detail.review_overall_sub')}</Text>
        </View>
        <View style={{ flexDirection: 'row' }} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                haptic('selection');
                setRating(n);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: rating === n }}
              accessibilityLabel={t('eatkcal.v2.order_detail.star', { n })}
              testID={`ek-review-star-${n}`}
              style={styles.starBtn}
            >
              <Star size={22} color={n <= rating ? c.ink : c.line} weight="fill" />
            </Pressable>
          ))}
        </View>
      </View>

      {feedback.items.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={[styles.b14, { color: c.ink }]}>{t('eatkcal.v2.order_detail.review_items')}</Text>
          {feedback.items.map((it) => {
            const vote = itemFeedback[it.productId];
            return (
              <View key={it.productId} style={styles.rateRow}>
                <Text style={[styles.r14, { color: c.ink, flex: 1 }]} numberOfLines={2}>
                  {it.name}
                </Text>
                <Pressable
                  onPress={() => toggleItem(it.productId, true)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: vote === true }}
                  accessibilityLabel={t('eatkcal.v2.order_detail.review_like')}
                  style={styles.starBtn}
                >
                  <ThumbsUp size={20} color={vote === true ? c.ink : c.secondary} weight={vote === true ? 'fill' : 'regular'} />
                </Pressable>
                <Pressable
                  onPress={() => toggleItem(it.productId, false)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: vote === false }}
                  accessibilityLabel={t('eatkcal.v2.order_detail.review_dislike')}
                  style={styles.starBtn}
                >
                  <ThumbsDown size={20} color={vote === false ? c.ink : c.secondary} weight={vote === false ? 'fill' : 'regular'} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t('eatkcal.v2.order_detail.review_comment')}
        placeholderTextColor={c.secondary}
        multiline
        accessibilityLabel={t('eatkcal.v2.order_detail.review_comment')}
        style={[styles.comment, { backgroundColor: c.line, color: c.ink }]}
      />
      <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.order_detail.review_note')}</Text>
      <EkInkButton
        label={t('eatkcal.v2.order_detail.review_send')}
        onPress={submit}
        disabled={rating === 0 || submitting}
        testID="ek-review-send"
      />
      {message ? <Text style={[ekType.c13, { color: c.secondary, textAlign: 'center' }]}>{message}</Text> : null}
    </EkCard>
  );
}

const styles = StyleSheet.create({
  lineThumb: { width: 44, height: 44, borderRadius: 10 },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepLine: { position: 'absolute', left: 5, top: 14, bottom: 0, width: 2 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  stepText: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  b14: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 14, lineHeight: 19 },
  r14: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, lineHeight: 19 },
  mapTile: { width: 72, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
  textBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  supportRow: { flexDirection: 'row', gap: 8 },
  supportBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  comment: { minHeight: 80, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: 15, textAlignVertical: 'top' },
});
