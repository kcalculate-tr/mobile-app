// G24-S1 md.3 — kcalAI Koç yazma alanı: hazır soru çipleri, "Koç'a sor…" alanı, mikrofon (yalnız
// expo-speech-recognition varsa — Tara'daki yardımcı), Gönder / Yanıtı durdur, sabit
// "Koç tıbbi tavsiye vermez." satırı. Ses paneli (FinCoachVoice): dokun → dinler, canlı döküm,
// İptal / Gönder (HIG: basılı tutma zorunlu değil — VoiceOver'da da kullanılabilir).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { AppText, CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { ArrowUp, Microphone, Sparkle, Stop } from '../../../components/icons';
import { abortListening, requestSpeechPermission, speechAvailable, startListening, stopListening } from '../../ai/scan/voice/speech';
import { Disclaimer, LIME, LIME_INK, useCoachTones } from './parts';

export function Chips({ items, onPick, vertical }: { items: string[]; onPick: (q: string) => void; vertical?: boolean }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const chip = (q: string) => (
    <Pressable
      key={q}
      onPress={() => {
        haptic('light');
        onPick(q);
      }}
      accessibilityRole="button"
      style={({ pressed }) => [vertical ? styles.chipV : styles.chip, { backgroundColor: c.card, borderColor: c.line, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      testID={`coach-chip-${q}`}
    >
      {vertical ? <Sparkle size={18} color={c.text} /> : null}
      <AppText style={[styles.chipText, { color: c.text }]}>{q}</AppText>
    </Pressable>
  );
  if (vertical) {
    return (
      <View style={styles.chipsV} accessibilityLabel={tr('coach.chips_a11y')}>
        {items.map(chip)}
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow} accessibilityLabel={tr('coach.chips_a11y')} testID="coach-chips">
      {items.map(chip)}
    </ScrollView>
  );
}

export function Composer({
  draft,
  onDraft,
  onSend,
  onStop,
  busy,
  disabled,
  placeholder,
  onDisabledPress,
  chips,
  onChip,
  lang,
  bottomInset,
}: {
  draft: string;
  onDraft: (s: string) => void;
  onSend: (text: string, via: 'text' | 'voice') => void;
  onStop: () => void;
  busy: boolean;
  disabled: boolean;
  placeholder: string;
  onDisabledPress?: () => void;
  chips: string[] | null;
  onChip: (q: string) => void;
  lang: 'tr' | 'en';
  bottomInset: number;
}) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  const [voice, setVoice] = useState(false);
  const micOk = speechAvailable();
  const canSend = draft.trim().length > 0 && !disabled && !busy;
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderTopColor: c.line, paddingBottom: Math.max(8, bottomInset) }]} testID="coach-composer">
      {chips && chips.length && !voice ? (
        <Animated.View entering={FadeIn.duration(reduced ? REDUCED.duration : DURATION.fast)}>
          <Chips items={chips} onPick={onChip} />
        </Animated.View>
      ) : null}
      {voice ? (
        <VoicePanel
          lang={lang}
          onCancel={() => setVoice(false)}
          onSend={(text) => {
            setVoice(false);
            onSend(text, 'voice');
          }}
        />
      ) : (
        <View style={styles.row}>
          <Pressable style={[styles.field, { backgroundColor: c.card, borderColor: c.line, opacity: disabled ? 0.55 : 1 }]} onPress={disabled ? onDisabledPress : undefined} disabled={!disabled} accessible={false}>
            <TextInput
              value={draft}
              onChangeText={onDraft}
              placeholder={placeholder}
              placeholderTextColor={c.sec}
              editable={!disabled}
              multiline
              maxLength={1000}
              accessibilityLabel={tr('coach.field')}
              accessibilityHint={disabled ? placeholder : undefined}
              style={[styles.input, { color: c.text }]}
              testID="coach-input"
            />
          </Pressable>
          {micOk ? (
            <Pressable
              onPress={() => {
                if (disabled) {
                  onDisabledPress?.();
                  return;
                }
                haptic('medium');
                setVoice(true);
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('coach.mic')}
              accessibilityState={{ disabled }}
              style={[styles.round, { backgroundColor: c.card, borderColor: c.line, borderWidth: 1, opacity: disabled ? 0.55 : 1 }]}
              testID="coach-mic"
            >
              <Microphone size={22} color={c.text} />
            </Pressable>
          ) : null}
          {busy ? (
            <Pressable onPress={onStop} accessibilityRole="button" accessibilityLabel={tr('coach.stop')} style={[styles.round, { backgroundColor: c.chip }]} testID="coach-stop">
              <Stop size={18} color={c.text} weight="fill" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (!canSend) {
                  if (disabled) onDisabledPress?.();
                  return;
                }
                haptic('light');
                onSend(draft.trim(), 'text');
              }}
              accessibilityRole="button"
              accessibilityLabel={tr('coach.send')}
              accessibilityState={{ disabled: !canSend }}
              style={[styles.round, { backgroundColor: canSend ? LIME : c.chip }]}
              testID="coach-send"
            >
              <ArrowUp size={22} color={canSend ? LIME_INK : c.sec} weight="bold" />
            </Pressable>
          )}
        </View>
      )}
      <Disclaimer />
    </View>
  );
}

function VoicePanel({ lang, onCancel, onSend }: { lang: 'tr' | 'en'; onCancel: () => void; onSend: (text: string) => void }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  const [text, setText] = useState('');
  const [level, setLevel] = useState(0);
  const [err, setErr] = useState(false);
  const textRef = useRef('');
  useEffect(() => {
    let off: (() => void) | null = null;
    let alive = true;
    void (async () => {
      const perm = await requestSpeechPermission();
      if (!alive) return;
      if (perm && !perm.granted) {
        setErr(true);
        return;
      }
      off = startListening(lang === 'en' ? 'en-US' : 'tr-TR', {
        onResult: (t) => {
          textRef.current = t;
          setText(t);
        },
        onEnd: () => {},
        onError: () => setErr(true),
        onVolume: (v) => setLevel(Math.max(0, Math.min(1, (v + 2) / 12))),
      });
      if (!off) setErr(true);
    })();
    return () => {
      alive = false;
      off?.();
      abortListening();
    };
  }, [lang]);
  const send = () => {
    stopListening();
    const t = textRef.current.trim();
    if (!t) {
      setErr(true);
      return;
    }
    onSend(t);
  };
  const bars = Array.from({ length: 24 }, (_, i) => 8 + Math.round((reduced ? 0.5 : level) * (10 + ((i * 7) % 24))));
  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(REDUCED.duration) : FadeInDown.duration(DURATION.base).easing(CURVE.enter)}
      style={[styles.voice, { backgroundColor: c.card, borderColor: c.line }]}
      testID="coach-voice"
    >
      <AppText style={[styles.listening, { color: c.text }]} accessibilityLiveRegion="polite">
        {err ? tr('coach.voice_empty') : tr('coach.listening')}
      </AppText>
      <View style={styles.wave} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {bars.map((h, i) => (
          <View key={i} style={[styles.waveBar, { height: h, backgroundColor: LIME }]} />
        ))}
      </View>
      {text ? (
        <AppText style={[styles.transcript, { color: c.text }]} accessibilityLiveRegion="polite" testID="coach-voice-text">
          {text}
        </AppText>
      ) : null}
      <AppText style={[styles.hint, { color: c.sec }]}>{tr('coach.voice_hint')}</AppText>
      <View style={styles.voiceRow}>
        <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.voiceBtn, { borderWidth: 1, borderColor: c.line2 }]} testID="coach-voice-cancel">
          <AppText style={[styles.voiceBtnText, { color: c.text }]}>{tr('coach.cancel')}</AppText>
        </Pressable>
        <Pressable onPress={send} accessibilityRole="button" style={[styles.voiceBtn, { backgroundColor: LIME }]} testID="coach-voice-send">
          <AppText style={[styles.voiceBtnText, { color: LIME_INK }]}>{tr('coach.send')}</AppText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: 8, gap: 8 },
  chipsRow: { gap: 8, paddingHorizontal: 16 },
  chip: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, justifyContent: 'center' },
  chipsV: { gap: 10, alignSelf: 'stretch' },
  chipV: { minHeight: 52, borderRadius: 26, borderWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  chipText: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12 },
  field: { flex: 1, minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  input: { fontSize: 17, paddingVertical: 10, maxHeight: 120 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  voice: { marginHorizontal: 12, borderRadius: 24, borderWidth: 1, padding: 16, gap: 10, alignItems: 'center' },
  listening: { fontSize: 17, fontWeight: '700' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 3, height: 44 },
  waveBar: { width: 4, borderRadius: 2 },
  transcript: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
  voiceRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  voiceBtn: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  voiceBtnText: { fontSize: 16, fontWeight: '700' },
});
