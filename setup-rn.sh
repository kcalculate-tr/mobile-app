#!/bin/bash

# 🚀 KCAL REACT NATIVE EXPO - AUTO SETUP SCRIPT
# Bu script yeni bir React Native Expo projesi oluşturur ve gerekli tüm bağımlılıkları kurar.

set -e

echo "🚀 Kcal React Native Expo Projesi Kuruluyor..."
echo ""

# Renk kodları
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Yeni proje oluştur
echo -e "${BLUE}📦 1/6 - Expo projesi oluşturuluyor...${NC}"
cd ~/Desktop
npx create-expo-app@latest kcal-mobile --template blank-typescript --yes
cd kcal-mobile

echo -e "${GREEN}✅ Proje oluşturuldu: ~/Desktop/kcal-mobile${NC}"
echo ""

# 2. Core dependencies
echo -e "${BLUE}📦 2/6 - Core dependencies kuruluyor...${NC}"
npm install @react-navigation/native@^6.1.9 \
            @react-navigation/native-stack@^6.9.17 \
            @react-navigation/bottom-tabs@^6.5.11

npx expo install react-native-screens react-native-safe-area-context

echo -e "${GREEN}✅ Navigation paketleri kuruldu${NC}"
echo ""

# 3. Supabase
echo -e "${BLUE}📦 3/6 - Supabase & AsyncStorage kuruluyor...${NC}"
npm install @supabase/supabase-js@^2.39.0 \
            @react-native-async-storage/async-storage@^1.21.0 \
            react-native-url-polyfill@^2.0.0

echo -e "${GREEN}✅ Supabase entegrasyonu hazır${NC}"
echo ""

# 4. UI & Styling
echo -e "${BLUE}📦 4/6 - NativeWind & Tailwind kuruluyor...${NC}"
npm install nativewind@^2.0.11
npm install --save-dev tailwindcss@3.3.2

npx tailwindcss init

echo -e "${GREEN}✅ Styling sistemi kuruldu${NC}"
echo ""

# 5. Expo modules
echo -e "${BLUE}📦 5/6 - Expo modülleri kuruluyor...${NC}"
npx expo install expo-linking \
                  expo-web-browser \
                  expo-haptics \
                  expo-status-bar \
                  expo-splash-screen

echo -e "${GREEN}✅ Expo modülleri hazır${NC}"
echo ""

# 6. Lucide icons
echo -e "${BLUE}📦 6/6 - Icons kuruluyor...${NC}"
npm install lucide-react-native@^0.400.0

echo -e "${GREEN}✅ Icon paketi kuruldu${NC}"
echo ""

# Tailwind config oluştur
echo -e "${YELLOW}⚙️  tailwind.config.js yapılandırılıyor...${NC}"
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#F0F0F0',
        'brand-primary': '#98CD00',
        'brand-secondary': '#82CD47',
        'brand-dark': '#202020',
        'brand-white': '#FFFFFF',
      },
    },
  },
  plugins: [],
}
EOF

# Babel config güncelle
echo -e "${YELLOW}⚙️  babel.config.js yapılandırılıyor...${NC}"
cat > babel.config.js << 'EOF'
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['nativewind/babel'],
  };
};
EOF

# Dizin yapısını oluştur
echo -e "${YELLOW}📁 Dizin yapısı oluşturuluyor...${NC}"
mkdir -p src/screens
mkdir -p src/components
mkdir -p src/navigation
mkdir -p src/context
mkdir -p src/lib
mkdir -p src/utils

# Test screen oluştur
cat > src/screens/HomeScreen.tsx << 'EOF'
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
      <View className="bg-brand-primary rounded-b-3xl p-6">
        <Text className="text-white text-3xl font-bold">Kcal 🍽️</Text>
        <Text className="text-white/80 text-sm mt-2">
          React Native ile sağlıklı yaşam!
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 mt-6">
        <Text className="text-brand-dark text-xl font-bold mb-4">
          Hoş Geldiniz!
        </Text>

        <View className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
          <Text className="text-brand-dark font-bold text-lg">
            Izgara Tavuk 🍗
          </Text>
          <Text className="text-gray-500 text-sm mt-1">
            500 kcal • 45g protein
          </Text>
          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-brand-primary font-bold text-xl">
              ₺85.00
            </Text>
            <TouchableOpacity className="bg-brand-primary rounded-full px-5 py-2">
              <Text className="text-white font-bold">Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
          <Text className="text-brand-dark font-bold text-lg">
            Somon Salata 🥗
          </Text>
          <Text className="text-gray-500 text-sm mt-1">
            420 kcal • 38g protein
          </Text>
          <View className="flex-row items-center justify-between mt-3">
            <Text className="text-brand-primary font-bold text-xl">
              ₺95.00
            </Text>
            <TouchableOpacity className="bg-brand-primary rounded-full px-5 py-2">
              <Text className="text-white font-bold">Ekle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
EOF

# App.tsx güncelle
cat > App.tsx << 'EOF'
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <HomeScreen />
      <StatusBar style="light" backgroundColor="#98CD00" />
    </SafeAreaProvider>
  );
}
EOF

echo ""
echo -e "${GREEN}✨ KURULUM TAMAMLANDI! ✨${NC}"
echo ""
echo -e "${BLUE}📱 Uygulamayı başlatmak için:${NC}"
echo -e "   ${YELLOW}npx expo start${NC}"
echo ""
echo -e "${BLUE}📱 iOS Simulator:${NC}"
echo -e "   ${YELLOW}npx expo run:ios${NC}"
echo ""
echo -e "${BLUE}📱 Android Emulator:${NC}"
echo -e "   ${YELLOW}npx expo run:android${NC}"
echo ""
echo -e "${BLUE}📂 Proje Dizini:${NC}"
echo -e "   ${YELLOW}~/Desktop/kcal-mobile${NC}"
echo ""
echo -e "${GREEN}🎉 Başarılar dileriz!${NC}"
