// G24-S1 md.3 — kcalAI Koç sheet'leri: "Koç Balance'ta" (FinCoachUpsell), seçenekler menüsü,
// geçmişi silme uyarısı (FinCoachDelete: ölçek 1.08 → 1 + opaklık 220; azaltılmışta yalnız opaklık).
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText, CURVE, DURATION, REDUCED, Sheet, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Check, ClockCounterClockwise, Trash } from '../../../components/icons';
import { CoachGlass, LIME, LIME_INK, useCoachTones } from './parts';

export function UpsellSheet({
  visible,
  trial,
  daily,
  aiPerDay,
  yearlyPrice,
  onPlans,
  onClose,
}: {
  visible: boolean;
  trial: number;
  daily: number;
  aiPerDay: number | null;
  yearlyPrice: string | null;
  onPlans: () => void;
  onClose: () => void;
}) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const list = [tr('coach.up1', { n: daily }), aiPerDay != null ? tr('coach.up2', { n: aiPerDay }) : null, tr('coach.up3')].filter(Boolean) as string[];
  return (
    <Sheet visible={visible} onClose={onClose} testID="coach-upsell">
      <View style={styles.upWrap}>
        <CoachGlass size={110} />
        <AppText style={[styles.upTitle, { color: c.text }]} accessibilityRole="header">
          {tr('coach.up_title')}
        </AppText>
        <AppText style={[styles.upBody, { color: c.sec }]}>{tr('coach.up_body', { n: trial })}</AppText>
        <View style={[styles.upList, { backgroundColor: c.nested }]}>
          {list.map((l) => (
            <View key={l} style={styles.upRow}>
              <View style={styles.check}>
                <Check size={14} color={LIME_INK} weight="bold" />
              </View>
              <AppText style={[styles.upRowText, { color: c.text }]}>{l}</AppText>
            </View>
          ))}
        </View>
        {yearlyPrice ? <AppText style={[styles.upPrice, { color: c.sec }]}>{tr('coach.up_price', { price: yearlyPrice })}</AppText> : null}
        <Pressable onPress={onPlans} accessibilityRole="button" style={[styles.btn, { backgroundColor: LIME }]} testID="coach-upsell-plans">
          <AppText style={[styles.btnText, { color: LIME_INK }]}>{tr('coach.up_cta')}</AppText>
        </Pressable>
        <Pressable onPress={onClose} accessibilityRole="button" style={[styles.btn, { borderWidth: 1, borderColor: c.line2 }]} testID="coach-upsell-later">
          <AppText style={[styles.btnText, { color: c.text, fontWeight: '600' }]}>{tr('coach.not_now')}</AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}

export function MenuSheet({ visible, onHistory, onDelete, onClose }: { visible: boolean; onHistory: () => void; onDelete: () => void; onClose: () => void }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('coach.options')} testID="coach-menu">
      <View style={[styles.menu, { backgroundColor: c.nested }]}>
        <Pressable onPress={onHistory} accessibilityRole="button" style={styles.menuRow} testID="coach-menu-history">
          <ClockCounterClockwise size={22} color={c.text} />
          <AppText style={[styles.menuText, { color: c.text }]}>{tr('coach.history')}</AppText>
        </Pressable>
        <View style={[styles.sep, { backgroundColor: c.line }]} />
        <Pressable onPress={onDelete} accessibilityRole="button" style={styles.menuRow} testID="coach-menu-delete">
          <Trash size={22} color={c.red} />
          <AppText style={[styles.menuText, { color: c.red }]}>{tr('coach.del_history')}</AppText>
        </Pressable>
      </View>
    </Sheet>
  );
}

export function DeleteConfirm({ visible, busy, onConfirm, onCancel }: { visible: boolean; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = visible ? withTiming(1, { duration: reduced ? REDUCED.duration : DURATION.fast, easing: CURVE.enter }) : 0;
  }, [visible, reduced, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: reduced ? 1 : 1.08 - 0.08 * p.value }] }));
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onCancel}>
      <View style={[styles.scrim, { backgroundColor: c.t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(10,10,10,0.4)' }]}>
        <Animated.View style={[styles.alert, { backgroundColor: c.card }, st]} accessibilityViewIsModal accessibilityRole="alert" testID="coach-delete">
          <AppText style={[styles.alertTitle, { color: c.text }]} accessibilityRole="header">
            {tr('coach.del_title')}
          </AppText>
          <AppText style={[styles.alertBody, { color: c.sec }]}>{tr('coach.del_body')}</AppText>
          <View style={styles.alertRow}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.alertBtn, { borderColor: c.line2, borderWidth: 1 }]} testID="coach-delete-cancel">
              <AppText style={[styles.btnText, { color: c.text, fontWeight: '600' }]}>{tr('common.cancel')}</AppText>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ busy }}
              style={[styles.alertBtn, { backgroundColor: c.red }]}
              testID="coach-delete-confirm"
            >
              <AppText style={[styles.btnText, { color: '#FFFFFF' }]}>{tr('coach.del')}</AppText>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  upWrap: { alignItems: 'center', gap: 12, paddingBottom: 8 },
  upTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30, textAlign: 'center' },
  upBody: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  upList: { alignSelf: 'stretch', borderRadius: 20, padding: 14, gap: 10 },
  upRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: { width: 24, height: 24, borderRadius: 12, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  upRowText: { flex: 1, fontSize: 16 },
  upPrice: { fontSize: 13, textAlign: 'center' },
  btn: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  menu: { borderRadius: 20, overflow: 'hidden' },
  menuRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  menuText: { fontSize: 16, fontWeight: '500' },
  sep: { height: 1, marginLeft: 50 },
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  alert: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 20, gap: 10 },
  alertTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  alertBody: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  alertRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  alertBtn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
