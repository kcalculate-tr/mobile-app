import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { CreditCard, Lock, ArrowLeft } from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import KeyboardAccessory from '../components/KeyboardAccessory';
import { initPayment } from '../lib/payment';
import { payWithSavedCard, SavedCard, syncSavedCards } from '../lib/cards';
import { getOrCreateDeviceId } from '../lib/deviceId';
import { RootStackParamList } from '../navigation/types';
import { haptic } from '../utils/haptics';
import { useCartStore } from '../store/cartStore';
import { getSupabaseClient } from '../lib/supabase';
import { logEvent, track } from '../lib/analytics';
import { COLORS } from '../constants/theme';
import {
  PAYMENT_PROVIDER,
  PAYTR_FAIL_URL,
  PAYTR_OK_URL,
  PAYTR_INIT_URL,
  PAYNKOLAY_INIT_URL,
  PAYNKOLAY_VPOS_ORIGIN,
} from '../config/payment';

type PaymentScreenRouteProp = RouteProp<RootStackParamList, 'PaymentScreen'>;
type PaymentScreenNavProp = NativeStackNavigationProp<RootStackParamList>;

const TOSLA_PROCESS_URL = 'https://entegrasyon.tosla.com/api/Payment/ProcessCardForm';

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return digits.slice(0, 2) + '/' + digits.slice(2);
  }
  return digits;
}

export default function PaymentScreen() {
  const route = useRoute<PaymentScreenRouteProp>();
  if (PAYMENT_PROVIDER === 'paynkolay') {
    return (
      <PaynkolayPaymentFlow
        orderId={route.params.orderId}
        amount={route.params.amount}
        orderCode={route.params.orderCode}
        noticeMessage={route.params.noticeMessage}
      />
    );
  }
  if (PAYMENT_PROVIDER === 'paytr_iframe') {
    return (
      <PaytrPaymentFlow
        orderId={route.params.orderId}
        amount={route.params.amount}
        orderCode={route.params.orderCode}
        noticeMessage={route.params.noticeMessage}
      />
    );
  }
  return <ToslaPaymentFlow />;
}

function ToslaPaymentFlow() {
  const route = useRoute<PaymentScreenRouteProp>();
  const navigation = useNavigation<PaymentScreenNavProp>();
  const insets = useSafeAreaInsets();
  const clearCart = useCartStore((s) => s.clearCart);
  const { orderId, amount, orderCode, noticeMessage } = route.params;

  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [webViewHtml, setWebViewHtml] = useState<string | null>(null);
  const hasNavigated = useRef(false);
  const paymentTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ekran-seviyesi benzersiz aksesuar ID'si: bu ekrandaki tüm input'lar referanslar,
  // tek InputAccessoryView mount edilir → duplicate nativeID çakışması yok.
  const accId = useMemo(() => `acc_${Math.random().toString(36).slice(2, 11)}`, []);
  const iosAccId = Platform.OS === 'ios' ? accId : undefined;

  useEffect(() => {
    return () => {
      if (paymentTimerRef.current) clearTimeout(paymentTimerRef.current);
    };
  }, []);

  // Flip animation
  const flipAnim = useRef(new Animated.Value(0)).current;

  const flipToBack = () => {
    Animated.spring(flipAnim, { toValue: 1, useNativeDriver: true }).start();
  };
  const flipToFront = () => {
    Animated.spring(flipAnim, { toValue: 0, useNativeDriver: true }).start();
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const maskedCardNumber = () => {
    const digits = cardNumber.replace(/\D/g, '');
    const padded = digits.padEnd(16, '•');
    return [padded.slice(0, 4), padded.slice(4, 8), padded.slice(8, 12), padded.slice(12, 16)].join(' ');
  };

  const handlePay = async () => {
    setError('');
    const cardDigits = cardNumber.replace(/\D/g, '');
    const expiryDigits = expiry.replace(/\D/g, '');

    if (!cardHolder.trim()) { setError('Kart sahibi adını girin.'); return; }
    if (cardDigits.length < 16) { setError('Geçerli bir kart numarası girin.'); return; }
    if (expiryDigits.length < 4) { setError('Son kullanma tarihini girin.'); return; }
    if (cvv.length < 3) { setError('CVV girin.'); return; }

    setLoading(true);
    track('payment_attempt', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER });
    try {
      const initResult = await initPayment(orderId, amount);
      if (!initResult.success || !initResult.threeDSessionId) {
        setError(initResult.error ?? 'Ödeme başlatılamadı.');
        track('payment_failed', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER, reason: 'init_failed' });
        return;
      }

      const threeDSessionId = initResult.threeDSessionId;
      const expireDate = expiryDigits.slice(0, 2) + expiryDigits.slice(2, 4); // MMYY

      // ProcessCardForm'a doğrudan fetch ile POST et
      const formData = new FormData();
      formData.append('ThreeDSessionId', threeDSessionId);
      formData.append('CardHolderName', cardHolder.trim());
      formData.append('CardNo', cardDigits);
      formData.append('ExpireDate', expireDate);
      formData.append('Cvv', cvv);

      const res = await fetch(TOSLA_PROCESS_URL, {
        method: 'POST',
        body: formData,
      });

      const responseText = await res.text();

      // HTML response'u doğrudan WebView modal'da göster
      setWebViewHtml(responseText);
    } catch (err) {
      console.error('PaymentScreen HATA:', String(err));
      Alert.alert('Hata', String(err));
      setError(String(err));
      track('payment_failed', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER, reason: 'network_error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => {
              haptic.selection();
              navigation.goBack();
            }} 
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <ArrowLeft size={20} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ödeme</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Kart Görseli */}
          <View style={styles.cardVisual}>
            <View style={styles.cardDecoCircle1} />
            <View style={styles.cardDecoCircle2} />
            
            <View style={styles.cardTop}>
              <CreditCard size={28} color="rgba(255,255,255,0.7)" />
              <View style={styles.cardLogos}>
                <View style={styles.cardLogo1} />
                <View style={styles.cardLogo2} />
              </View>
            </View>

            <Text style={styles.cardNumberDisplay}>
              {cardNumber || '•••• •••• •••• ••••'}
            </Text>

            <View style={styles.cardBottom}>
              <View>
                <Text style={styles.cardLabelText}>Kart Sahibi</Text>
                <Text style={styles.cardValueText}>{cardHolder.toUpperCase() || 'AD SOYAD'}</Text>
              </View>
              <View>
                <Text style={styles.cardLabelText}>Son Kullanım</Text>
                <Text style={styles.cardValueText}>{expiry || 'AA/YY'}</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Kart Bilgileri</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kart Numarası</Text>
              <TextInput
                style={styles.input}
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                keyboardType="number-pad"
                maxLength={19}
                textContentType="creditCardNumber"
                autoComplete="cc-number"
                inputAccessoryViewID={iosAccId}
                placeholderTextColor={COLORS.text.tertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Kart Üzerindeki İsim</Text>
              <TextInput
                style={styles.input}
                placeholder="AD SOYAD"
                value={cardHolder}
                onChangeText={(v) => setCardHolder(v.toUpperCase())}
                autoCapitalize="words"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                textContentType="oneTimeCode"
                inputAccessoryViewID={iosAccId}
                placeholderTextColor={COLORS.text.tertiary}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Son Kullanım</Text>
                <TextInput
                  style={styles.input}
                  placeholder="AA/YY"
                  value={expiry}
                  onChangeText={(v) => setExpiry(formatExpiry(v))}
                  keyboardType="number-pad"
                  maxLength={5}
                  autoComplete="cc-exp"
                  inputAccessoryViewID={iosAccId}
                  placeholderTextColor={COLORS.text.tertiary}
                />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>CVV</Text>
                <TextInput
                  style={styles.input}
                  placeholder="•••"
                  value={cvv}
                  onChangeText={(v) => setCvv(v.replace(/\D/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  maxLength={3}
                  secureTextEntry
                  textContentType="creditCardSecurityCode"
                  autoComplete="cc-csc"
                  inputAccessoryViewID={iosAccId}
                  placeholderTextColor={COLORS.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* Security Badge */}
          <View style={styles.securityBadge}>
            <Lock size={14} color={COLORS.text.tertiary} />
            <Text style={styles.securityText}>256-bit SSL Şifrelemeli Güvenli Ödeme</Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        {/* Pay Button */}
        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <Pressable
            style={[styles.payButton, loading && styles.payButtonDisabled]}
            onPress={handlePay}
            disabled={loading}
          >
            <Text style={styles.payButtonText}>
              {loading ? 'İşleniyor...' : 'Ödemeyi Tamamla'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* iOS native "Kapat" aksesuarı — ekran-seviyesi benzersiz ID. */}
      <KeyboardAccessory nativeID={accId} />

      {/* 3D Secure WebView Modal */}
      <Modal visible={!!webViewHtml} animationType="slide" onRequestClose={() => setWebViewHtml(null)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
            <Text style={styles.modalTitle}>3D Secure Doğrulama</Text>
            <TouchableOpacity
              onPress={async () => {
                if (hasNavigated.current) return;
                hasNavigated.current = true;
                setWebViewHtml(null);
                // NOT: orders.status/payment_status'u client'tan doğrudan yazmıyoruz
                // artık — orders_guard_protected_cols trigger'ı bunu zaten reddediyor
                // (yalnızca sunucu/admin). Bu akış (Tosla) şu an hiçbir build
                // profilinde aktif değil (dormant); yeniden aktifleştirilirse
                // PayTR/Paynkolay'daki gibi sunucu-taraflı bir callback gerekir.
                logEvent.purchase(String(orderId), Number(amount) || 0);
                track('payment_success', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER });
                navigation.replace('OrderSuccess', {
                  orderCode: orderCode ?? String(orderId),
                  orderId: String(orderId),
                  noticeMessage,
                });
              }}
              style={styles.modalCloseBtn}
            >
              <Text style={styles.modalCloseText}>✕ Kapat</Text>
            </TouchableOpacity>
          </View>
          <WebView
            source={{ html: webViewHtml ?? '', baseUrl: 'https://entegrasyon.tosla.com' }}
            style={{ flex: 1 }}
            onShouldStartLoadWithRequest={(request) => {
              return true;
            }}
            onNavigationStateChange={(state) => {
              // Tosla success/fail sayfalarını yakala
              if (state.url?.includes('tosla.com') && state.loading === false) {
                // İşlem tamamlandı, DB zaten güncellendi
                if (hasNavigated.current) return;
                paymentTimerRef.current = setTimeout(async () => {
                  if (hasNavigated.current) return;
                  hasNavigated.current = true;
                  setWebViewHtml(null);
                  haptic.success();
                  logEvent.purchase(String(orderId), Number(amount) || 0);
                  track('payment_success', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER });
                  // Pantry tek kaynak = TrackerScreen backfill (delivered +
                  // orderItemId dedup + bundle expansion). Anında ekleme yok.
                  clearCart();
                  navigation.replace('OrderSuccess', {
                    orderCode: orderCode ?? String(orderId),
                    orderId: String(orderId),
                    noticeMessage,
                  });
                }, 1500);
              }
            }}
          />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f6f6f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#f6f6f6',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },

  // Card Visual
  cardVisual: {
    height: 180,
    borderRadius: 20,
    backgroundColor: '#000000',
    padding: 24,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  cardDecoCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(198,240,79,0.1)',
  },
  cardDecoCircle2: {
    position: 'absolute',
    bottom: -40,
    right: 60,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(198,240,79,0.06)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
  },
  cardLogos: {
    flexDirection: 'row',
    gap: -10,
  },
  cardLogo1: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#d4183d',
    opacity: 0.9,
  },
  cardLogo2: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff8c00',
    opacity: 0.9,
  },
  cardNumberDisplay: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#ffffff',
    marginBottom: 16,
    letterSpacing: 3,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 2,
  },
  cardValueText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#ffffff',
  },

  // Form Card
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary,
    marginBottom: 6,
    paddingLeft: 2,
  },
  input: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#000000',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputHalf: {
    flex: 1,
  },

  // Security Badge
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  securityText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },

  // Error
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  payButton: {
    width: '100%',
    height: 56,
    borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButtonDisabled: {
    backgroundColor: '#d0e8a0',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1a3d00',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#000000',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#fff',
  },
  modalCloseBtn: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});

type PaytrFlowProps = {
  orderId: string;
  amount: number;
  orderCode?: string;
  noticeMessage?: string;
};

type PaytrInitResponse = {
  success?: boolean;
  token?: string;
  iframeUrl?: string;
  merchantOid?: string;
  error?: string;
  reason?: string;
};

const SUPABASE_ANON_KEY = 'sb_publishable_tjeQHxsEgZIObTyf1UHz5Q_Bh4jqS29';
const POLL_MAX_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 1000;

const matchesPayTRReturn = (url: string): { matches: boolean; success: boolean } => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'eatkcal.com') return { matches: false, success: false };
    if (u.pathname === '/payment/success') return { matches: true, success: true };
    if (u.pathname === '/payment/fail') return { matches: true, success: false };
    return { matches: false, success: false };
  } catch {
    return { matches: false, success: false };
  }
};

function PaytrPaymentFlow({ orderId, amount, orderCode, noticeMessage }: PaytrFlowProps) {
  const navigation = useNavigation<PaymentScreenNavProp>();
  const insets = useSafeAreaInsets();
  const clearCart = useCartStore((s) => s.clearCart);

  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [initError, setInitError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setInitError('Oturum bulunamadı.');
          return;
        }

        const { data: order } = await supabase
          .from('orders')
          .select('customer_name, customer_email, phone, address, city, district')
          .eq('id', orderId)
          .maybeSingle();

        const userEmail =
          (typeof order?.customer_email === 'string' && order.customer_email.trim()) ||
          session.user.email ||
          '';
        const userName =
          (typeof order?.customer_name === 'string' && order.customer_name.trim()) ||
          session.user.email ||
          'Misafir';
        const userPhone =
          (typeof order?.phone === 'string' && order.phone.trim()) || '0000000000';
        const userAddress =
          [order?.address, order?.district, order?.city]
            .filter((v) => typeof v === 'string' && v.trim())
            .join(', ') || 'Adres belirtilmedi';

        track('payment_attempt', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER });

        const res = await fetch(PAYTR_INIT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            orderId: String(orderId),
            userEmail,
            userName,
            userPhone,
            userAddress,
          }),
        });

        const json = (await res.json().catch(() => ({}))) as PaytrInitResponse;
        if (cancelled) return;

        if (!res.ok || !json.success || !json.iframeUrl) {
          setInitError(json.reason || json.error || 'Ödeme başlatılamadı.');
          track('payment_failed', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER, reason: 'init_failed' });
          return;
        }

        setIframeUrl(json.iframeUrl);
      } catch (err) {
        if (!cancelled) setInitError(err instanceof Error ? err.message : 'Ödeme başlatılamadı.');
        track('payment_failed', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER, reason: 'network_error' });
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  const pollOrderConfirmed = async (): Promise<boolean> => {
    try {
      const supabase = getSupabaseClient();
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        const { data } = await supabase
          .from('orders')
          .select('status, payment_status')
          .eq('id', orderId)
          .maybeSingle();
        if (data?.status === 'confirmed' || data?.payment_status === 'paid') return true;
        if (attempt < POLL_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }
      return false;
    } catch (err) {
      console.warn('[paytr] poll error:', err);
      handleFailure();
      return false;
    }
  };

  const handleSuccess = async () => {
    if (handledRef.current) return;
    handledRef.current = true;
    setVerifying(true);
    haptic.success();

    logEvent.purchase(String(orderId), Number(amount) || 0);
    track('payment_success', { order_id: String(orderId), price: Number(amount) || 0, payment_method: PAYMENT_PROVIDER });

    await pollOrderConfirmed();

    // Pantry artık TEK kaynaktan dolar: TrackerScreen backfill (sipariş
    // delivered olunca, order_items'tan, orderItemId ile dedup'lı, bundle
    // 6 öğüne açılır). Buradaki anında ekleme kaldırıldı (çift-add + bundle
    // genişletme tutarsızlığı). Sepeti boşaltma davranışı korunur.
    if (useCartStore.getState().items.length > 0) {
      clearCart();
    }

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

  const handleNavigationCheck = (url: string): boolean => {
    if (handledRef.current) return false;
    const result = matchesPayTRReturn(url);
    if (result.matches) {
      if (result.success) handleSuccess();
      else handleFailure();
      return false;
    }
    return true;
  };

  const onShouldStartLoadWithRequest = (request: { url: string }) => {
    const url = request.url || '';
    if (__DEV__) console.log('[paytr] onShouldStartLoadWithRequest:', url);
    return handleNavigationCheck(url);
  };

  const onNavStateChange = (state: { url?: string }) => {
    const url = state.url || '';
    if (__DEV__) console.log('[paytr] onNavigationStateChange:', url);
    handleNavigationCheck(url);
  };

  const onLoadStart = (e: { nativeEvent: { url: string } }) => {
    const url = e.nativeEvent.url || '';
    if (__DEV__) console.log('[paytr] onLoadStart:', url);
    handleNavigationCheck(url);
  };

  const onLoadEnd = (e: { nativeEvent: { url: string } }) => {
    const url = e.nativeEvent.url || '';
    if (__DEV__) console.log('[paytr] onLoadEnd:', url);
    handleNavigationCheck(url);
  };

  const onWebViewError = (e: { nativeEvent: unknown }) => {
    console.warn('[paytr] onError:', e.nativeEvent);
  };

  return (
    <View style={[paytrStyles.container, { flex: 1 }]}>
      <View style={[paytrStyles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={paytrStyles.backButton}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={paytrStyles.headerTitle}>Güvenli Ödeme</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={paytrStyles.body}>
        {iframeUrl ? (
          <WebView
            source={{ uri: iframeUrl }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavStateChange}
            onLoadStart={onLoadStart}
            onLoadEnd={onLoadEnd}
            onError={onWebViewError}
            startInLoadingState
          />
        ) : (
          <View style={paytrStyles.loaderWrap}>
            {initError ? (
              <>
                <Text style={paytrStyles.errorText}>{initError}</Text>
                <Pressable style={paytrStyles.retryBtn} onPress={() => navigation.goBack()}>
                  <Text style={paytrStyles.retryText}>Geri Dön</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={COLORS.brand.green} />
                <Text style={paytrStyles.loaderText}>Ödeme sayfası hazırlanıyor…</Text>
              </>
            )}
          </View>
        )}
      </View>

      {verifying ? (
        <View style={paytrStyles.verifyingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={paytrStyles.verifyingText}>Ödeme onaylanıyor…</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Paynkolay hosted (Ortak Odeme) akisi ────────────────────────────────────
// PaytrPaymentFlow deseninden turetildi. Tek farklar:
//  - init -> paynkolay-payment-init { orderId, amount } -> { success, formHtml }
//  - WebView source = { html: formHtml, baseUrl } (form-POST; PayTR uri: GET'ti)
//  - donus URL'leri ayni: callback eatkcal.com/payment/success|fail'e redirect eder
type PaynkolayFlowProps = {
  orderId: string;
  amount: number;
  orderCode?: string;
  noticeMessage?: string;
};

type PaynkolayInitResponse = {
  success?: boolean;
  formHtml?: string;
  error?: string;
};

// 16×1500ms = 24sn marj. Callback dönüş zincirinde senkron koştuğu için normalde
// 1. denemede paid görülür; bu sadece gateway timing varyansına karşı sigorta.
const PAYNKOLAY_POLL_MAX_ATTEMPTS = 16;
const PAYNKOLAY_POLL_INTERVAL_MS = 1500;

const matchesPaynkolayReturn = (url: string): { matches: boolean; success: boolean } => {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // SADECE callback'in ASIL redirect'ini (eatkcal.com/payment/success|fail) yakala.
    // 'result='/'pk=' gibi query fallback'i KULLANMA: callback URL'inin KENDISI query
    // tasidigi icin (successUrl=.../paynkolay-callback?...), fallback o ara duragi
    // "donus" sanip navigasyonu keserdi -> callback HIC kosmaz, order pending kalir,
    // polling timeout olurdu. Final-redirect host'una kilitleyince callback once kosar.
    if (host === 'eatkcal.com') {
      if (u.pathname === '/payment/success') return { matches: true, success: true };
      if (u.pathname === '/payment/fail') return { matches: true, success: false };
    }
    return { matches: false, success: false };
  } catch {
    return { matches: false, success: false };
  }
};

// Ödeme ekranı hangi aşamada: kart listesi yükleniyor / kayıtlı karttan seç /
// yeni kart (hosted) / sonuç bekleniyor (WebView veya senkron non-3D sonucu).
type PaynkolayStage = 'loading_cards' | 'choose_card' | 'new_card' | 'processing';

function PaynkolayPaymentFlow({ orderId, amount, orderCode, noticeMessage }: PaynkolayFlowProps) {
  const navigation = useNavigation<PaymentScreenNavProp>();
  const insets = useSafeAreaInsets();
  const clearCart = useCartStore((s) => s.clearCart);

  const [formHtml, setFormHtml] = useState<string | null>(null);
  const [initError, setInitError] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  // ERKEN KAPATMA GUARD: donus URL'i bir kez islensin; WebView poll bitene kadar
  // MOUNTED kalir (callback POST'u ucustayken kapanmaz — Tosla'daki notla ayni).
  const handledRef = useRef(false);

  const [stage, setStage] = useState<PaynkolayStage>('loading_cards');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [saveNewCard, setSaveNewCard] = useState(false); // "Kartımı kaydet" — varsayılan İŞARETSİZ
  const [payBusy, setPayBusy] = useState(false);

  // Kayıtlı kartları bir kez çek; varsa varsayılan kartı seçili göster, yoksa
  // doğrudan yeni-kart (hosted) adımına düş.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await syncSavedCards();
        if (cancelled) return;
        const cards = result.cards ?? [];
        setSavedCards(cards);
        if (cards.length > 0) {
          const def = cards.find((c) => c.is_default) ?? cards[0];
          setSelectedCardId(def.id);
          setStage('choose_card');
        } else {
          setStage('new_card');
        }
      } catch {
        if (!cancelled) setStage('new_card');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startHostedInit = async (shouldSaveCard: boolean) => {
    setStage('processing');
    setPayBusy(true);
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

      const res = await fetch(PAYNKOLAY_INIT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ orderId: String(orderId), amount, saveCard: shouldSaveCard }),
      });
      const json = (await res.json().catch(() => ({}))) as PaynkolayInitResponse;
      if (!res.ok || !json.success || !json.formHtml) {
        const message = json.error || 'Ödeme başlatılamadı.';
        setInitError(message);
        handleFailure(message);
        return;
      }
      setFormHtml(json.formHtml);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ödeme başlatılamadı.';
      setInitError(message);
      handleFailure(message);
    } finally {
      setPayBusy(false);
    }
  };

  const startSavedCardPay = async (cardId: string) => {
    setStage('processing');
    setPayBusy(true);
    try {
      track('payment_attempt', { order_id: String(orderId), price: amount, payment_method: PAYMENT_PROVIDER });
      const deviceId = await getOrCreateDeviceId();
      const result = await payWithSavedCard(orderId, cardId, deviceId);
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
      if (result.requires3D && result.formHtml) {
        setFormHtml(result.formHtml);
        return;
      }
      // Non-3D: paynkolay-cards zaten callback'e röle etti, order tamamlandı.
      handleSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ödeme başlatılamadı.';
      setInitError(message);
      handleFailure(message);
    } finally {
      setPayBusy(false);
    }
  };

  const pollOrderConfirmed = async (): Promise<boolean> => {
    const supabase = getSupabaseClient();
    for (let attempt = 0; attempt < PAYNKOLAY_POLL_MAX_ATTEMPTS; attempt++) {
      const { data } = await supabase
        .from('orders')
        .select('status, payment_status')
        .eq('id', orderId)
        .maybeSingle();
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

  const onShouldStartLoadWithRequest = (request: { url: string }) => {
    const url = request.url || '';
    if (__DEV__) console.log('[paynkolay] onShouldStartLoadWithRequest:', url);
    return handleNavigationCheck(url);
  };
  const onNavStateChange = (state: { url?: string }) => {
    const url = state.url || '';
    if (__DEV__) console.log('[paynkolay] onNavigationStateChange:', url);
    handleNavigationCheck(url);
  };
  const onLoadStart = (e: { nativeEvent: { url: string } }) => {
    handleNavigationCheck(e.nativeEvent.url || '');
  };
  const onWebViewError = (e: { nativeEvent: unknown }) => {
    console.warn('[paynkolay] onError:', e.nativeEvent);
  };

  return (
    <View style={[paytrStyles.container, { flex: 1 }]}>
      <View style={[paytrStyles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={paytrStyles.backButton}
          activeOpacity={0.8}
        >
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={paytrStyles.headerTitle}>Güvenli Ödeme</Text>
        <View style={{ width: 42 }} />
      </View>

      <View style={paytrStyles.body}>
        {formHtml ? (
          <WebView
            source={{ html: formHtml, baseUrl: PAYNKOLAY_VPOS_ORIGIN }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onNavigationStateChange={onNavStateChange}
            onLoadStart={onLoadStart}
            onError={onWebViewError}
            startInLoadingState
          />
        ) : stage === 'choose_card' ? (
          <ScrollView contentContainerStyle={cardChoiceStyles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={cardChoiceStyles.title}>Ödeme Yöntemi</Text>
            {savedCards.map((card) => {
              const selected = card.id === selectedCardId;
              const brand = card.brand?.trim() || 'Kart';
              const bank = card.bank_name?.trim();
              return (
                <TouchableOpacity
                  key={card.id}
                  style={[cardChoiceStyles.cardRow, selected && cardChoiceStyles.cardRowSelected]}
                  onPress={() => setSelectedCardId(card.id)}
                  activeOpacity={0.7}
                >
                  <View style={cardChoiceStyles.radioOuter}>
                    {selected ? <View style={cardChoiceStyles.radioInner} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={cardChoiceStyles.cardTitle}>{bank ? `${bank} ${brand}` : brand}</Text>
                    <Text style={cardChoiceStyles.cardSub}>•••• {card.last4 ?? '----'}</Text>
                  </View>
                  {card.is_default ? <Text style={cardChoiceStyles.defaultTag}>Varsayılan</Text> : null}
                </TouchableOpacity>
              );
            })}

            <Pressable
              style={[cardChoiceStyles.payBtn, (!selectedCardId || payBusy) && cardChoiceStyles.payBtnDisabled]}
              disabled={!selectedCardId || payBusy}
              onPress={() => selectedCardId && startSavedCardPay(selectedCardId)}
            >
              {payBusy ? (
                <ActivityIndicator color="#1a3d00" />
              ) : (
                <Text style={cardChoiceStyles.payBtnText}>Bu Kartla Öde</Text>
              )}
            </Pressable>

            <TouchableOpacity onPress={() => setStage('new_card')} disabled={payBusy}>
              <Text style={cardChoiceStyles.newCardLink}>Farklı / yeni kart ile öde</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : stage === 'new_card' ? (
          <ScrollView contentContainerStyle={cardChoiceStyles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={cardChoiceStyles.title}>Yeni Kart ile Ödeme</Text>
            <Text style={cardChoiceStyles.subtitle}>
              Kart bilgilerinizi PaynKolay'ın güvenli sayfasında gireceksiniz.
            </Text>

            <TouchableOpacity
              style={cardChoiceStyles.checkboxRow}
              onPress={() => setSaveNewCard((v) => !v)}
              activeOpacity={0.7}
              disabled={payBusy}
            >
              <View style={[cardChoiceStyles.checkbox, saveNewCard && cardChoiceStyles.checkboxChecked]}>
                {saveNewCard ? <Text style={cardChoiceStyles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={cardChoiceStyles.checkboxLabel}>Kartımı sonraki ödemeler için kaydet</Text>
            </TouchableOpacity>

            <Pressable
              style={[cardChoiceStyles.payBtn, payBusy && cardChoiceStyles.payBtnDisabled]}
              disabled={payBusy}
              onPress={() => startHostedInit(saveNewCard)}
            >
              {payBusy ? (
                <ActivityIndicator color="#1a3d00" />
              ) : (
                <Text style={cardChoiceStyles.payBtnText}>Ödemeye Geç</Text>
              )}
            </Pressable>

            {savedCards.length > 0 ? (
              <TouchableOpacity onPress={() => setStage('choose_card')} disabled={payBusy}>
                <Text style={cardChoiceStyles.newCardLink}>Kayıtlı kartımla öde</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        ) : (
          <View style={paytrStyles.loaderWrap}>
            {initError ? (
              <>
                <Text style={paytrStyles.errorText}>{initError}</Text>
                <Pressable style={paytrStyles.retryBtn} onPress={() => navigation.goBack()}>
                  <Text style={paytrStyles.retryText}>Geri Dön</Text>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={COLORS.brand.green} />
                <Text style={paytrStyles.loaderText}>Ödeme sayfası hazırlanıyor…</Text>
              </>
            )}
          </View>
        )}
      </View>

      {verifying ? (
        <View style={paytrStyles.verifyingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={paytrStyles.verifyingText}>Ödeme onaylanıyor…</Text>
        </View>
      ) : null}
    </View>
  );
}

const paytrStyles = StyleSheet.create({
  container: { backgroundColor: '#000' },
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
});

const cardChoiceStyles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, backgroundColor: '#fff' },
  title: {
    fontSize: 18, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000000', marginBottom: 4,
  },
  subtitle: { fontSize: 13, color: COLORS.text.secondary, marginBottom: 8 },

  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)',
    padding: 14,
  },
  cardRowSelected: { borderColor: COLORS.brand.green, backgroundColor: 'rgba(198,240,79,0.08)' },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: COLORS.brand.green, alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.brand.green },
  cardTitle: { fontSize: 14, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  cardSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 2 },
  defaultTag: { fontSize: 11, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.tertiary },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.brand.green, borderColor: COLORS.brand.green },
  checkboxMark: { fontSize: 13, fontWeight: '700', color: '#1a3d00' },
  checkboxLabel: { fontSize: 13, color: '#000000', flex: 1 },

  payBtn: {
    height: 54, borderRadius: 100, backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  payBtnDisabled: { backgroundColor: '#d0e8a0' },
  payBtnText: { fontSize: 15, fontWeight: '700', fontFamily: 'PlusJakartaSans_700Bold', color: '#1a3d00' },

  newCardLink: {
    fontSize: 13, fontWeight: '600', fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.secondary, textAlign: 'center', marginTop: 12,
  },
});
