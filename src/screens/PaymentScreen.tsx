import React, { useEffect, useRef, useState } from 'react';
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
import { CreditCard, Lock, CaretRight, ArrowLeft } from 'phosphor-react-native';
import ScreenContainer from '../components/ScreenContainer';
import { initPayment } from '../lib/payment';
import { RootStackParamList } from '../navigation/types';
import { haptic } from '../utils/haptics';
import { useCartStore } from '../store/cartStore';
import { usePantryStore } from '../store/pantryStore';
import { getSupabaseClient } from '../lib/supabase';
import { COLORS } from '../constants/theme';
import {
  PAYMENT_PROVIDER,
  PAYTR_FAIL_URL,
  PAYTR_OK_URL,
  PAYTR_INIT_URL,
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
  if (PAYMENT_PROVIDER === 'paytr_iframe') {
    return (
      <PaytrPaymentFlow
        orderId={route.params.orderId}
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
  const addToPantry = usePantryStore((s) => s.addItems);
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

  const completeOrder = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
        })
        .eq('id', orderId);
    } catch (err) {
      console.error('Order update error:', err);
    }
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
    try {
      const initResult = await initPayment(orderId, amount);
      if (!initResult.success || !initResult.threeDSessionId) {
        setError(initResult.error ?? 'Ödeme başlatılamadı.');
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
                autoCapitalize="characters"
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
                  placeholderTextColor={COLORS.text.tertiary}
                />
              </View>
            </View>
          </View>

          {/* Saved Cards */}
          <TouchableOpacity
            style={styles.savedCardsButton}
            onPress={() => navigation.navigate('ProfileSavedCards')}
            activeOpacity={0.8}
          >
            <View style={styles.savedCardsIcon}>
              <CreditCard size={16} color="#1a3d00" />
            </View>
            <Text style={styles.savedCardsText}>Kayıtlı Kart Kullan</Text>
            <CaretRight size={16} color={COLORS.text.tertiary} />
          </TouchableOpacity>

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
                await completeOrder();
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
            source={{ html: webViewHtml ?? '' }}
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
                  await completeOrder();
                  haptic.success();
                  const { items: cartItems } = useCartStore.getState();
                  addToPantry(cartItems.map((item) => ({
                    productId: String(item.productId),
                    name: item.name,
                    calories: item.calories ?? 0,
                    protein: item.protein ?? 0,
                    carbs: item.carbs ?? 0,
                    fat: item.fats ?? 0,
                    quantity: item.quantity,
                    imageUrl: item.img ?? undefined,
                  })));
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

  // Saved Cards Button
  savedCardsButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  savedCardsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedCardsText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1a3d00',
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

function PaytrPaymentFlow({ orderId, orderCode, noticeMessage }: PaytrFlowProps) {
  const navigation = useNavigation<PaymentScreenNavProp>();
  const insets = useSafeAreaInsets();
  const clearCart = useCartStore((s) => s.clearCart);
  const addToPantry = usePantryStore((s) => s.addItems);

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
          return;
        }

        setIframeUrl(json.iframeUrl);
      } catch (err) {
        if (!cancelled) setInitError(err instanceof Error ? err.message : 'Ödeme başlatılamadı.');
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

    await pollOrderConfirmed();

    const cartItems = useCartStore.getState().items;
    if (cartItems.length > 0) {
      addToPantry(cartItems.map((item) => ({
        productId: String(item.productId),
        name: item.name,
        calories: item.calories ?? 0,
        protein: item.protein ?? 0,
        carbs: item.carbs ?? 0,
        fat: item.fats ?? 0,
        quantity: item.quantity,
        imageUrl: item.img ?? undefined,
      })));
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
