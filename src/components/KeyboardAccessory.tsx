import React from 'react';
import {
  Dimensions,
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// Tek paylaşılan native aksesuar ID'si. Tüm iOS text input'ları bu ID'yi
// inputAccessoryViewID ile referanslar; InputAccessoryView bir kez mount edilir.
export const DEFAULT_ACCESSORY_ID = 'kcal_default_accessory';

type Props = { nativeID?: string };

// iOS-only: klavyeye native (UI thread) yapışık "Kapat" barı. Android'de null
// döner — Android'de InputAccessoryView yoktur, oradaki dismiss akışı App.tsx'te
// Platform.OS==='android' koşuluyla korunan eski JS KeyboardToolbar'dan gelir.
export function KeyboardAccessory({ nativeID = DEFAULT_ACCESSORY_ID }: Props) {
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={nativeID}>
      <View style={styles.bar}>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={() => Keyboard.dismiss()}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>Kapat</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

export default KeyboardAccessory;

const styles = StyleSheet.create({
  bar: {
    // Tam pencere genişliği + alignSelf:center → köşe sızıntısı/kayma sıfır.
    width: Dimensions.get('window').width,
    alignSelf: 'center',
    height: 44,
    backgroundColor: '#F6F6F6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D1D1D6',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
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
