// eatkcal v2 (G15-S5 md.1/md.5) — "Yeni kart" (PaynKolay kart doğrulama) yeni görünüm.
//
// `yeni_siparis` açıkken `ProfileAddCard` rotası bu bileşenle kaydolur (routes.tsx
// v2ScreenFor); kapalıyken src/screens/profile/AddCardScreen.tsx AYNEN.
// MANTIK (doğrulama başlat/poll/iptal/WebView dönüşü/geri tuşu) o dosyadan SATIR
// SATIR KOPYA — yalnız JSX ve stiller v2. Kaynakta değişiklik olursa buraya da
// uygulanmalı (LOG › SORULAR).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { FinCardSkeleton } from '../../../../core/design';
import { FinText as Text } from '../../../../core/design/components/FinText';
import { PaynkolayText } from '../ui/PaynkolayLogo';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { CaretLeft, Check, CreditCard, Info, Lock, WarningCircle } from '../../../../components/icons';
import { ekType, useEk } from '../ui/kit';
import { useRequireAuth } from '../../../../hooks/useRequireAuth';
import { RootStackParamList } from '../../../../navigation/types';
import { PAYNKOLAY_VPOS_ORIGIN } from '../../../../config/payment';
import { cancelCardVerification, getVerificationStatus, startCardVerification } from '../../../../lib/cards';
import { POLL_MAX_MS ,
  CLOSED_MESSAGE,
  LIMIT_MESSAGE,
  TIMEOUT_MESSAGE,
  VerificationResult,
  VerificationStatus,
  inProgressMessage,
  markCardsStale,
  pollVerification,
  resultForStatus,
} from '../../../../lib/cardVerification';
import { PAYMENT_PAGE_ERROR_MESSAGE, toRenderableFormHtml } from '../../../../lib/paymentHtml';
import { matchesPaynkolayReturn } from '../../../../lib/paynkolayReturn';
import {
  LoadGuard,
  PAGE_LOAD_FAILED_MESSAGE,
  START_REQUEST_TIMEOUT_MS,
  createLoadGuard,
  isBenignWebViewError,
  isFatalHttpError,
  isProviderPageReady,
  userMessageForError,
  withDeadline,
} from '../../../../lib/webviewResilience';
import { haptic } from '../../../../utils/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// info -> starting -> webview -> verifying -> result
//                 \-> in_progress (409) | limit (429) | error
// webview: 20 sn içinde açılmazsa ya da onError/onHttpError -> load_failed (kayıt OTOMATİK iptal)
// webview kapatılırsa: closed (kayıt açık kalır) | verifying sonunda timeout
type Stage = 'info' | 'starting' | 'webview' | 'verifying' | 'result' | 'in_progress' | 'limit' | 'closed' | 'timeout' | 'load_failed' | 'error';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function EkAddCardScreen() {
  const navigation = useNavigation<NavProp>();
  const { c, t, theme, insets } = useEk();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [stage, setStage] = useState<Stage>('info');
  const [formHtml, setFormHtml] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Açık doğrulama kaydı (WebView açıkken / 409 dönünce dolar).
  const verificationIdRef = useRef<string | null>(null);
  // Dönüş URL'i bir kez işlensin; WebView poll bitene kadar mounted kalır.
  const returnHandledRef = useRef(false);
  const abortedRef = useRef(false);
  const startedRef = useRef(false); // bir doğrulama başlatıldıysa liste dönüşte yenilenir
  const stageRef = useRef<Stage>('info');
  const loadFailedRef = useRef(false);
  const mainUrlRef = useRef<string>('');
  const autoCancelRef = useRef<Promise<unknown> | null>(null);
  const guardRef = useRef<LoadGuard | null>(null);
  stageRef.current = stage;

  useEffect(() => () => {
    abortedRef.current = true;
    guardRef.current?.stop();
    if (startedRef.current) markCardsStale();
    // Ekran WebView açıkken kapandıysa (gezinme sıfırlama vb.) açık kayıt kilit bırakmasın.
    const id = verificationIdRef.current;
    if (id && stageRef.current === 'webview' && !returnHandledRef.current) {
      cancelCardVerification(id).catch(() => undefined);
    }
  }, []);

  // WebView/poll sürerken swipe-back kapalı (kayıt açık kalırdı); çıkış başlık düğmesiyle.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: stage !== 'webview' && stage !== 'verifying' });
  }, [navigation, stage]);

  const showResult = useCallback((r: VerificationResult) => {
    setResult(r);
    setStage('result');
    if (r.tone === 'success') haptic.success();
  }, []);

  const runPoll = useCallback(async (id: string, maxMs?: number) => {
    return pollVerification({
      fetchStatus: async (): Promise<VerificationStatus> => getVerificationStatus(id),
      sleep,
      now: Date.now,
      isAborted: () => abortedRef.current,
      maxMs,
    });
  }, []);

  const beginVerifying = useCallback(async (id: string) => {
    setStage('verifying');
    // Sert üst sınır: polling ~60 sn + son isteğin süresi; takılsa da "doğrulanıyor" bitmek ZORUNDA.
    const outcome = await withDeadline(runPoll(id), POLL_MAX_MS + 15_000).catch(() => ({ kind: 'timeout' as const }));
    if (outcome.kind === 'aborted') return;
    if (outcome.kind === 'terminal') { showResult(outcome.result); return; }
    setMessage(TIMEOUT_MESSAGE);
    setStage('timeout');
  }, [runPoll, showResult]);

  const start = useCallback(async () => {
    setStage('starting');
    returnHandledRef.current = false;
    loadFailedRef.current = false;
    mainUrlRef.current = '';
    try {
      // Üst süre: sağlayıcı/sunucu takılsa da "hazırlanıyor" sonsuza kadar sürmez.
      const r = await withDeadline(startCardVerification(), START_REQUEST_TIMEOUT_MS);
      if (abortedRef.current) {
        // Kullanıcı beklerken ekrandan çıktı: yeni açılan kayıt 15 dk kilit bırakmasın.
        if (r.kind === 'started') cancelCardVerification(r.verificationId).catch(() => undefined);
        return;
      }
      if (r.kind === 'started') {
        const html = toRenderableFormHtml(r.formHtml);
        verificationIdRef.current = r.verificationId;
        startedRef.current = true;
        if (!html) {
          // Kayıt açıldı ama sayfa gösterilemiyor: kullanıcı kilitli kalmasın.
          await cancelCardVerification(r.verificationId).catch(() => undefined);
          verificationIdRef.current = null;
          setMessage(PAYMENT_PAGE_ERROR_MESSAGE);
          setStage('error');
          return;
        }
        setFormHtml(html);
        setStage('webview');
        return;
      }
      if (r.kind === 'in_progress') {
        verificationIdRef.current = r.verificationId ?? verificationIdRef.current;
        setMessage(inProgressMessage(r.retryAfterSeconds));
        setStage('in_progress');
        return;
      }
      if (r.kind === 'limit') {
        setMessage(LIMIT_MESSAGE);
        setStage('limit');
        return;
      }
      setMessage(r.message);
      setStage('error');
    } catch (err) {
      if (abortedRef.current) return;
      setMessage(userMessageForError(err, 'İşlem başlatılamadı. Lütfen tekrar dene.'));
      setStage('error');
    }
  }, []);

  // "İptal et ve yeniden dene": açık kaydı iptal eder, sonra yenisini başlatır.
  // Kayıt bu arada tamamlandıysa (iptal edilemedi) gerçek sonucu gösterir.
  const cancelAndRetry = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const c = await cancelCardVerification(verificationIdRef.current ?? undefined);
      if (abortedRef.current) return;
      if (c.cancelled === false && typeof c.status === 'string') {
        const finished = resultForStatus({
          status: c.status, card_saved: !!c.card_saved, note: c.note ?? null, refunded: !!c.refunded,
        });
        if (finished && c.status !== 'failed') {
          startedRef.current = true;
          showResult(finished);
          return;
        }
      }
      if (c.cancelled === false && c.status === 'succeeded') {
        // Ödeme alınmış, kart işleniyor/iade ediliyor: yeni deneme başlatma, sonucu bekle.
        startedRef.current = true;
        setMessage(TIMEOUT_MESSAGE);
        setStage('timeout');
        return;
      }
      verificationIdRef.current = null;
      setFormHtml(null);
      await start();
    } catch (err) {
      if (abortedRef.current) return;
      setMessage(userMessageForError(err, 'İptal edilemedi. Lütfen tekrar dene.'));
      setStage('error');
    } finally {
      setBusy(false);
    }
  }, [busy, showResult, start]);

  // Kullanıcı ödeme ekranını KAPATTI (dönüş URL'i görülmeden). 3D arka planda
  // tamamlanmış olabilir: önce TEK durum kontrolü; nihaiyse sonucu göster, değilse
  // kayıt açık kalır -> bilgi + "İptal et ve yeniden dene".
  const handleWebViewClose = useCallback(async () => {
    if (returnHandledRef.current) return;
    returnHandledRef.current = true;
    setFormHtml(null);
    const id = verificationIdRef.current;
    if (id) {
      setStage('verifying');
      const once = await withDeadline(runPoll(id, 0), 15_000).catch(() => ({ kind: 'timeout' as const }));
      if (abortedRef.current) return;
      if (once.kind === 'terminal') { showResult(once.result); return; }
    }
    setMessage(CLOSED_MESSAGE);
    setStage('closed');
  }, [runPoll, showResult]);

  // Sayfa açılamadı (20 sn zaman aşımı / onError / onHttpError): WebView kaldırılır, açık kayıt
  // OTOMATİK iptal edilir (kullanıcı 15 dk beklemesin). Sayfa hiç açılmadığı için para çekilmemiştir;
  // yine de iptal edilen kayıt sweep'in rapor kontrolüne dahildir.
  const handleLoadFailure = (reason: 'timeout' | 'error' | 'http_error', detail?: Record<string, unknown>) => {
    if (loadFailedRef.current || returnHandledRef.current || abortedRef.current) return;
    loadFailedRef.current = true;
    guardRef.current?.stop();
    console.warn('[add-card] sayfa açılamadı', { reason, ...detail });
    setFormHtml(null);
    setMessage(PAGE_LOAD_FAILED_MESSAGE);
    setStage('load_failed');
    const id = verificationIdRef.current;
    if (id) {
      autoCancelRef.current = cancelCardVerification(id)
        .then((c) => {
          // İptal edilemediyse kayıt bu arada tamamlanmış olabilir: gerçek sonucu göster.
          if (abortedRef.current || stageRef.current !== 'load_failed') return;
          if (c.cancelled === false && typeof c.status === 'string' && c.status !== 'failed') {
            const finished = resultForStatus({ status: c.status, card_saved: !!c.card_saved, note: c.note ?? null, refunded: !!c.refunded });
            if (finished) showResult(finished);
          }
        })
        .catch(() => undefined); // iptal edilemezse "Tekrar dene" (cancelAndRetry) yeniden dener
    }
  };
  const failRef = useRef(handleLoadFailure);
  failRef.current = handleLoadFailure;

  // WebView açıldığında 20 sn'lik "sayfa hazır olmalı" bekçisi başlar.
  useEffect(() => {
    if (stage !== 'webview' || !formHtml) return;
    const guard = createLoadGuard({ onTimeout: () => failRef.current('timeout') });
    guardRef.current = guard;
    guard.start();
    return () => guard.stop();
  }, [stage, formHtml]);

  const markProviderReady = (url?: string) => {
    if (isProviderPageReady(url, PAYNKOLAY_VPOS_ORIGIN)) guardRef.current?.markReady();
  };

  const retryAfterLoadFailure = async () => {
    if (busy) return;
    await (autoCancelRef.current ?? Promise.resolve()).catch(() => undefined);
    if (abortedRef.current || stageRef.current !== 'load_failed') return;
    await cancelAndRetry();
  };

  const handleNavigationCheck = (url: string): boolean => {
    if (returnHandledRef.current) return false;
    const r = matchesPaynkolayReturn(url);
    if (!r.matches) return true;
    returnHandledRef.current = true;
    const id = verificationIdRef.current;
    // Başarılı/başarısız dönüş fark etmez: nihai sonuç sunucudan (verify_status) okunur.
    if (id) beginVerifying(id);
    else { setMessage(TIMEOUT_MESSAGE); setStage('timeout'); }
    return false; // eatkcal.com'a gerçek navigasyonu engelle (WebView mounted kalır)
  };

  const goBackToCards = useCallback(() => {
    if (startedRef.current) markCardsStale();
    navigation.goBack();
  }, [navigation]);

  const handleHeaderBack = useCallback(() => {
    if (stage === 'webview') { handleWebViewClose(); return; }
    if (stage === 'verifying') return; // sonuç bekleniyor
    goBackToCards();
  }, [goBackToCards, handleWebViewClose, stage]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stage === 'webview') { handleWebViewClose(); return true; }
      if (stage === 'verifying') return true;
      return false;
    });
    return () => sub.remove();
  }, [stage, handleWebViewClose]);

  if (authLoading) return <FinCardSkeleton />; // G22-S2 md.7
  if (!isAuthenticated) return null;

  const retryFresh = () => { verificationIdRef.current = null; setFormHtml(null); setStage('info'); };

  const onInk = theme.isDark ? c.bg : '#FFFFFF';
  const Primary = ({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) => (
    <Pressable
      style={({ pressed }) => [s.primaryBtn, { backgroundColor: c.ink }, (loading || pressed) && { opacity: 0.7 }]}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={onInk} /> : <Text style={[ekType.b17, { color: onInk }]}>{label}</Text>}
    </Pressable>
  );
  const Secondary = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable style={s.secondaryBtn} onPress={onPress} accessibilityRole="button">
      <Text style={[ekType.b15s, { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
  const Icon = ({ tone }: { tone: 'success' | 'info' | 'error' | 'card' }) => (
    <View style={[s.iconWrap, { backgroundColor: tone === 'success' ? c.accent : c.line }]}>
      {tone === 'success' ? (
        <Check size={26} color={c.onAccent} weight="bold" />
      ) : tone === 'error' ? (
        <WarningCircle size={26} color={c.ink} />
      ) : tone === 'card' ? (
        <CreditCard size={26} color={c.ink} />
      ) : (
        <Info size={26} color={c.ink} />
      )}
    </View>
  );
  const Title = ({ children }: { children: React.ReactNode }) => (
    <Text style={[ekType.h20, { color: c.ink, textAlign: 'center' }]}>{children}</Text>
  );
  const Body = ({ children }: { children: React.ReactNode }) => (
    <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center' }]}>{children}</Text>
  );

  return (
    <View style={[s.root, { backgroundColor: c.bg, paddingTop: insets.top }]} testID="ek-add-card">
      <View style={s.header}>
        <Pressable
          onPress={handleHeaderBack}
          style={s.backBtn}
          disabled={stage === 'verifying'}
          accessibilityRole="button"
          accessibilityLabel={t('eatkcal.v2.common.back')}
        >
          <CaretLeft size={22} color={c.ink} />
        </Pressable>
        <Text style={[ekType.h20, { color: c.ink, flex: 1, textAlign: 'center' }]} accessibilityRole="header">
          {t('eatkcal.v2.addcard.title')}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {stage === 'webview' && formHtml ? (
        <WebView
          source={{ html: formHtml, baseUrl: PAYNKOLAY_VPOS_ORIGIN }}
          style={s.webview}
          originWhitelist={['*']}
          onShouldStartLoadWithRequest={(req) => {
            if ((req as { isTopFrame?: boolean }).isTopFrame !== false) mainUrlRef.current = req.url || '';
            return handleNavigationCheck(req.url || '');
          }}
          onNavigationStateChange={(st) => {
            if (st.url) mainUrlRef.current = st.url;
            if (!st.loading) markProviderReady(st.url);
            handleNavigationCheck(st.url || '');
          }}
          onLoadStart={(e) => {
            mainUrlRef.current = e.nativeEvent.url || mainUrlRef.current;
            handleNavigationCheck(e.nativeEvent.url || '');
          }}
          onLoadEnd={(e) => markProviderReady(e.nativeEvent.url)}
          onError={(e) => {
            const ev = e.nativeEvent as { code?: number; description?: string };
            if (isBenignWebViewError(ev)) return; // kendi engellediğimiz dönüş navigasyonu
            handleLoadFailure('error', { code: ev.code, description: String(ev.description ?? '').slice(0, 120) });
          }}
          onHttpError={(e) => {
            const ev = e.nativeEvent as { statusCode?: number; url?: string };
            if (isFatalHttpError(ev, mainUrlRef.current)) handleLoadFailure('http_error', { statusCode: ev.statusCode });
            else console.warn('[add-card] http hata (alt kaynak, yoksayıldı)', { statusCode: ev.statusCode });
          }}
          startInLoadingState
        />
      ) : (
        <View style={[s.body, { backgroundColor: c.surface }]}>
          {stage === 'info' && (
            <>
              <Icon tone="card" />
              <Title>{t('eatkcal.v2.addcard.info_title')}</Title>
              <Body>{t('eatkcal.v2.addcard.info_body')}</Body>
              <Primary label={t('eatkcal.v2.addcard.continue')} onPress={start} />
              <Secondary label={t('eatkcal.v2.cards.cancel')} onPress={goBackToCards} />
              <View style={[s.securityNote, { backgroundColor: c.line }]}>
                <Lock size={16} color={c.secondary} />
                <PaynkolayText text={t('eatkcal.v2.addcard.security')} style={[ekType.c13, { color: c.secondary, flex: 1 }]} isDark={theme.isDark} />
              </View>
            </>
          )}

          {(stage === 'starting' || stage === 'verifying') && (
            <>
              <ActivityIndicator size="large" color={c.ink} />
              <Body>{stage === 'starting' ? t('eatkcal.v2.payment.preparing') : t('eatkcal.v2.addcard.verifying')}</Body>
            </>
          )}

          {stage === 'result' && result && (
            <>
              <Icon tone={result.tone} />
              <Title>{result.message}</Title>
              <Primary label={t('eatkcal.v2.addcard.ok')} onPress={goBackToCards} />
              {result.canRetry ? <Secondary label={t('eatkcal.v2.common.retry')} onPress={retryFresh} /> : null}
            </>
          )}

          {stage === 'in_progress' && (
            <>
              <Icon tone="info" />
              <Title>{message}</Title>
              <Primary label={t('eatkcal.v2.addcard.cancel_retry')} onPress={cancelAndRetry} loading={busy} />
              <Secondary label={t('eatkcal.v2.cards.cancel')} onPress={goBackToCards} />
            </>
          )}

          {stage === 'load_failed' && (
            <>
              <Icon tone="error" />
              <Title>{message}</Title>
              <Body>{t('eatkcal.v2.addcard.load_failed_body')}</Body>
              <Primary label={t('eatkcal.v2.common.retry')} onPress={retryAfterLoadFailure} loading={busy} />
              <Secondary label={t('eatkcal.v2.cards.cancel')} onPress={goBackToCards} />
            </>
          )}

          {stage === 'closed' && (
            <>
              <Icon tone="info" />
              <Body>{message}</Body>
              <Primary label={t('eatkcal.v2.addcard.cancel_retry')} onPress={cancelAndRetry} loading={busy} />
              <Secondary label={t('eatkcal.v2.common.close')} onPress={goBackToCards} />
            </>
          )}

          {stage === 'timeout' && (
            <>
              <Icon tone="info" />
              <Title>{message}</Title>
              <Primary label={t('eatkcal.v2.addcard.back_to_cards')} onPress={goBackToCards} />
            </>
          )}

          {stage === 'limit' && (
            <>
              <Icon tone="info" />
              <Title>{message}</Title>
              <Primary label={t('eatkcal.v2.addcard.ok')} onPress={goBackToCards} />
            </>
          )}

          {stage === 'error' && (
            <>
              <Icon tone="error" />
              <Title>{message}</Title>
              <Primary label={t('eatkcal.v2.common.retry')} onPress={retryFresh} />
              <Secondary label={t('eatkcal.v2.cards.cancel')} onPress={goBackToCards} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 8, gap: 4 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  webview: { flex: 1, backgroundColor: '#fff' },
  body: { margin: 16, borderRadius: 20, paddingTop: 24, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 10 },
  iconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { alignSelf: 'stretch', minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  secondaryBtn: { alignSelf: 'stretch', minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  securityNote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 16, marginTop: 8, alignSelf: 'stretch' },
});
