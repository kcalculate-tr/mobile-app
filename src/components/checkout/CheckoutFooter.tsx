import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowRight, Check, Plus, Truck } from 'phosphor-react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

const NEON = COLORS.brand.green;
const PANEL = '#000000';
const BAR_H = 5;

interface Props {
  /** Buton etiketi — tutar AYRI verilir, araya nokta/ayraç konmaz. */
  label: string;
  priceText?: string | null;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  bottomInset: number;

  /** İlerleme şeridi — teslimat bölgesi dışındaysa gizlenir. */
  showProgress?: boolean;
  cartTotal?: number;
  minOrderAmount?: number;
  freeDeliveryThreshold?: number;

  /** Sözleşme onayı — yalnızca özet adımında gösterilir. */
  /** Hedefin altındayken "Ürün Ekle" kısayolu. */
  onAddProducts?: () => void;

  showContracts?: boolean;
  contractsAccepted?: boolean;
  /** Onaylanmadan sipariş denendiyse gösterilecek uyarı. */
  contractsError?: string | null;
  onToggleContracts?: () => void;
  onPressTerms?: () => void;
  onPressDistanceSales?: () => void;
}

const lira = (v: number) => `₺${Math.ceil(v).toLocaleString('tr-TR')}`;

export default function CheckoutFooter({
  label,
  priceText,
  onPress,
  disabled = false,
  loading = false,
  bottomInset,
  showProgress = false,
  cartTotal = 0,
  minOrderAmount = 0,
  freeDeliveryThreshold = 0,
  onAddProducts,
  showContracts = false,
  contractsAccepted = false,
  contractsError,
  onToggleContracts,
  onPressTerms,
  onPressDistanceSales,
}: Props) {
  const ilerleme = useRef(new Animated.Value(0)).current;

  const esikVar = freeDeliveryThreshold > 0;
  const minAltinda = minOrderAmount > 0 && cartTotal < minOrderAmount;
  const ucretsizAltinda = esikVar && !minAltinda && cartTotal < freeDeliveryThreshold;
  const kazanildi = !minAltinda && !ucretsizAltinda;

  const hedef = minAltinda ? minOrderAmount : freeDeliveryThreshold;
  const kalan = Math.max(hedef - cartTotal, 0);
  const yuzde = kazanildi ? 100 : Math.min((cartTotal / Math.max(hedef, 1)) * 100, 100);

  // Şerit gizliyken (ör. Gel-Al) animasyon çalıştırmanın anlamı yok ve
  // blok yeniden mount olduğunda Animated.Value eski konumunda takılı
  // kalıyordu — "Ücretsiz teslimat kazandınız" yazarken bar yarıda
  // duruyordu. Gizliyken ve yeniden görünür olurken değer DOĞRUDAN yazılır;
  // animasyon yalnızca şerit zaten ekrandayken çalışır.
  const oncekiGorunurRef = useRef(showProgress);
  useEffect(() => {
    const yenidenGorunur = showProgress && !oncekiGorunurRef.current;
    oncekiGorunurRef.current = showProgress;

    if (!showProgress || yenidenGorunur) {
      ilerleme.setValue(yuzde);
      return;
    }

    Animated.timing(ilerleme, {
      toValue: yuzde,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      // Animasyon yarıda kesildiyse (ör. blok unmount olup değere bağlı son
      // düğüm koptuysa) değer donmasın, hedefe otursun.
      if (!finished) ilerleme.setValue(yuzde);
    });
  }, [yuzde, showProgress, ilerleme]);

  const genislik = ilerleme.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={[s.panel, { paddingBottom: Math.max(20, bottomInset + 12) }]}>
      {showProgress ? (
        <View style={s.ilerlemeBlok}>
          <View style={s.ilerlemeSatir}>
            {kazanildi ? (
              <Check size={13} color={NEON} weight="bold" />
            ) : (
              <Truck size={13} color={NEON} weight="fill" />
            )}
            {kazanildi ? (
              <Text style={s.ilerlemeMetin}>
                <Text style={s.vurgu}>Ücretsiz teslimat</Text> kazandınız
              </Text>
            ) : (
              <Text style={s.ilerlemeMetin}>
                {minAltinda ? 'Minimum sipariş tutarına' : 'Ücretsiz teslimata'}{' '}
                <Text style={s.vurgu}>{lira(kalan)}</Text> kaldı
              </Text>
            )}

            {/* Hedefin altındaki müşterinin tek ihtiyacı ürün eklemek —
                kısayol mesajın yanında, tek dokunuşta katalog. */}
            {!kazanildi && onAddProducts ? (
              <TouchableOpacity
                onPress={onAddProducts}
                activeOpacity={0.75}
                style={s.ekleBtn}
                hitSlop={8}
              >
                <Plus size={11} color="#000000" weight="bold" />
                <Text style={s.ekleBtnMetin}>Ürün Ekle</Text>
                <ArrowRight size={11} color="#000000" weight="bold" />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={s.ray}>
            <Animated.View style={[s.dolgu, { width: genislik }]} />
          </View>
        </View>
      ) : null}

      {showContracts ? (
        <Pressable
          onPress={onToggleContracts}
          style={({ pressed }) => [s.sozlesmeSatir, pressed && { opacity: 0.75 }]}
          hitSlop={6}
        >
          <View
            style={[
              s.kutu,
              contractsAccepted && s.kutuAktif,
              !contractsAccepted && !!contractsError && s.kutuHatali,
            ]}
          >
            {contractsAccepted ? <Check size={13} color="#000000" weight="bold" /> : null}
          </View>
          <Text style={s.sozlesmeMetin}>
            <Text style={s.sozlesmeLink} onPress={onPressTerms}>
              Kullanım Koşulları
            </Text>
            {' ile '}
            <Text style={s.sozlesmeLink} onPress={onPressDistanceSales}>
              Mesafeli Satış Sözleşmesi
            </Text>
            {"'ni"} okudum ve onaylıyorum.
          </Text>
        </Pressable>
      ) : null}

      {showContracts && !contractsAccepted && contractsError ? (
        <Text style={s.sozlesmeHata}>{contractsError}</Text>
      ) : null}

      <TouchableOpacity
        style={[s.buton, disabled && s.butonPasif]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#000000" />
        ) : (
          <View style={s.butonIc}>
            <Text style={[s.butonMetin, disabled && s.butonMetinPasif]} numberOfLines={1}>
              {label}
            </Text>
            {priceText ? (
              // Tutar sağda, zemin katmanı OLMADAN durur: araya "•" ayracı
              // koymaya da, arkasına rozet koymaya da gerek yok — hizalama
              // ayrımı zaten yapıyor (23.09.2026 tasarım notu).
              <Text style={[s.tutarMetin, disabled && s.butonMetinPasif]}>{priceText}</Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  panel: {
    backgroundColor: PANEL,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    zIndex: 10,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },

  ilerlemeBlok: {
    marginBottom: SPACING.md,
  },
  ilerlemeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
  },
  ilerlemeMetin: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.62)',
  },
  ekleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: NEON,
  },
  ekleBtnMetin: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.2,
  },
  vurgu: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: NEON,
  },
  ray: {
    height: BAR_H,
    borderRadius: BAR_H / 2,
    backgroundColor: 'rgba(255,255,255,0.13)',
    overflow: 'hidden',
  },
  dolgu: {
    height: '100%',
    borderRadius: BAR_H / 2,
    backgroundColor: NEON,
  },

  sozlesmeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm + 2,
    marginBottom: SPACING.md,
  },
  kutu: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  kutuAktif: {
    backgroundColor: NEON,
    borderColor: NEON,
  },
  sozlesmeMetin: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.55)',
  },
  kutuHatali: {
    borderColor: '#ff6b6b',
    backgroundColor: 'rgba(255,107,107,0.14)',
  },
  sozlesmeHata: {
    marginTop: -SPACING.sm,
    marginBottom: SPACING.md,
    marginLeft: 32,
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#ff8585',
  },
  sozlesmeLink: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'rgba(255,255,255,0.92)',
    textDecorationLine: 'underline',
  },

  buton: {
    height: 58,
    borderRadius: RADIUS.pill,
    backgroundColor: NEON,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  butonPasif: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  butonIc: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  butonMetin: {
    flexShrink: 1,
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: 0.2,
  },
  butonMetinPasif: {
    color: 'rgba(255,255,255,0.45)',
  },
  tutarMetin: {
    marginLeft: SPACING.md,
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
    letterSpacing: -0.3,
  },
});
