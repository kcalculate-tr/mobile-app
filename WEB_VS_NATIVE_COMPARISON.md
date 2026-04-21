# 🆚 WEB vs REACT NATIVE - KARŞILAŞTIRMA TABLOSU

## 🎯 TEMEL FARKLILIKLARI

### 1. COMPONENT DÖNÜŞÜMÜ

| Özellik | Web (React) | Native (React Native) | Zorluk |
|---------|-------------|----------------------|--------|
| **Container** | `<div>` | `<View>` | ✅ Kolay |
| **Text** | `<h1>`, `<p>`, `<span>` | `<Text>` | ✅ Kolay |
| **Image** | `<img src="">` | `<Image source={{ uri: "" }}>` | ⚠️ Orta |
| **Button** | `<button onClick>` | `<TouchableOpacity onPress>` | ✅ Kolay |
| **Input** | `<input onChange>` | `<TextInput onChangeText>` | ⚠️ Orta |
| **Link** | `<a href>` | `<Pressable>` + `Linking` | ⚠️ Orta |
| **List** | `map()` veya `grid` | `FlatList` | ⚠️ Orta |
| **Modal** | `<div>` + `position: fixed` | `<Modal>` component | ✅ Kolay |

---

### 2. STYLING

| Özellik | Web | Native | Notlar |
|---------|-----|--------|--------|
| **CSS Framework** | Tailwind CSS | NativeWind | ✅ Aynı class'lar |
| **Flexbox** | ✅ Tam destek | ✅ Tam destek | `flex-direction: 'row'` default |
| **Grid** | ✅ `grid-cols-2` | ❌ Yok | `FlatList` + `numColumns` kullan |
| **Hover** | ✅ `hover:bg-blue-600` | ❌ Yok | `Pressable` states kullan |
| **Transition** | ✅ `transition-all` | ❌ Yok | Reanimated kullan |
| **Shadow** | ✅ `shadow-lg` | ⚠️ iOS ✅, Android'de `elevation` | Platform spesifik |
| **Backdrop Blur** | ✅ `backdrop-blur-md` | ❌ Yok | Native blur component |
| **Safe Area** | CSS `env()` | `SafeAreaView` | Native component daha iyi |

---

### 3. NAVIGATION

| Özellik | Web (React Router) | Native (React Navigation) |
|---------|-------------------|---------------------------|
| **Import** | `react-router-dom` | `@react-navigation/native` |
| **Hook** | `useNavigate()` | `useNavigation()` |
| **Navigate** | `navigate('/cart')` | `navigation.navigate('Cart')` |
| **Link** | `<Link to="/cart">` | `<TouchableOpacity onPress={...}>` |
| **Params** | `/product/:id` | `navigation.navigate('Product', { id: 123 })` |
| **Back** | `navigate(-1)` | `navigation.goBack()` |
| **Modal** | `<Route>` | `presentation: 'modal'` |

---

### 4. DATA PERSISTENCE

| Özellik | Web | Native |
|---------|-----|--------|
| **Storage API** | `localStorage` | `AsyncStorage` |
| **Set Item** | `localStorage.setItem('key', 'value')` | `await AsyncStorage.setItem('key', 'value')` |
| **Get Item** | `localStorage.getItem('key')` | `await AsyncStorage.getItem('key')` |
| **Remove** | `localStorage.removeItem('key')` | `await AsyncStorage.removeItem('key')` |
| **Async?** | ❌ Senkron | ✅ Asenkron (await gerekli) |
| **Max Size** | ~5-10 MB | ~6 MB (artırılabilir) |

---

### 5. ÖDEME ENTEGRASYONU (TOSLA)

| Adım | Web | Native |
|------|-----|--------|
| **1. API Request** | ✅ Supabase Edge Function | ✅ Supabase Edge Function (aynı) |
| **2. Redirect** | `window.location.href = paymentUrl` | `WebBrowser.openBrowserAsync(paymentUrl)` |
| **3. Browser** | ❌ Tab değişir (kullanıcı kaybolur) | ✅ In-app browser (kontrollü) |
| **4. Callback** | URL params (`/payment-success?tx=123`) | Deep link (`kcal://payment-success?tx=123`) |
| **5. State Restore** | ⚠️ localStorage | ✅ AsyncStorage (korunur) |
| **UX** | ⚠️ Tab kaybı riski | ✅ Seamless (kullanıcı app içinde) |

---

### 6. ANIMATIONS

| Özellik | Web (Framer Motion) | Native (Reanimated) |
|---------|-------------------|---------------------|
| **Import** | `framer-motion` | `react-native-reanimated` |
| **Fade In** | `initial={{ opacity: 0 }}` | `entering={FadeIn}` |
| **Slide** | `animate={{ y: 0 }}` | `entering={SlideInUp}` |
| **Exit** | `exit={{ opacity: 0 }}` | `exiting={FadeOut}` |
| **Tap** | `whileTap={{ scale: 0.95 }}` | `Pressable` + `useSharedValue` |
| **Duration** | `transition={{ duration: 0.3 }}` | `.duration(300)` |
| **Performance** | ⚠️ Main thread | ✅ UI thread (60fps) |

---

### 7. ICONS

| Özellik | Web | Native |
|---------|-----|--------|
| **Package** | `lucide-react` | `lucide-react-native` |
| **Import** | `import { Home } from 'lucide-react'` | `import { Home } from 'lucide-react-native'` |
| **Usage** | `<Home size={24} className="text-blue-500" />` | `<Home size={24} color="#3b82f6" />` |
| **Color** | ✅ Tailwind class | ⚠️ Hex/RGB prop |
| **Stroke** | CSS `stroke-width` | `strokeWidth` prop |

---

### 8. FORMS

#### Web
```jsx
<form onSubmit={handleSubmit}>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="E-posta"
  />
  <button type="submit">Gönder</button>
</form>
```

#### Native
```tsx
<KeyboardAvoidingView behavior="padding">
  <TextInput
    keyboardType="email-address"
    value={email}
    onChangeText={setEmail}
    placeholder="E-posta"
  />
  <TouchableOpacity onPress={handleSubmit}>
    <Text>Gönder</Text>
  </TouchableOpacity>
</KeyboardAvoidingView>
```

**Farklar:**
- ❌ `<form>` yok → Manuel submit
- ❌ `onChange` yok → `onChangeText` kullan
- ✅ `KeyboardAvoidingView` → Klavye açılınca view kayar

---

### 9. LISTS & SCROLLING

#### Web (Small List)
```jsx
<div className="overflow-y-auto">
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</div>
```

#### Native (Small List)
```tsx
<ScrollView>
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</ScrollView>
```

#### Web (Large List - Virtual Scroll)
```jsx
// react-window veya react-virtual
<FixedSizeList
  height={600}
  itemCount={products.length}
  itemSize={100}
>
  {({ index }) => <ProductCard product={products[index]} />}
</FixedSizeList>
```

#### Native (Large List - Optimized)
```tsx
<FlatList
  data={products}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <ProductCard product={item} />}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

**Performance:**
- Web: Manual virtualization gerekli
- Native: `FlatList` built-in optimized ✅

---

### 10. IMAGES

#### Web
```jsx
<img
  src="/images/product.jpg"
  alt="Product"
  className="w-full h-32 object-cover"
/>
```

#### Native (Basic)
```tsx
<Image
  source={{ uri: 'https://example.com/image.jpg' }}
  className="w-full h-32"
  resizeMode="cover"
/>
```

#### Native (Optimized - Expo Image)
```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: product.image_url }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
  className="w-full h-32"
/>
```

**Farklar:**
- Local images: `require()` gerekli
- Remote: `{ uri: "url" }` format
- `expo-image`: Daha hızlı, cache, blur preview

---

### 11. SUPABASE CLIENT

#### Web
```jsx
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(url, key, {
  auth: {
    storage: window.localStorage,
  },
});
```

#### Native
```tsx
import 'react-native-url-polyfill/auto'; // ✅ Polyfill
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // ✅ Native'de kapalı
  },
});
```

**Farklar:**
- Polyfill gerekli (`react-native-url-polyfill`)
- AsyncStorage
- `detectSessionInUrl: false` (native'de URL yok)

---

### 12. HAPTIC FEEDBACK

#### Web
```jsx
// ❌ Native haptic yok
// navigator.vibrate([100]) (Android only, basic)
```

#### Native
```tsx
import * as Haptics from 'expo-haptics';

// Button click
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// Success
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Error
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Selection
Haptics.selectionAsync();
```

**Kullanım Örnekleri:**
- Sepete ekle: `Light`
- Sipariş tamamla: `Success`
- Hata: `Error`
- Dropdown seçim: `Selection`

---

### 13. SAFE AREA (iPhone Çentik)

#### Web
```css
/* index.css */
.safe-top {
  padding-top: env(safe-area-inset-top);
}
```

```jsx
<header className="safe-top bg-brand-primary">
  {/* Content */}
</header>
```

#### Native
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

<SafeAreaView 
  className="flex-1 bg-brand-bg" 
  edges={['top', 'bottom']}
>
  <View className="bg-brand-primary p-4">
    <Text>Header</Text>
  </View>
</SafeAreaView>
```

**Farklar:**
- Web: CSS ile manuel
- Native: Component otomatik handle eder ✅

---

### 14. ENVIRONMENT VARIABLES

#### Web
```bash
# .env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

```jsx
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
```

#### Native
```bash
# .env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx
```

```tsx
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
```

**app.config.js:**
```javascript
export default {
  expo: {
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
```

---

## 🎯 PERFORMANS KARŞILAŞTIRMASI

| Metrik | Web (PWA) | Capacitor | React Native |
|--------|-----------|-----------|--------------|
| **Cold Start** | ~500ms | ~2s (WebView) | ~1s |
| **Hot Reload** | ✅ Instant | ⚠️ Slow | ✅ Fast |
| **List Scroll (1000 items)** | ⚠️ 30fps | ⚠️ 30fps | ✅ 60fps |
| **Animation FPS** | ⚠️ 30-60fps | ⚠️ 30fps | ✅ 60fps |
| **App Size** | ~1 MB | ~50 MB | ~20 MB |
| **Memory Usage** | ⚠️ High (browser) | ⚠️ Very High | ✅ Low |
| **Battery Impact** | ⚠️ Medium | ⚠️ High | ✅ Low |

---

## 🛠️ GELİŞTİRME DENEYİMİ

| Özellik | Web | React Native |
|---------|-----|--------------|
| **Hot Reload** | ✅ Instant | ✅ Fast Refresh |
| **Debugging** | ✅ Chrome DevTools | ✅ React Native Debugger |
| **Error Messages** | ✅ Clear | ✅ Clear |
| **Build Time** | ✅ Fast (Vite) | ⚠️ Slower (Metro) |
| **Testing** | ✅ Jest + Testing Library | ✅ Jest + Testing Library (aynı) |
| **Learning Curve** | ✅ Easy (HTML/CSS) | ⚠️ Medium (Native concepts) |

---

## 📱 NATIVE ÖZELLİKLER

| Özellik | Web | React Native |
|---------|-----|--------------|
| **Push Notifications** | ⚠️ Limited (FCM) | ✅ Full (APNs/FCM) |
| **Camera** | ⚠️ Browser API | ✅ Full access |
| **Location** | ⚠️ Browser API | ✅ Full access |
| **Biometric Auth** | ❌ | ✅ Face ID / Touch ID |
| **Haptic Feedback** | ❌ | ✅ Rich haptics |
| **Background Tasks** | ❌ Limited | ✅ Full support |
| **Offline Storage** | ⚠️ 5-10 MB | ✅ Unlimited |
| **App Store Distribution** | ❌ | ✅ iOS + Android |

---

## 💰 COST COMPARISON

| Aspect | Web | React Native |
|--------|-----|--------------|
| **Development** | ✅ $$ | ⚠️ $$$ (daha uzun) |
| **Hosting** | ⚠️ $ (Vercel/Netlify) | ✅ Free (only API) |
| **App Store Fees** | ✅ Free | ⚠️ $99/year (Apple) + $25 (Google) |
| **Maintenance** | ✅ Easy | ⚠️ Medium |
| **Updates** | ✅ Instant | ⚠️ Store review (1-2 gün) |

---

## ✅ SONUÇ: HANGİSİNİ SEÇMELİ?

### Web (PWA) Kullan Eğer:
- ✅ Hızlı prototipleme
- ✅ SEO önemli
- ✅ App Store gereksiz
- ✅ Basit UI/UX yeterli
- ✅ Desktop + mobile desteği

### React Native Kullan Eğer:
- ✅ Premium UX/UI gerekli
- ✅ Native özelliklere ihtiyaç (kamera, push, haptics)
- ✅ 60fps animasyonlar önemli
- ✅ Offline-first uygulama
- ✅ App Store distribution
- ✅ Long-term product

---

## 🎯 KCAL İÇİN DOĞRU SEÇİM: REACT NATIVE ✅

**Neden?**
1. ✅ **Premium Feel:** Getir/Trendyol seviyesinde UX
2. ✅ **Performans:** 60fps liste scroll, animasyonlar
3. ✅ **Native Features:** Push notification, haptic feedback
4. ✅ **App Store:** iOS/Android dağıtımı
5. ✅ **Scalability:** Enterprise-ready
6. ✅ **Ecosystem:** 10,000+ paketler

**Trade-off:**
- ⚠️ Geliştirme süresi: +1-2 hafta
- ⚠️ Öğrenme eğrisi: Native concepts
- ⚠️ Build zamanı: Daha uzun

**ROI (Return on Investment):**
- **Short-term:** Web daha hızlı
- **Long-term:** React Native daha karlı (better UX → more users → higher revenue)

---

## 📊 MİGRASYON EFORu TAHMİNİ

| Component | Web Lines | Native Lines | Effort (Days) |
|-----------|-----------|--------------|---------------|
| Home | 250 | 300 | 1 |
| ProductDetail | 200 | 250 | 1 |
| Cart | 150 | 200 | 0.5 |
| Checkout | 400 | 500 | 2 |
| Profile | 300 | 350 | 1 |
| Auth | 200 | 250 | 1 |
| Context (3 files) | 300 | 350 | 1 |
| Components (10+) | 500 | 600 | 2 |
| Admin | 1000 | 1200 | 3 |
| Kitchen | 500 | 600 | 2 |
| **TOTAL** | **~3800** | **~4600** | **~15 days** |

**+ Buffer:** +5 days (bug fixing, testing, polish)
**= TOTAL: 20 days (4 weeks)**

---

## 🚀 NEXT STEPS

1. **Week 1:** Setup + Core Screens (Home, Cart, Checkout)
2. **Week 2:** Backend (Supabase, Context) + Payment
3. **Week 3:** Admin + Kitchen Panels
4. **Week 4:** Testing + Polish + App Store Submit

**Timeline:** 1 Mart 2026 → 1 Nisan 2026 (Beta Launch)

---

**Karşılaştırma Tablosu** | Web vs React Native | 24 Şubat 2026
