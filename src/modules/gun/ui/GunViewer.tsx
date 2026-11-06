// Gün görüntüleyici — T20GunView / T19GunEnd / T19GunDone. Seçilen halkadan
// başlayıp (buildViewerQueue) şeritteki sonraki kullanıcılara ilerler. Dokun:
// sağ yarı ileri, sol yarı geri; aşağı kaydır: kapat. Son kart her kullanıcı
// için günün özeti (yüzde halkası + öğün küçük görselleri).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTheme, ProgressRing } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CachedImage } from '../../../components/CachedImage';
import { Plus, User, X } from '../../../components/icons';
import { getGunClient } from '../client';
import type { DayCard, DayRing } from '../types';
import { buildViewerQueue } from './viewerQueue';

const MEAL_I18N: Record<string, string> = {
  breakfast: 'meal.breakfast',
  lunch: 'meal.lunch',
  dinner: 'meal.dinner',
  snack: 'meal.snack',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export interface GunViewerProps {
  visible: boolean;
  rings: DayRing[];
  startUserId: string;
  onClose: () => void;
  /** SORU (bkz. types.ts DayCard): başkasının kartını kendi günlüğüne eklemek
   * için sözleşmede henüz RPC yok. Verilirse CTA onu çağırır; verilmezse
   * buton devre dışı görünür (yine de HER ZAMAN görünür — tasarım gereği). */
  onAddToDay?: (card: DayCard) => Promise<void>;
}

export function GunViewer({
  visible,
  rings,
  startUserId,
  onClose,
  onAddToDay,
  vitrinSlide,
  vitrinDone,
  vitrinCard,
}: GunViewerProps & {
  /** Yalnız __DEV__ vitrini (FinGunEnd/FinGunDone): özet slaytıyla aç. */
  vitrinSlide?: 'summary';
  /** Yalnız __DEV__ vitrini (FinGunDone): halka dolu göster. */
  vitrinDone?: boolean;
  /** Yalnız __DEV__ vitrini (FinGunView "Öğle 2/3"): başlangıç kartı. */
  vitrinCard?: number;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const insets = useSafeAreaInsets();

  const queue = useMemo(() => buildViewerQueue(rings, startUserId), [rings, startUserId]);
  const [userIdx, setUserIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [cards, setCards] = useState<DayCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const currentUserId = queue[userIdx];
  const currentRing = rings.find((r) => r.user.id === currentUserId) ?? null;
  const isLastCard = cardIdx >= cards.length; // true → özet kartı
  const summary = isLastCard && !loading;

  useEffect(() => {
    if (!visible) return;
    setUserIdx(0);
    setCardIdx(0);
  }, [visible, startUserId]);

  useEffect(() => {
    if (!visible || !currentUserId) return;
    let alive = true;
    setLoading(true);
    getGunClient()
      .getDayCards({ user: currentUserId })
      .then((res) => {
        if (!alive) return;
        setCards(res);
        setCardIdx(
          __DEV__ && vitrinSlide === 'summary'
            ? res.length
            : __DEV__ && vitrinCard != null
              ? Math.min(vitrinCard, Math.max(res.length - 1, 0))
              : 0,
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [visible, currentUserId]);

  const goToUser = useCallback(
    (nextIdx: number) => {
      if (nextIdx < 0) {
        setCardIdx(0); // ilk kullanıcının ilk kartındaysa ileri/geri bir şey yapma
        return;
      }
      if (nextIdx >= queue.length) {
        onClose();
        return;
      }
      setUserIdx(nextIdx);
    },
    [queue.length, onClose],
  );

  const goNext = useCallback(() => {
    if (cardIdx < cards.length) {
      setCardIdx((i) => i + 1); // özet karta geç
    } else {
      goToUser(userIdx + 1);
    }
  }, [cardIdx, cards.length, userIdx, goToUser]);

  const goPrev = useCallback(() => {
    if (cardIdx > 0) {
      setCardIdx((i) => i - 1);
    } else {
      goToUser(userIdx - 1);
    }
  }, [cardIdx, userIdx, goToUser]);

  // Aşağı kaydır: kapat.
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > Math.abs(g.dx) && g.dy > 6,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120) {
          onClose();
          translateY.setValue(0);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    }),
  ).current;

  if (!currentRing) return null;
  const card: DayCard | undefined = cards[cardIdx];

  const handleAdd = async () => {
    if (!card || !onAddToDay || adding) return;
    setAdding(true);
    try {
      await onAddToDay(card);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[styles.root, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        {/* Zemin: fotoğraf varsa o, yoksa tema yüzeyi. */}
        {summary ? (
          // G15-S2 (FinGunEnd/FinGunDone): özet slaytı tema zemininde, mürekkep başlık.
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: t.color.bg }]} />
        ) : card?.photo_url ? (
          <CachedImage uri={card.photo_url} style={StyleSheet.absoluteFillObject} />
        ) : (
          // G15-S2 (FinGunView): foto yokken de görüntüleyici koyu zemin — beyaz
          // başlık/ilerleme çubukları açık zeminde okunmuyordu.
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#2C2C2E' }]} />
        )}
        {card ? <View style={styles.photoScrim} /> : null}

        {/* Dokun bölgeleri: sol geri, sağ ileri. */}
        {!loading ? (
          <View style={styles.tapZones} pointerEvents="box-none">
            <Pressable style={styles.tapZone} onPress={goPrev} accessibilityLabel={tt('common.retry')} />
            <Pressable style={styles.tapZone} onPress={goNext} />
          </View>
        ) : null}

        <View style={[styles.header, { top: insets.top + 8 }]}>
          <View style={styles.progressRow}>
            {Array.from({ length: Math.max(cards.length, 1) + 1 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: summary
                      ? t.color.ink
                      : i <= cardIdx
                        ? '#FFFFFF'
                        : 'rgba(255,255,255,0.4)',
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.headerRow}>
            <View style={[styles.avatarSmall, { backgroundColor: t.color.line, borderColor: t.color.accent }]}>
              {currentRing.user.avatar_url ? (
                <CachedImage uri={currentRing.user.avatar_url} style={styles.avatarSmallImg} />
              ) : (
                <User size={16} color={t.color.secondary} weight="fill" />
              )}
            </View>
            <AppText variant="body" style={[styles.headerName, summary ? { color: t.color.ink } : null]}>
              {currentRing.user.display_name}
            </AppText>
            {summary ? (
              <AppText variant="caption" tone="secondary">
                {tt('gun.day_summary')}
              </AppText>
            ) : card ? (
              <AppText variant="caption" style={styles.headerMeta}>
                {tt(MEAL_I18N[card.meal_type] ?? 'meal.snack')} · {cardIdx + 1} / {cards.length}
              </AppText>
            ) : null}
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel={tt('common.close')}>
              <X size={20} color={summary ? t.color.ink : '#FFFFFF'} weight="bold" />
            </Pressable>
          </View>
        </View>

        {isLastCard ? (
          <SummaryCard ring={__DEV__ && vitrinDone ? { ...currentRing, progress: 1 } : currentRing} cards={cards} />
        ) : card ? (
          <View
            style={[
              styles.bottomCard,
              { bottom: insets.bottom + 40, backgroundColor: t.isDark ? 'rgba(28,28,30,0.82)' : 'rgba(255,255,255,0.82)' },
            ]}
          >
            <View style={styles.bottomRow}>
              <AppText variant="heading" style={styles.mealName} numberOfLines={1}>
                {card.name}
              </AppText>
              <AppText variant="caption" tone="secondary">
                {formatTime(card.consumed_at)}
              </AppText>
            </View>
            <View style={[styles.bottomRow, { marginTop: 10 }]}>
              <View>
                <AppText variant="heading" style={styles.kcal}>
                  {card.kcal} kcal
                </AppText>
                <AppText variant="caption" tone="secondary">
                  P {card.protein_g} g · K {card.carbs_g ?? '—'} g · Y {card.fat_g ?? '—'} g
                </AppText>
              </View>
              <Pressable
                onPress={handleAdd}
                disabled={!onAddToDay || adding}
                style={[styles.addBtn, { backgroundColor: t.color.accent, opacity: onAddToDay ? 1 : 0.5 }]}
                accessibilityRole="button"
              >
                {/* G15-S2 (FinGunView): "+ Öğle’ye logla" — kartın öğününe loglanır. */}
                <Plus size={16} color={t.color.onAccent} weight="bold" />
                <AppText variant="body" tone="onAccent" style={styles.addBtnText}>
                  {tt(`gun.log_to_${MEAL_I18N[card.meal_type] ? card.meal_type : 'snack'}`)}
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}

        <AppText variant="caption" style={[styles.expiryHint, { bottom: insets.bottom + 14 }, summary ? { color: t.color.secondary } : null]}>
          {tt('gun.expires_in_24h')}
        </AppText>
      </Animated.View>
    </Modal>
  );
}

function SummaryCard({ ring, cards }: { ring: DayRing; cards: DayCard[] }) {
  const t = useTheme();
  const { t: tt } = useT();
  const complete = ring.progress >= 1;

  return (
    <View style={styles.summaryWrap}>
      <ProgressRing progress={ring.progress} size={236} strokeWidth={18} color={t.color.accentLine}>
        {complete ? (
          <AppText variant="heading" style={styles.summaryComplete}>
            {tt('gun.day_complete')}
          </AppText>
        ) : (
          <>
            <AppText variant="display" style={styles.summaryPercent}>
              %{Math.round(ring.progress * 100)}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {tt('gun.percent_full')}
            </AppText>
          </>
        )}
      </ProgressRing>
      <View style={styles.summaryThumbs}>
        {cards.slice(0, 3).map((c) => (
          <View key={c.id} style={styles.summaryThumbCol}>
            <View style={[styles.summaryThumb, { backgroundColor: t.color.surfaceRaised }]}>
              {c.photo_url ? (
                <CachedImage uri={c.photo_url} style={styles.summaryThumbImg} />
              ) : (
                null
              )}
            </View>
            <AppText variant="caption" tone="secondary">
              {tt(MEAL_I18N[c.meal_type] ?? 'meal.snack')}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="body" tone="secondary" style={styles.summaryFooter}>
        {tt('gun.shared_summary', { count: cards.length, streak: ring.streak })}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  photoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  tapZone: { flex: 1 },
  header: { position: 'absolute', left: 12, right: 12 },
  progressRow: { flexDirection: 'row', gap: 4 },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, height: 36 },
  avatarSmall: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarSmallImg: { width: '100%', height: '100%' },
  headerName: { color: '#FFFFFF', fontWeight: '700' },
  headerMeta: { color: 'rgba(255,255,255,0.8)' },
  closeBtn: { marginLeft: 'auto', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  bottomCard: { position: 'absolute', left: 12, right: 12, borderRadius: 20, padding: 16 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealName: { flex: 1, marginRight: 8, fontSize: 20, lineHeight: 26 },
  kcal: { marginBottom: 2 },
  addBtn: { height: 44, paddingHorizontal: 16, borderRadius: 22, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontWeight: '700' },
  expiryHint: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.85)' },
  summaryWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 24 },
  summaryPercent: { fontSize: 44 },
  summaryComplete: { textAlign: 'center', fontSize: 30, lineHeight: 36, maxWidth: 170 },
  summaryThumbs: { flexDirection: 'row', gap: 20 },
  summaryThumbCol: { alignItems: 'center', gap: 6 },
  summaryThumb: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  summaryThumbImg: { width: '100%', height: '100%' },
  summaryFooter: { textAlign: 'center' },
});
