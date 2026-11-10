// G15-S3 — Şikayet akışı TAM SAYFA (Final FinReport + FinReportDone) ve engelleme
// onay içeriği (FinPostMenuBlock). Gönderi menüsü (PostMenu) ve yorum menüsü
// (CommentsSheet) ortak kullanır.
//
//  - Neden adımı: "✕ Şikayet et", açıklama, 7 neden (radyo), isteğe bağlı not,
//    siyah "Gönder". Gönderim report_content'e `kod` (+ ": not") olarak gider.
//  - Teşekkürler adımı: siyah ✓ dairesi, başlık + açıklama, sonraki seçenekler
//    (engelle / sessize al / benzerlerini daha az göster — yalnız çağıran o
//    davranışı verdiyse görünür), siyah "Tamam".
//  - Gönderim başarısızsa neden adımında sakin bir not (kırmızı yok) + tekrar dene.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { AppText, fontFamily, haptic, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { REPORT_REASONS, type ReportReason } from './format';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

const NOTE_MAX = 300;

/** report_content'e giden metin: neden kodu + isteğe bağlı not. */
export function reportReasonText(reason: ReportReason, note: string): string {
  const n = note.trim().slice(0, NOTE_MAX);
  return n ? `${reason}: ${n}` : reason;
}

// Final çizgi ikonları (24 viewBox, stroke 1.75).
const LINE = {
  x: 'M6 6l12 12 M18 6 6 18',
  block: 'M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M6.3 6.3l11.4 11.4',
  mute: 'M6 16V11a6 6 0 0 1 9.5-4.9 M18 11v5l1.5 2H8 M4 4l16 16',
  less: 'M4 7h16 M7 12h10 M10 17h4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
} as const;

export function LineIcon({
  name,
  size = 22,
  color,
  strokeWidth = 1.75,
}: {
  name: keyof typeof LINE;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path d={LINE[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Step = 'reason' | 'done';

export function ReportModal({
  visible,
  authorName,
  onSubmit,
  onBlock,
  onMute,
  onLessLike,
  onClose,
  initialStep,
  initialReason,
  initialNote,
}: {
  visible: boolean;
  authorName: string;
  onSubmit: (reason: ReportReason, note: string) => boolean | void | Promise<boolean | void>;
  onBlock?: () => void;
  onMute?: () => void;
  onLessLike?: () => void;
  onClose: () => void;
  /** YALNIZ __DEV__ vitrini: açılış adımı / örnek seçim. */
  initialStep?: Step;
  initialReason?: ReportReason | null;
  initialNote?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tr } = useT();
  const [step, setStep] = useState<Step>(initialStep ?? 'reason');
  const [reason, setReason] = useState<ReportReason | null>(initialReason ?? null);
  const [note, setNote] = useState(initialNote ?? '');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep(initialStep ?? 'reason');
      setReason(initialReason ?? null);
      setNote(initialNote ?? '');
      setFailed(false);
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const line2 = t.isDark ? '#48484A' : '#C3C7CC';
  const onInk = t.isDark ? '#0A0A0A' : '#FFFFFF';

  const send = async () => {
    if (!reason || sending) return;
    haptic('selection');
    setSending(true);
    setFailed(false);
    const res = await Promise.resolve(onSubmit(reason, note)).catch(() => false);
    setSending(false);
    if (res === false) setFailed(true);
    else setStep('done');
  };

  const after: Array<{ key: string; icon: keyof typeof LINE; label: string; sub: string; run: () => void }> = [];
  if (onBlock) {
    after.push({
      key: 'block',
      icon: 'block',
      label: tr('kesfet.report.after.block', { name: authorName }),
      sub: tr('kesfet.report.after.block_sub'),
      run: onBlock,
    });
  }
  if (onMute) {
    after.push({ key: 'mute', icon: 'mute', label: tr('kesfet.report.after.mute'), sub: tr('kesfet.report.after.mute_sub'), run: onMute });
  }
  if (onLessLike) {
    after.push({ key: 'less', icon: 'less', label: tr('kesfet.report.after.less'), sub: tr('kesfet.report.after.less_sub'), run: onLessLike });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.fill, { backgroundColor: t.color.bg, paddingTop: insets.top }]}
      >
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        {step === 'reason' ? (
          <>
            <View style={styles.header}>
              {/* G17-S1 md.7: modal → başlık solda, kapat X sağda. */}
              <AppText accessibilityRole="header" style={[styles.h1, { color: t.color.ink, flex: 1, paddingLeft: 12 }]}>
                {tr('kesfet.report.title')}
              </AppText>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={styles.iconBtn}>
                <LineIcon name="x" color={t.color.ink} />
              </Pressable>
            </View>
            <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 120 }}>
              <AppText variant="body" tone="secondary" style={styles.lead}>
                {tr('kesfet.report.lead')}
              </AppText>
              <View accessibilityRole="radiogroup" style={styles.reasons}>
                {REPORT_REASONS.map((r) => {
                  const on = r === reason;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => {
                        haptic('selection');
                        setReason(r);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={tr(`kesfet.report.reason.${r}`)}
                      style={[styles.reasonRow, { borderBottomColor: t.color.line }]}
                    >
                      <AppText
                        variant="body"
                        style={[styles.reasonText, on ? styles.semibold : null, { color: t.color.ink }]}
                      >
                        {tr(`kesfet.report.reason.${r}`)}
                      </AppText>
                      <View
                        style={[
                          styles.radio,
                          on ? { borderWidth: 2, borderColor: t.color.ink } : { borderWidth: 1.5, borderColor: line2 },
                        ]}
                      >
                        {on ? <View style={[styles.radioDot, { backgroundColor: t.color.ink }]} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.noteWrap}>
                <AppText variant="caption" tone="secondary" style={styles.noteLabel}>
                  {tr('kesfet.report.note_label')}
                </AppText>
                <TextInput
                  value={note}
                  onChangeText={(v) => setNote(v.slice(0, NOTE_MAX))}
                  multiline
                  accessibilityLabel={tr('kesfet.report.note_label')}
                  style={[
                    styles.note,
                    { borderColor: t.color.line, backgroundColor: t.color.surface, color: t.color.ink },
                  ]}
                />
              </View>
              {failed ? (
                <AppText variant="caption" tone="secondary" style={styles.failed}>
                  {tr('kesfet.ui.report_notice_desc')}
                </AppText>
              ) : null}
            </ScrollView>
            <View style={[styles.bottom, { bottom: Math.max(insets.bottom, 16) + 18 }]}>
              <Pressable
                onPress={() => void send()}
                disabled={!reason || sending}
                accessibilityRole="button"
                accessibilityState={{ disabled: !reason || sending }}
                accessibilityLabel={failed ? tr('common.retry') : tr('kesfet.report.send')}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: t.color.ink, opacity: !reason || sending ? 0.4 : pressed ? 0.9 : 1 },
                ]}
              >
                <AppText variant="body" style={[styles.primaryText, { color: onInk }]}>
                  {failed ? tr('common.retry') : tr('kesfet.report.send')}
                </AppText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <ScrollView {...SCROLL_KEYBOARD} contentContainerStyle={{ paddingBottom: 120 }}>
              <View style={styles.doneHead}>
                <View style={[styles.doneCircle, { backgroundColor: t.color.ink }]}>
                  <LineIcon name="check" size={32} color={onInk} strokeWidth={2.5} />
                </View>
                <AppText accessibilityRole="header" style={[styles.doneTitle, { color: t.color.ink }]}>
                  {tr('kesfet.report.done_title')}
                </AppText>
                <AppText variant="body" tone="secondary" style={styles.doneDesc}>
                  {tr('kesfet.report.done_desc')}
                </AppText>
              </View>
              {after.length > 0 ? (
                <View style={[styles.afterList, { borderTopColor: t.color.line }]}>
                  {after.map((a) => (
                    <Pressable
                      key={a.key}
                      onPress={() => {
                        haptic('selection');
                        a.run();
                        onClose();
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                      style={({ pressed }) => [styles.afterRow, { borderBottomColor: t.color.line }, pressed && { opacity: 0.7 }]}
                    >
                      <LineIcon name={a.icon} color={t.color.ink} />
                      <View style={styles.afterText}>
                        <AppText variant="body" style={[styles.afterLabel, { color: t.color.ink }]}>
                          {a.label}
                        </AppText>
                        <AppText variant="caption" tone="secondary" style={styles.afterSub}>
                          {a.sub}
                        </AppText>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <View style={[styles.bottom, { bottom: Math.max(insets.bottom, 16) + 18 }]}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={tr('kesfet.ui.done_ok')}
                style={({ pressed }) => [styles.primary, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
              >
                <AppText variant="body" style={[styles.primaryText, { color: onInk }]}>
                  {tr('kesfet.ui.done_ok')}
                </AppText>
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** FinPostMenuBlock — engelleme onayı (sheet içeriği). */
export function BlockConfirm({
  name,
  onConfirm,
  onCancel,
}: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const onInk = t.isDark ? '#0A0A0A' : '#FFFFFF';
  return (
    <View style={styles.blockWrap}>
      <View style={[styles.blockIcon, { backgroundColor: t.color.line }]}>
        <LineIcon name="block" size={24} color={t.color.ink} />
      </View>
      <AppText accessibilityRole="header" style={[styles.blockTitle, { color: t.color.ink }]}>
        {tr('kesfet.ui.block_confirm_title', { name })}
      </AppText>
      <AppText variant="body" tone="secondary" style={styles.blockDesc}>
        {tr('kesfet.ui.block_confirm_desc')}
      </AppText>
      <Pressable
        onPress={() => {
          haptic('medium');
          onConfirm();
        }}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfet.ui.menu.block')}
        style={({ pressed }) => [styles.primary, styles.blockBtn, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
      >
        <AppText variant="body" style={[styles.primaryText, { color: onInk }]}>
          {tr('kesfet.ui.menu.block')}
        </AppText>
      </Pressable>
      <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel={tr('common.cancel')} style={styles.textBtn}>
        <AppText variant="body" style={[styles.primaryText, { color: t.color.ink }]}>
          {tr('common.cancel')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  h1: { fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 28 },
  lead: { marginTop: 8, marginHorizontal: 16, fontSize: 15, lineHeight: 21 },
  reasons: { marginTop: 12, paddingHorizontal: 16 },
  reasonRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  reasonText: { flex: 1, fontSize: 15, lineHeight: 21 },
  semibold: { fontFamily: fontFamily.bodySemibold },
  radio: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  noteWrap: { marginTop: 14, marginHorizontal: 16, gap: 6 },
  noteLabel: { fontSize: 13, fontFamily: fontFamily.bodySemibold },
  note: {
    minHeight: 72,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    fontSize: 14,
    fontFamily: fontFamily.bodyRegular,
    textAlignVertical: 'top',
  },
  failed: { marginTop: 12, marginHorizontal: 16, fontSize: 13 },
  bottom: { position: 'absolute', left: 16, right: 16 },
  primary: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 15, fontFamily: fontFamily.bodySemibold },
  doneHead: { paddingTop: 72, paddingHorizontal: 16, alignItems: 'center', gap: 10 },
  doneCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { fontFamily: fontFamily.headingBold, fontSize: 28, lineHeight: 34, textAlign: 'center' },
  doneDesc: { maxWidth: 320, textAlign: 'center', fontSize: 15, lineHeight: 21 },
  afterList: { marginTop: 28, marginHorizontal: 16, borderTopWidth: 1 },
  afterRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1 },
  afterText: { flex: 1 },
  afterLabel: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.bodySemibold },
  afterSub: { fontSize: 13, lineHeight: 18 },
  blockWrap: { paddingTop: 4, paddingBottom: 4 },
  blockIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { marginTop: 14, fontFamily: fontFamily.headingBold, fontSize: 22, lineHeight: 28 },
  blockDesc: { marginTop: 8, fontSize: 15, lineHeight: 21 },
  blockBtn: { marginTop: 20 },
  textBtn: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});
