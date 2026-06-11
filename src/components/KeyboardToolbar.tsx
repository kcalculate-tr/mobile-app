import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardEvent,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Global "Kapat" barı — klavye yüksekliğini milimetrik takip eden, absolute
 * konumlu JS overlay. iOS native InputAccessoryView (RN 0.81 / Fabric) cihazda
 * render OLMADIĞI için kanıtlanmış çalışan bu yaklaşıma dönüldü. Tek component
 * tüm ekranları (kart formu dahil) kapsar; per-screen aksesuar gerekmez.
 *
 * Bar, klavyenin tam üstüne (bottom: kbHeight) oturur; full genişlik, siyah
 * "Kapat". iOS'ta keyboardWillShow ile klavye animasyonuyla senkron belirir.
 */
export default function KeyboardToolbar() {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // iOS native klavye ivmesini (e.duration) birebir kopyalayan donanım ivmeli
    // animasyon → bar klavyeyle senkron yükselir/iner (JS lag'i maskeler).
    const onShow = (e: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext({
          duration: e.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setKbHeight(e.endCoordinates?.height ?? 0);
    };
    const onHide = (e: KeyboardEvent) => {
      if (Platform.OS === 'ios') {
        LayoutAnimation.configureNext({
          duration: e.duration || 250,
          update: { type: LayoutAnimation.Types.keyboard },
        });
      }
      setKbHeight(0);
    };

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (kbHeight <= 0) return null;

  return (
    <View style={[styles.bar, { bottom: kbHeight }]}>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={() => Keyboard.dismiss()}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissText}>Kapat</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: '#F6F6F6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  dismissBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dismissText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
});
