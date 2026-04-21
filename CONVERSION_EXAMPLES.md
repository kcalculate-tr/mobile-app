# 🔄 WEB → REACT NATIVE DÖNÜŞÜM ÖRNEKLERİ

## 📋 HIZLI REFERANS TABLOSU

### HTML → React Native Components

| Web | React Native | Import |
|-----|--------------|--------|
| `<div>` | `<View>` | `react-native` |
| `<span>`, `<p>`, `<h1>` | `<Text>` | `react-native` |
| `<img>` | `<Image>` | `react-native` |
| `<button>` | `<TouchableOpacity>` | `react-native` |
| `<input>` | `<TextInput>` | `react-native` |
| `<select>` | `<Picker>` | `@react-native-picker/picker` |
| `<a>` | `<Pressable>` + `Linking` | `react-native` |

---

## 1️⃣ HOME.JSX → HOMESCREEN.TSX

### Web (Önce)

```jsx
// src/pages/Home.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);

  return (
    <div className="min-h-screen bg-[#F0F0F0]">
      <header className="bg-[#98CD00] rounded-b-3xl p-4">
        <h1 className="text-white text-2xl font-bold">Kcal</h1>
      </header>

      <div className="grid grid-cols-2 gap-4 p-4">
        {products.map(product => (
          <div 
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-white rounded-xl p-4"
          >
            <img src={product.image} className="w-full h-32 rounded-lg" />
            <h3 className="text-lg font-bold mt-2">{product.name}</h3>
            <p className="text-gray-600">{product.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Native (Sonra)

```tsx
// src/screens/HomeScreen.tsx
import React, { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [products, setProducts] = useState([]);

  return (
    <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-brand-primary rounded-b-3xl p-4">
        <Text className="text-white text-2xl font-bold">Kcal</Text>
      </View>

      {/* Products Grid */}
      <FlatList
        data={products}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        columnWrapperStyle={{ gap: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        renderItem={({ item: product }) => (
          <TouchableOpacity 
            onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
            className="flex-1 bg-white rounded-xl p-4"
          >
            <Image 
              source={{ uri: product.image }} 
              className="w-full h-32 rounded-lg" 
              resizeMode="cover"
            />
            <Text className="text-lg font-bold mt-2">{product.name}</Text>
            <Text className="text-gray-600">{product.price}</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
```

---

## 2️⃣ CHECKOUT.JSX → CHECKOUTSCREEN.TSX

### Web Payment Flow (Önce)

```jsx
// src/pages/Checkout.jsx
const handleSubmit = async () => {
  // ... order kaydetme

  const toslaPayment = await initiateToslaPayment({ ... });
  
  // ❌ Web redirect
  window.location.href = toslaPayment.paymentUrl;
};
```

---

### Native Payment Flow (Sonra)

```tsx
// src/screens/CheckoutScreen.tsx
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const handleSubmit = async () => {
  // ... order kaydetme

  const toslaPayment = await initiateToslaPayment({ ... });
  
  // ✅ Native in-app browser
  const result = await WebBrowser.openBrowserAsync(toslaPayment.paymentUrl, {
    dismissButtonStyle: 'cancel',
    toolbarColor: '#98CD00',
  });

  if (result.type === 'cancel') {
    Alert.alert('Ödeme İptal Edildi', 'Ödeme işlemi tamamlanmadı.');
  }
};

// Deep link callback dinleyici
useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const { hostname, queryParams } = Linking.parse(url);

    if (hostname === 'payment-success') {
      // Sipariş başarılı
      clearCart();
      navigation.navigate('PaymentSuccess', { 
        transactionId: queryParams?.transaction_id 
      });
    } else if (hostname === 'payment-fail') {
      // Ödeme başarısız
      Alert.alert('Ödeme Başarısız', queryParams?.error_message);
    }
  });

  return () => subscription.remove();
}, []);
```

**app.json'a deep link ekle:**
```json
{
  "expo": {
    "scheme": "kcal",
    "ios": {
      "associatedDomains": ["applinks:kcalapp.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            { "scheme": "kcal", "host": "*" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## 3️⃣ CART CONTEXT DÖNÜŞÜMÜ

### Web (localStorage)

```jsx
// src/context/CartContext.jsx
import { createContext, useState, useEffect } from 'react';

const CART_STORAGE_KEY = 'kcal_cart';

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) setCart(JSON.parse(stored));
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  // ...
}
```

---

### Native (AsyncStorage)

```tsx
// src/context/CartContext.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_STORAGE_KEY = '@kcal_cart';

interface CartContextType {
  cart: any[];
  addToCart: (item: any) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<any[]>([]);

  // ✅ AsyncStorage'dan yükle
  useEffect(() => {
    loadCart();
  }, []);

  // ✅ Her değişiklikte kaydet
  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const loadCart = async () => {
    try {
      const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (stored) setCart(JSON.parse(stored));
    } catch (error) {
      console.error('Cart load error:', error);
    }
  };

  const saveCart = async (cartData: any[]) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
    } catch (error) {
      console.error('Cart save error:', error);
    }
  };

  const addToCart = (item: any) => {
    setCart(prev => [...prev, item]);
  };

  const clearCart = async () => {
    setCart([]);
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}
```

---

## 4️⃣ FRAMER MOTION → REANIMATED

### Web (Framer Motion)

```jsx
import { motion, AnimatePresence } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  className="bg-white rounded-xl p-4"
>
  <h2>Animated Card</h2>
</motion.div>
```

---

### Native (Reanimated)

```tsx
import Animated, { FadeIn, FadeOut, SlideInUp } from 'react-native-reanimated';

<Animated.View
  entering={FadeIn.duration(300).springify()}
  exiting={FadeOut}
  className="bg-white rounded-xl p-4"
>
  <Text>Animated Card</Text>
</Animated.View>

// veya

<Animated.View
  entering={SlideInUp.delay(100)}
  className="bg-white rounded-xl p-4"
>
  <Text>Slides Up</Text>
</Animated.View>
```

**Animasyon Mapping:**

| Framer Motion | Reanimated |
|---------------|------------|
| `initial={{ opacity: 0 }}` | `entering={FadeIn}` |
| `animate={{ opacity: 1 }}` | (otomatik) |
| `exit={{ opacity: 0 }}` | `exiting={FadeOut}` |
| `whileTap={{ scale: 0.95 }}` | `Pressable` + `useSharedValue` |
| `transition={{ duration: 0.3 }}` | `.duration(300)` |

---

## 5️⃣ SAFE AREA (iPhone Çentik)

### Web (CSS)

```css
/* index.css */
.safe-top {
  padding-top: env(safe-area-inset-top);
}
```

```jsx
<header className="safe-top bg-brand-primary">
  {/* ... */}
</header>
```

---

### Native (SafeAreaView)

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
  return (
    <SafeAreaView 
      className="flex-1 bg-brand-bg" 
      edges={['top', 'bottom']} // Hangi kenarlar korunsun?
    >
      {/* İçerik otomatik olarak safe area içinde */}
      <View className="bg-brand-primary p-4">
        <Text className="text-white">Header</Text>
      </View>
    </SafeAreaView>
  );
}

// Sadece üst (top) korumalı
<SafeAreaView edges={['top']}>

// Sadece alt (bottom) korumalı
<SafeAreaView edges={['bottom']}>

// Hepsi
<SafeAreaView edges={['top', 'bottom', 'left', 'right']}>
```

---

## 6️⃣ TAILWIND → NATIVEWIND

### Desteklenen Classlar

✅ **Çalışır:**
- Layout: `flex`, `flex-row`, `items-center`, `justify-between`
- Spacing: `p-4`, `m-2`, `gap-3`, `space-y-2`
- Sizing: `w-full`, `h-32`, `min-h-screen`
- Colors: `bg-brand-primary`, `text-white`, `border-gray-300`
- Border: `rounded-xl`, `border`, `border-2`
- Typography: `text-lg`, `font-bold`, `text-center`

❌ **Çalışmaz (Native'de yok):**
- `grid`, `grid-cols-2` → `FlatList` + `numColumns={2}`
- `backdrop-blur` → Native blur kullan
- `hover:` → `Pressable` states
- `group-hover:` → Manuel state yönetimi
- CSS animations → Reanimated

⚠️ **Sınırlı Destek:**
- `shadow-lg` → iOS'ta çalışır, Android'de `elevation` prop ekle
- `transition-all` → Reanimated ile manuel

---

### Örnek Dönüşümler

**Grid Layout:**
```jsx
// ❌ Web
<div className="grid grid-cols-2 gap-4">
  {products.map(p => <ProductCard />)}
</div>

// ✅ Native
<FlatList
  data={products}
  numColumns={2}
  columnWrapperStyle={{ gap: 16 }}
  renderItem={({ item }) => <ProductCard product={item} />}
/>
```

**Shadow:**
```jsx
// ❌ Web
<div className="shadow-lg">

// ✅ Native (iOS)
<View className="shadow-lg" style={{ shadowColor: '#000' }}>

// ✅ Native (Android - elevation kullan)
<View style={{ elevation: 8 }}>
```

**Hover State:**
```jsx
// ❌ Web
<button className="bg-blue-500 hover:bg-blue-600">

// ✅ Native
import { Pressable } from 'react-native';

<Pressable
  className={({ pressed }) => 
    `bg-blue-500 ${pressed ? 'opacity-80' : 'opacity-100'}`
  }
>
  {({ pressed }) => (
    <Text className="text-white">Button</Text>
  )}
</Pressable>
```

---

## 7️⃣ NAVIGATION DÖNÜŞÜMÜ

### Web (React Router)

```jsx
import { useNavigate, Link } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  return (
    <>
      <Link to="/cart">Sepete Git</Link>
      <button onClick={() => navigate('/checkout')}>
        Checkout
      </button>
    </>
  );
}
```

---

### Native (React Navigation)

```tsx
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity, Text } from 'react-native';

function MyComponent() {
  const navigation = useNavigation();

  return (
    <>
      <TouchableOpacity onPress={() => navigation.navigate('Cart')}>
        <Text className="text-blue-500">Sepete Git</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Checkout')}>
        <Text>Checkout</Text>
      </TouchableOpacity>
    </>
  );
}
```

**Params ile navigate:**
```tsx
// Params gönder
navigation.navigate('ProductDetail', { productId: 123 });

// Params al
import { useRoute } from '@react-navigation/native';

const route = useRoute();
const { productId } = route.params;
```

---

## 8️⃣ SUPABASE DÖNÜŞÜMÜ

### Web (localStorage)

```jsx
import { supabase } from './supabase';

export const supabase = createClient(url, key, {
  auth: {
    storage: window.localStorage, // ❌ Web only
  },
});
```

---

### Native (AsyncStorage)

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto'; // ✅ Polyfill

export const supabase = createClient(url, key, {
  auth: {
    storage: AsyncStorage, // ✅ Native storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // ✅ Native'de kapalı
  },
});
```

---

## 9️⃣ FORMS & INPUTS

### Web

```jsx
<form onSubmit={handleSubmit}>
  <input
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="E-posta"
    className="w-full px-4 py-3 rounded-xl"
  />
  
  <button type="submit">Gönder</button>
</form>
```

---

### Native

```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  className="flex-1"
>
  <TextInput
    keyboardType="email-address"
    autoCapitalize="none"
    value={email}
    onChangeText={setEmail}
    placeholder="E-posta"
    className="w-full px-4 py-3 rounded-xl"
    style={{ fontSize: 16 }} // iOS zoom prevention
  />
  
  <TouchableOpacity onPress={handleSubmit}>
    <Text>Gönder</Text>
  </TouchableOpacity>
</KeyboardAvoidingView>
```

**Input Types:**

| Web | Native `keyboardType` |
|-----|----------------------|
| `type="email"` | `email-address` |
| `type="tel"` | `phone-pad` |
| `type="number"` | `numeric` |
| `type="text"` | `default` |

---

## 🔟 ICONS (Lucide)

### Web

```jsx
import { Home, ShoppingBag } from 'lucide-react';

<Home size={24} className="text-brand-primary" />
```

---

### Native

```tsx
import { Home, ShoppingBag } from 'lucide-react-native'; // ✅ -native suffix

<Home size={24} color="#98CD00" strokeWidth={2} />
```

**Fark:**
- `className` → ❌ Çalışmaz
- `color` prop → ✅ Kullan
- `strokeWidth` → ✅ Kalınlık

---

## 1️⃣1️⃣ HAPTIC FEEDBACK

```tsx
import * as Haptics from 'expo-haptics';

// Button click
<TouchableOpacity
  onPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleAction();
  }}
>

// Başarı feedback'i
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Hata feedback'i
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

// Seçim feedback'i
Haptics.selectionAsync();
```

**Feedback Map:**

| Aksiyon | Haptic |
|---------|--------|
| Sepete ekle | `Light` |
| Kart seç | `Selection` |
| Sipariş tamamla | `Success` |
| Hata | `Error` |
| Mutfak: Hazırla | `Medium` |

---

## 1️⃣2️⃣ IMAGE HANDLING

### Web

```jsx
<img 
  src="/images/product.jpg" 
  alt="Product"
  className="w-full h-32"
/>
```

---

### Native

```tsx
// Local image
<Image 
  source={require('../assets/product.jpg')}
  className="w-full h-32"
  resizeMode="cover" // 'cover' | 'contain' | 'stretch'
/>

// Remote image
<Image 
  source={{ uri: 'https://example.com/image.jpg' }}
  className="w-full h-32"
  resizeMode="cover"
/>

// Optimized (expo-image)
import { Image } from 'expo-image';

<Image
  source={{ uri: product.image_url }}
  placeholder={blurhash} // Blur preview
  contentFit="cover"
  transition={200}
  className="w-full h-32"
/>
```

---

## 1️⃣3️⃣ SCROLL & LISTS

### Web

```jsx
<div className="overflow-y-auto">
  {products.map(p => <ProductCard key={p.id} />)}
</div>
```

---

### Native

```tsx
// Küçük liste (< 50 item)
<ScrollView>
  {products.map(p => <ProductCard key={p.id} product={p} />)}
</ScrollView>

// Büyük liste (> 50 item) - Performance
<FlatList
  data={products}
  keyExtractor={(item) => item.id.toString()}
  renderItem={({ item }) => <ProductCard product={item} />}
  initialNumToRender={10}
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

---

## 1️⃣4️⃣ MODAL

### Web

```jsx
import { motion } from 'framer-motion';

{showModal && (
  <div className="fixed inset-0 bg-black/50">
    <motion.div className="bg-white rounded-3xl p-6">
      <h2>Modal Title</h2>
      <button onClick={() => setShowModal(false)}>Close</button>
    </motion.div>
  </div>
)}
```

---

### Native

```tsx
import { Modal } from 'react-native';

<Modal
  visible={showModal}
  animationType="slide" // 'none' | 'slide' | 'fade'
  presentationStyle="pageSheet" // iOS style
  onRequestClose={() => setShowModal(false)}
>
  <View className="flex-1 bg-white p-6">
    <Text className="text-2xl font-bold">Modal Title</Text>
    <TouchableOpacity onPress={() => setShowModal(false)}>
      <Text>Close</Text>
    </TouchableOpacity>
  </View>
</Modal>
```

---

## ✅ DÖNÜŞÜM KONTROL LİSTESİ

### Her Screen İçin

- [ ] `div` → `View`
- [ ] `span/p/h1` → `Text`
- [ ] `img` → `Image`
- [ ] `button` → `TouchableOpacity` veya `Pressable`
- [ ] `onClick` → `onPress`
- [ ] `onChange` → `onChangeText` (TextInput)
- [ ] `useNavigate` → `useNavigation`
- [ ] `navigate('/path')` → `navigation.navigate('ScreenName')`
- [ ] `localStorage` → `AsyncStorage`
- [ ] Framer Motion → Reanimated
- [ ] `lucide-react` → `lucide-react-native`
- [ ] `window.location.href` → `WebBrowser.openBrowserAsync`
- [ ] Safe area CSS → `SafeAreaView`

---

## 🎯 İLK 3 GÜN HEDEF

**Gün 1:**
- Expo projesi kur
- Dependencies kur
- HomeScreen dönüşümü (basit versiyon)

**Gün 2:**
- ProductCard component
- Navigation setup
- CartContext (AsyncStorage)

**Gün 3:**
- CartScreen
- CheckoutScreen (form kısmı)
- Tosla payment handler (expo-web-browser)

**Sonuç:** 3 günde çalışan bir MVP! ✅

---

**Referans Rehberi** | React Native Expo Conversion | 24 Şubat 2026
