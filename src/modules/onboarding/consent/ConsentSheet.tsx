// G20-S1 md.1 — Rıza sheet'i (FinOnbAccountEmail sheet dili: aynı yüzey, başlık,
// kapat düğmesi, hareket token'ları). Üç kip:
//   details   — Apple/Google: "Ayrıntılar" → blok (onay kutusu yok; kabul "Devam
//               ederek …" satırıyla), "Tamam" kapatır. Kapatılabilir.
//   notice    — mevcut kullanıcı, bir sonraki açılışta BİR KEZ: aynı içerik + "Devam et".
//   reconsent — yeni belge sürümü: onay kutusu zorunlu, "Kabul et ve devam et".
//               Kapatılamaz (karartma/geri tuşu kapatmaz).
// Hareket: sheet base 300 enter / fast 200 exit, karartma 0→0.32; azaltılmış 200 ms opaklık.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, REDUCED, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { OnbButton } from '../components/pieces';
import { useOnb } from '../components/onbTheme';
import { ConsentBlock } from './ConsentBlock';

const X_D =
  'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';

export type ConsentSheetMode = 'details' | 'notice' | 'reconsent';

export function ConsentSheet({
  visible,
  mode,
  adOn,
  onAdChange,
  onConfirm,
  onClose,
  busy,
}: {
  visible: boolean;
  mode: ConsentSheetMode;
  adOn: boolean;
  onAdChange: (v: boolean) => void;
  /** Birincil düğme (details: Tamam · notice: Devam et · reconsent: Kabul et). */
  onConfirm: () => void;
  /** Yalnız details kipinde (karartma / X / geri). */
  onClose?: () => void;
  busy?: boolean;
}) {
  const P = useOnb();
  const i18n = useT();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const [accepted, setAccepted] = useState(false);
  const [showRequired, setShowRequired] = useState(false);
  const y = useSharedValue(1);
  const o = useSharedValue(0);
  const dismissable = mode === 'details';

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        y.value = 0;
        o.value = withTiming(1, { duration: REDUCED.duration });
      } else {
        o.value = withTiming(1, { duration: DURATION.base, easing: CURVE.enter });
        y.value = withTiming(0, { duration: DURATION.base, easing: CURVE.enter });
      }
    } else if (mounted) {
      const end = () => {
        setMounted(false);
        setAccepted(false);
        setShowRequired(false);
      };
      if (reduced) {
        o.value = withTiming(0, { duration: REDUCED.duration }, (ok) => ok && runOnJS(end)());
      } else {
        o.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit });
        y.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.exit }, (ok) => ok && runOnJS(end)());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduced ? o.value : 1,
    transform: [{ translateY: y.value * 520 }],
  }));

  if (!mounted) return null;

  const sheetBg = P.isDark ? '#1C1C1E' : '#F2F2F2';
  const sheetEdge = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)';
  const xBg = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.06)';
  const title = i18n.t(`consent.sheet.${mode}_title`);
  const lead = i18n.t(`consent.sheet.${mode}_lead`);
  const ok = i18n.t(`consent.sheet.${mode}_ok`);
  const close = () => {
    if (dismissable) onClose?.();
  };
  const confirm = () => {
    if (busy) return;
    if (mode === 'reconsent' && !accepted) {
      setShowRequired(true);
      return;
    }
    onConfirm();
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,10,10,0.32)' }, scrimStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessible={dismissable}
          accessibilityRole={dismissable ? 'button' : undefined}
          accessibilityLabel={dismissable ? i18n.t('consent.sheet.close') : undefined}
        />
      </Animated.View>
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { borderTopColor: sheetEdge }, sheetStyle]}
          testID={`consent-sheet-${mode}`}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: sheetBg }]} />
          <View style={styles.head}>
            <AppText style={[styles.title, { color: P.ink }]} accessibilityRole="header">
              {title}
            </AppText>
            {dismissable ? (
              <Pressable
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('consent.sheet.close')}
                style={styles.xHit}
              >
                <View style={[styles.xDot, { backgroundColor: xBg }]}>
                  <Svg width={18} height={18} viewBox="0 0 256 256">
                    <Path d={X_D} fill={P.ink} />
                  </Svg>
                </View>
              </Pressable>
            ) : (
              <View style={styles.xHit} />
            )}
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <AppText style={[styles.lead, { color: P.sec }]}>{lead}</AppText>
            <ConsentBlock
              accepted={mode === 'reconsent' ? accepted : undefined}
              onAcceptedChange={(v) => {
                setAccepted(v);
                if (v) setShowRequired(false);
              }}
              showRequired={showRequired}
              adOn={adOn}
              onAdChange={onAdChange}
              testID={`consent-sheet-${mode}-block`}
            />
            <OnbButton
              kind={mode === 'details' ? 'ink' : 'lime'}
              label={ok}
              onPress={confirm}
              disabled={busy || (mode === 'reconsent' && !accepted)}
            />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchor: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: 720,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    overflow: 'hidden',
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, paddingRight: 8, paddingBottom: 4, paddingLeft: 20 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 22, lineHeight: 25, flex: 1 },
  xHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  xDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0 },
  body: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 34, gap: 14 },
  lead: { fontSize: 15, lineHeight: 21 },
});
