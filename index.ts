// KRİTİK: supabase-js v2 React Native'de session persistence için
// spec-uyumlu global URL/URLSearchParams ister (GoTrue cold-start'ta
// refresh token fetch'inde URL parse ediyor). RN'in yerleşik URL'i
// eksik → refresh sessizce patlıyor, persist edilmiş session atılıyor
// → her açılışta yeniden login. Bu import App'ten ve supabase
// client modülünden ÖNCE çalışmalı (Supabase RN resmi şartı).
import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
