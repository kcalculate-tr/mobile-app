import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { CaretLeft, CheckCircle, CreditCard, Info, Lock, WarningCircle } from 'phosphor-react-native';
import ScreenContainer from '../../components/ScreenContainer';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';
import { PAYNKOLAY_VPOS_ORIGIN } from '../../config/payment';
import { cancelCardVerification, getVerificationStatus, startCardVerification } from '../../lib/cards';
import { POLL_MAX_MS } from '../../lib/cardVerification';
import {
  CLOSED_MESSAGE,
  LIMIT_MESSAGE,
  TIMEOUT_MESSAGE,
  VerificationResult,
  VerificationStatus,
  inProgressMessage,
  markCardsStale,
  pollVerification,
  resultForStatus,
} from '../../lib/cardVerification';
import { PAYMENT_PAGE_ERROR_MESSAGE, toRenderableFormHtml } from '../../lib/paymentHtml';
import { matchesPaynkolayReturn } from '../../lib/paynkolayReturn';
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
} from '../../lib/webviewResilience';
import { haptic } from '../../utils/haptics';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// info -> starting -> webview -> verifying -> result
//                 \-> in_progress (409) | limit (429) | error
// webview: 20 sn içinde açılmazsa ya da onError/onHttpError -> load_failed (kayıt OTOMATİK iptal)
// webview kapatılırsa: closed (kayıt açık kalır) | verifying sonunda timeout
type Stage = 'info' | 'starting' | 'webview' | 'verifying' | 'result' | 'in_progress' | 'limit' | 'closed' | 'timeout' | 'load_failed' | 'error';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function AddCardScreen() {
  const navigation = useNavigation<NavProp>();
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

  if (authLoading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  const retryFresh = () => { verificationIdRef.current = null; setFormHtml(null); setStage('info'); };

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={handleHeaderBack} style={s.backBtn} activeOpacity={0.75} disabled={stage === 'verifying'}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Kart Ekle</Text>
        <View style={{ width: 36 }} />
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
        <View style={s.body}>
          {stage === 'info' && (
            <>
              <View style={s.iconWrap}><CreditCard size={30} color="#000000" /></View>
              <Text style={s.title}>Yeni kart ekle</Text>
              <Text style={s.text}>
                Kartını doğrulamak için 1 TL'lik bir işlem yapılacak ve aynı gün iade edilecek.
              </Text>
              <PrimaryButton label="Devam et" onPress={start} />
              <SecondaryButton label="Vazgeç" onPress={goBackToCards} />
              <View style={s.securityNote}>
                <Lock size={14} color={COLORS.text.secondary} />
                <Text style={s.securityText}>
                  Kart bilgilerini KCAL görmez ve saklamaz; işlem lisanslı ödeme kuruluşu PaynKolay'ın güvenli sayfasında yapılır.
                </Text>
              </View>
            </>
          )}

          {(stage === 'starting' || stage === 'verifying') && (
            <>
              <ActivityIndicator size="large" color={COLORS.brand.green} />
              <Text style={s.text}>{stage === 'starting' ? 'Güvenli ödeme sayfası hazırlanıyor…' : 'Kartın doğrulanıyor…'}</Text>
            </>
          )}

          {stage === 'result' && result && (
            <>
              <ResultIcon tone={result.tone} />
              <Text style={s.title}>{result.message}</Text>
              <PrimaryButton label="Tamam" onPress={goBackToCards} />
              {result.canRetry ? <SecondaryButton label="Tekrar dene" onPress={retryFresh} /> : null}
            </>
          )}

          {stage === 'in_progress' && (
            <>
              <ResultIcon tone="info" />
              <Text style={s.title}>{message}</Text>
              <PrimaryButton label="İptal et ve yeniden dene" onPress={cancelAndRetry} loading={busy} />
              <SecondaryButton label="Vazgeç" onPress={goBackToCards} />
            </>
          )}

          {stage === 'load_failed' && (
            <>
              <ResultIcon tone="error" />
              <Text style={s.title}>{message}</Text>
              <Text style={s.text}>Kayıt iptal edildi, 15 dakika beklemen gerekmez. Bir tutar çekildiyse otomatik olarak iade edilir.</Text>
              <PrimaryButton label="Tekrar dene" onPress={retryAfterLoadFailure} loading={busy} />
              <SecondaryButton label="Vazgeç" onPress={goBackToCards} />
            </>
          )}

          {stage === 'closed' && (
            <>
              <ResultIcon tone="info" />
              <Text style={s.text}>{message}</Text>
              <PrimaryButton label="İptal et ve yeniden dene" onPress={cancelAndRetry} loading={busy} />
              <SecondaryButton label="Kapat" onPress={goBackToCards} />
            </>
          )}

          {stage === 'timeout' && (
            <>
              <ResultIcon tone="info" />
              <Text style={s.title}>{message}</Text>
              <PrimaryButton label="Kartlarıma dön" onPress={goBackToCards} />
            </>
          )}

          {stage === 'limit' && (
            <>
              <ResultIcon tone="info" />
              <Text style={s.title}>{message}</Text>
              <PrimaryButton label="Tamam" onPress={goBackToCards} />
            </>
          )}

          {stage === 'error' && (
            <>
              <ResultIcon tone="error" />
              <Text style={s.title}>{message}</Text>
              <PrimaryButton label="Tekrar dene" onPress={retryFresh} />
              <SecondaryButton label="Vazgeç" onPress={goBackToCards} />
            </>
          )}
        </View>
      )}
    </ScreenContainer>
  );
}

function ResultIcon({ tone }: { tone: 'success' | 'info' | 'error' }) {
  if (tone === 'success') return <CheckCircle size={56} weight="fill" color={COLORS.brand.green} />;
  if (tone === 'error') return <WarningCircle size={56} weight="fill" color="#EF4444" />;
  return <Info size={56} weight="fill" color="#6b7280" />;
}

function PrimaryButton({ label, onPress, loading }: { label: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={[s.primaryBtn, loading && { opacity: 0.6 }]} onPress={onPress} disabled={loading} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color="#1a3d00" /> : <Text style={s.primaryBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.secondaryBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  webview: { flex: 1, backgroundColor: '#ffffff' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 14 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: '#ffffff',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  title: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', textAlign: 'center', lineHeight: 24 },
  text: { fontSize: 14, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 21 },
  primaryBtn: {
    width: '100%', height: 50, borderRadius: 100, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  primaryBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: '#1a3d00' },
  secondaryBtn: { width: '100%', height: 46, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.secondary },
  securityNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)', width: '100%', marginTop: 12,
  },
  securityText: { flex: 1, fontSize: 12, color: COLORS.text.secondary, lineHeight: 18 },
});
