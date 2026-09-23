import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { ArrowLeft } from 'phosphor-react-native';
import { payWithSavedCard } from '../lib/cards';
import { PAYMENT_PAGE_ERROR_MESSAGE, toRenderableFormHtml } from '../lib/paymentHtml';
import { matchesPaynkolayReturn } from '../lib/paynkolayReturn';
import {
  LoadGuard,
  PAYMENT_PAGE_LOAD_FAILED_MESSAGE,
  START_REQUEST_TIMEOUT_MS,
  createLoadGuard,
  fetchWithTimeout,
  isBenignWebViewError,
  isFatalHttpError,
  isProviderPageReady,
  userMessageForError,
  withDeadline,
} from '../lib/webviewResilience';
import { RootStackParamList } from '../navigation/types';
import { haptic } from '../utils/haptics';
import { useCartStore } from '../store/cartStore';
import { getSupabaseClient } from '../lib/supabase';
import { logEvent, track } from '../lib/analytics';
import { COLORS } from '../constants/theme';
import {
  PAYMENT_PROVIDER,
  PAYNKOLAY_INIT_URL,
  PAYNKOLAY_VPOS_ORIGIN,
} from '../config/payment';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'PaymentScreen'>;
type PaymentScreenNavProp = NativeStackNavigationProp<RootStackParamList>;

// Edge function cagrilarinda apikey header'i (publishable anahtar).
const SUPABASE_ANON_KEY = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';

export default function PaymentScreen() {
  // 23.09.2026: PayTR ve Tosla dallari silindi — tek saglayici PaynKolay
  // (bkz. src/config/payment.ts). Ekran artik dogrudan hosted akisi acar.
  const route = useRoute<PaymentScreenRouteProp>();
  return (
    <PaynkolayPaymentFlow
      orderId={route.params.orderId}
      amount={route.params.amount}
      orderCode={route.params.orderCode}
      noticeMessage={route.params.noticeMessage}
      payMode={route.params.payMode}
      cardId={route.params.cardId}
      saveCard={route.params.saveCard}
    />
  );
}
// ── Paynkolay hosted (Ortak Odeme) akisi ────────────────────────────────────
// (Eski PaytrPaymentFlow deseninden turetilmisti; o dal 23.09.2026'da silindi.)
// Tek farklar:
//  - init -> paynkolay-payment-init { orderId, amount } -> { success, formHtml }
//  - WebView source = { html: formHtml, baseUrl } (form-POST; PayTR uri: GET'ti)
//  - donus URL'leri ayni: callback eatkcal.com/payment/success|fail'e redirect eder
type PaynkolayFlowProps = {
  orderId: string;
  amount: number;
  orderCode?: string;
  noticeMessage?: string;
  // Ödeme yöntemi Sipariş Özeti'nde (CheckoutScreen) seçilir; bu ekran ara
  // seçim ekranı göstermeden doğrudan başlatır. payMode yoksa (ör. Macro
  // satın alma) yeni kart / hosted akışı kartı KAYDETMEDEN başlar.
  payMode?: 'saved_card' | 'new_card';
  cardId?: string;
  saveCard?: boolean;
};

type PaynkolayInitResponse = {
  success?: boolean;
  formHtml?: string;
  error?: string;
  pending?: boolean;
};

// 16×1500ms = 24sn marj. Callback dönüş zincirinde senkron koştuğu için normalde
// 1. denemede paid görülür; bu sadece gateway timing varyansına karşı sigorta.
const PAYNKOLAY_POLL_MAX_ATTEMPTS = 16;
const PAYNKOLAY_POLL_INTERVAL_MS = 1500;

// Ödeme ekranı hangi aşamada: başlatılıyor / sonuç bekleniyor (WebView) /
// bu sipariş için önceki bir ödeme hâlâ inceleniyor (yeni deneme başlatılmaz).
type PaynkolayStage = 'processing' | 'review_pending';

function PaynkolayPaymentFlow({ orderId, amount, orderCode, noticeMessage, payMode, cardId, saveCard }: PaynkolayFlowProps) {
  const navigation = useNavigation<PaymentScreenNavProp>();
  const insets = useSafeAreaInsets();
  const clearCart = useCartStore((s) => s.clearCart);

  const [formHtml, setFormHtml] = useState<string | null>(null);
  const [initError, setInitError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  // ERKEN KAPATMA GUARD: donus URL'i bir kez islensin; WebView poll bitene kadar
  // MOUNTED kalir (callback POST'u ucustayken kapanmaz — Tosla'daki notla ayni).
  const handledRef = useRef(false);

  // StrictMode/yeniden-render'a karsi guard: mount-baslatma effect'i ekran
  // basina EN FAZLA 1 kez gercekten calisir (syncSavedCards 8 kez cagrilmis
  // gozlemi — 2026-09-16 canli test — buna karsi eklendi).
  const initStartedRef = useRef(false);
  const [stage, setStage] = useState<PaynkolayStage>('processing');
  // SAĞLAYICI TAKILMASI: sayfa 20 sn içinde açılmazsa ya da onError/onHttpError gelirse WebView
  // KAPATILMAZ (yavaş ama çalışan bir 3D sayfası yarıda kesilmesin) — üstünde "Tekrar dene /
  // Geri Dön" bandı çıkar; sayfa sonradan açılırsa bant kalkar. Kullanıcı kilitli kalmaz.
  const [stalled, setStalled] = useState<null | 'timeout' | 'error'>(null);
  const guardRef = useRef<LoadGuard | null>(null);
  const mainUrlRef = useRef('');

  // Önce bu sipariş için bekleyen bir inceleme var mı diye bak — varsa HİÇ ödeme
  // denemesi başlatılmaz, kalıcı "kontrol ediliyor" ekranı gösterilir. Yoksa
  // Checkout'ta seçilen yönteme göre DOĞRUDAN başlar (ara ekran yok):
  //   saved_card -> paynkolay-cards pay (her zaman 3D),
  //   diğer      -> hosted init (saveCard: "Kartımı kaydet" işaretliyse true).
  useEffect(() => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: orderRow } = await withDeadline(
          Promise.resolve(
            supabase
              .from('orders')
              .select('payment_review_pending')
              .eq('id', orderId)
              .maybeSingle(),
          ),
          8000,
        );
        if (orderRow?.payment_review_pending) {
          setStage('review_pending');
          return;
        }
      } catch {
        // inceleme kontrolü başarısız olsa da ödeme akışı kilitlenmesin
      }
      if (payMode === 'saved_card' && cardId) {
        await startSavedCardPay(cardId);
      } else {
        await startHostedInit(payMode === 'new_card' && saveCard === true);
      }
    })();
  }, []);

  const startHostedInit = async (shouldSaveCard: boolean) => {
    setStage('processing');
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const message = 'Oturum bulunamadı.';
        setInitError(message);
        handleFailure(message);
        return;
      }
      track('payment_attempt', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER });

      // Üst süre: sağlayıcı/sunucu takılırsa "hazırlanıyor" sonsuza kadar sürmez.
      const res = await fetchWithTimeout(PAYNKOLAY_INIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ orderId: String(orderId), amount, saveCard: shouldSaveCard }),
      }, START_REQUEST_TIMEOUT_MS);
      const json = (await res.json().catch(() => ({}))) as PaynkolayInitResponse;
      if (json.pending) {
        handlePendingReview(json.error);
        return;
      }
      if (!res.ok || !json.success || !json.formHtml) {
        const message = json.error || 'Ödeme başlatılamadı.';
        setInitError(message);
        handleFailure(message);
        return;
      }
      const safeHtml = toRenderableFormHtml(json.formHtml);
      if (!safeHtml) {
        track('payment_failed', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER, reason: 'invalid_form_html' });
        setInitError(PAYMENT_PAGE_ERROR_MESSAGE);
        handleFailure(PAYMENT_PAGE_ERROR_MESSAGE);
        return;
      }
      setFormHtml(safeHtml);
    } catch (err) {
      const message = userMessageForError(err, PAYMENT_PAGE_LOAD_FAILED_MESSAGE);
      setInitError(message);
      handleFailure(message);
    }
  };

  const startSavedCardPay = async (cardId: string) => {
    setStage('processing');
    try {
      track('payment_attempt', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER });
      const result = await payWithSavedCard(orderId, cardId);
      if (result.pending) {
        handlePendingReview(result.error);
        return;
      }
      if (!result.success && !result.alreadyPaid) {
        const message = result.error || 'Ödeme başlatılamadı.';
        setInitError(message);
        handleFailure(message);
        return;
      }
      if (result.alreadyPaid) {
        handleSuccess();
        return;
      }
      // Saklı kart ödemesi HER ZAMAN 3D'li: geçerli bir form HTML'i yoksa (beklenmeyen
      // yanıt) ham içerik ASLA gösterilmez ve "başarılı" varsayılmaz — kontrollü hata.
      const safeHtml = result.requires3D ? toRenderableFormHtml(result.formHtml) : null;
      if (!safeHtml) {
        track('payment_failed', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER, reason: 'invalid_form_html' });
        setInitError(PAYMENT_PAGE_ERROR_MESSAGE);
        handleFailure(PAYMENT_PAGE_ERROR_MESSAGE);
        return;
      }
      setFormHtml(safeHtml);
    } catch (err) {
      const message = userMessageForError(err, PAYMENT_PAGE_LOAD_FAILED_MESSAGE);
      setInitError(message);
      handleFailure(message);
    }
  };

  const pollOrderConfirmed = async (): Promise<boolean> => {
    const supabase = getSupabaseClient();
    for (let attempt = 0; attempt < PAYNKOLAY_POLL_MAX_ATTEMPTS; attempt++) {
      const { data } = await withDeadline(
        Promise.resolve(
          supabase
            .from('orders')
            .select('status, payment_status')
            .eq('id', orderId)
            .maybeSingle(),
        ),
        8000,
      ).catch(() => ({ data: null }));
      if (data?.status === 'confirmed' || data?.payment_status === 'paid') return true;
      if (attempt < PAYNKOLAY_POLL_MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => setTimeout(resolve, PAYNKOLAY_POLL_INTERVAL_MS));
      }
    }
    return false;
  };

  const handleSuccess = async () => {
    if (handledRef.current) return;
    handledRef.current = true;
    setVerifying(true);
    haptic.success();
    logEvent.purchase(String(orderId), Number(amount) || 0);
    track('payment_success', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER });

    const paid = await pollOrderConfirmed();
    if (!paid) {
      // callback'in order'i guncellemesi gecikmis olabilir; yanlis "basarili"
      // ekrani gostermek yerine kullaniciyi siparislere yonlendir.
      setVerifying(false);
      Alert.alert(
        'Ödeme doğrulanıyor',
        'Ödemeniz işleniyor olabilir. Siparişlerim sayfasından durumu kontrol edebilirsiniz.',
        [{ text: 'Tamam', onPress: () => navigation.goBack() }],
      );
      return;
    }

    if (useCartStore.getState().items.length > 0) clearCart();
    navigation.replace('OrderSuccess', {
      orderCode: orderCode ?? String(orderId),
      orderId: String(orderId),
      noticeMessage,
    });
  };

  const handleFailure = (reason?: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    track('payment_failed', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER, reason: reason ?? 'psp_declined' });
    Alert.alert('Ödeme başarısız', reason || 'Ödeme tamamlanamadı. Lütfen tekrar deneyin.', [
      { text: 'Tamam', onPress: () => navigation.goBack() },
    ]);
  };

  // Saklı kart odemesi ne hash ne raporla teyit edilebildiginde (needs_manual_review):
  // siparis durumu SUNUCUDA degistirilmedi — kullaniciya kesin basarisiz demek yerine
  // kontrol edildigini bildiriyoruz.
  const handlePendingReview = (message?: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    track('payment_pending', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER });
    Alert.alert(
      'Ödemen kontrol ediliyor',
      message || 'Ödemeniz kontrol ediliyor, birkaç dakika içinde bilgilendireceğiz.',
      [{ text: 'Tamam', onPress: () => navigation.goBack() }],
    );
  };

  const handleNavigationCheck = (url: string): boolean => {
    if (handledRef.current) return false;
    const result = matchesPaynkolayReturn(url);
    if (result.matches) {
      if (result.success) handleSuccess();
      else handleFailure();
      return false; // eatkcal.com'a gercek navigasyonu engelle (WebView mounted kalir)
    }
    return true;
  };

  const markProviderReady = (url?: string) => {
    if (isProviderPageReady(url, PAYNKOLAY_VPOS_ORIGIN)) {
      guardRef.current?.markReady();
      setStalled((cur) => (cur === 'timeout' ? null : cur)); // yavaş açıldı: bant kalksın
    }
  };
  const onShouldStartLoadWithRequest = (request: { url: string; isTopFrame?: boolean }) => {
    const url = request.url || '';
    if (__DEV__) console.log('[paynkolay] onShouldStartLoadWithRequest:', url);
    if (request.isTopFrame !== false) mainUrlRef.current = url;
    return handleNavigationCheck(url);
  };
  const onNavStateChange = (state: { url?: string; loading?: boolean }) => {
    const url = state.url || '';
    if (__DEV__) console.log('[paynkolay] onNavigationStateChange:', url);
    if (url) mainUrlRef.current = url;
    if (!state.loading) markProviderReady(url);
    handleNavigationCheck(url);
  };
  const onLoadStart = (e: { nativeEvent: { url: string } }) => {
    mainUrlRef.current = e.nativeEvent.url || mainUrlRef.current;
    handleNavigationCheck(e.nativeEvent.url || '');
  };
  const onLoadEnd = (e: { nativeEvent: { url: string } }) => markProviderReady(e.nativeEvent.url);
  const onWebViewError = (e: { nativeEvent: { code?: number; description?: string } }) => {
    const ev = e.nativeEvent;
    // Kendi engellediğimiz dönüş navigasyonu (iOS -999 / ERR_ABORTED) gerçek hata değil.
    if (isBenignWebViewError(ev) || handledRef.current) return;
    console.warn('[paynkolay] onError:', { code: ev.code, description: String(ev.description ?? '').slice(0, 120) });
    setStalled('error');
  };
  const onWebViewHttpError = (e: { nativeEvent: { statusCode?: number; url?: string } }) => {
    const ev = e.nativeEvent;
    if (handledRef.current) return;
    if (isFatalHttpError(ev, mainUrlRef.current)) {
      console.warn('[paynkolay] onHttpError:', { statusCode: ev.statusCode });
      setStalled('error');
    }
  };

  // WebView (form) her açıldığında 20 sn'lik "sağlayıcı sayfası hazır olmalı" bekçisi.
  useEffect(() => {
    if (!formHtml) return;
    setStalled(null);
    const guard = createLoadGuard({
      onTimeout: () => { if (!handledRef.current) setStalled((cur) => cur ?? 'timeout'); },
    });
    guardRef.current = guard;
    guard.start();
    return () => guard.stop();
  }, [formHtml]);

  // "Tekrar dene": takılan sayfayı bırakıp ödeme başlatmayı baştan yapar (yeni form).
  const retryAfterStall = () => {
    guardRef.current?.stop();
    setStalled(null);
    setFormHtml(null);
    setInitError('');
    if (payMode === 'saved_card' && cardId) startSavedCardPay(cardId);
    else startHostedInit(payMode === 'new_card' && saveCard === true);
  };

  return (
    <View style={[hostedStyles.container, { flex: 1 }]}>
      <View style={[hostedStyles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={hostedStyles.backButton}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={hostedStyles.headerTitle}>Güvenli Ödeme</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={hostedStyles.body}>
        {formHtml ? (
          <WebView
            source={{ html: formHtml, baseUrl: PAYNKOLAY_VPOS_ORIGIN }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavStateChange}
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
            onError={onWebViewError}
            onHttpError={onWebViewHttpError}
            startInLoadingState
          />
        ) : stage === 'review_pending' ? (
          <View style={hostedStyles.loaderWrap}>
            <ActivityIndicator size="large" color={COLORS.brand.green} />
            <Text style={hostedStyles.loaderText}>Ödemen kontrol ediliyor…</Text>
            <Text style={[hostedStyles.errorText, { color: COLORS.text.secondary, marginTop: 8 }]}>
              Bu sipariş için önceki ödemen inceleniyor. Sonucu birkaç dakika
              içinde bildireceğiz — şimdi yeni bir ödeme denemesi başlatılamaz.
            </Text>
            <Pressable style={hostedStyles.retryBtn} onPress={() => navigation.goBack()}>
              <Text style={hostedStyles.retryText}>Geri Dön</Text>
            </Pressable>
          </View>
        ) : (
          <View style={hostedStyles.loaderWrap}>
            {initError ? (
              <>
                <Text style={hostedStyles.errorText}>{initError}</Text>
                <Pressable style={hostedStyles.retryBtn} onPress={() => navigation.goBack()}>
                  <Text style={hostedStyles.retryText}>Geri Dön</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={COLORS.brand.green} />
                <Text style={hostedStyles.loaderText}>Ödeme sayfası hazırlanıyor…</Text>
              </>
            )}
          </View>
        )}
      </View>

      {stalled && formHtml && !verifying ? (
        <View style={hostedStyles.stallBanner}>
          <Text style={hostedStyles.stallText}>{PAYMENT_PAGE_LOAD_FAILED_MESSAGE}</Text>
          <View style={hostedStyles.stallRow}>
            <Pressable style={hostedStyles.stallPrimary} onPress={retryAfterStall}>
              <Text style={hostedStyles.stallPrimaryText}>Tekrar dene</Text>
            </Pressable>
            <Pressable style={hostedStyles.stallSecondary} onPress={() => navigation.goBack()}>
              <Text style={hostedStyles.stallSecondaryText}>Geri Dön</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {verifying ? (
        <View style={hostedStyles.verifyingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={hostedStyles.verifyingText}>Ödeme onaylanıyor…</Text>
        </View>
      ) : null}
    </View>
  );
}

const hostedStyles = StyleSheet.create({
  container: { backgroundColor: '#000' },
  stallBanner: {
    position: 'absolute', left: 16, right: 16, bottom: 32,
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  stallText: { fontSize: 14, color: '#111', textAlign: 'center', lineHeight: 20 },
  stallRow: { flexDirection: 'row', gap: 10 },
  stallPrimary: { flex: 1, height: 44, borderRadius: 100, backgroundColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center' },
  stallPrimaryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: '#1a3d00' },
  stallSecondary: { flex: 1, height: 44, borderRadius: 100, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  stallSecondaryText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#333' },
  body: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  loaderText: {
    marginTop: 12,
    color: COLORS.text.secondary,
    fontSize: 14,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
  },
  retryText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1a3d00',
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});
