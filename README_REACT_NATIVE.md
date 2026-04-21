# 📱 KCAL - REACT NATIVE EXPO MİGRASYONU

> Web React uygulamasından React Native (Expo) native mobil uygulamasına tam geçiş rehberi

---

## 🎯 ÖZET

**Karar:** Capacitor ❌ → React Native (Expo) ✅

**Neden React Native?**
- ✅ True native performance (WebView yok)
- ✅ 60fps animasyonlar (Reanimated)
- ✅ Geniş ecosystem (10,000+ paket)
- ✅ Better UX (haptic, gestures, native feel)
- ✅ App Store ready (iOS + Android)

**Tahmini Süre:** 3-4 hafta

---

## 📚 DÖKÜMANTASYON (Sıralı Oku)

### 🚀 Başlangıç (İlk Oku)
1. **`RN_MIGRATION_SUMMARY.md`** - Genel bakış, hızlı başlangıç
2. **`QUICK_START_RN.md`** - 5 dakikada test projesi kurulum
3. **`WEB_VS_NATIVE_COMPARISON.md`** - Web vs Native karşılaştırma

### 🔄 Dönüşüm Rehberi
4. **`CONVERSION_EXAMPLES.md`** - 14 bölüm halinde dönüşüm örnekleri
5. **`REACT_NATIVE_MIGRATION.md`** - Detaylı adım adım migration plan

### 🛠️ Kurulum
6. **`setup-rn.sh`** - Otomatik kurulum scripti (çalıştırılabilir)

---

## ⚡ HIZLI BAŞLANGIÇ (5 Dakika)

### Seçenek 1: Otomatik Setup

```bash
cd ~/Desktop/kcal-final
./setup-rn.sh
```

Bu script:
- ✅ Yeni Expo projesi oluşturur (`~/Desktop/kcal-mobile`)
- ✅ Tüm dependencies kurar
- ✅ Tailwind/NativeWind yapılandırır
- ✅ Folder structure oluşturur
- ✅ Test screen ekler

### Seçenek 2: Manuel Kurulum

```bash
# 1. Yeni proje
npx create-expo-app kcal-mobile --template blank-typescript
cd kcal-mobile

# 2. Dependencies (tek komut)
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill nativewind lucide-react-native

npx expo install react-native-screens react-native-safe-area-context expo-linking expo-web-browser expo-haptics expo-status-bar

npm install --save-dev tailwindcss@3.3.2
npx tailwindcss init
```

### İlk Test

```bash
npx expo start
# QR kodu Expo Go ile tara
```

**Başarı Kriteri:** Yeşil header + "Kcal" yazısı görünmeli! ✅

---

## 📁 PROJE YAPISI

```
kcal-mobile/
├── App.tsx                          # Root
├── app.json                         # Expo config
├── babel.config.js                  # NativeWind
├── tailwind.config.js               # Brand colors
│
├── assets/
│   ├── icon.png (1024x1024)
│   ├── splash.png (2732x2732)
│   └── fonts/
│
└── src/
    ├── screens/                     # Tüm ekranlar
    │   ├── HomeScreen.tsx
    │   ├── CartScreen.tsx
    │   ├── CheckoutScreen.tsx
    │   ├── ProductDetailScreen.tsx
    │   └── ProfileScreen.tsx
    │
    ├── components/                  # Reusable
    │   ├── ProductCard.tsx
    │   └── SearchBar.tsx
    │
    ├── navigation/
    │   └── BottomTabNavigator.tsx
    │
    ├── context/                     # State (AsyncStorage)
    │   ├── CartContext.tsx
    │   ├── AuthContext.tsx
    │   └── ProductContext.tsx
    │
    ├── lib/
    │   └── supabase.ts              # Native client
    │
    └── utils/
        ├── paymentHandler.ts        # Tosla + WebBrowser
        └── haptics.ts               # Vibration
```

---

## 🔄 DÖNÜŞÜM HAR İTASI

### Web → Native Component Mapping

```
<div>                 → <View>
<span>, <p>, <h1>     → <Text>
<img>                 → <Image>
<button onClick>      → <TouchableOpacity onPress>
<input onChange>      → <TextInput onChangeText>

localStorage          → AsyncStorage
useNavigate()         → useNavigation()
navigate('/cart')     → navigation.navigate('Cart')
window.location.href  → WebBrowser.openBrowserAsync()
```

### Örnek: Home.jsx → HomeScreen.tsx

**Önce (Web):**
```jsx
<div className="min-h-screen bg-[#F0F0F0]">
  <header className="bg-[#98CD00] p-4">
    <h1 className="text-white text-2xl">Kcal</h1>
  </header>
  
  <div className="grid grid-cols-2 gap-4">
    {products.map(p => <ProductCard />)}
  </div>
</div>
```

**Sonra (Native):**
```tsx
<SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
  <View className="bg-brand-primary p-4">
    <Text className="text-white text-2xl">Kcal</Text>
  </View>
  
  <FlatList
    data={products}
    numColumns={2}
    renderItem={({ item }) => <ProductCard product={item} />}
  />
</SafeAreaView>
```

**Değişiklikler:**
1. `div` → `View`
2. `h1` → `Text`
3. `grid` → `FlatList` (performans için)
4. `min-h-screen` → `flex-1` + `SafeAreaView`

---

## 💳 ÖDEME ENTEGRASYONU (TOSLA)

### Web (Önce)
```jsx
const handlePay = () => {
  window.location.href = paymentUrl; // ❌ Tab kaybı
};
```

### Native (Sonra)
```tsx
import * as WebBrowser from 'expo-web-browser';

const handlePay = async () => {
  const result = await WebBrowser.openBrowserAsync(paymentUrl, {
    toolbarColor: '#98CD00',
  });
  
  if (result.type === 'cancel') {
    Alert.alert('Ödeme iptal edildi');
  }
};
```

**Callback (Deep Link):**
```tsx
// App.tsx
useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    if (url.includes('payment-success')) {
      // Success handler
    }
  });
  return () => subscription.remove();
}, []);
```

**Tosla Callback URL:**
- Success: `kcal://payment-success?transaction_id=xxx`
- Fail: `kcal://payment-fail?error_message=xxx`

---

## 📊 DÖNÜŞÜM TAKVİMİ

### Week 1: Core Setup
- [x] Expo project init
- [x] Dependencies
- [ ] HomeScreen
- [ ] ProductCard component
- [ ] Navigation

### Week 2: Backend
- [ ] Supabase native client
- [ ] CartContext (AsyncStorage)
- [ ] AuthContext
- [ ] Checkout + Payment

### Week 3: Admin & Kitchen
- [ ] Admin panel (tablet)
- [ ] Kitchen dashboard
- [ ] Touch-optimized (52x52px buttons)

### Week 4: Polish & Deploy
- [ ] Haptic feedback
- [ ] Safe area fixes
- [ ] Performance tuning
- [ ] TestFlight/Play Store beta

---

## 🎯 KRİTİK ÖNCELIKLER

### Önce (Hemen)
1. **HomeScreen** - Ürün listesi (FlatList)
2. **CartScreen** - Sepet yönetimi (AsyncStorage)
3. **CheckoutScreen** - Ödeme (WebBrowser)
4. **Auth** - Login/Register

### Sonra
5. Profile & Settings
6. Orders & Tracking
7. Admin Panel
8. Kitchen Dashboard

---

## 🔧 TEKNİK DETAYLAR

### Supabase Native Setup

```typescript
// src/lib/supabase.ts
import 'react-native-url-polyfill/auto'; // ✅ Polyfill
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage, // ✅ Native storage
    detectSessionInUrl: false, // ✅ Native'de false
  },
});
```

### CartContext (AsyncStorage)

```typescript
// src/context/CartContext.tsx
const [cart, setCart] = useState([]);

useEffect(() => {
  const loadCart = async () => {
    const stored = await AsyncStorage.getItem('@kcal_cart');
    if (stored) setCart(JSON.parse(stored));
  };
  loadCart();
}, []);

useEffect(() => {
  AsyncStorage.setItem('@kcal_cart', JSON.stringify(cart));
}, [cart]);
```

### Haptic Feedback

```typescript
import * as Haptics from 'expo-haptics';

<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(product);
  }}
>
  <Text>Sepete Ekle</Text>
</TouchableOpacity>
```

---

## 📱 BUILD & DEPLOY

### EAS Build Setup

```bash
# EAS CLI kur
npm install -g eas-cli
eas login

# Build config
eas build:configure

# iOS build
eas build --platform ios --profile preview

# Android build
eas build --platform android --profile preview

# Production
eas build --platform all --profile production
```

### TestFlight (iOS)

```bash
eas submit --platform ios
```

### Google Play (Android)

```bash
eas submit --platform android
```

---

## 🐛 SIKÇA SORULAN SORULAR

### Q: Expo Go'da görünmüyor?
```bash
npx expo start -c  # Cache temizle
```

### Q: AsyncStorage hatası?
```bash
npx expo install @react-native-async-storage/async-storage
```

### Q: Supabase bağlanmıyor?
```typescript
// Polyfill ekledin mi?
import 'react-native-url-polyfill/auto';
```

### Q: Tailwind class'ları çalışmıyor?
```javascript
// babel.config.js kontrol et
plugins: ['nativewind/babel']
```

---

## 📞 YARDIMCI KAYNAKLAR

### Dökümanlar
- [React Native](https://reactnative.dev/docs/getting-started)
- [Expo](https://docs.expo.dev/)
- [NativeWind](https://www.nativewind.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase RN](https://supabase.com/docs/guides/with-react-native)

### Örnekler
- Expo Examples: https://github.com/expo/examples
- React Native Gallery: https://reactnative.gallery/

### Topluluk
- Expo Discord: https://chat.expo.dev/
- Stack Overflow: `react-native` tag

---

## ✅ GEÇİŞ DURUMU

### Tamamlandı ✅
- [x] Migration plan oluşturuldu
- [x] Conversion örnekleri hazırlandı
- [x] Setup script hazırlandı
- [x] Dökümanlar tamamlandı

### Bekliyor ⏳
- [ ] `./setup-rn.sh` çalıştır
- [ ] İlk screen'i oluştur
- [ ] Supabase client kur
- [ ] Ödeme entegrasyonu

---

## 🚀 İLK ADIM

```bash
cd ~/Desktop/kcal-final
./setup-rn.sh
```

**Sonra:**
1. `QUICK_START_RN.md` dosyasını oku
2. `CONVERSION_EXAMPLES.md` dosyasından örneklere bak
3. İlk screen'i oluştur (HomeScreen.tsx)
4. Test et (`npx expo start`)

---

## 📊 BAŞARI METRİKLERİ

**Hedef (4 hafta sonra):**
- ✅ iOS + Android native app
- ✅ 60fps scroll & animations
- ✅ Haptic feedback
- ✅ App Store ready
- ✅ TestFlight beta

**Long-term:**
- ✅ 10,000+ downloads
- ✅ 4.5+ App Store rating
- ✅ Getir/Trendyol seviyesi UX

---

## 💪 BAŞARILI GEÇİŞ İÇİN İPUÇLARI

1. **Adım Adım İlerle:** Tüm uygulamayı birden dönüştürme, screen by screen git
2. **Test Et:** Her screen'i hemen test et
3. **AsyncStorage:** localStorage'dan farkını anla (async/await)
4. **FlatList Kullan:** Performance için `map()` yerine `FlatList`
5. **SafeAreaView:** Her screen'de kullan (iPhone çentik)
6. **Haptic Ekle:** Premium hissi için tüm etkileşimlere
7. **Dökümanları Oku:** Takılınca dökümanlardan bak

---

## 🎉 SON SÖZ

React Native geçişi ilk başta zor görünebilir, ama:
- ✅ Component yapısı aynı (React)
- ✅ State management aynı (Context/Redux)
- ✅ Tailwind'e benzer (NativeWind)
- ✅ API calls aynı (Supabase)

**Fark sadece:** HTML → Native Components

**3-4 hafta sonra:** App Store'da native uygulamanız! 🚀

---

**Hazırlayan:** Claude Sonnet 4.5  
**Tarih:** 24 Şubat 2026  
**Proje:** Kcal React Native Migration  

**Başarılar dileriz! 🍀**
