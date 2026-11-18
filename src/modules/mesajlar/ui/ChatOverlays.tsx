// G63-S1 — Sohbet katmanları (docs/g63/design/FinChat.dc.html `menu` · `block` · `blocked`).
//  • Menü: mevcut Sheet (28 köşe, tutamaç, başlık = kişi adı, 44 kapat) + 16 köşe grup: Sessize al (≥ 56, alt
//    satır 13, 51×31 anahtar, açıkken lime), Bildir (bayrak), Engelle (kırmızı). Ayraç 1 pt, 52 soldan.
//  • Engelle onayı: 290 genişlik, 16 köşe uyarı; başlık 17 kalın, gövde 14; Vazgeç | Engelle (kırmızı kalın) ≥ 48.
//    Giriş 220 ms (1,08 → 1 + opaklık); azaltılmış harekette yalnız opaklık. Cam yerine düz yüzey (Reduce
//    Transparency karşılığı — paylaş sayfasıyla aynı karar).
//  • Durum bildirimi: alttan 112, ≥ 52, 16 köşe; "[Ad] engellendi".
//  • Mesaj seçenekleri (tasarımda yok; aynı grup dili): Mesajı sil (15 dk) / Mesajı bildir.
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { FinText as Text } from '../../../core/design/components/FinText';
import { RN_CURVE, DURATION, Sheet, fontFamily, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { DmIcon, LIME, type DmPalette } from './parts';

function Row({
  icon,
  label,
  sub,
  color,
  onPress,
  role = 'button',
  checked,
  right,
  bold,
  testID,
  c,
}: {
  icon: 'bellSlash' | 'flag' | 'prohibit' | 'x';
  label: string;
  sub?: string;
  color: string;
  onPress: () => void;
  role?: 'button' | 'switch';
  checked?: boolean;
  right?: React.ReactNode;
  bold?: boolean;
  testID?: string;
  c: DmPalette;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'switch' ? { checked: !!checked } : undefined}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.line }]}
      testID={testID}
    >
      <DmIcon name={icon} size={22} color={color} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color, fontFamily: bold ? fontFamily.bodySemibold : fontFamily.bodyRegular }]}>{label}</Text>
        {sub ? <Text style={[styles.rowSub, { color: c.sec }]}>{sub}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function Switch({ on, c }: { on: boolean; c: DmPalette }) {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: on ? 1 : 0, duration: reduced ? 0 : DURATION.fast, easing: RN_CURVE.standard, useNativeDriver: false }).start();
  }, [on, reduced, x]);
  return (
    <View style={[styles.track, { backgroundColor: on ? LIME : c.switchOff }]}>
      <Animated.View style={[styles.knob, { left: x.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }]} />
    </View>
  );
}

export function ChatMenuSheet({
  visible,
  name,
  muted,
  c,
  onClose,
  onToggleMute,
  onReport,
  onBlock,
}: {
  visible: boolean;
  name: string;
  muted: boolean;
  c: DmPalette;
  onClose: () => void;
  onToggleMute: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  const { t: tr } = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={name}>
      <View style={[styles.group, { backgroundColor: c.groupSolid }]} testID="dm-menu">
        <Row
          c={c}
          icon="bellSlash"
          label={tr('dm.chat.mute')}
          sub={tr('dm.chat.mute_sub')}
          color={c.text}
          role="switch"
          checked={muted}
          onPress={() => {
            haptic('selection');
            onToggleMute();
          }}
          right={<Switch on={muted} c={c} />}
          testID="dm-menu-mute"
        />
        <View style={[styles.sep, { backgroundColor: c.line }]} />
        <Row c={c} icon="flag" label={tr('dm.chat.report')} color={c.text} onPress={onReport} testID="dm-menu-report" />
        <View style={[styles.sep, { backgroundColor: c.line }]} />
        <Row c={c} icon="prohibit" label={tr('dm.chat.block')} color={c.red} bold onPress={onBlock} testID="dm-menu-block" />
      </View>
    </Sheet>
  );
}

export function MessageActionsSheet({
  visible,
  c,
  canDelete,
  canReport,
  onClose,
  onDelete,
  onReport,
}: {
  visible: boolean;
  c: DmPalette;
  canDelete: boolean;
  canReport: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  const { t: tr } = useT();
  return (
    <Sheet visible={visible} onClose={onClose} title={tr('dm.chat.msg_actions')}>
      <View style={[styles.group, { backgroundColor: c.groupSolid }]} testID="dm-msg-actions">
        {canDelete ? (
          <Row c={c} icon="x" label={tr('dm.chat.delete_msg')} sub={tr('dm.chat.delete_msg_sub')} color={c.red} bold onPress={onDelete} testID="dm-msg-delete" />
        ) : null}
        {canDelete && canReport ? <View style={[styles.sep, { backgroundColor: c.line }]} /> : null}
        {canReport ? <Row c={c} icon="flag" label={tr('dm.chat.report_msg')} color={c.text} onPress={onReport} testID="dm-msg-report" /> : null}
      </View>
    </Sheet>
  );
}

export function BlockAlert({
  visible,
  name,
  c,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  name: string;
  c: DmPalette;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : RN_CURVE.enter, useNativeDriver: true }).start();
  }, [visible, reduced, v]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]} onPress={onCancel} accessibilityElementsHidden importantForAccessibility="no" />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          accessibilityRole="alert"
          style={[
            styles.alert,
            { backgroundColor: c.glass },
            reduced ? { opacity: v } : { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] }) }] },
          ]}
          testID="dm-block-alert"
        >
          <View style={styles.alertBody}>
            <Text accessibilityRole="header" style={[styles.alertTitle, { color: c.text }]}>
              {tr('dm.chat.block_title', { name })}
            </Text>
            <Text style={[styles.alertText, { color: c.text }]}>{tr('dm.chat.block_body')}</Text>
          </View>
          <View style={[styles.alertBtns, { borderTopColor: c.line2 }]}>
            <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.alertBtn, { borderRightWidth: 1, borderRightColor: c.line2 }]} testID="dm-block-cancel">
              <Text style={[styles.alertBtnText, { color: c.text, fontFamily: fontFamily.bodyMedium }]}>{tr('dm.chat.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic('warning');
                onConfirm();
              }}
              accessibilityRole="button"
              style={styles.alertBtn}
              testID="dm-block-confirm"
            >
              <Text style={[styles.alertBtnText, { color: c.red, fontFamily: fontFamily.bodyBold }]}>{tr('dm.chat.block')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function StatusToast({ text, c, bottom = 112, icon }: { text: string | null; c: DmPalette; bottom?: number; icon?: 'prohibit' }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!text) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: DURATION.fast, easing: reduced ? RN_CURVE.linear : RN_CURVE.standard, useNativeDriver: true }).start();
  }, [text, reduced, v]);
  if (!text) return null;
  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom, backgroundColor: c.glass, opacity: v }]}
      testID="dm-status-toast"
    >
      {icon ? <DmIcon name={icon} size={20} color={c.text} /> : null}
      <Text style={[styles.toastText, { color: c.text }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 8, borderRadius: 16, overflow: 'hidden' },
  row: { minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowLabel: { fontSize: 16, lineHeight: 21 },
  rowSub: { fontSize: 13, lineHeight: 17 },
  sep: { height: 1, marginLeft: 52 },
  track: { width: 51, height: 31, borderRadius: 16 },
  knob: { position: 'absolute', top: 2, width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  alert: { width: 290, maxWidth: '100%', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  alertBody: { paddingTop: 20, paddingHorizontal: 18, paddingBottom: 16, alignItems: 'center' },
  alertTitle: { fontFamily: fontFamily.bodyBold, fontSize: 17, lineHeight: 22, textAlign: 'center' },
  alertText: { marginTop: 6, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  alertBtns: { flexDirection: 'row', borderTopWidth: 1 },
  alertBtn: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  alertBtnText: { fontSize: 17, textAlign: 'center' },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { flex: 1, fontFamily: fontFamily.bodySemibold, fontSize: 15, lineHeight: 20 },
});
