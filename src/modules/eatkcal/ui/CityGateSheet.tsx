// T20SignupEat (ekran 1) — şehir kapısı. İlk "Sipariş ver"de bir kez
// gösterilir; İzmir dışı seçimler yalnız yerel "Haber ver" tercihi kaydeder,
// gezinirken (adres/telefon ekranlarına geçerken) hiçbir şey sorulmaz.
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from '../../../components/icons';
import { SPRING, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { useEatkcalRegistration } from '../../profil/useRegistration';
import { CITY_CATALOG } from '../cityGate';
import { addNotifyCity } from '../cityGateStorage';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** İzmir doğrulanınca çağrılır — çağıran taraf kapıyı "geçildi" işaretler ve devam eder. */
  onConfirmed: () => void;
};

export default function CityGateSheet({ visible, onClose, onConfirmed }: Props) {
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const reg = useEatkcalRegistration();
  const [selected, setSelected] = useState<string>('izmir');
  const [notified, setNotified] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const reduced = useReducedMotion();

  // Alttan açılan sayfa: SPRING.sheet ile yukarı yaylanır (TRANSITION.sheet).
  // Azaltılmış harekette anında yerine oturur.
  const anim = useSharedValue(0);
  useEffect(() => {
    if (!visible) {
      anim.value = 0;
      return;
    }
    anim.value = reduced ? 1 : withSpring(1, SPRING.sheet);
  }, [visible, reduced, anim]);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(anim.value, [0, 1], [380, 0]) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: anim.value }));

  const handleNotify = useCallback(async (cityKey: string) => {
    await addNotifyCity(cityKey);
    setNotified((prev) => new Set(prev).add(cityKey));
  }, []);

  const handleContinue = useCallback(async () => {
    if (selected !== 'izmir' || submitting) return;
    setSubmitting(true);
    reg.setCity('izmir');
    // setCity bir sonraki render'a kadar işlenmez; aynı anahtarın sabit
    // olduğunu bildiğimiz için doğrudan sunucuya o anahtarla soruyoruz.
    const ok = await reg.checkCity();
    setSubmitting(false);
    if (ok) onConfirmed();
  }, [selected, submitting, reg, onConfirmed]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { paddingBottom: Math.max(34, insets.bottom + 16) }, sheetStyle]}>
          <View style={styles.handleBar} />
          <Text style={styles.title}>{t('eatkcal.city_gate.title')}</Text>
          <Text style={styles.subtitle}>{t('eatkcal.city_gate.subtitle')}</Text>

          {CITY_CATALOG.map((city) => {
            const label = lang === 'en' ? city.labelEn : city.labelTr;
            const isSelected = selected === city.key;
            const isNotified = notified.has(city.key);
            return (
              <View key={city.key} style={styles.row}>
                <TouchableOpacity
                  style={styles.rowTouchable}
                  activeOpacity={city.active ? 0.7 : 1}
                  onPress={() => city.active && setSelected(city.key)}
                  disabled={!city.active}
                >
                  <Text style={[styles.rowTitle, !city.active && styles.rowTitleMuted]}>{label}</Text>
                  <Text style={styles.rowSub}>
                    {city.active ? t('eatkcal.city_gate.active_note') : t('eatkcal.city_gate.soon')}
                  </Text>
                </TouchableOpacity>
                {city.active ? (
                  isSelected ? (
                    <View style={styles.checkBadge}>
                      <Check size={14} color="#FFFFFF" weight="bold" />
                    </View>
                  ) : null
                ) : (
                  <TouchableOpacity
                    style={styles.notifyBtn}
                    onPress={() => handleNotify(city.key)}
                    disabled={isNotified}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.notifyBtnText}>
                      {isNotified ? t('eatkcal.city_gate.notified') : t('eatkcal.city_gate.notify')}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {reg.status === 'blocked' ? (
            <Text style={styles.error}>{t('eatkcal.city_gate.blocked')}</Text>
          ) : null}
          {reg.status === 'error' ? (
            <Text style={styles.error}>{t('eatkcal.city_gate.error')}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.continueBtn, submitting && styles.continueBtnDisabled]}
            onPress={handleContinue}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>{t('eatkcal.city_gate.continue')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: {
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
  },
  handleBar: { width: 36, height: 5, borderRadius: 3, backgroundColor: '#C3C7CC', alignSelf: 'center', marginTop: 8, marginBottom: 14 },
  title: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 22, color: '#0A0A0A' },
  subtitle: { marginTop: 2, marginBottom: 8, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B6B70' },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E9EBEE',
  },
  rowTouchable: { flex: 1, paddingVertical: 10 },
  rowTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#0A0A0A' },
  rowTitleMuted: { fontFamily: 'PlusJakartaSans_500Medium', color: '#6B6B70' },
  rowSub: { marginTop: 2, fontFamily: 'PlusJakartaSans_400Regular', fontSize: 13, color: '#6B6B70' },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtn: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C3C7CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyBtnText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 13, color: '#0A0A0A' },
  error: { marginTop: 10, fontFamily: 'PlusJakartaSans_500Medium', fontSize: 13, color: '#E5484D' },
  continueBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: { opacity: 0.6 },
  continueBtnText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15, color: '#FFFFFF' },
});
