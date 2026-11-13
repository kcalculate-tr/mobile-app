// G22-S1 md.4 — FinSubLimitAI / FinSubLimitBarcode (FinSubLimitSheet): hak dolunca Tara/Ses/Barkod'da.
// Kamera üstünde %55 zemin, alttan sheet (Paywall ile aynı: base 300 enter, fast 200 exit;
// azaltılmışta 200 ms opaklık). Plan karoları (Ücretsiz · Fresh · Balance) değerleri sunucudan
// (app_settings), fiyat RevenueCat'ten (yoksa alt satır gizli). Abonelik kapalıyken (bayrak/anahtar)
// karolar ve "Planları gör" GİZLİ — yalnız yenilenme + Elle ekle.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, CURVE, DURATION, REDUCED, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Barcode, Check, Clock, X } from '../../../components/icons';
import { limitTiles, type TierLimits } from '../../../lib/subscription/limits';
import type { Tier } from '../../../lib/subscription/plans';
import { palette } from '../../../core/design/tokens';

export interface SubLimitSheetProps {
  visible: boolean;
  kind: 'ai' | 'barcode';
  limits: TierLimits | null;
  tier: Tier;
  /** Bugünkü tavan (başlıktaki sayı; sunucudan). */
  cap: number | null;
  prices?: { fresh: string | null; balance: string | null };
  plansEnabled: boolean;
  onPlans: () => void;
  onManual: () => void;
  onClose: () => void;
}

export default function SubLimitSheet(p: SubLimitSheetProps) {
  const t = useTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(p.visible);
  const v = useSharedValue(0);

  useEffect(() => {
    if (p.visible) {
      setMounted(true);
      v.value = withTiming(1, reduced ? { duration: REDUCED.duration } : { duration: DURATION.base, easing: CURVE.enter });
    } else if (mounted) {
      v.value = withTiming(0, reduced ? { duration: REDUCED.duration } : { duration: DURATION.fast, easing: CURVE.exit }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.visible, reduced]);

  const scrim = useAnimatedStyle(() => ({ opacity: v.value }));
  const sheet = useAnimatedStyle(() =>
    reduced ? { opacity: v.value } : { opacity: Math.min(1, v.value * 4), transform: [{ translateY: (1 - v.value) * 360 }] },
  );

  const ink = t.color.ink;
  const nested = t.isDark ? '#2C2C2E' : '#F3F4F6';
  const card = t.isDark ? '#1C1C1E' : '#FFFFFF';
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';
  const isAi = p.kind === 'ai';
  const showPlans = p.plansEnabled;
  const cap = p.cap ?? (isAi ? p.limits?.ai.free : p.limits?.barcode.free) ?? null;

  const title = isAi
    ? cap != null
      ? tr('sub.limit.ai_title', { n: cap })
      : tr('ai_scan.limit_title')
    : tr('sub.limit.barcode_title', { n: cap ?? '' });
  // G23-S1: Balance'ta da hak biterse (günde 50) planlar Balance'tan yükseği olmadığı için
  // gösterilmez → "yarın yenilenir" gövdesi.
  const top = p.tier === 'balance';
  const body = !showPlans || top
    ? tr(isAi ? 'sub.limit.ai_body_free' : 'sub.limit.barcode_body_free')
    : isAi
      ? tr('sub.limit.ai_body', { fresh: p.limits?.ai.fresh ?? '', balance: p.limits?.ai.balance ?? '' })
      : tr('sub.limit.barcode_body');
  const tiles = p.limits ? limitTiles(p.kind, p.limits, p.tier) : [];

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={p.onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={p.onClose} accessibilityLabel={tr('common.close')} />
      </Animated.View>
      <Animated.View
        style={[styles.sheet, { backgroundColor: card, paddingBottom: Math.max(24, insets.bottom + 8) }, sheet]}
        accessibilityViewIsModal
        testID={`sub-limit-${p.kind}`}
      >
        <View style={[styles.handle, { backgroundColor: line2 }]} />
        <Pressable onPress={p.onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={styles.close} hitSlop={6}>
          <X size={20} color={ink} />
        </Pressable>
        <View style={[styles.icon, { backgroundColor: nested }]}>{isAi ? <Clock size={24} color={ink} /> : <Barcode size={24} color={ink} />}</View>
        <AppText textRole="screenTitle" style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <AppText tone="secondary" style={styles.body}>
          {body}
        </AppText>

        {showPlans && tiles.length ? (
          <View style={styles.tiles} accessibilityLabel={tr('sub.limit.tiles_a11y')}>
            {tiles.map((x) => {
              const name = x.tier === 'free' ? tr('sub.limit.free') : x.tier === 'fresh' ? 'Fresh' : 'Balance';
              const val = x.unlimited ? tr('sub.limit.unlimited') : x.value != null ? tr('sub.limit.per_day', { n: x.value }) : '—';
              const price = x.tier === 'fresh' ? p.prices?.fresh : x.tier === 'balance' ? p.prices?.balance : null;
              const sub = x.current ? tr('sub.limit.now') : price ? tr('sub.limit.per_month_price', { price }) : null;
              return (
                <View
                  key={x.tier}
                  accessible
                  accessibilityLabel={[name, val, sub].filter(Boolean).join(', ')}
                  style={[styles.tile, { backgroundColor: nested }, x.current ? { borderWidth: 2, borderColor: ink } : null]}
                >
                  <AppText tone="secondary" style={styles.tileName} numberOfLines={1}>
                    {name}
                  </AppText>
                  <AppText style={styles.tileVal} numberOfLines={2}>
                    {val}
                  </AppText>
                  {sub ? (
                    <AppText tone="secondary" style={styles.tileSub} numberOfLines={2}>
                      {sub}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.note, { backgroundColor: nested }]}>
          <Check size={14} color={ink} weight="bold" />
          <AppText style={styles.noteText}>{tr(isAi ? 'sub.limit.ai_note' : 'sub.limit.barcode_note')}</AppText>
        </View>

        {showPlans ? (
          <Pressable onPress={p.onPlans} accessibilityRole="button" style={[styles.btn, styles.first, { backgroundColor: palette.lime }]} testID="sub-limit-plans">
            <AppText style={[styles.btnText, { color: '#0A0A0A' }]}>{tr('sub.limit.plans')}</AppText>
          </Pressable>
        ) : null}
        <Pressable
          onPress={p.onManual}
          accessibilityRole="button"
          style={[styles.btn, showPlans ? styles.next : styles.first, showPlans ? { borderWidth: 1, borderColor: line2 } : { backgroundColor: ink }]}
          testID="sub-limit-manual"
        >
          <AppText style={[styles.btnText, { color: showPlans ? ink : t.color.bg }]}>{tr('sub.limit.manual')}</AppText>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 16 },
  handle: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  close: { position: 'absolute', right: 8, top: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  icon: { marginTop: 18, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 14 },
  body: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  tiles: { marginTop: 14, flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10, minHeight: 78 },
  tileName: { fontSize: 13 },
  tileVal: { marginTop: 2, fontSize: 17, fontWeight: '700' },
  tileSub: { marginTop: 2, fontSize: 12 },
  note: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  noteText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  first: { marginTop: 18 },
  next: { marginTop: 10 },
  btn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '700' },
});
