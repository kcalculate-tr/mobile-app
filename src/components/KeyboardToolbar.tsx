import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Global "Kapat" barı — temiz, yüksek performanslı conditional absolute overlay.
 * Klavye yüksekliğini takip eder, klavyenin tam üstüne (bottom: kbHeight) oturur.
 * Klavye yokken render OLMAZ (return null) → boşuna layout/bellek yükü yok.
 * (LayoutAnimation + sürekli-mount varyantı ağır ekranlarda JS thread darboğazı
 *  yaptığı için bu sade modele dönüldü.)
 */
export default function KeyboardToolbar() {
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: KeyboardEvent) => setKbHeight(e.endCoordinates?.height ?? 0);
    const onHide = () => setKbHeight(0);

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
    width: Dimensions.get('window').width,
    height: 44,
    backgroundColor: '#F6F6F6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    alignSelf: 'center',
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
