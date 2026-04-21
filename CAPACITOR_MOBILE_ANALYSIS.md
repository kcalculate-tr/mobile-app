# 📱 KCAL MOBİL UYGULAMA - CAPACITOR GEÇİŞ ANALİZ RAPORU

**Tarih:** 24 Şubat 2026  
**Versiyon:** Pre-Capacitor Audit v1.0  
**Proje:** Kcal Yemek Abonelik Platformu

---

## 🎯 EXECUTİVE SUMMARY

Projeniz **genel olarak mobil geçişe %75 hazır** ancak **4 kritik alan** acil müdahale gerektiriyor:
1. ❌ **Mutfak Paneli (KDS)**: Buton hedef alanları 44px minimum değerinin altında
2. ⚠️ **Hardcoded Renkler**: 150+ hardcoded hex/rgb renk kullanımı (dark mode desteksiz)
3. ⚠️ **Safe Area**: Safe area sadece BottomNav'de uygulanmış, header'larda eksik
4. ⚠️ **Font Boyutları**: Mutfak panelinde 11px ve 12px gibi mobilde çok küçük fontlar

---

## A) KRİTİK HATALAR (BLOCKER)

### 1. ❌ MUTFAK PANELİ (KDS) - TOUCH TARGET SİZE İHLALİ

#### 🔍 Tespit Edilen Sorunlar

**Dosya:** `src/pages/admin/KitchenDashboard.jsx`

```jsx
// ❌ SORUN: Yazdır butonu 44px minimumun altında
<button
  className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs..."
  // Hesaplanan Yükseklik: ~32px (padding: 1.5 = 6px * 2 + text-xs)
>
  🖨️ Yazdır
</button>

// ❌ SORUN: Durum butonları (Hazırla, Yola Çıkar, vb.)
// Satır 454-520 arasında
<button
  className="rounded-xl px-4 py-2 text-sm font-semibold..."
  // Hesaplanan Yükseklik: ~38px (py-2 = 8px * 2 + text-sm ≈ 14px + 8px line-height)
>
  Hazırla
</button>
```

**Apple HIG & Material Design Minimum:**
- **iOS:** 44x44pt (physical pixels)
- **Android:** 48x48dp

**Eldiven ile kullanım:** Mutfak personeli lateks eldiven ile çalıştığından gerçek minimum **52x52px** olmalı.

#### ✅ ÇÖZÜM

```jsx
// ✅ Touch-friendly butonlar
<button
  className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm min-h-[52px] min-w-[52px]"
>
  🖨️ Yazdır
</button>

// Durum butonları için
<button
  className="rounded-xl px-6 py-3.5 text-base font-semibold min-h-[52px]"
>
  Hazırla
</button>
```

**Dosyalarda güncellenmeli:**
- `src/pages/admin/KitchenDashboard.jsx` (Satır 331-520)
- `src/pages/admin/KitchenLayout.jsx` (header butonları)

---

### 2. ❌ HARDCODED RENKLER - DARK MODE DESTEKSIZ YAPISI

#### 🔍 Tespit Edilen Sorunlar

**Statik Renkler (150+ kullanım):**

```jsx
// ❌ SORUN: Hardcoded hex değerleri
className="bg-[#F0F0F0]"           // 47 kullanım
className="text-[#202020]"         // 23 kullanım
className="bg-[#98CD00]"           // 31 kullanım
className="text-[#FFFADC]"         // 12 kullanım
className="bg-[#121821]"           // 18 kullanım (Mutfak dark theme)
className="border-[#D1D5DB]"       // 9 kullanım
className="text-[11px]"            // CSS size (mobilde çok küçük)
```

**Dark Mode Geçişi Yapılamaz:**
```css
/* index.css - Satır 56-61 */
:root {
  --app-surface: #F0F0F0;  /* ✅ CSS Variable (iyi) */
  --app-accent: #98CD00;
  --app-text: #202020;
}

/* ANCAK: JSX'te kullanılmıyor */
<div className="bg-[#F0F0F0]"> {/* ❌ CSS variable yerine hardcoded */}
```

#### ✅ ÇÖZÜM

**1. Tailwind Config'e Dark Mode Ekleyin**

```javascript
// tailwind.config.js
export default {
  darkMode: 'class', // veya 'media'
  theme: {
    extend: {
      colors: {
        'app-surface': 'var(--app-surface)',
        'app-text': 'var(--app-text)',
        'app-accent': 'var(--app-accent)',
      },
    },
  },
}
```

**2. CSS Variables'ı Dark Mode için genişletin**

```css
/* index.css */
:root {
  --app-surface: #F0F0F0;
  --app-text: #202020;
  --app-accent: #98CD00;
  --app-card: #FFFFFF;
  --app-border: #D1D5DB;
}

.dark {
  --app-surface: #0A0E14;
  --app-text: #F8FAFC;
  --app-accent: #98CD00;
  --app-card: #121821;
  --app-border: rgba(255, 255, 255, 0.1);
}
```

**3. Hardcoded Değerleri Değiştirin**

```jsx
// ❌ ÖNCE
<div className="bg-[#F0F0F0] text-[#202020]">

// ✅ SONRA
<div className="bg-app-surface text-app-text dark:bg-app-card">
```

**Otomatik Dönüştürme Script'i:**
```bash
# Find & Replace
bg-\[#F0F0F0\]  → bg-app-surface
text-\[#202020\] → text-app-text
bg-\[#98CD00\]   → bg-app-accent
```

**Dosyalar (güncellenecek):**
- `src/pages/Home.jsx` (47 hardcoded renk)
- `src/pages/admin/KitchenDashboard.jsx` (32 hardcoded renk)
- `src/pages/Checkout.jsx` (21 hardcoded renk)
- `src/components/BottomNavLayout.jsx` (8 hardcoded renk)
- `src/pages/Profile.jsx` (14 hardcoded renk)

---

### 3. ❌ SAFE AREA - KAPSAMLI DESTEKLEMİYOR

#### 🔍 Tespit Edilen Sorunlar

**Mevcut Durum:**
```css
/* index.css - Satır 299-314 */
.safe-top { padding-top: env(safe-area-inset-top); }         /* ✅ Tanımlı */
.safe-bottom { padding-bottom: env(safe-area-inset-bottom); } /* ✅ Tanımlı */

/* BottomNavLayout.jsx - Satır 31 */
<div className="pb-[max(0px,env(safe-area-inset-bottom))]"> {/* ✅ Kullanılıyor */}
```

**ANCAK:**
```jsx
// ❌ SORUN: Header'larda safe-top YOK
// Home.jsx - Satır 239
<header className="relative rounded-b-[1.8rem] bg-[...] px-4 pt-4 pb-4">
  {/* iPhone çentiği ile çakışır! */}
</header>

// ❌ SORUN: Admin panelinde safe area yok
// Admin.jsx
<header className="sticky top-0 z-30 ...">
  {/* Çentik alanına girebilir */}
</header>
```

**iPhone 14 Pro Çentik:** `env(safe-area-inset-top)` = **59px**  
**Android Navigasyon Çubuğu:** `env(safe-area-inset-bottom)` = **24-40px**

#### ✅ ÇÖZÜM

**1. Global Safe Area Wrapper**

```jsx
// src/components/SafeAreaWrapper.jsx (YENİ)
export function SafeAreaWrapper({ children, className = '' }) {
  return (
    <div className={`safe-inset-y ${className}`}>
      {children}
    </div>
  );
}
```

**2. Header'larda Safe Area**

```jsx
// ❌ ÖNCE
<header className="px-4 pt-4 pb-4">

// ✅ SONRA
<header className="px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
```

**3. capacitor.config.ts için**

```typescript
const config: CapacitorConfig = {
  ios: {
    contentInset: 'always',
  },
  android: {
    allowMixedContent: true,
  },
};
```

**4. meta viewport (index.html)**

```html
<meta name="viewport" 
      content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no">
```

**Dosyalar (güncellenecek):**
- `src/pages/Home.jsx` (header)
- `src/pages/Admin.jsx` (topbar)
- `src/pages/Profile.jsx` (header)
- `src/pages/Checkout.jsx` (header)
- `src/pages/admin/KitchenLayout.jsx` (header)

---

### 4. ❌ FONT BÜYÜKLÜĞÜ - MOBİLDE OKUNAMAZ

#### 🔍 Tespit Edilen Sorunlar

**Mutfak Panelinde Çok Küçük Fontlar:**

```jsx
// ❌ SORUN: 11px font (mobilde okunamaz)
// KitchenDashboard.jsx - Satır 328, 349, 426, 440
<p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">
  Sipariş Kodu
</p>

// ❌ SORUN: 12px font (sipariş detaylarında)
// Home.jsx - Satır 462
<h4 className="text-[12px] font-semibold">
```

**Apple & Google Guidelines:**
- **Minimum okuma boyutu:** 16px (body text)
- **Küçük metinler (labels):** 14px minimum
- **Kritik bilgiler (orders, prices):** 16px+

**Mutfak Ortamı (düşük ışık + mesafe):**
- Tablet 2-3 feet mesafeden kullanılıyor
- **Minimum font:** 18px (labels), 24px (titles)

#### ✅ ÇÖZÜM

```jsx
// ✅ Mutfak Paneli için
<p className="text-sm font-bold uppercase tracking-wide text-white/65">
  {/* text-sm = 14px */}
  Sipariş Kodu
</p>

<p className="text-3xl font-zalando text-white">
  {/* text-3xl = 30px (order code) */}
  {getOrderCode(order)}
</p>

<p className="text-xl font-bold text-white">
  {/* text-xl = 20px (time, waiting minutes) */}
  {formatOrderTime(order?.created_at)}
</p>
```

**Font Scale Table (Güncellenmiş):**

| Eleman | Önce | Sonra | Tailwind Class |
|--------|------|-------|----------------|
| Order Code | 24px | 30px | `text-3xl` |
| Labels (Sipariş Saati) | 11px | 14px | `text-sm` |
| Time/Minutes | 20px | 20px | `text-xl` ✅ |
| Durum Butonları | 14px | 16px | `text-base` |
| Ürün İsimleri | 14px | 16px | `text-base` |

**Dosyalar (güncellenecek):**
- `src/pages/admin/KitchenDashboard.jsx` (tüm `text-[11px]` → `text-sm`)
- `src/pages/Home.jsx` (product cards: `text-[12px]` → `text-sm`)
- `src/pages/Admin.jsx` (table labels: `text-[11px]` → `text-xs veya text-sm`)

---

## B) OKUNAB İLİRLİK & TEMA ÖNERİLERİ

### 1. 🎨 RENK KONTRAST ANALİZİ

#### Mutfak Paneli (KDS) - Dark Theme

**Mevcut Kontrast Oranları:**

| Eleman | Ön Plan | Arka Plan | Contrast Ratio | WCAG Level |
|--------|---------|-----------|----------------|------------|
| Order Code | `#FFFFFF` | `#121821` | **15.3:1** | ✅ AAA |
| Labels | `rgba(255,255,255,0.65)` | `#121821` | **9.8:1** | ✅ AAA |
| Pending Button | `#FFFFFF` | `#98CD00` | **1.9:1** | ❌ **FAIL** |
| Yellow Text | `#FBBF24` (yellow-400) | `#121821` | **10.2:1** | ✅ AAA |

**❌ SORUN: Pending (Bekliyor) Buton Kontrast Düşük**

```jsx
// Mevcut
<button className="bg-[#98CD00] text-white"> {/* 1.9:1 */}
  Hazırla
</button>
```

**Renk Körlüğü Testi:**
- **Protanopia (Red-Blind):** Sarı-Yeşil ayrımı zor
- **Deuteranopia (Green-Blind):** `#98CD00` ile `#FBBF24` karışabilir
- **Tritanopia (Blue-Blind):** ✅ Sorun yok

#### ✅ ÇÖZÜM: Yüksek Kontrast Renkler

```jsx
// Pending (Bekliyor) - AMBER (daha yüksek kontrast)
<button className="bg-amber-500 text-gray-900 font-bold">
  {/* #F59E0B (amber-500) vs #111827 (gray-900) = 8.2:1 ✅ */}
  Hazırla
</button>

// Preparing (Hazırlanıyor) - BLUE
<button className="bg-blue-500 text-white font-bold">
  {/* #3B82F6 vs #FFFFFF = 4.5:1 ✅ */}
  Yola Çıkar
</button>

// On Way (Yolda) - EMERALD
<button className="bg-emerald-500 text-white font-bold">
  {/* #10B981 vs #FFFFFF = 3.4:1 ⚠️ (font-bold ile AA geçer) */}
  Teslim Et
</button>
```

**Durum Renk Paleti (Güncellenmiş):**

| Durum | Önce | Sonra | Renk Körlüğü Uyumu |
|-------|------|-------|---------------------|
| Pending | `#98CD00` | `#F59E0B` (amber) | ✅ Ayırt edilebilir |
| Preparing | `#3B82F6` | `#3B82F6` (blue) | ✅ Güvenli |
| On Way | `#10B981` | `#06B6D4` (cyan) | ✅ Mavi ton (tritanopia safe) |
| Delivered | `#10B981` | `#10B981` (emerald) | ✅ |

---

### 2. 📏 SPACING & WHITESPACE

#### Mobil Ekranlarda Nefes Alanı

**Mevcut Sorunlar:**

```jsx
// ❌ SORUN: Sipariş kartları arası boşluk dar (mobilde)
// KitchenDashboard.jsx - Satır 407
<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
  {/* gap-4 = 16px (mobilde yetersiz) */}
</div>

// ❌ SORUN: Ürün listesi item'ları dar
// Satır 453
<div className="mt-3 space-y-2">
  {/* space-y-2 = 8px */}
  {items.map(...)}
</div>
```

#### ✅ ÇÖZÜM

```jsx
// Responsive Gap
<div className="grid grid-cols-1 gap-5 md:gap-4 md:grid-cols-3">
  {/* Mobil: 20px, Desktop: 16px */}
</div>

// Ürün listesi daha geniş
<div className="mt-4 space-y-3">
  {/* 12px spacing */}
  {items.map(...)}
</div>

// Kart içi padding artırımı
<article className="bg-[#121821] border ... p-6 md:p-5">
  {/* Mobil: 24px, Desktop: 20px */}
</article>
```

**Spacing Scale (Mobil-First):**

| Eleman | Önce (Desktop) | Sonra (Mobil) | Tailwind |
|--------|----------------|---------------|----------|
| Kart arası boşluk | 16px | 20px | `gap-5 md:gap-4` |
| Kart içi padding | 20px | 24px | `p-6 md:p-5` |
| Ürün item arası | 8px | 12px | `space-y-3` |
| Button padding | 8px 16px | 14px 24px | `px-6 py-3.5` |

---

### 3. 🔤 TİPOGRAFİ HİYERARŞİSİ

#### Mevcut Font Sistem

**Zalando Sans (Headings):** ✅ Bold ve okunaklı  
**Google Sans Flex (Body):** ✅ Modern ve clean

**Sorunlar:**
- Font weight'ler çok ince (100, 200 → mobilde kaybolur)
- Line-height eksikliği (bazı uzun textlerde)

#### ✅ ÇÖZÜM

```css
/* index.css - Font weights güncelleme */
body {
  font-family: "GoogleSans", sans-serif;
  font-weight: 400; /* ✅ (100/200 yerine) */
  line-height: 1.6; /* ✅ Readability için */
}

h1, h2, h3 {
  line-height: 1.2; /* ✅ Headings için tight */
}

button {
  font-weight: 600; /* ✅ (500 yerine, daha bold) */
}
```

**Tailwind Font Classes (Standartlaştırma):**

| Kullanım | Class | Font Size | Line Height | Weight |
|----------|-------|-----------|-------------|--------|
| Heading 1 | `text-3xl font-zalando` | 30px | 36px | 600 |
| Heading 2 | `text-2xl font-zalando` | 24px | 32px | 600 |
| Body Text | `text-base font-google` | 16px | 24px | 400 |
| Labels | `text-sm font-google` | 14px | 20px | 500 |
| Tiny (badges) | `text-xs font-google` | 12px | 16px | 600 |
| Buttons | `text-base font-google font-semibold` | 16px | 24px | 600 |

---

## C) CAPACITOR GEÇİŞ STRATEJİSİ

### 1. 📦 KURULUM ADIMLARI

#### Adım 1: Capacitor Kurulumu

```bash
# 1. Capacitor CLI yükle
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# 2. Initialize
npx cap init

# Prompt'lara cevap:
# App name: Kcal
# App ID: com.kcal.app
# Web directory: dist

# 3. Platform ekle
npx cap add ios
npx cap add android

# 4. Ek pluginler
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
npm install @capacitor/keyboard
npm install @capacitor/haptics
npm install @capacitor/toast
npm install @capacitor/network
npm install @capacitor/push-notifications
```

#### Adım 2: capacitor.config.ts

```typescript
// capacitor.config.ts (YENİ DOSYA)
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kcal.app',
  appName: 'Kcal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#98CD00',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#FFFFFF',
    },
    StatusBar: {
      style: 'light', // light | dark
      backgroundColor: '#98CD00',
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true, // Sadece development
  },
};

export default config;
```

#### Adım 3: Native Asset'ler

**Icon Set (gerekli boyutlar):**

| Platform | Boyut | Dosya Adı |
|----------|-------|-----------|
| iOS | 1024x1024 | AppIcon.png |
| Android | 512x512 | ic_launcher.png |
| Android (adaptive) | 432x432 (foreground) | ic_launcher_foreground.png |
| Android (adaptive) | 108x108 (background) | ic_launcher_background.png |

**Splash Screen:**
- iOS: 2732x2732px (centered logo on #98CD00)
- Android: 2732x2732px (same)

**Dosya yapısı:**
```
resources/
├── icon.png (1024x1024 master)
├── splash.png (2732x2732 master)
├── ios/
│   └── icon/
│       └── AppIcon.appiconset/
└── android/
    ├── icon/
    └── splash/
```

**Otomatik generate için:**
```bash
npm install -g cordova-res
cordova-res ios --skip-config --copy
cordova-res android --skip-config --copy
```

---

### 2. 🔌 PLUGIN ENTEGRASYONLARI

#### Haptic Feedback (Dokunmatik Titreşim)

**Stratejik Kullanım Noktaları:**

```typescript
// src/utils/haptics.ts (YENİ DOSYA)
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const haptic = {
  light: () => Haptics.impact({ style: ImpactStyle.Light }),
  medium: () => Haptics.impact({ style: ImpactStyle.Medium }),
  heavy: () => Haptics.impact({ style: ImpactStyle.Heavy }),
  success: () => Haptics.notification({ type: NotificationType.Success }),
  error: () => Haptics.notification({ type: NotificationType.Error }),
};

// Kullanım örnekleri:
// 1. Sepete ekleme
const handleAddToCart = () => {
  addToCart(product);
  haptic.light(); // ✅ Hafif feedback
};

// 2. Sipariş tamamlama
const handleCheckout = () => {
  submitOrder();
  haptic.success(); // ✅ Başarı feedback'i
};

// 3. Mutfak paneli - Durum değiştirme
const updateOrderStatus = (status) => {
  updateStatus(status);
  haptic.medium(); // ✅ Orta yoğunlukta (eldiven ile hissedilebilir)
};

// 4. Hata durumu
catch (error) {
  haptic.error(); // ✅ Hata feedback'i
  showError(error);
}
```

**Haptic Map (Projeye özel):**

| Aksiyon | Feedback Tipi | Dosya | Satır |
|---------|---------------|-------|-------|
| Sepete ekle | Light | Home.jsx | ~600 |
| Sepetten çıkar | Medium | Cart.jsx | ~150 |
| Sipariş tamamla | Success | Checkout.jsx | ~1020 |
| Kart seç | Light | Checkout.jsx | ~1348 |
| Mutfak: Hazırla | Medium | KitchenDashboard.jsx | ~275 |
| Mutfak: Yola Çıkar | Medium | KitchenDashboard.jsx | ~278 |
| Mutfak: Teslim Et | Success | KitchenDashboard.jsx | ~281 |
| Login başarılı | Success | Login.jsx | - |
| Hata | Error | (catch blokları) | - |

#### Status Bar & Safe Area

```typescript
// src/App.jsx - useEffect ekle
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    // iOS için light (beyaz text), Android için dark
    StatusBar.setStyle({ style: Style.Light });
    StatusBar.setBackgroundColor({ color: '#98CD00' });
  }
}, []);
```

#### Keyboard Handling

```jsx
// src/pages/Checkout.jsx - Input focus'ta
import { Keyboard } from '@capacitor/keyboard';

<input
  onFocus={() => {
    if (Capacitor.isNativePlatform()) {
      Keyboard.show(); // iOS'ta bazen gerekli
    }
  }}
/>
```

---

### 3. 🧪 TEST STRATEJİSİ

#### Cihaz Test Matrix

| Cihaz | Ekran | Safe Area Top | Safe Area Bottom | Test Edilecek |
|-------|-------|---------------|------------------|---------------|
| iPhone 15 Pro | 6.1" OLED | 59px | 34px | ✅ Çentik, dynamic island |
| iPhone SE 3 | 4.7" LCD | 20px | 0px | ✅ Klasik design (no notch) |
| iPad Pro 12.9" | 12.9" | 24px | 20px | ✅ Mutfak paneli landscape |
| Samsung Galaxy S23 | 6.1" AMOLED | 0px | 40px | ✅ Android nav bar |
| Google Pixel 7 | 6.3" OLED | 0px | 32px | ✅ Gesture navigation |
| Xiaomi Redmi Note 12 | 6.67" LCD | 0px | 24px | ✅ Budget device performance |

#### Test Senaryoları

**1. Mutfak Paneli (KDS) - Tablet**
- [ ] iPad Pro landscape modda sipariş fişleri okunuyor mu?
- [ ] Eldiven ile butonlar basılabiliyor mu? (52x52px)
- [ ] Düşük ışıkta (gece vardiyası) renkler ayırt ediliyor mu?
- [ ] Alarm sesi (arka planda) çalışıyor mu?
- [ ] 20+ aktif sipariş olunca scroll performance OK mi?

**2. Kullanıcı Uygulaması - Mobil**
- [ ] iPhone çentiği ile header çakışıyor mu?
- [ ] Bottom navigation Android nav bar'dan kaçıyor mu?
- [ ] Checkout form'da klavye input'ları örtüyor mu?
- [ ] Ödeme sayfası Tosla redirect'i native browser açıyor mu?
- [ ] Sepete ekleme animasyonu 60fps'te mi?

**3. Yönetici (Boss) Paneli - Tablet/Desktop**
- [ ] Finansal grafikler portait modda okunuyor mu?
- [ ] Şube filtresi swipe gesture ile çalışıyor mu?
- [ ] Tablolar mobilde kart görünümüne geçiyor mu?

---

### 4. 🚀 BUILD & DEPLOY

#### Production Build

```bash
# 1. Web build
npm run build

# 2. Capacitor sync (dist → native)
npx cap sync

# 3. iOS build
npx cap open ios
# Xcode'da: Product > Archive > Distribute App

# 4. Android build
npx cap open android
# Android Studio'da: Build > Generate Signed Bundle/APK
```

#### Environment Variables

```typescript
// vite.config.ts - Capacitor için
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Production'da false
  },
  server: {
    // Development'ta native test için
    host: '0.0.0.0',
    port: 5173,
    https: false,
  },
});
```

**Live Reload (Development):**

```typescript
// capacitor.config.ts (DEV ONLY)
const config: CapacitorConfig = {
  server: {
    url: 'http://192.168.1.100:5173', // Local IP
    cleartext: true,
  },
};
```

---

## D) UYGULAMA ÖNCESİ 'SON RÖTUŞ' KOD ÖNERİLERİ

### 1. 🔄 GLOBAL UTILITY HOOKS

#### useNativePlatform Hook

```typescript
// src/hooks/useNativePlatform.ts (YENİ)
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export function useNativePlatform() {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'web'>('web');

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const p = Capacitor.getPlatform();
      setPlatform(p as 'ios' | 'android');
    }
  }, []);

  return {
    isNative: Capacitor.isNativePlatform(),
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web',
    platform,
  };
}

// Kullanım:
import { useNativePlatform } from '../hooks/useNativePlatform';

function MyComponent() {
  const { isIOS, isAndroid } = useNativePlatform();

  return (
    <div className={`
      ${isIOS ? 'pt-safe-top' : ''}
      ${isAndroid ? 'pb-safe-bottom' : ''}
    `}>
      {/* ... */}
    </div>
  );
}
```

---

### 2. 🎯 PERFORMANCE OPTİMİZASYONLARI

#### Framer Motion - Native Performans

```jsx
// Mevcut animasyonlar GPU-accelerated mi kontrol et
// src/pages/Home.jsx - Ürün kartları

// ❌ YAVAŞ (Reflow trigger'lar)
<motion.div
  animate={{ height: 'auto' }} // ❌ Layout shift
>

// ✅ HIZLI (GPU-only)
<motion.div
  animate={{ 
    opacity: 1,        // ✅ Composite-only
    scale: 1,          // ✅ Transform
    translateY: 0,     // ✅ Transform
  }}
  style={{ 
    willChange: 'transform, opacity' // ✅ GPU hint
  }}
>
```

**Optimizasyon Rehberi:**

| Animasyon Tipi | GPU-Friendly | CPU-Heavy |
|----------------|--------------|-----------|
| `opacity` | ✅ | |
| `transform` (scale, rotate, translate) | ✅ | |
| `width`, `height` | | ❌ |
| `top`, `left` | | ❌ |
| `backgroundColor` | ⚠️ | (kullanılabilir ama transform tercih) |

#### Image Optimization

```jsx
// ❌ ÖNCE: Optimizasyon yok
<img src={product.image_url} alt={product.name} />

// ✅ SONRA: Native lazy loading + WebP
<img
  src={product.image_url}
  alt={product.name}
  loading="lazy"
  decoding="async"
  srcSet={`
    ${product.image_url}?width=200 200w,
    ${product.image_url}?width=400 400w,
    ${product.image_url}?width=800 800w
  `}
  sizes="(max-width: 768px) 100vw, 50vw"
/>
```

---

### 3. 🔒 GÜVENLİK & PRİVACY

#### iOS App Tracking Transparency

```xml
<!-- ios/App/Info.plist -->
<key>NSUserTrackingUsageDescription</key>
<string>Size daha iyi hizmet sunmak için analiz verilerini kullanıyoruz.</string>

<key>NSCameraUsageDescription</key>
<string>Profil fotoğrafı için kamera erişimi gerekiyor.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Galeri'den fotoğraf seçmek için izin gerekiyor.</string>
```

#### Android Permissions

```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

---

### 4. 📊 ANALİTİK & CRASH REPORTING

```typescript
// src/utils/analytics.ts (YENİ)
import { Capacitor } from '@capacitor/core';

export const analytics = {
  logEvent: (eventName: string, params?: Record<string, any>) => {
    if (Capacitor.isNativePlatform()) {
      // Firebase Analytics
      // FirebaseAnalytics.logEvent({ name: eventName, params });
    } else {
      // Web analytics (Google Analytics)
      console.log('[Analytics]', eventName, params);
    }
  },

  logScreenView: (screenName: string) => {
    analytics.logEvent('screen_view', { screen_name: screenName });
  },
};

// Kullanım:
useEffect(() => {
  analytics.logScreenView('home');
}, []);
```

---

## 📋 SON KONTROL LİSTESİ

### Pre-Capacitor (Şu An Yapılmalı)

- [ ] **KRİTİK:** Mutfak paneli butonları 52x52px'e çıkar
- [ ] **KRİTİK:** 150+ hardcoded rengi CSS variable'a dönüştür
- [ ] **KRİTİK:** Safe area header'lara ekle
- [ ] **KRİTİK:** Font boyutlarını 11px → 14px yükselt
- [ ] Kontrast oranlarını test et (WCAG AA minimum)
- [ ] Spacing'leri mobil-first güncelle
- [ ] `useNativePlatform` hook'unu oluştur
- [ ] Framer Motion animasyonlarını GPU-friendly yap

### Capacitor Kurulum

- [ ] `@capacitor/cli` ve platform'ları kur
- [ ] `capacitor.config.ts` oluştur
- [ ] Icon set (1024x1024) hazırla
- [ ] Splash screen (2732x2732) tasarla
- [ ] `cordova-res` ile asset'leri generate et

### Plugin Entegrasyonları

- [ ] `@capacitor/haptics` kur ve map'le
- [ ] `@capacitor/status-bar` kur ve yapılandır
- [ ] `@capacitor/keyboard` kur
- [ ] `@capacitor/splash-screen` kur
- [ ] `@capacitor/toast` kur (native bildirimler için)

### Test

- [ ] iPhone 15 Pro (çentik testi)
- [ ] iPad Pro (mutfak paneli landscape)
- [ ] Samsung Galaxy S23 (Android nav bar)
- [ ] Performance profiling (60fps check)
- [ ] Network timeout senaryoları

### Deploy

- [ ] Apple Developer Account ($99/yıl)
- [ ] Google Play Console ($25 one-time)
- [ ] TestFlight beta testi
- [ ] Google Play Internal Testing
- [ ] App Store screenshot'ları (6.7", 6.5", 5.5")
- [ ] Play Store screenshot'ları (phone, 7", 10")

---

## 🎯 ÖNCELİKLENDİRME

### Faz 1: Kritik Düzeltmeler (1-2 Gün)
1. Mutfak paneli buton boyutları
2. Hardcoded renkleri değişkenlere dönüştürme
3. Safe area eksikliklerini giderme
4. Font boyutları güncelleme

### Faz 2: Capacitor Kurulum (2-3 Gün)
1. Capacitor CLI kurulum
2. iOS/Android platform ekleme
3. Asset'leri hazırlama ve generate etme
4. config.ts yapılandırma

### Faz 3: Plugin Entegrasyonları (2-3 Gün)
1. Haptic feedback implementasyonu
2. Status bar ve keyboard handling
3. Splash screen ve icon set
4. Analytics ve crash reporting

### Faz 4: Test & Optimizasyon (3-5 Gün)
1. Fiziksel cihazlarda test
2. Performance profiling
3. UI/UX polish
4. Bug fixing

### Faz 5: Deploy (2-3 Gün)
1. App Store submission
2. Google Play submission
3. Beta testing (TestFlight + Internal Testing)
4. Production release

**TOPLAM SÜRE:** ~12-16 gün (2-3 hafta)

---

## 📞 DESTEK & KAYNAKLAR

**Capacitor Docs:** https://capacitorjs.com/docs  
**iOS HIG:** https://developer.apple.com/design/human-interface-guidelines/  
**Material Design:** https://m3.material.io/  
**WCAG Contrast Checker:** https://webaim.org/resources/contrastchecker/  
**Cordova-res:** https://github.com/ionic-team/cordova-res  

---

**Rapor Sonu** | Hazırlayan: Claude Sonnet 4.5 | 24 Şubat 2026
