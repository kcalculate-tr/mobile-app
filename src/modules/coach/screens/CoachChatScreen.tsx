// G24-S1 md.3 — FinCoachChat: kcalAI Koç sohbeti. Hâller: chat · empty · typing · error · limit ·
// trial · upsell · voice · safety (tasarım `state` prop'u ile birebir).
//
// • Başlık: geri · avatar (günün kalori halkası) · "kcalAI Koç" + "Bugün %62, 760 kcal kaldı" · seçenekler.
// • Hap: Balance "Bugün N/30" (+ Balance rozeti) · deneme "Deneme N/3" (N = kalan; sunucu my_coach_status).
// • İlk mesajdan önce AYRI AI izni (bir kez; ConsentSheet `ai_coach`, metin tek yerde).
// • Yanıt "akarak" görünür: SSE YOK, istemci metni FinMoCoach temposunda açar; kartlar metinden sonra.
// • Hak bitti (Balance) → Limit hâli "yarın 00.00'da yenilenir"; deneme bitti → 1100 ms sonra
//   "Koç Balance'ta" sheet'i → paywall (koçlu, Balance Yıllık seçili).
// • Hata (ağ/sunucu) → "Yanıt alınamadı" + Tekrar dene (hak düşmedi: sunucu iade eder).
// • Sunucu fonksiyonu yoksa (404) → girişler gizlenir, ekran geri döner (çökme yok).
// • VoiceOver: balonlar "Koç:" / "Sen:" etiketli; kartlar tek öğe + eylem; dokunma ≥ 44 pt.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppText, CURVE, DURATION, ProgressRing, REDUCED, Toast, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { ArrowLeft, DotsThree } from '../../../components/icons';
import { useNutritionSummary } from '../../../hooks/useNutritionSummary';
import { useSubscriptionStore } from '../../../lib/subscription/purchases';
import { useSubscriptionEnabled } from '../../../lib/subscription/useSubscriptionBootstrap';
import { usePlanCards } from '../../../lib/subscription/usePlanCards';
import { ConsentSheet } from '../../onboarding/consent/ConsentSheet';
import { LEGAL_SLUG } from '../../../lib/legal/slugs';
import { openLegalWeb } from '../../../lib/legal/openLegal';
import { hasCoachConsent, markCoachMissing, setCoachConsent } from '../access';
import { addProductToCart, addSuggestionToDayWithId, openRecipe, removeSuggestionFromDay } from '../actions';
import { logTrace } from '../../shell/logTrace';
import { slotFromHour } from '../../gun/homeData';
import { CoachError, deleteCoachHistory, fetchCoachMessages, fetchCoachStatus, sendCoachMessage, setCoachFeedback } from '../client';
import {
  COACH_DAILY_FALLBACK,
  COACH_TRIAL_FALLBACK,
  UPSELL_DELAY_MS,
  gateOf,
  headerSub,
  needsStamp,
  optimisticUse,
  pillText,
  stampLabel,
} from '../model';
import { trackCoach } from '../track';
import type { CoachChatParams, CoachErrorCode, CoachMessage, CoachRef, CoachStatus } from '../types';
import { CardList, type CardHandlers } from '../ui/cards';
import { Chips, Composer } from '../ui/Composer';
import { CoachAvatar, CoachGlass, FeedbackRow, QuotaPill, StreamText, TypingDots, useCoachTones } from '../ui/parts';
import { DeleteConfirm, MenuSheet, UpsellSheet } from '../ui/sheets';
import { SCROLL_KEYBOARD } from '../../../core/design/keyboard';

type Nav = { navigate: (n: string, p?: object) => void; goBack: () => void; canGoBack?: () => boolean };

type Row =
  | { kind: 'msg'; m: CoachMessage; stamp: string | null }
  | { kind: 'typing' }
  | { kind: 'error'; code: CoachErrorCode }
  | { kind: 'limit' }
  | { kind: 'trial' };

export default function CoachChatScreen() {
  const nav = useNavigation() as unknown as Nav;
  const params = (useRoute().params ?? {}) as CoachChatParams;
  const { t: tr, lang: rawLang } = useT();
  const lang: 'tr' | 'en' = rawLang === 'en' ? 'en' : 'tr';
  const c = useCoachTones();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { summary } = useNutritionSummary();
  const subOn = useSubscriptionEnabled();
  const limits = useSubscriptionStore((s) => s.limits);

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(params.prefill ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: CoachErrorCode; text: string; via: 'text' | 'chip' | 'voice' } | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const refRef = useRef<CoachRef | undefined>(params.ref);
  const pendingSend = useRef<{ text: string; via: 'text' | 'chip' | 'voice' } | null>(null);
  const skipStream = useRef(false);
  const listRef = useRef<FlatList<Row> | null>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const { cards: planCards } = usePlanCards(upsell && subOn);
  const yearlyBalance = planCards?.find((p) => p.tier === 'balance' && p.yearly)?.priceText ?? null;

  // ── Yükleme ──
  useEffect(() => {
    let off = false;
    void (async () => {
      const [msgs, st] = await Promise.all([fetchCoachMessages().catch(() => [] as CoachMessage[]), fetchCoachStatus()]);
      if (off) return;
      setMessages(msgs);
      setStatus(st);
      setLoading(false);
    })();
    return () => {
      off = true;
    };
  }, []);

  const gate = gateOf(status);
  const trialCap = status?.kind === 'trial' ? status.limit : limits?.coach?.trial ?? COACH_TRIAL_FALLBACK;
  const dailyCap = limits?.coach?.daily ?? (status?.kind === 'daily' ? status.limit : COACH_DAILY_FALLBACK);
  const pill = pillText(status, tr);
  const head = headerSub(summary ? summary.consumedKcal : null, summary ? summary.targetKcal : null, tr);

  // ── Gönderim ──
  const doSend = useCallback(
    async (text: string, via: 'text' | 'chip' | 'voice') => {
      const body = text.trim();
      if (!body || busy) return;
      if (gate === 'trial_out') {
        setUpsell(true);
        return;
      }
      if (gate === 'limit') return;
      if (!(await hasCoachConsent())) {
        pendingSend.current = { text: body, via };
        setConsent(true);
        return;
      }
      const local: CoachMessage = { id: `local-${Date.now()}`, role: 'user', body, cards: null, feedback: null, created_at: new Date().toISOString() };
      setError(null);
      setMessages((m) => [...m, local]);
      setDraft('');
      setBusy(true);
      skipStream.current = false;
      const before = status;
      setStatus((s) => optimisticUse(s));
      trackCoach('coach_send', { via, kind: before?.kind ?? 'trial' });
      try {
        const ref = refRef.current;
        const r = await sendCoachMessage(body, lang, ref ?? null);
        refRef.current = undefined;
        if (!alive.current) return;
        setMessages((m) => [...m.filter((x) => x.id !== local.id), r.userMessage ?? local, r.reply]);
        if (!skipStream.current) setStreamId(r.reply.id);
        // HIG (VoiceOver): yeni yanıt odak değiştirmeden okunur.
        AccessibilityInfo.announceForAccessibility(tr('coach.coach_a11y', { text: r.reply.body }));
        if (r.status) setStatus(r.status);
        else if (r.safety) setStatus(before); // güvenli yanıt hak düşmez
        const next = r.status ?? before;
        if (next && next.kind === 'trial' && next.limit - next.used <= 0 && !r.safety) {
          setTimeout(() => {
            if (!alive.current) return;
            setUpsell(true);
            trackCoach('coach_upsell', { action: 'view' });
          }, UPSELL_DELAY_MS);
        }
        if (next && next.kind === 'daily' && next.limit - next.used <= 0) trackCoach('coach_limit', { kind: 'daily' });
      } catch (e) {
        if (!alive.current) return;
        const err = e instanceof CoachError ? e : new CoachError('network');
        setStatus(err.status ?? before);
        if (err.code === 'unavailable') {
          markCoachMissing();
          setMessages((m) => m.filter((x) => x.id !== local.id));
          if (nav.canGoBack?.() !== false) nav.goBack();
          return;
        }
        if (err.code === 'quota') {
          setMessages((m) => m.filter((x) => x.id !== local.id));
          setDraft(body);
          const st = err.status;
          if (st?.kind === 'trial') {
            setUpsell(true);
            trackCoach('coach_upsell', { action: 'view' });
          } else trackCoach('coach_limit', { kind: 'daily' });
          return;
        }
        setError({ code: err.code, text: body, via });
        AccessibilityInfo.announceForAccessibility(tr('coach.err_title'));
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [busy, gate, lang, nav, status, tr],
  );

  const retry = () => {
    if (!error) return;
    const { text, via } = error;
    setMessages((m) => {
      // Başarısız yerel kullanıcı balonunu kaldır; yeniden gönderim yenisini ekler.
      const i = [...m].reverse().findIndex((x) => x.role === 'user' && x.id.startsWith('local-') && x.body === text);
      if (i === -1) return m;
      const idx = m.length - 1 - i;
      return [...m.slice(0, idx), ...m.slice(idx + 1)];
    });
    setError(null);
    void doSend(text, via);
  };

  const setFeedback = (id: string, v: -1 | 1 | null) => {
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, feedback: v } : x)));
    trackCoach('coach_feedback', { value: v === 1 ? 'up' : v === -1 ? 'down' : 'clear' });
    if (!id.startsWith('local-')) void setCoachFeedback(id, v);
  };

  const handlers = (messageId: string): CardHandlers => ({
    onAddMeal: async (card, index, from) => {
      const id = await addSuggestionToDayWithId(card, messageId, index);
      if (!id) {
        setToast(tr('coach.add_failed'));
        return false;
      }
      // G28-S1 md.1: ortak Logla izi — kart Ana sayfa sekmesine uçar, varışta +1 rozet + toast
      // ("<Öğün>'ye loglandı · Geri al · Gör"). Koç'un ayrı "Gününe eklendi" toast'ı yok (tek toast).
      void logTrace({
        from,
        mealLabel: tr(`meal.${slotFromHour(new Date().getHours())}`),
        source: 'coach',
        kcal: Math.round(card.kcal),
        name: card.name,
        id,
        undo: async () => {
          await removeSuggestionFromDay(id);
        },
      });
      return true;
    },
    onOpenRecipe: (postId) => openRecipe(postId, nav),
    onAddProduct: async (productId) => {
      const r = await addProductToCart(productId, nav);
      if (r === 'failed') setToast(tr('coach.cart_failed'));
      return r;
    },
  });

  const goPlans = () => {
    setUpsell(false);
    trackCoach('coach_upsell', { action: 'plans' });
    nav.navigate('SubPaywall', { from: 'coach', coach: true, plan: 'balance', yearly: true });
  };

  const confirmDelete = async () => {
    setDelBusy(true);
    const ok = await deleteCoachHistory();
    setDelBusy(false);
    setDel(false);
    if (ok) {
      setMessages([]);
      setError(null);
      setToast(tr('coach.deleted'));
    } else setToast(tr('coach.del_failed'));
  };

  // ── Satırlar ──
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    if (status?.kind === 'trial' && gate !== 'trial_out' && messages.length) out.push({ kind: 'trial' });
    const now = new Date();
    messages.forEach((m, i) => out.push({ kind: 'msg', m, stamp: needsStamp(messages[i - 1], m) ? stampLabel(m.created_at, now, lang, tr) : null }));
    if (busy) out.push({ kind: 'typing' });
    if (error) out.push({ kind: 'error', code: error.code });
    if (gate === 'limit') out.push({ kind: 'limit' });
    return out;
  }, [messages, busy, error, gate, status?.kind, lang, tr]);

  // Geçmişten açıldıysa (focusId) o mesaja, değilse sona kaydır.
  const focused = useRef(false);
  useEffect(() => {
    if (!rows.length) return;
    const fi = !focused.current && params.focusId ? rows.findIndex((r) => r.kind === 'msg' && r.m.id === params.focusId) : -1;
    if (fi >= 0) {
      focused.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: fi, animated: false, viewPosition: 0 }));
      return;
    }
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: !reduced }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, reduced]);

  const empty = !loading && messages.length === 0 && !busy;
  const chips = [tr('coach.q_today'), tr('coach.q_dinner'), tr('coach.q_protein'), tr('coach.q_week')];
  const showChips = !empty && !busy && gate === 'open' && !draft;
  const placeholder = gate === 'limit' ? tr('coach.ph_limit') : gate === 'trial_out' ? tr('coach.ph_trial') : tr('coach.ph');
  const enter = reduced ? FadeIn.duration(REDUCED.duration) : FadeInDown.duration(DURATION.base).easing(CURVE.enter);

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'typing') return <TypingDots />;
    if (item.kind === 'trial') {
      return (
        <AppText style={[styles.center, styles.trialIntro, { color: c.sec }]} testID="coach-trial-intro">
          {tr('coach.trial_intro', { cap: dailyCap })}
        </AppText>
      );
    }
    if (item.kind === 'limit') {
      return (
        <View style={[styles.notice, { backgroundColor: c.card, borderColor: c.line }]} accessibilityLiveRegion="polite" testID="coach-limit">
          <AppText style={[styles.noticeTitle, { color: c.text }]}>{tr('coach.limit_title')}</AppText>
          <AppText style={[styles.noticeBody, { color: c.sec }]}>{tr('coach.limit_body')}</AppText>
          <Pressable onPress={() => nav.navigate('CoachHistory')} accessibilityRole="button" style={styles.link} testID="coach-limit-history">
            <AppText style={[styles.linkText, { color: c.text }]}>{tr('coach.see_history')}</AppText>
          </Pressable>
        </View>
      );
    }
    if (item.kind === 'error') {
      const body = item.code === 'network' ? tr('coach.err_body') : item.code === 'rate_limit' ? tr('coach.err_body_rate') : tr('coach.err_body_server');
      return (
        <View style={[styles.notice, { backgroundColor: c.card, borderColor: c.line }]} accessibilityRole="alert" testID="coach-error">
          <AppText style={[styles.noticeTitle, { color: c.red }]}>{tr('coach.err_title')}</AppText>
          <AppText style={[styles.noticeBody, { color: c.sec }]}>{body}</AppText>
          <Pressable onPress={retry} accessibilityRole="button" style={[styles.retry, { borderColor: c.line2 }]} testID="coach-retry">
            <AppText style={[styles.linkText, { color: c.text, textDecorationLine: 'none' }]}>{tr('coach.retry')}</AppText>
          </Pressable>
        </View>
      );
    }
    const m = item.m;
    const stamp = item.stamp ? (
      <View style={[styles.stamp, { backgroundColor: c.chip }]}>
        <AppText style={[styles.stampText, { color: c.sec }]}>{item.stamp}</AppText>
      </View>
    ) : null;
    if (m.role === 'user') {
      return (
        <Animated.View entering={m.id.startsWith('local-') ? enter : undefined}>
          {stamp}
          <View style={styles.meRow} accessible accessibilityLabel={tr('coach.me_a11y', { text: m.body })} testID="coach-me">
            <View style={styles.meBubble}>
              <AppText style={styles.meText}>{m.body}</AppText>
            </View>
          </View>
        </Animated.View>
      );
    }
    const animate = streamId === m.id;
    return (
      <CoachTurn
        m={m}
        stamp={stamp}
        animate={animate}
        onStreamDone={() => setStreamId((id) => (id === m.id ? null : id))}
        handlers={handlers(m.id)}
        onFeedback={(v) => setFeedback(m.id, v)}
      />
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: c.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} testID="coach-chat">
      {/* Başlık */}
      <View style={[styles.header, { paddingTop: insets.top + 4, borderBottomColor: c.line }]}>
        <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel={tr('coach.back')} style={styles.icon44} testID="coach-back">
          <ArrowLeft size={24} color={c.text} />
        </Pressable>
        <View style={styles.headMid} accessible accessibilityRole="header" accessibilityLabel={head.pct != null && summary ? tr('coach.head_a11y', { pct: head.pct, left: Math.max(0, Math.round(summary.targetKcal - summary.consumedKcal)) }) : tr('coach.name')}>
          <ProgressRing progress={(head.pct ?? 0) / 100} size={44} strokeWidth={3} trackColor={c.line}>
            <CoachAvatar size={36} />
          </ProgressRing>
          <View style={styles.flex1}>
            <AppText style={[styles.headTitle, { color: c.text }]}>{tr('coach.name')}</AppText>
            <AppText style={[styles.headSub, { color: c.sec }]}>{head.text}</AppText>
          </View>
        </View>
        <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={tr('coach.options')} style={styles.icon44} testID="coach-options">
          <DotsThree size={26} color={c.text} weight="bold" />
        </Pressable>
      </View>

      {pill ? (
        <View style={styles.pillWrap}>
          <QuotaPill label={pill.label} a11y={pill.a11y} balance={pill.balance} />
        </View>
      ) : null}

      {empty ? (
        <View style={styles.empty} testID="coach-empty">
          <CoachGlass size={110} />
          <AppText style={[styles.hello, { color: c.text }]} accessibilityRole="header">
            {tr('coach.hello')}
          </AppText>
          <AppText style={[styles.helloBody, { color: c.sec }]}>{tr('coach.hello_body')}</AppText>
          {gate === 'open' ? <Chips items={chips} onPick={(q) => void doSend(q, 'chip')} vertical /> : null}
          {gate === 'trial_out' ? (
            <Pressable onPress={() => setUpsell(true)} accessibilityRole="button" style={styles.link}>
              <AppText style={[styles.linkText, { color: c.text }]}>{tr('coach.up_cta')}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList {...SCROLL_KEYBOARD}
          ref={listRef}
          data={rows}
          keyExtractor={(r, i) => (r.kind === 'msg' ? r.m.id : `${r.kind}-${i}`)}
          renderItem={renderRow}
          contentContainerStyle={styles.listPad}
          accessibilityLabel={tr('coach.log_label')}
          onScrollToIndexFailed={(e) => listRef.current?.scrollToOffset({ offset: e.averageItemLength * e.index, animated: false })}
          testID="coach-list"
        />
      )}

      <Composer
        draft={draft}
        onDraft={setDraft}
        onSend={(text, via) => void doSend(text, via)}
        onStop={() => {
          skipStream.current = true;
          setStreamId(null);
        }}
        busy={busy || streamId != null}
        disabled={gate !== 'open'}
        placeholder={placeholder}
        onDisabledPress={gate === 'trial_out' ? () => setUpsell(true) : undefined}
        chips={showChips ? chips : null}
        onChip={(q) => void doSend(q, 'chip')}
        lang={lang}
        bottomInset={insets.bottom}
      />

      <UpsellSheet
        visible={upsell}
        trial={trialCap}
        daily={dailyCap}
        aiPerDay={limits?.ai.balance ?? null}
        yearlyPrice={yearlyBalance}
        onPlans={goPlans}
        onClose={() => {
          setUpsell(false);
          trackCoach('coach_upsell', { action: 'dismiss' });
        }}
      />
      <MenuSheet
        visible={menu}
        onClose={() => setMenu(false)}
        onHistory={() => {
          setMenu(false);
          nav.navigate('CoachHistory');
        }}
        onDelete={() => {
          setMenu(false);
          setDel(true);
        }}
      />
      <DeleteConfirm visible={del} busy={delBusy} onCancel={() => setDel(false)} onConfirm={() => void confirmDelete()} />
      <ConsentSheet
        visible={consent}
        mode="ai_coach"
        onConfirm={() => {
          setConsent(false);
          void setCoachConsent(true, 'coach').then(() => {
            const p = pendingSend.current;
            pendingSend.current = null;
            if (p) void doSend(p.text, p.via);
          });
        }}
        onClose={() => {
          setConsent(false);
          if (pendingSend.current) setDraft(pendingSend.current.text);
          pendingSend.current = null;
        }}
        onPrivacy={() => {
          setConsent(false);
          if (pendingSend.current) setDraft(pendingSend.current.text);
          pendingSend.current = null;
          // G28-S1 md.7: legal.eatkcal.com gizlilik; açılamazsa uygulama içi metin.
          void openLegalWeb('privacy', lang, () => nav.navigate('ProfileContracts', { slug: LEGAL_SLUG.privacy }));
        }}
      />
      <Toast visible={toast != null} message={toast ?? ''} onDismiss={() => setToast(null)} autoHideMs={2200} />
    </KeyboardAvoidingView>
  );
}

function CoachTurn({
  m,
  stamp,
  animate,
  onStreamDone,
  handlers,
  onFeedback,
}: {
  m: CoachMessage;
  stamp: React.ReactNode;
  animate: boolean;
  onStreamDone: () => void;
  handlers: CardHandlers;
  onFeedback: (v: -1 | 1 | null) => void;
}) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  const [textDone, setTextDone] = useState(!animate);
  const cards = m.cards ?? [];
  const safety = cards.some((x) => x.type === 'safety');
  return (
    <Animated.View entering={animate ? (reduced ? FadeIn.duration(REDUCED.duration) : FadeInDown.duration(DURATION.base).easing(CURVE.enter)) : undefined} style={styles.coachTurn}>
      {stamp}
      <View style={styles.coachRow}>
        <CoachAvatar />
        <View style={styles.coachCol}>
          <View style={[styles.coachBubble, { backgroundColor: c.card, borderColor: c.line }]} accessible accessibilityLabel={tr('coach.coach_a11y', { text: m.body })} testID={safety ? 'coach-reply-safety' : 'coach-reply'}>
            <StreamText
              text={m.body}
              animate={animate}
              onDone={() => {
                setTextDone(true);
                onStreamDone();
              }}
              style={[styles.coachText, { color: c.text }]}
            />
          </View>
          {cards.length && textDone ? <CardList cards={cards} animate={animate} handlers={handlers} /> : null}
          {textDone && !m.id.startsWith('local-') ? <FeedbackRow value={m.feedback} onChange={onFeedback} /> : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 8, borderBottomWidth: 1, gap: 4 },
  icon44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headMid: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headTitle: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 19, lineHeight: 24 },
  headSub: { fontSize: 14 },
  pillWrap: { paddingTop: 10, paddingBottom: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 10 },
  hello: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 24, lineHeight: 30, textAlign: 'center' },
  helloBody: { fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: 10 },
  listPad: { paddingVertical: 16, gap: 14 },
  trialIntro: { fontSize: 14, lineHeight: 20, paddingHorizontal: 32 },
  stamp: { alignSelf: 'center', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 12 },
  stampText: { fontSize: 13, fontWeight: '500' },
  meRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 56, paddingRight: 16 },
  meBubble: { backgroundColor: '#C6F04F', borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  meText: { fontSize: 16, lineHeight: 22, color: '#0A0A0A' },
  coachTurn: {},
  coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 16 },
  coachCol: { flex: 1, gap: 10, paddingRight: 16 },
  coachBubble: { alignSelf: 'flex-start', borderRadius: 20, borderTopLeftRadius: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  coachText: { fontSize: 16, lineHeight: 22 },
  notice: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, padding: 16, gap: 6 },
  noticeTitle: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  noticeBody: { fontSize: 15, lineHeight: 21 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkText: { fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  retry: { alignSelf: 'flex-start', minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 18, justifyContent: 'center', marginTop: 4 },
});
