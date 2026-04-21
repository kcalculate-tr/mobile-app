# 📱 REACT NATIVE (EXPO) MİGRASYON PLANI

## 🎯 GEÇİŞ STRATEJİSİ

**Karar:** Capacitor ❌ → React Native (Expo) ✅

**Neden React Native?**
- ✅ True native performance
- ✅ Daha geniş plugin ekosistemi
- ✅ Expo ile hızlı prototipleme
- ✅ Hot reload ve debugging kolaylığı
- ✅ Single codebase (iOS + Android)

---

## ADIM 1: PROJE YAPISINI HAZIRLA

### 1.1 Yeni Expo Projesi Oluştur

```bash
# Yeni dizinde Expo projesi oluştur
npx create-expo-app kcal-mobile --template blank-typescript

cd kcal-mobile

# Temel bağımlılıklar
npx expo install react-native-web react-dom @expo/metro-runtime

# Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npx expo install react-native-screens react-native-safe-area-context

# UI & Styling
npm install nativewind
npm install --save-dev tailwindcss@3.3.2
npx tailwindcss init

# State & Backend
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npm install react-native-url-polyfill

# Animations
npm install react-native-reanimated react-native-gesture-handler

# Other essentials
npx expo install expo-linking expo-web-browser expo-constants expo-status-bar
npx expo install expo-splash-screen expo-haptics
```

---

### 1.2 NativeWind Kurulumu

**tailwind.config.js**
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}", 
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'brand-white': '#FFFFFF',
        'brand-bg': '#F0F0F0',
        'brand-primary': '#98CD00',
        'brand-secondary': '#82CD47',
        'brand-dark': '#202020',
      },
    },
  },
  plugins: [],
}
```

**babel.config.js**
```javascript
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'nativewind/babel',
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};
```

**app.json**
```json
{
  "expo": {
    "name": "Kcal",
    "slug": "kcal-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#98CD00"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.kcal.app"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#98CD00"
      },
      "package": "com.kcal.app"
    },
    "plugins": [
      "expo-router"
    ]
  }
}
```

---

## ADIM 2: SUPABASE ENTEGRASYONU (NATIVE)

### 2.1 Supabase Client (AsyncStorage ile)

**src/lib/supabase.ts** (YENİ DOSYA)
```typescript
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || 'YOUR_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage, // ✅ Native storage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // ✅ Native'de URL detection kapalı
  },
});

// Session listener
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state changed:', event);
});
```

**app.config.js** (Environment Variables)
```javascript
export default {
  expo: {
    // ...
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
  },
};
```

**.env**
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## ADIM 3: NAVIGATION YAPISINI KUR

### 3.1 App.tsx (Root)

**App.tsx**
```typescript
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

// Contexts
import { CartProvider } from './src/context/CartContext';
import { AuthProvider } from './src/context/AuthContext';
import { ProductProvider } from './src/context/ProductContext';

// Screens
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CheckoutScreen from './src/screens/CheckoutScreen';
import ProductDetailScreen from './src/screens/ProductDetailScreen';

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, assets, etc.
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProductProvider>
          <CartProvider>
            <NavigationContainer>
              <Stack.Navigator
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              >
                {/* Main App */}
                <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
                
                {/* Auth Screens */}
                <Stack.Screen 
                  name="Login" 
                  component={LoginScreen}
                  options={{ presentation: 'modal' }}
                />
                <Stack.Screen 
                  name="Register" 
                  component={RegisterScreen}
                  options={{ presentation: 'modal' }}
                />
                
                {/* Detail Screens */}
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                <Stack.Screen name="Checkout" component={CheckoutScreen} />
              </Stack.Navigator>
            </NavigationContainer>
            <StatusBar style="light" backgroundColor="#98CD00" />
          </CartProvider>
        </ProductProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

---

### 3.2 Bottom Tab Navigator

**src/navigation/BottomTabNavigator.tsx** (YENİ)
```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';
import { Home, Activity, ShoppingBag, Heart, User } from 'lucide-react-native';

// Screens
import HomeScreen from '../screens/HomeScreen';
import TrackerScreen from '../screens/TrackerScreen';
import CartScreen from '../screens/CartScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#98CD00',
        tabBarInactiveTintColor: '#202020',
        tabBarStyle: {
          backgroundColor: '#F0F0F0',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Tracker"
        component={TrackerScreen}
        options={{
          tabBarLabel: 'Takip',
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Cart"
        component={CartScreen}
        options={{
          tabBarLabel: 'Sepet',
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />,
          tabBarBadge: undefined, // Cart count badge buraya eklenecek
        }}
      />
      <Tab.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{
          tabBarLabel: 'Favoriler',
          tabBarIcon: ({ color, size }) => <Heart color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
```

---

## ADIM 4: HOME SCREEN DÖNÜŞÜMÜ (ÖRNEK)

### 4.1 HomeScreen.tsx

**src/screens/HomeScreen.tsx** (YENİ)
```typescript
import React, { useContext, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Bell, MapPin, ShoppingBag } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Contexts
import { AuthContext } from '../context/AuthContext';
import { ProductContext } from '../context/ProductContext';
import { CartContext } from '../context/CartContext';

// Components
import ProductCard from '../components/ProductCard';
import CategoryFilter from '../components/CategoryFilter';
import SearchBar from '../components/SearchBar';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const { products, loading } = useContext(ProductContext);
  const { cart, addToCart } = useContext(CartContext);

  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'Tümü' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    // Fetch products again
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleAddToCart = (product: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart(product);
  };

  const renderHeader = () => (
    <View className="bg-brand-primary rounded-b-3xl px-4 pt-4 pb-6">
      {/* User Info */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity 
          className="flex-row items-center"
          onPress={() => navigation.navigate('Profile')}
        >
          <View className="h-12 w-12 rounded-full bg-white items-center justify-center mr-3">
            <Text className="text-brand-primary font-bold text-lg">
              {user?.email?.charAt(0).toUpperCase() || 'K'}
            </Text>
          </View>
          <View>
            <Text className="text-white font-bold text-base">
              Merhaba 👋
            </Text>
            <Text className="text-white/80 text-xs">
              {user?.email?.split('@')[0] || 'Kullanıcı'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Cart Icon */}
        <TouchableOpacity
          className="relative h-12 w-12 rounded-full bg-white items-center justify-center"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            navigation.navigate('Cart');
          }}
        >
          <ShoppingBag size={22} color="#98CD00" />
          {cartCount > 0 && (
            <View className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 items-center justify-center">
              <Text className="text-white text-xs font-bold">{cartCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Location */}
      <View className="flex-row items-center mb-4">
        <MapPin size={16} color="#fff" />
        <Text className="text-white ml-2 text-sm">
          İzmir, Karabağlar
        </Text>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Ürün ara..."
      />
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id.toString()}
        numColumns={2}
        ListHeaderComponent={
          <>
            {renderHeader()}
            <CategoryFilter
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </>
        }
        renderItem={({ item }) => (
          <View className="flex-1 p-2">
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
              onAddToCart={() => handleAddToCart(item)}
            />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}
```

---

### 4.2 ProductCard Component (Native)

**src/components/ProductCard.tsx** (YENİ)
```typescript
import React from 'react';
import { View, Text, Image, TouchableOpacity, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    image_url: string;
    price: number;
    kcal: number;
    protein: number;
  };
  onPress: () => void;
  onAddToCart: () => void;
}

export default function ProductCard({ product, onPress, onAddToCart }: ProductCardProps) {
  const handleAddToCart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddToCart();
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl overflow-hidden shadow-sm active:scale-95"
      style={{ aspectRatio: 0.75 }}
    >
      {/* Image */}
      <View className="relative">
        <Image
          source={{ uri: product.image_url }}
          className="w-full h-32 bg-gray-100"
          resizeMode="cover"
        />
        
        {/* Macro Badge */}
        <View className="absolute top-2 left-2 bg-white/90 rounded-lg px-2 py-1 flex-row items-center">
          <Text className="text-brand-primary text-xs font-bold">
            {product.kcal} kcal
          </Text>
        </View>
      </View>

      {/* Content */}
      <View className="p-3 flex-1">
        <Text 
          className="text-brand-dark font-bold text-sm mb-1"
          numberOfLines={2}
        >
          {product.name}
        </Text>

        <Text className="text-gray-500 text-xs mb-2">
          {product.protein}g protein
        </Text>

        {/* Price & Add Button */}
        <View className="flex-row items-center justify-between mt-auto">
          <Text className="text-brand-primary font-bold text-lg">
            ₺{product.price.toFixed(2)}
          </Text>

          <TouchableOpacity
            onPress={handleAddToCart}
            className="bg-brand-primary rounded-full h-8 w-8 items-center justify-center active:scale-90"
          >
            <Plus size={18} color="#fff" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
}
```

---

## ADIM 5: ÖDEME ENTEGRASYONU (NATIVE)

### 5.1 Tosla Payment Handler

**src/utils/paymentHandler.ts** (YENİ)
```typescript
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

// Tosla ödeme başlatma
export async function initiateToslaPayment({
  orderUUID,
  amount,
  customerName,
  customerEmail,
  saveCard = false,
  cardToken = null,
  cardHolderName = null,
  cardNumber = null,
  cardExpiry = null,
  cardCvv = null,
}: {
  orderUUID: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  saveCard?: boolean;
  cardToken?: string | null;
  cardHolderName?: string | null;
  cardNumber?: string | null;
  cardExpiry?: string | null;
  cardCvv?: string | null;
}) {
  try {
    const requestBody: any = {
      amount: Number(amount).toFixed(2),
      orderId: orderUUID,
      customerName,
      customerEmail,
    };

    // Kayıtlı kart ile ödeme
    if (cardToken) {
      requestBody.cardToken = cardToken;
      requestBody.saveCard = false;
    } 
    // Yeni kart ile ödeme
    else if (cardNumber) {
      requestBody.cardHolderName = cardHolderName;
      requestBody.cardNumber = cardNumber;
      requestBody.cardExpiry = cardExpiry;
      requestBody.cardCvv = cardCvv;
      requestBody.saveCard = saveCard;
    }

    // Supabase Edge Function çağrısı
    const { data, error } = await supabase.functions.invoke('tosla-payment-init', {
      body: requestBody,
    });

    if (error) {
      throw new Error(error.message || 'Ödeme işlemi başlatılamadı');
    }

    console.log('🔒 Tosla Response:', data);
    
    const paymentUrl = data?.Url || data?.PaymentUrl || data?.Link || data?.paymentUrl || data?.url;
    
    if (!paymentUrl) {
      const errorMessage = data?.Message || data?.ErrorMessage || data?.error || 'Ödeme URL\'si alınamadı';
      throw new Error(errorMessage);
    }

    console.log('✅ Tosla payment URL found:', paymentUrl);

    // ✅ NATIVE: expo-web-browser ile aç
    const result = await WebBrowser.openBrowserAsync(paymentUrl, {
      dismissButtonStyle: 'cancel',
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#98CD00',
      controlsColor: '#FFFFFF',
    });

    // Callback URL'den sonuç al
    if (result.type === 'cancel') {
      return { success: false, cancelled: true };
    }

    return {
      success: true,
      paymentUrl: paymentUrl,
      transactionId: data?.TransactionId || data?.transactionId || null,
    };
  } catch (error: any) {
    console.error('🔒 Tosla payment error:', error);
    return {
      success: false,
      error: error.message || 'Ödeme başlatma hatası',
    };
  }
}

// Deep link listener (Payment callback için)
export function setupPaymentCallbackListener(
  onSuccess: (params: any) => void,
  onFailure: (params: any) => void
) {
  // URL Scheme: kcal://payment-success?transaction_id=xxx
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const { hostname, queryParams } = Linking.parse(url);

    if (hostname === 'payment-success') {
      onSuccess(queryParams);
    } else if (hostname === 'payment-fail') {
      onFailure(queryParams);
    }
  });

  return () => subscription.remove();
}
```

---

### 5.2 CheckoutScreen (Native)

**src/screens/CheckoutScreen.tsx** (ÖRNEK - Partial)
```typescript
import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import { CartContext } from '../context/CartContext';
import { AuthContext } from '../context/AuthContext';
import { initiateToslaPayment } from '../utils/paymentHandler';
import { supabase } from '../lib/supabase';

export default function CheckoutScreen() {
  const navigation = useNavigation();
  const { cart, clearCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: user?.email || '',
    address: '',
  });

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = 40;
  const total = subtotal + deliveryFee;

  const handleCheckout = async () => {
    if (!form.fullName || !form.phone || !form.address) {
      Alert.alert('Eksik Bilgi', 'Lütfen tüm alanları doldurun.');
      return;
    }

    setLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      // 1. Siparişi database'e kaydet
      const orderPayload = {
        user_id: user?.id,
        customer_name: form.fullName,
        customer_email: form.email,
        phone: form.phone,
        address: form.address,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total_amount: total,
        status: 'pending',
        payment_status: 'pending',
      };

      const { data: order, error } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (error) throw error;

      // 2. Tosla ödeme başlat
      const paymentResult = await initiateToslaPayment({
        orderUUID: order.id,
        amount: total,
        customerName: form.fullName,
        customerEmail: form.email,
      });

      if (!paymentResult.success) {
        throw new Error(paymentResult.error || 'Ödeme başlatılamadı');
      }

      // 3. Başarılı - Sepeti temizle
      clearCart();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Success screen'e yönlendir
      navigation.reset({
        index: 0,
        routes: [{ name: 'PaymentSuccess', params: { orderId: order.id } }],
      });
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata', error.message || 'Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <Text className="text-2xl font-bold text-brand-dark mt-4 mb-6">
          Sipariş Özeti
        </Text>

        {/* Form Fields */}
        <View className="space-y-4">
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base"
            placeholder="Ad Soyad"
            value={form.fullName}
            onChangeText={(text) => setForm({ ...form, fullName: text })}
          />
          
          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base"
            placeholder="Telefon"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(text) => setForm({ ...form, phone: text })}
          />

          <TextInput
            className="bg-white rounded-xl px-4 py-3 text-base"
            placeholder="Adres"
            multiline
            numberOfLines={3}
            value={form.address}
            onChangeText={(text) => setForm({ ...form, address: text })}
          />
        </View>

        {/* Price Summary */}
        <View className="bg-white rounded-2xl p-4 mt-6">
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Ürün Tutarı</Text>
            <Text className="font-bold">₺{subtotal.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Teslimat</Text>
            <Text className="font-bold">₺{deliveryFee.toFixed(2)}</Text>
          </View>
          <View className="border-t border-gray-200 pt-2 mt-2">
            <View className="flex-row justify-between">
              <Text className="font-bold text-lg">Toplam</Text>
              <Text className="font-bold text-lg text-brand-primary">
                ₺{total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      <View className="px-4 pb-4 bg-white border-t border-gray-100">
        <TouchableOpacity
          onPress={handleCheckout}
          disabled={loading}
          className="bg-brand-primary rounded-2xl py-4 items-center active:scale-95"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-lg">
              Siparişi Tamamla - ₺{total.toFixed(2)}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

---

## ADIM 6: CONTEXT'LERİ DÖNÜŞTÜR

### 6.1 CartContext (Native)

**src/context/CartContext.tsx**
```typescript
import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_STORAGE_KEY = '@kcal_cart';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextType>({
  cart: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
});

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

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
      if (stored) {
        setCart(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Cart load error:', error);
    }
  };

  const saveCart = async (cartData: CartItem[]) => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
    } catch (error) {
      console.error('Cart save error:', error);
    }
  };

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const clearCart = async () => {
    setCart([]);
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
```

---

## ADIM 7: DÖNÜŞÜM KONTROL LİSTESİ

### ✅ Web → Native Dönüşüm Tablosu

| Web (React) | Native (React Native) | NativeWind Class |
|-------------|------------------------|------------------|
| `<div>` | `<View>` | ✅ Aynı |
| `<span>`, `<p>`, `<h1>` | `<Text>` | ✅ Aynı |
| `<img>` | `<Image>` | ✅ Aynı |
| `<button>` | `<TouchableOpacity>` veya `<Pressable>` | ✅ Aynı |
| `<input>` | `<TextInput>` | ⚠️ Farklı props |
| `<a>` | `<TouchableOpacity>` + navigation | N/A |
| `onClick` | `onPress` | - |
| `className` | `className` (NativeWind) | ✅ Aynı |
| `style` | `style` | ✅ Aynı |
| `window.location.href` | `Linking.openURL()` | - |
| `localStorage` | `AsyncStorage` | - |
| Framer Motion | `react-native-reanimated` | ⚠️ API farklı |

---

### 🔧 Component Dönüşüm Örnekleri

**ÖNCE (Web):**
```jsx
<div className="bg-white rounded-xl p-4">
  <h2 className="text-xl font-bold">Title</h2>
  <p className="text-gray-600">Description</p>
  <button onClick={handleClick} className="bg-brand-primary text-white px-4 py-2">
    Click Me
  </button>
</div>
```

**SONRA (Native):**
```jsx
<View className="bg-white rounded-xl p-4">
  <Text className="text-xl font-bold">Title</Text>
  <Text className="text-gray-600">Description</Text>
  <TouchableOpacity 
    onPress={handleClick} 
    className="bg-brand-primary px-4 py-2"
  >
    <Text className="text-white">Click Me</Text>
  </TouchableOpacity>
</View>
```

---

## ADIM 8: ASSETS & FONTS

### 8.1 Custom Fonts

**Zalando & Google Sans fontlarını ekle:**

```bash
# assets/fonts/ dizinine fontları kopyala
mkdir -p assets/fonts
# ZalandoSansExpanded-*.ttf
# GoogleSansFlex_*.ttf
```

**App.tsx'te yükle:**
```typescript
import * as Font from 'expo-font';

const loadFonts = () => {
  return Font.loadAsync({
    'Zalando-Bold': require('./assets/fonts/ZalandoSansExpanded-ExtraBold.ttf'),
    'Zalando-SemiBold': require('./assets/fonts/ZalandoSansExpanded-SemiBold.ttf'),
    'GoogleSans-Regular': require('./assets/fonts/GoogleSansFlex_24pt-Regular.ttf'),
    'GoogleSans-Medium': require('./assets/fonts/GoogleSansFlex_24pt-Medium.ttf'),
  });
};
```

**tailwind.config.js:**
```javascript
theme: {
  extend: {
    fontFamily: {
      'zalando': ['Zalando-Bold'],
      'google': ['GoogleSans-Regular'],
    },
  },
}
```

---

## ADIM 9: TEST & DEBUG

### 9.1 Development Mode

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Expo Go (hızlı test)
npx expo start
```

### 9.2 Native Debugging

```typescript
// React Native Debugger
import { LogBox } from 'react-native';

// Development'ta bazı uyarıları gizle
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

if (__DEV__) {
  console.log('🚀 Development mode');
}
```

---

## ADIM 10: BUILD & DEPLOY

### 10.1 EAS Build

```bash
# EAS CLI kur
npm install -g eas-cli

# Login
eas login

# Build configuration
eas build:configure

# iOS build
eas build --platform ios

# Android build
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

**eas.json:**
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

---

## 📋 MİGRASYON PLANI (Tamamı)

### Faz 1: Kurulum (1-2 Gün)
- [ ] Expo projesi oluştur
- [ ] NativeWind kurulumu
- [ ] Supabase native client
- [ ] Navigation yapısı
- [ ] Context'leri taşı (AsyncStorage)

### Faz 2: Core Screens (3-5 Gün)
- [ ] HomeScreen dönüşümü
- [ ] ProductDetail dönüşümü
- [ ] CartScreen dönüşümü
- [ ] CheckoutScreen dönüşümü
- [ ] ProfileScreen dönüşümü

### Faz 3: Ödeme & Auth (2-3 Gün)
- [ ] Tosla payment handler (expo-web-browser)
- [ ] Deep link callback setup
- [ ] Login/Register screens
- [ ] Auth flow

### Faz 4: Admin & Kitchen (3-4 Gün)
- [ ] Admin paneli (tablet layout)
- [ ] Kitchen dashboard
- [ ] Touch-friendly butonlar (52x52px)
- [ ] Tablet landscape optimizasyonu

### Faz 5: Polish & Test (3-5 Gün)
- [ ] Safe area optimizasyonları
- [ ] Haptic feedback entegrasyonu
- [ ] Performance optimizasyonları
- [ ] iOS/Android cihaz testleri

### Faz 6: Deploy (2-3 Gün)
- [ ] EAS Build yapılandırması
- [ ] TestFlight beta
- [ ] Google Play Internal Testing
- [ ] Production release

**TOPLAM SÜRE: 14-22 gün (3-4 hafta)**

---

## 🆚 CAPACITOR vs REACT NATIVE

| Özellik | Capacitor | React Native |
|---------|-----------|--------------|
| Web kodu yeniden kullanımı | ✅ %100 | ⚠️ %60-70 |
| Native performance | ⚠️ WebView | ✅ True native |
| Plugin ekosistemi | ⚠️ Sınırlı | ✅ Çok geniş |
| Learning curve | ✅ Düşük | ⚠️ Orta-Yüksek |
| Hot reload | ✅ | ✅ |
| Dosya boyutu | ⚠️ Büyük | ✅ Küçük |
| Maintenance | ✅ Kolay | ⚠️ Orta |

**Seçim:** React Native ✅ (True native, performans, ecosystem)

---

## 📞 YARDIMCI KAYNAKLAR

- **React Native Docs:** https://reactnative.dev/docs/getting-started
- **Expo Docs:** https://docs.expo.dev/
- **NativeWind:** https://www.nativewind.dev/
- **React Navigation:** https://reactnavigation.org/
- **Supabase RN:** https://supabase.com/docs/guides/with-react-native

---

**Rapor Sonu** | React Native Migration Plan | 24 Şubat 2026
