# 🚀 REACT NATIVE EXPO - HIZLI BAŞLANGIÇ

## ⚡ 5 DAKİKADA BAŞLA

### 1. Yeni Proje Oluştur

```bash
# Terminal'de yeni dizin
cd ~/Desktop
npx create-expo-app kcal-mobile --template blank-typescript
cd kcal-mobile
```

---

### 2. Bağımlılıkları Kur (Tek Komut)

```bash
# Core
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# Supabase
npm install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill

# UI & Styling
npm install nativewind
npm install --save-dev tailwindcss@3.3.2

# Utils
npx expo install expo-linking expo-web-browser expo-haptics expo-status-bar

# Initialize Tailwind
npx tailwindcss init
```

---

### 3. Dosya Yapısını Kur

```
kcal-mobile/
├── App.tsx
├── app.json
├── babel.config.js
├── tailwind.config.js
├── tsconfig.json
├── assets/
│   ├── icon.png (1024x1024)
│   ├── splash.png (2732x2732)
│   └── fonts/
│       ├── ZalandoSansExpanded-ExtraBold.ttf
│       └── GoogleSansFlex_24pt-Regular.ttf
└── src/
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── CartScreen.tsx
    │   ├── CheckoutScreen.tsx
    │   └── ProfileScreen.tsx
    ├── components/
    │   ├── ProductCard.tsx
    │   └── SafeArea.tsx
    ├── navigation/
    │   └── BottomTabNavigator.tsx
    ├── context/
    │   ├── CartContext.tsx
    │   ├── AuthContext.tsx
    │   └── ProductContext.tsx
    ├── lib/
    │   └── supabase.ts
    └── utils/
        ├── paymentHandler.ts
        └── haptics.ts
```

---

### 4. Kritik Dosyaları Yapılandır

#### babel.config.js
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
```

#### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#F0F0F0',
        'brand-primary': '#98CD00',
        'brand-dark': '#202020',
      },
    },
  },
  plugins: [],
}
```

#### app.json
```json
{
  "expo": {
    "name": "Kcal",
    "slug": "kcal-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#98CD00"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.kcal.app"
    },
    "android": {
      "package": "com.kcal.app"
    }
  }
}
```

---

### 5. İlk Screen'i Oluştur (Test)

**src/screens/HomeScreen.tsx**
```typescript
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-brand-bg">
      <View className="bg-brand-primary rounded-b-3xl p-6">
        <Text className="text-white text-2xl font-bold">
          Kcal 🍽️
        </Text>
        <Text className="text-white/80 text-sm mt-1">
          Sağlıklı yaşam başlasın!
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 mt-4">
        <Text className="text-brand-dark text-lg font-bold mb-4">
          Günün Menüsü
        </Text>

        <TouchableOpacity className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-brand-dark font-bold">Izgara Tavuk</Text>
          <Text className="text-gray-500 text-sm mt-1">500 kcal • 45g protein</Text>
          <Text className="text-brand-primary font-bold mt-2">₺85.00</Text>
        </TouchableOpacity>

        <TouchableOpacity className="bg-white rounded-2xl p-4 mb-3">
          <Text className="text-brand-dark font-bold">Somon Salata</Text>
          <Text className="text-gray-500 text-sm mt-1">420 kcal • 38g protein</Text>
          <Text className="text-brand-primary font-bold mt-2">₺95.00</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
```

**App.tsx** (Minimal)
```typescript
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <HomeScreen />
    </SafeAreaProvider>
  );
}
```

---

### 6. İlk Çalıştırma

```bash
# iOS Simulator (Mac only)
npx expo run:ios

# Android Emulator
npx expo run:android

# Expo Go (en hızlı test)
npx expo start
# QR kodu telefondan tara
```

---

## 🔄 WEB → NATIVE DÖNÜŞÜM ŞABLONhome

### Template 1: Basit Card

**Web:**
```jsx
<div className="bg-white rounded-xl p-4 shadow-sm">
  <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
  <p className="text-gray-600 text-sm">{product.description}</p>
  <button onClick={handleClick} className="bg-brand-primary text-white px-4 py-2 rounded-lg mt-3">
    Sepete Ekle
  </button>
</div>
```

**Native:**
```tsx
<View className="bg-white rounded-xl p-4 shadow-sm">
  <Text className="text-lg font-bold text-gray-900">{product.name}</Text>
  <Text className="text-gray-600 text-sm">{product.description}</Text>
  <TouchableOpacity 
    onPress={handleClick} 
    className="bg-brand-primary rounded-lg mt-3 py-2 px-4"
  >
    <Text className="text-white text-center">Sepete Ekle</Text>
  </TouchableOpacity>
</View>
```

---

### Template 2: Image + Content

**Web:**
```jsx
<div className="flex items-center gap-3">
  <img src={product.image} className="w-20 h-20 rounded-lg" />
  <div>
    <h4 className="font-bold">{product.name}</h4>
    <p className="text-sm text-gray-500">{product.price}</p>
  </div>
</div>
```

**Native:**
```tsx
<View className="flex-row items-center gap-3">
  <Image 
    source={{ uri: product.image }} 
    className="w-20 h-20 rounded-lg" 
  />
  <View>
    <Text className="font-bold">{product.name}</Text>
    <Text className="text-sm text-gray-500">{product.price}</Text>
  </View>
</View>
```

---

### Template 3: Form Input

**Web:**
```jsx
<input
  type="text"
  placeholder="Ad Soyad"
  value={name}
  onChange={(e) => setName(e.target.value)}
  className="w-full px-4 py-3 rounded-xl border border-gray-300"
/>
```

**Native:**
```tsx
<TextInput
  placeholder="Ad Soyad"
  value={name}
  onChangeText={setName}
  className="w-full px-4 py-3 rounded-xl border border-gray-300"
  style={{ fontSize: 16 }} // iOS zoom prevention
/>
```

---

## 🎯 ÖNCELİK SIRASI (Dönüşüm)

### Kritik Path (Önce bunlar)
1. **Auth System** (Login/Register)
2. **Home Screen** (Ürün listesi)
3. **Product Detail**
4. **Cart Screen**
5. **Checkout** (Tosla entegrasyonu)

### İkincil (Sonra)
6. Profile & Settings
7. Orders & Tracker
8. Admin Panel (Tablet)
9. Kitchen Dashboard (Tablet)

---

## 🐛 SIKÇA KARŞILAŞILAN SORUNLAR

### 1. "Invariant Violation: TurboModuleRegistry.getEnforcing"
```bash
# Çözüm: Expo prebuild
npx expo prebuild --clean
```

### 2. "Metro bundler stuck"
```bash
# Cache temizle
npx expo start -c
```

### 3. "Font not loaded"
```typescript
// App.tsx'te font yükleme await et
const [fontsLoaded] = useFonts({
  'Zalando-Bold': require('./assets/fonts/...'),
});

if (!fontsLoaded) return null;
```

### 4. "AsyncStorage undefined"
```typescript
// Polyfill ekle
import 'react-native-url-polyfill/auto';
```

---

## ✅ İLK GÜN KONTROL LİSTESİ

- [ ] `npx create-expo-app kcal-mobile --template blank-typescript`
- [ ] Tüm dependencies kur (yukarıdaki liste)
- [ ] `tailwind.config.js` yapılandır
- [ ] `babel.config.js` güncelle (nativewind plugin)
- [ ] `src/screens/HomeScreen.tsx` oluştur (test için)
- [ ] `npx expo start` çalıştır
- [ ] Expo Go ile telefondan test et

**Sonuç:** İlk gün sonunda çalışan bir ekran göreceksiniz! ✅

---

## 📦 PACKAGE.JSON (Final)

```json
{
  "name": "kcal-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "^50.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@supabase/supabase-js": "^2.39.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "react-native-url-polyfill": "^2.0.0",
    "nativewind": "^2.0.11",
    "expo-linking": "~6.0.0",
    "expo-web-browser": "~12.8.0",
    "expo-haptics": "~12.8.0",
    "expo-status-bar": "~1.11.0"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.45",
    "typescript": "^5.1.3",
    "tailwindcss": "3.3.2"
  }
}
```

---

Detaylı migration plan hazır! İlk adımları atalım mı? 🚀
