// G22-S1 md.1 — FinScanVoice (Tur 26g): "Ne yedin? Söyle" — tüm hâller.
//
// idle (Hazır) · listening (Dinliyorum, canlı döküm) · paused · processing (Analiz ediliyor +
// öğe çipleri) · sheet hâlleri: perm (iki izin) · denied (Ayarlar) · empty (duyulmadı, hak
// düşmez) · offline (telefonda saklandı) · limit (hak bitti) · failed. Hareket FinMoScanVoice:
// dalga çubukları YALNIZ kayıt sürerken sesi izler (standard, instant örnekleme), kayıt halkası
// yalnız kayıt sürerken story 900 nabız; azaltılmış harekette dalga sabit, halka sabit, yalnız opaklık.
// Bu bileşen SAF görünüm: durum ScanScreen'de (useVoiceScan).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, CURVE, DURATION, haptic, useReducedMotion, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import {
  Check,
  Clock,
  Keyboard,
  Microphone,
  MicrophoneSlash,
  Sparkle,
  Stop,
  WarningCircle,
  Waveform,
  WifiSlash,
  X,
} from '../../../../components/icons';
import { WAVE_BARS, isSheetPhase, splitSpokenItems, splitTail, waveHeights, type VoicePhase } from './voiceCore';
import { SCROLL_KEYBOARD } from '../../../../core/design/keyboard';

export type ScanInputMode = 'photo' | 'voice' | 'barcode' | 'manual';

function tokens(isDark: boolean) {
  return isDark
    ? { bg: '#000000', card: '#1C1C1E', nested: '#2C2C2E', line: '#2C2C2E', line2: '#48484A', wave: '#C6F04F', halo: 'rgba(198,240,79,0.35)', dotHalo: 'rgba(198,240,79,0.18)', scrim: 'rgba(0,0,0,0.4)' }
    : { bg: '#F3F4F6', card: '#FFFFFF', nested: '#F3F4F6', line: '#E9EBEE', line2: '#C3C7CC', wave: '#4A6B00', halo: 'rgba(74,107,0,0.3)', dotHalo: 'rgba(74,107,0,0.14)', scrim: 'rgba(10,10,10,0.4)' };
}

export interface FinScanVoiceProps {
  phase: VoicePhase;
  transcript: string;
  /** Ara sonuç akıyor → son kelime ikincil renkte. */
  interim?: boolean;
  /** 0…1 ses seviyesi (kayıt sürerken). */
  level?: number;
  pillText: string | null;
  pillA11y?: string | null;
  offlineCount?: number;
  /** Hak bitti sheet'inde "Planları gör" (abonelik bayrağı + RevenueCat). */
  plansEnabled?: boolean;
  limitCap?: number | null;
  onClose: () => void;
  onMode: (m: ScanInputMode) => void;
  onMic: () => void;
  onDone: () => void;
  onCancel: () => void;
  onKeyboardSubmit: (text: string) => void;
  onPermContinue: () => void;
  onPermLater: () => void;
  onOpenSettings: () => void;
  onRetry: () => void;
  onOfflineOk: () => void;
  onPlans: () => void;
  onManual: () => void;
  /** Mod çubuğunda Ses dışındaki modlar (Fotoğraf/Barkod) kilitli mi (analiz sürerken). */
  modesLocked?: boolean;
}

export default function FinScanVoice(p: FinScanVoiceProps) {
  const t = useTheme();
  const k = tokens(t.isDark);
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [kbOpen, setKbOpen] = useState(false);
  const [kbText, setKbText] = useState('');

  const recording = p.phase === 'listening';
  const processing = p.phase === 'processing';
  const hasTranscript = p.transcript.trim().length > 0;
  const showWave = p.phase === 'idle' || p.phase === 'listening' || p.phase === 'paused' || p.phase === 'empty';
  const showExample = p.phase === 'idle' || (isSheetPhase(p.phase) && p.phase !== 'offline');
  const sheet = isSheetPhase(p.phase);

  // ── Dalga: yalnız kayıt sürerken sesi izler; azaltılmışta sabit çubuk ──
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!recording || reduced) return;
    const id = setInterval(() => setTick((n) => n + 1), DURATION.instant);
    return () => clearInterval(id);
  }, [recording, reduced]);
  const heights = useMemo(
    () => (recording && !reduced ? waveHeights(Math.max(0.12, p.level ?? 0), tick * 0.9) : new Array(WAVE_BARS).fill(6)),
    [recording, reduced, p.level, tick],
  );

  // ── Kayıt halkası: kayıt sürerken story 900 nabız (döngü), değilse sabit ──
  const halo = useSharedValue(0);
  useEffect(() => {
    if (recording && !reduced) {
      // story 900 nabız (ileri-geri), yalnız kayıt sürerken.
      halo.value = withRepeat(withTiming(1, { duration: DURATION.story, easing: CURVE.standard }), -1, true);
    } else {
      cancelAnimation(halo);
      halo.value = withTiming(0, { duration: DURATION.fast });
    }
  }, [recording, reduced, halo]);
  const haloStyle = useAnimatedStyle(() => ({ opacity: recording ? 0.45 + 0.55 * halo.value : 0, transform: [{ scale: 1 + 0.06 * halo.value }] }));

  // Basma: instant 100 ölçek 0.98 (FinMoScanVoice "Kayıt").
  const press = useSharedValue(1);
  const micStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  const { head, tail } = splitTail(p.transcript, !!p.interim && recording);
  const chips = processing ? splitSpokenItems(p.transcript) : [];

  const statusLabel =
    p.phase === 'listening'
      ? tr('voice.listening')
      : p.phase === 'paused'
        ? tr('voice.paused')
        : p.phase === 'processing'
          ? tr('voice.said')
          : p.phase === 'offline'
            ? tr('voice.saved')
            : tr('voice.ready');
  const topPill = p.phase === 'offline' ? tr('voice.offline_chip') : p.pillText;

  return (
    <View style={[styles.fill, { backgroundColor: k.bg }]} testID="fin-scan-voice">
      {/* Üst: hak hapı (sol) + kapat (sağ, modal kuralı) */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        {topPill ? (
          <View style={[styles.pill, { backgroundColor: k.card }]} accessibilityLabel={p.pillA11y ?? topPill} testID="voice-pill">
            <AppText style={styles.pillText} numberOfLines={1}>
              {topPill}
            </AppText>
          </View>
        ) : (
          <View />
        )}
        <Pressable onPress={p.onClose} accessibilityRole="button" accessibilityLabel={tr('common.close')} style={[styles.close, { backgroundColor: k.card }]}>
          <X size={20} color={t.color.ink} />
        </Pressable>
      </View>

      <ScrollView {...SCROLL_KEYBOARD} style={styles.fill} contentContainerStyle={styles.body} scrollEnabled={!sheet}>
        <AppText style={[styles.title, { color: t.color.ink }]} accessibilityRole="header">
          {tr('voice.title')}
        </AppText>
        {showExample ? (
          <AppText tone="secondary" style={styles.example}>
            {tr('voice.example')}
          </AppText>
        ) : null}

        {/* Orta: dalga / analiz noktası */}
        {p.phase !== 'offline' ? (
          <View style={styles.center}>
            {processing ? (
              <Animated.View entering={reduced ? FadeIn.duration(DURATION.fast) : FadeIn.duration(DURATION.fast)} style={styles.procWrap} accessibilityLiveRegion="polite">
                <View style={[styles.dotHalo, { backgroundColor: k.dotHalo }]}>
                  <View style={[styles.dot, { backgroundColor: '#C6F04F' }]} />
                </View>
                <AppText style={styles.procTitle}>{tr('voice.processing')}</AppText>
                <AppText tone="secondary" style={styles.procSub}>
                  {tr('voice.processing_sub')}
                </AppText>
              </Animated.View>
            ) : showWave ? (
              <View style={styles.wave} accessible accessibilityRole="image" accessibilityLabel={tr('voice.wave_a11y')} testID="voice-wave">
                {heights.map((h, i) => (
                  <View key={i} style={[styles.bar, { height: h, backgroundColor: recording ? k.wave : k.line2 }]} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Döküm alanı */}
        <View style={[styles.tr, { borderTopColor: k.line }, p.phase === 'offline' ? styles.trOffline : null]}>
          <View style={styles.status}>
            <View style={[styles.statusDot, { backgroundColor: recording ? k.wave : k.line2 }]} />
            <AppText tone="secondary" style={styles.statusText}>
              {statusLabel}
            </AppText>
          </View>
          {hasTranscript && (recording || p.phase === 'paused' || processing || p.phase === 'offline') ? (
            <AppText style={[styles.transcript, { color: t.color.ink }]} accessibilityLiveRegion="polite" testID="voice-transcript">
              {head}
              {tail ? <AppText style={[styles.transcript, { color: t.color.secondary }]}>{tail}</AppText> : null}
              {recording ? <AppText style={[styles.transcript, { color: t.color.ink }]}>|</AppText> : null}
            </AppText>
          ) : p.phase === 'idle' || (p.phase === 'paused' && !hasTranscript) ? (
            <>
              <AppText style={styles.idleHint}>{tr('voice.idle_hint')}</AppText>
              <AppText tone="secondary" style={styles.tip}>
                {tr('voice.tip')}
              </AppText>
            </>
          ) : null}
          {recording ? (
            <AppText tone="secondary" style={styles.tip}>
              {tr('voice.done_hint')}
            </AppText>
          ) : null}
          {chips.length ? (
            <View style={styles.chips} accessibilityLabel={tr('voice.items_a11y')}>
              {chips.map((c, i) => (
                <Animated.View
                  key={`${c}-${i}`}
                  entering={FadeIn.duration(DURATION.fast).delay(reduced ? 0 : Math.min(i, 3) * DURATION.instant)}
                  style={[styles.chip, { backgroundColor: k.card }]}
                >
                  <Check size={14} color={t.color.ink} weight="bold" />
                  <AppText style={styles.chipText} numberOfLines={1}>
                    {c}
                  </AppText>
                </Animated.View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Alt panel: mod çubuğu + kayıt kontrolleri */}
      {!sheet ? (
        <View style={[styles.panel, { backgroundColor: k.card, paddingBottom: Math.max(20, insets.bottom + 4), borderTopColor: k.line }]}>
          <View style={styles.modes} accessibilityRole="tablist" accessibilityLabel={tr('voice.modes_a11y')}>
            {(['photo', 'voice', 'barcode', 'manual'] as const).map((m) => {
              const sel = m === 'voice';
              const label = m === 'photo' ? tr('ai_scan.mode_photo') : m === 'voice' ? tr('voice.mode') : m === 'barcode' ? tr('ai_scan.mode_barcode') : tr('ai_scan.mode_manual');
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    if (sel) return;
                    haptic('selection');
                    p.onMode(m);
                  }}
                  disabled={!sel && !!p.modesLocked}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: sel, disabled: !sel && !!p.modesLocked }}
                  style={[styles.mode, sel ? { backgroundColor: t.color.ink } : null]}
                  testID={`voice-mode-${m}`}
                >
                  <AppText style={[styles.modeText, { color: sel ? t.color.bg : t.color.ink }]}>{label}</AppText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.controls} accessibilityLabel={tr('voice.controls_a11y')}>
            <View style={styles.side} />
            <Animated.View style={[styles.micWrap, micStyle]}>
              <Animated.View pointerEvents="none" style={[styles.halo, { borderColor: k.halo }, haloStyle]} />
              <Pressable
                onPressIn={() => {
                  if (!reduced) press.value = withTiming(0.98, { duration: DURATION.instant });
                }}
                onPressOut={() => {
                  press.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.standard });
                }}
                onPress={() => {
                  haptic(recording ? 'selection' : 'medium');
                  p.onMic();
                }}
                disabled={processing}
                accessibilityRole="button"
                accessibilityLabel={recording ? tr('voice.stop') : tr('voice.start')}
                accessibilityState={{ selected: recording, disabled: processing }}
                style={[styles.mic, { borderColor: t.color.ink, opacity: processing ? 0.4 : 1 }]}
                testID="voice-mic"
              >
                <View style={[styles.micInner, { backgroundColor: '#C6F04F' }]}>
                  {recording ? <Stop size={24} color="#0A0A0A" weight="fill" /> : <Microphone size={26} color="#0A0A0A" weight="bold" />}
                </View>
              </Pressable>
            </Animated.View>
            <View style={[styles.side, styles.sideRight]}>
              {processing ? (
                <Pressable onPress={p.onCancel} accessibilityRole="button" style={[styles.ghost, { borderColor: k.line2 }]} testID="voice-cancel">
                  <AppText style={styles.ghostText}>{tr('voice.cancel')}</AppText>
                </Pressable>
              ) : (recording || p.phase === 'paused') && hasTranscript ? (
                <Animated.View entering={FadeIn.duration(DURATION.fast)} exiting={FadeOut.duration(DURATION.fast)}>
                  <Pressable
                    onPress={() => {
                      haptic('light');
                      p.onDone();
                    }}
                    accessibilityRole="button"
                    style={[styles.done, { backgroundColor: t.color.ink }]}
                    testID="voice-done"
                  >
                    <Check size={16} color={t.color.bg} weight="bold" />
                    <AppText style={[styles.doneText, { color: t.color.bg }]}>{tr('voice.done')}</AppText>
                  </Pressable>
                </Animated.View>
              ) : (
                <Pressable
                  onPress={() => setKbOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={tr('voice.keyboard')}
                  style={[styles.kb, { backgroundColor: k.nested }]}
                  testID="voice-keyboard"
                >
                  <Keyboard size={22} color={t.color.ink} />
                </Pressable>
              )}
            </View>
          </View>
        </View>
      ) : null}

      {/* Sheet hâlleri (FinScanVoice sheet: base 300 enter) */}
      {sheet ? <VoiceSheet {...p} k={k} onKeyboard={() => setKbOpen(true)} /> : null}

      {/* Klavyeyle yaz — aynı metin analizi */}
      <Modal visible={kbOpen} transparent animationType="fade" onRequestClose={() => setKbOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.kbFill, { backgroundColor: k.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setKbOpen(false)} accessibilityLabel={tr('common.close')} />
          <View style={[styles.kbSheet, { backgroundColor: k.card, paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <AppText textRole="sheetTitle">{tr('voice.title')}</AppText>
            <TextInput
              value={kbText}
              onChangeText={setKbText}
              placeholder={tr('voice.keyboard_placeholder')}
              placeholderTextColor={t.color.secondary}
              multiline
              maxLength={500}
              autoFocus
              style={[styles.kbInput, { color: t.color.ink, backgroundColor: k.nested }]}
              accessibilityLabel={tr('voice.keyboard')}
              testID="voice-kb-input"
            />
            <Pressable
              onPress={() => {
                const v = kbText.trim();
                if (!v) return;
                setKbOpen(false);
                setKbText('');
                p.onKeyboardSubmit(v);
              }}
              disabled={!kbText.trim()}
              accessibilityRole="button"
              style={[styles.btn, { backgroundColor: t.color.ink, opacity: kbText.trim() ? 1 : 0.45, marginTop: 12 }]}
              testID="voice-kb-send"
            >
              <AppText style={[styles.btnText, { color: t.color.bg }]}>{tr('voice.keyboard_send')}</AppText>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function VoiceSheet(p: FinScanVoiceProps & { k: ReturnType<typeof tokens>; onKeyboard: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const ink = t.color.ink;
  const shown = useRef(false);
  useEffect(() => {
    // Uyarı haptiği yalnız "Seni duyamadık" (FinMoScanVoice "Haptik").
    if (p.phase === 'empty' && !shown.current) haptic('warning');
    shown.current = true;
  }, [p.phase]);

  let icon: React.ReactNode = null;
  let title = '';
  let body = '';
  let note: string | null = null;
  let primary: { label: string; onPress: () => void } = { label: '', onPress: () => {} };
  let secondary: { label: string; onPress: () => void }[] = [];
  let permRows = false;
  switch (p.phase) {
    case 'perm':
      icon = <Microphone size={24} color={ink} />;
      title = tr('voice.perm_title');
      body = tr('voice.perm_body');
      permRows = true;
      primary = { label: tr('voice.perm_primary'), onPress: p.onPermContinue };
      secondary = [{ label: tr('voice.perm_later'), onPress: p.onPermLater }];
      break;
    case 'denied':
      icon = <MicrophoneSlash size={24} color={ink} />;
      title = tr('voice.denied_title');
      body = tr('voice.denied_body');
      primary = { label: tr('voice.denied_primary'), onPress: p.onOpenSettings };
      secondary = [
        { label: tr('voice.keyboard'), onPress: p.onKeyboard },
        { label: tr('voice.photo'), onPress: () => p.onMode('photo') },
      ];
      break;
    case 'empty':
      icon = <WarningCircle size={24} color={ink} />;
      title = tr('voice.empty_title');
      body = tr('voice.empty_body');
      note = tr('voice.empty_note');
      primary = { label: tr('voice.empty_primary'), onPress: p.onRetry };
      secondary = [{ label: tr('voice.keyboard'), onPress: p.onKeyboard }];
      break;
    case 'offline':
      icon = <WifiSlash size={24} color={ink} />;
      title = tr('voice.offline_title');
      body = tr('voice.offline_body');
      note = tr('voice.offline_note', { count: p.offlineCount ?? 1 });
      primary = { label: tr('voice.offline_primary'), onPress: p.onOfflineOk };
      secondary = [{ label: tr('voice.keyboard'), onPress: p.onKeyboard }];
      break;
    case 'limit':
      icon = <Clock size={24} color={ink} />;
      title = p.limitCap != null ? tr('voice.limit_title', { cap: p.limitCap }) : tr('ai_scan.limit_title');
      body = p.plansEnabled ? tr('voice.limit_body') : tr('voice.limit_body_free');
      primary = p.plansEnabled ? { label: tr('voice.limit_primary'), onPress: p.onPlans } : { label: tr('voice.limit_manual'), onPress: p.onManual };
      secondary = p.plansEnabled ? [{ label: tr('voice.limit_manual'), onPress: p.onManual }] : [];
      break;
    case 'failed':
      icon = <WarningCircle size={24} color={ink} />;
      title = tr('voice.failed_title');
      body = tr('voice.failed_body');
      primary = { label: tr('voice.empty_primary'), onPress: p.onRetry };
      secondary = [{ label: tr('voice.keyboard'), onPress: p.onKeyboard }];
      break;
    default:
      return null;
  }

  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(DURATION.fast) : FadeIn.duration(DURATION.base)}
      style={[styles.sheet, { backgroundColor: p.k.card, paddingBottom: Math.max(24, insets.bottom + 8) }]}
      accessibilityViewIsModal
      testID={`voice-sheet-${p.phase}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: p.k.nested }]}>{icon}</View>
      <AppText textRole="screenTitle" style={styles.sheetTitle} accessibilityRole="header">
        {title}
      </AppText>
      <AppText tone="secondary" style={styles.sheetBody}>
        {body}
      </AppText>
      {permRows ? (
        <View style={styles.permRows}>
          {[
            { icon: <Microphone size={18} color={ink} />, t: tr('voice.perm_mic'), s: tr('voice.perm_mic_sub') },
            { icon: <Waveform size={18} color={ink} />, t: tr('voice.perm_speech'), s: tr('voice.perm_speech_sub') },
          ].map((r) => (
            <View key={r.t} style={[styles.permRow, { backgroundColor: p.k.nested }]}>
              <View style={[styles.permIcon, { backgroundColor: p.k.card }]}>{r.icon}</View>
              <View style={styles.flex1}>
                <AppText style={styles.permT}>{r.t}</AppText>
                <AppText tone="secondary" style={styles.permS}>
                  {r.s}
                </AppText>
              </View>
            </View>
          ))}
        </View>
      ) : null}
      {note ? (
        <View style={[styles.note, { backgroundColor: p.k.nested }]}>
          <Check size={14} color={ink} weight="bold" />
          <AppText style={styles.noteText}>{note}</AppText>
        </View>
      ) : null}
      <Pressable onPress={primary.onPress} accessibilityRole="button" style={[styles.btn, styles.first, { backgroundColor: ink }]} testID="voice-sheet-primary">
        <AppText style={[styles.btnText, { color: t.color.bg }]} numberOfLines={1}>
          {primary.label}
        </AppText>
      </Pressable>
      {secondary.length ? (
        <View style={[styles.next, secondary.length > 1 ? styles.pair : null]}>
          {secondary.map((s) => (
            <Pressable
              key={s.label}
              onPress={s.onPress}
              accessibilityRole="button"
              style={[styles.btn, { borderWidth: 1, borderColor: p.k.line2 }, secondary.length > 1 ? styles.flex1 : null]}
            >
              <AppText style={styles.btnText} numberOfLines={1}>
                {s.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Hak hapı ikonu (FinSubPill: ✦). Dışarıdan kullanım için. */
export function PillSparkle({ color }: { color: string }) {
  return <Sparkle size={14} color={color} weight="fill" />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  pill: { minHeight: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', flexShrink: 1, marginRight: 12 },
  pillText: { fontSize: 14, fontWeight: '600' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 24, flexGrow: 1 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  example: { marginTop: 6, fontSize: 16, lineHeight: 22 },
  center: { minHeight: 220, alignItems: 'center', justifyContent: 'center' },
  wave: { height: 80, flexDirection: 'row', alignItems: 'center', gap: 4 },
  bar: { width: 4, borderRadius: 2 },
  procWrap: { alignItems: 'center', gap: 4 },
  dotHalo: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  dot: { width: 22, height: 22, borderRadius: 11 },
  procTitle: { fontSize: 17, fontWeight: '600' },
  procSub: { fontSize: 14 },
  tr: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18 },
  trOffline: { marginTop: 18 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14 },
  transcript: { marginTop: 10, fontFamily: 'BricolageGrotesque_600SemiBold', fontSize: 24, lineHeight: 31 },
  idleHint: { marginTop: 10, fontSize: 17, fontWeight: '600' },
  tip: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  chips: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, borderRadius: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  chipText: { fontSize: 15, fontWeight: '500', flexShrink: 1 },
  panel: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  mode: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center' },
  modeText: { fontSize: 14, fontWeight: '600' },
  controls: { marginTop: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  side: { flex: 1 },
  sideRight: { alignItems: 'flex-end' },
  micWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 6 },
  mic: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  micInner: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  kb: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  done: { minHeight: 52, borderRadius: 26, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: { fontSize: 16, fontWeight: '700' },
  ghost: { minHeight: 52, borderRadius: 26, paddingHorizontal: 18, borderWidth: 1, justifyContent: 'center' },
  ghostText: { fontSize: 16, fontWeight: '600' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingHorizontal: 16 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { marginTop: 14 },
  sheetBody: { marginTop: 6, fontSize: 15, lineHeight: 21 },
  permRows: { marginTop: 14, gap: 8 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 12, minHeight: 56 },
  permIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  permT: { fontSize: 16, fontWeight: '600' },
  permS: { fontSize: 13 },
  note: { marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  noteText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  first: { marginTop: 18 },
  next: { marginTop: 10 },
  pair: { flexDirection: 'row', gap: 8 },
  btn: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  btnText: { fontSize: 15, fontWeight: '600' },
  kbFill: { flex: 1, justifyContent: 'flex-end' },
  kbSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingHorizontal: 16 },
  kbInput: { marginTop: 12, minHeight: 96, borderRadius: 16, padding: 14, fontSize: 17, textAlignVertical: 'top' },
});
