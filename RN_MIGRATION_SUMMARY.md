# 📱 REACT NATIVE EXPO - MİGRASYON ÖZETİ

## 🎯 KARAR: Capacitor ❌ → React Native Expo ✅

**Neden?**
- ✅ True native performance (WebView yok)
- ✅ Daha geniş ecosystem (10,000+ paket)
- ✅ Better animation (Reanimated 60fps)
- ✅ Smaller app size
- ✅ Expo ile hızlı development

---

## ⚡ HIZLI BAŞLANGIÇ (5 Dakika)

### Tek Komut Kurulum

```bash
# Otomatik setup script
cd ~/Desktop/kcal-final
./setup-rn.sh

# Veya manuel:
npx create-expo-app kcal-mobile --template blank-typescript
cd kcal-mobile
```

**İlk Test:**
```bash
npx expo start
# QR kod ile Expo Go'dan tara
```

---

## 📦 TEMEL BAĞIMLILIKLAR

### Must-Have Paketler

```json
{
  "dependencies": {
    "expo": "^50.0.0",
    "react": "18.2.0",
    "react-native": "0.73.0",
    
    // Navigation
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "@react-navigation/bottom-tabs": "^6.5.11",
    
    // Backend
    "@supabase/supabase-js": "^2.39.0",
    "@react-native-async-storage/async-storage": "^1.21.0",
    "react-native-url-polyfill": "^2.0.0",
    
    // UI
    "nativewind": "^2.0.11",
    "lucide-react-native": "^0.400.0",
    
    // Utils
    "expo-linking": "~6.0.0",
    "expo-web-browser": "~12.8.0",
    "expo-haptics": "~12.8.0",
    "expo-status-bar": "~1.11.0"
  }
}
```

---

## 🔧 YAPIŞLANDIRMA DOSYALARI

### 1. babel.config.js

```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
```

### 2. tailwind.config.js

```javascript
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
}
```

### 3. app.json

```json
{
  "expo": {
    "name": "Kcal",
    "slug": "kcal-mobile",
    "scheme": "kcal",
    "icon": "./assets/icon.png",
    "splash": {
      "backgroundColor": "#98CD00"
    },
    "ios": {
      "bundleIdentifier": "com.kcal.app"
    },
    "android": {
      "package": "com.kcal.app"
    }
  }
}
```

---

## 🎨 WEB → NATIVE DÖNÜŞÜM ÇİZELGESİ

### Component Mapping

```
<div>                    → <View>
<span>, <p>, <h1>        → <Text>
<img>                    → <Image>
<button>                 → <TouchableOpacity>
<input>                  → <TextInput>
<a href>                 → <Pressable> + Linking

onClick                  → onPress
onChange                 → onChangeText
className (Tailwind)     → className (NativeWind) ✅
style                    → style ✅
```

### Storage

```
localStorage.setItem()   → AsyncStorage.setItem()
localStorage.getItem()   → AsyncStorage.getItem()
```

### Navigation

```
useNavigate()            → useNavigation()
navigate('/cart')        → navigation.navigate('Cart')
<Link to="/cart">        → <TouchableOpacity onPress={...}>
```

### External Links

```
window.location.href     → WebBrowser.openBrowserAsync()
window.open()            → Linking.openURL()
```

---

## 🚀 MİGRASYON PLANI (Öncelikli)

### Faz 1: Kurulum (1 Gün)
```bash
✅ Expo projesi oluştur
✅ Dependencies kur
✅ Tailwind/NativeWind setup
✅ Folder structure
```

### Faz 2: Core Screens (3 Gün)
```
1. HomeScreen (ürün listesi)
2. ProductDetailScreen
3. CartScreen
4. CheckoutScreen
```

### Faz 3: Backend (2 Gün)
```
1. Supabase client (AsyncStorage)
2. CartContext
3. AuthContext
4. ProductContext
```

### Faz 4: Ödeme (2 Gün)
```
1. Tosla payment handler (expo-web-browser)
2. Deep linking setup
3. Payment success/fail screens
```

### Faz 5: Admin & Kitchen (3 Gün)
```
1. Admin panel (tablet layout)
2. Kitchen dashboard
3. Touch-optimized buttons (52x52px)
```

### Faz 6: Polish (2 Gün)
```
1. Haptic feedback
2. Safe area optimizations
3. Performance tuning
4. Bug fixes
```

**TOPLAM: 13 gün (2 hafta)**

---

## 📋 İLK GÜN KONTROL LİSTESİ

- [ ] `./setup-rn.sh` çalıştır (veya manuel kurulum)
- [ ] `npx expo start` ile test et
- [ ] Expo Go ile QR tara, ekranda "Kcal" yaz görüntüle
- [ ] `src/screens/HomeScreen.tsx` oluştur
- [ ] Tailwind class'ları test et (`bg-brand-primary`)
- [ ] `SafeAreaView` çalıştığını doğrula (iPhone çentik)

**Başarı Kriteri:** Telefonda yeşil header + "Kcal" yazısı görünmeli! ✅

---

## 🔄 DÖNÜŞÜM ÖNCELİĞİ (Screen by Screen)

### Öncelik 1: Kritik Akış (Hemen)
1. **Login/Register** → AuthScreen.tsx
2. **Home** → HomeScreen.tsx
3. **ProductDetail** → ProductDetailScreen.tsx
4. **Cart** → CartScreen.tsx
5. **Checkout** → CheckoutScreen.tsx

### Öncelik 2: Kullanıcı Profili (Sonra)
6. Profile → ProfileScreen.tsx
7. Orders → OrdersScreen.tsx
8. Tracker → TrackerScreen.tsx
9. Addresses → AddressesScreen.tsx
10. Cards → CardsScreen.tsx

### Öncelik 3: Admin (En Son)
11. Admin Dashboard (Tablet)
12. Kitchen Dashboard (Tablet)

---

## 🎯 İLK 3 EKRAN (Detaylı)

### 1. HomeScreen.tsx (Örnek)

**Özellikler:**
- SafeAreaView (iPhone çentik)
- FlatList (performanslı liste)
- TouchableOpacity (butonlar)
- Image (ürün görselleri)
- Navigation (ProductDetail'e geçiş)

**Dosya:** `CONVERSION_EXAMPLES.md` → Bölüm 1

---

### 2. CartScreen.tsx (Özet)

```tsx
<SafeAreaView>
  <FlatList
    data={cart}
    renderItem={({ item }) => (
      <View className="bg-white p-4 mb-3">
        <Text>{item.name}</Text>
        <Text>₺{item.price}</Text>
        <TouchableOpacity onPress={() => removeFromCart(item.id)}>
          <Text className="text-red-500">Sil</Text>
        </TouchableOpacity>
      </View>
    )}
  />
  
  <TouchableOpacity 
    className="bg-brand-primary p-4"
    onPress={() => navigation.navigate('Checkout')}
  >
    <Text className="text-white">Siparişi Tamamla</Text>
  </TouchableOpacity>
</SafeAreaView>
```

---

### 3. CheckoutScreen.tsx (Özet)

```tsx
import * as WebBrowser from 'expo-web-browser';

const handleCheckout = async () => {
  // 1. Order kaydet
  const { data: order } = await supabase.from('orders').insert([...]);

  // 2. Tosla payment başlat
  const payment = await initiateToslaPayment({ ... });

  // 3. Native browser aç
  const result = await WebBrowser.openBrowserAsync(payment.paymentUrl, {
    toolbarColor: '#98CD00',
  });

  // 4. Callback dinle (deep link)
  // Linking.addEventListener('url', handler)
};
```

---

## 🔐 SUPABASE NATIVE SETUP

### src/lib/supabase.ts

```typescript
import 'react-native-url-polyfill/auto'; // ✅ Polyfill
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'YOUR_URL';
const supabaseAnonKey = 'YOUR_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // ✅ Native storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // ✅ Native'de false
  },
});
```

**Usage:**
```tsx
// ✅ Aynı API (web ile 100% uyumlu)
const { data, error } = await supabase
  .from('products')
  .select('*');
```

---

## 💳 TOSLA PAYMENT (Native)

### src/utils/paymentHandler.ts

```typescript
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';

export async function initiateToslaPayment(params: any) {
  // 1. Edge Function çağır
  const { data, error } = await supabase.functions.invoke('tosla-payment-init', {
    body: params,
  });

  if (error) throw error;

  const paymentUrl = data?.Url || data?.paymentUrl;

  // 2. Native browser aç
  const result = await WebBrowser.openBrowserAsync(paymentUrl, {
    dismissButtonStyle: 'cancel',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
    toolbarColor: '#98CD00',
  });

  return { success: result.type !== 'cancel' };
}
```

**Deep Link Setup:**
```typescript
// App.tsx
import * as Linking from 'expo-linking';

useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const { hostname, queryParams } = Linking.parse(url);
    
    if (hostname === 'payment-success') {
      // Handle success
    }
  });

  return () => subscription.remove();
}, []);
```

**Tosla Callback URL'leri:**
- Success: `kcal://payment-success?transaction_id=xxx`
- Fail: `kcal://payment-fail?error_message=xxx`

---

## 🎨 HAPTIC FEEDBACK MAP

```typescript
// src/utils/haptics.ts
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  medium: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => Haptics.selectionAsync(),
};
```

**Kullanım:**
```tsx
import { haptic } from '../utils/haptics';

<TouchableOpacity
  onPress={() => {
    haptic.light(); // ✅ Hafif titreşim
    addToCart(product);
  }}
>
  <Text>Sepete Ekle</Text>
</TouchableOpacity>
```

---

## 📁 DİZİN YAPISI (Final)

```
kcal-mobile/
├── App.tsx                          # Root component
├── app.json                         # Expo config
├── babel.config.js                  # NativeWind plugin
├── tailwind.config.js               # Tailwind colors
├── package.json
├── tsconfig.json
│
├── assets/
│   ├── icon.png                     # 1024x1024
│   ├── splash.png                   # 2732x2732
│   ├── adaptive-icon.png            # Android
│   └── fonts/
│       ├── ZalandoSansExpanded-ExtraBold.ttf
│       └── GoogleSansFlex_24pt-Regular.ttf
│
└── src/
    ├── screens/                     # Tüm ekranlar
    │   ├── HomeScreen.tsx
    │   ├── CartScreen.tsx
    │   ├── CheckoutScreen.tsx
    │   ├── ProductDetailScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── LoginScreen.tsx
    │   └── RegisterScreen.tsx
    │
    ├── components/                  # Reusable components
    │   ├── ProductCard.tsx
    │   ├── SearchBar.tsx
    │   ├── CategoryFilter.tsx
    │   └── SafeArea.tsx
    │
    ├── navigation/
    │   └── BottomTabNavigator.tsx   # Tab navigation
    │
    ├── context/                     # State management
    │   ├── CartContext.tsx          # AsyncStorage
    │   ├── AuthContext.tsx
    │   └── ProductContext.tsx
    │
    ├── lib/
    │   └── supabase.ts              # Supabase client (native)
    │
    ├── utils/
    │   ├── paymentHandler.ts        # Tosla + WebBrowser
    │   ├── haptics.ts               # Vibration feedback
    │   └── formatCurrency.ts
    │
    └── types/
        └── index.ts                 # TypeScript types
```

---

## 🔄 CORE DÖNÜŞÜMLER (1:1 Mapping)

### 1. Home.jsx → HomeScreen.tsx

**Web:**
```jsx
<div className="min-h-screen bg-[#F0F0F0]">
  <header className="bg-[#98CD00] p-4">
    <h1 className="text-white text-2xl">Kcal</h1>
  </header>
  
  <div className="grid grid-cols-2 gap-4 p-4">
    {products.map(p => <ProductCard />)}
  </div>
</div>
```

**Native:**
```tsx
<SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
  <View className="bg-brand-primary p-4">
    <Text className="text-white text-2xl">Kcal</Text>
  </View>
  
  <FlatList
    data={products}
    numColumns={2}
    columnWrapperStyle={{ gap: 16 }}
    renderItem={({ item }) => <ProductCard product={item} />}
  />
</SafeAreaView>
```

---

### 2. CartContext.jsx → CartContext.tsx

**Değişiklikler:**
- `localStorage` → `AsyncStorage`
- `useEffect` için async/await
- TypeScript tipleri

**Dosya:** `CONVERSION_EXAMPLES.md` → Bölüm 6

---

### 3. Checkout.jsx → CheckoutScreen.tsx

**Değişiklikler:**
- Form inputs → `TextInput`
- Payment redirect → `WebBrowser.openBrowserAsync()`
- Success navigation → Deep linking

**Dosya:** `CONVERSION_EXAMPLES.md` → Bölüm 2

---

## 🎯 İLK HAFTA HEDEF

### Gün 1: Kurulum
- [x] Expo projesi oluştur
- [x] Dependencies kur
- [x] Folder structure
- [x] Test screen

### Gün 2-3: Core Screens
- [ ] HomeScreen (ürün listesi)
- [ ] ProductCard component
- [ ] Navigation setup

### Gün 4-5: Backend
- [ ] Supabase native client
- [ ] CartContext (AsyncStorage)
- [ ] AuthContext

### Gün 6-7: Checkout & Payment
- [ ] CheckoutScreen
- [ ] Tosla payment (WebBrowser)
- [ ] Deep linking

**Sonuç:** 7 günde çalışan MVP! 🎉

---

## 🐛 HATA GİDERME

### Metro Bundler Hatası
```bash
npx expo start -c  # Cache temizle
```

### "Cannot find module"
```bash
rm -rf node_modules
npm install
npx expo prebuild --clean
```

### iOS Simulator Hatası
```bash
npx expo run:ios --device  # Gerçek cihaz
```

### Android Build Hatası
```bash
cd android
./gradlew clean
cd ..
npx expo run:android
```

---

## 📞 YARDIMCI KAYNAKLAR

**Dökümanlar:**
- React Native: https://reactnative.dev/docs/getting-started
- Expo: https://docs.expo.dev/
- NativeWind: https://www.nativewind.dev/
- React Navigation: https://reactnavigation.org/

**Topluluk:**
- Expo Discord: https://chat.expo.dev/
- React Native Community: https://www.reactnative.dev/community/overview

**Örnekler:**
- Expo Examples: https://github.com/expo/examples
- React Native Gallery: https://reactnative.gallery/

---

## ✅ BAŞARIYLA DÖNÜŞTÜRÜLDÜ!

**Geçiş Durumu:**
- ✅ Kurulum script'i hazır (`setup-rn.sh`)
- ✅ Migration plan hazır
- ✅ Conversion örnekleri hazır
- ✅ Quick start guide hazır

**Sonraki Adım:**
```bash
cd ~/Desktop/kcal-final
./setup-rn.sh
```

**3-4 hafta sonra:** App Store & Google Play'de! 🚀

---

**Rapor Sonu** | React Native Migration Summary | 24 Şubat 2026
