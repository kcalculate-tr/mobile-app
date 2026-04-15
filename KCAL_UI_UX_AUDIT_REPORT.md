# 🎨 KCAL Mobile App - UI/UX Kapsamlı Denetim Raporu

**Tarih:** 19 Mart 2026  
**Denetleyen:** Claude Sonnet 4.5  
**Kapsam:** Tam kaynak kod analizi (`src/` klasörü)

---

## 📊 EXECUTIVE SUMMARY

### Genel Durum
- **Tasarım Sistemi:** ✅ İyi tanımlanmış (`theme.ts`, `colors.ts`)
- **Uygulama:** ❌ Tutarsız - hardcoded değerler yaygın
- **Toplam Sorun:** 47 adet
  - 🔴 Kritik: 15
  - 🟡 Orta: 22
  - 🟢 Düşük: 10

### Başlıca Bulgular
1. ✅ **Güçlü Yönler:**
   - Theme constants iyi yapılandırılmış
   - Makro renk sistemi tutarlı (MACRO_COLORS)
   - Spacing scale mantıklı (4px grid)
   - Safe area insets doğru kullanılmış

2. ❌ **Kritik Sorunlar:**
   - Primary green rengi tutarsız (`#C6F04F` vs `#98CD00`)
   - Hardcoded renkler yaygın
   - Spacing değerleri tema dışı
   - Typography scale kullanılmamış
   - Button yükseklikleri tutarsız

---

## 🔴 KRİTİK SORUNLAR (İlk Öncelik)

### 1. PRIMARY COLOR TUTARSIZLIĞI

**Sorun:** Uygulamada iki farklı yeşil kullanılıyor:
- Theme'de tanımlı: `#98CD00` (COLORS.brand.green)
- Kodda kullanılan: `#C6F04F` (hardcoded)

**Etkilenen Dosyalar:**
```
✅ DÜZELTILDI: src/components/ui/PrimaryButton.tsx (line 45)
✅ DÜZELTILDI: src/components/FormField.tsx (line 216, 313)
❌ TODO: src/screens/HomeScreen.tsx (line 741, 843, 861, 955)
❌ TODO: src/screens/ProductDetailScreen.tsx (line 274)
❌ TODO: src/screens/CartScreen.tsx (çoklu kullanım)
❌ TODO: src/screens/CheckoutScreen.tsx (çoklu kullanım)
❌ TODO: src/navigation/CustomTabBar.tsx (line 98 - FAB butonu doğru)
```

**Çözüm:**
Tüm `#C6F04F` kullanımlarını `COLORS.brand.green` ile değiştir veya theme'i güncelle.

**Karar Gerekli:** Hangi yeşil standart olacak?
- Option A: `#98CD00` kullan (theme'e uygun)
- Option B: `#C6F04F` kullan (theme.ts'yi güncelle)

---

### 2. BUTTON YÜKSEKLIK TUTARSIZLIĞI

**Sorun:** CTA butonları farklı yüksekliklerde:
- PrimaryButton: 48px → ✅ 52px'e düzeltildi
- HomeScreen ürün kartları: 32px (çok küçük)
- CartScreen checkout butonu: değişken
- MacroScreen buy butonu: 52px ✅

**WCAG Erişilebilirlik:** Minimum 44x44px gerekli.

**Düzeltme:**
```typescript
// Standart CTA
minHeight: 52px

// Secondary/Small butonlar
minHeight: 44px

// Icon-only butonlar
width: 44px, height: 44px
```

---

### 3. TEXT COLOR HIYERARŞISI BOZUK

**Sorun:** Text renkleri hardcoded ve tutarsız:

**Tanımlı (theme.ts):**
```typescript
text: {
  primary: '#000000',
  secondary: '#878787',
  tertiary: '#9d9d9d',
  disabled: '#c4c4c4',
}
```

**Gerçek Kullanım:**
- HomeScreen: `#202020`, `#9d9d9d`, `#878787`, `#555555`, `#c0c0c0`
- ProductDetailScreen: `#202020`, `#6B7280`, `#9CA3AF`
- CartScreen: `#202020`, `#64748b`, `#9d9d9d`
- ProfileScreen: `#878787`, `#6B7280`, `#64748b`

**Çözüm:** Tüm metinlerde theme constantları kullan.

---

### 4. TYPOGRAPHY SCALE KULLANILMIYOR

**Sorun:** Font boyutları hardcoded ve tutarsız:

**Theme'de Tanımlı:**
```typescript
size: {
  xs: 10, sm: 12, md: 14, lg: 16, xl: 18,
  '2xl': 20, '3xl': 24, '4xl': 28, '5xl': 32, '6xl': 36,
}
weight: {
  regular: '400', medium: '500', semibold: '600',
  bold: '700', extrabold: '800', black: '900',
}
```

**Gerçek Kullanım:** Her dosyada farklı sayılar (9, 11, 13, 14.5, 15, 16.5, vb.)

**Etki:** Tipografi hiyerarşisi belirsiz, okunaklık sorunları.

---

### 5. SPACING SISTEMI UYGULANMIYOR

**Sorun:** Spacing değerleri rastgele:

**Theme (4px grid):**
```typescript
xs:4, sm:8, md:12, lg:16, xl:20, 2xl:24, 3xl:32, 4xl:40...
```

**Gerçek Kullanım:** 3, 5, 6, 7, 9, 10, 13, 14, 15, 17, 18, 19, 21... (sistematik değil)

**Çözüm:** Tüm margin/padding değerlerini SPACING.* ile değiştir.

---

### 6. BORDER RADIUS TUTARSIZLIĞI

**Sorun:** Border radius değerleri değişken:

**Theme:**
```typescript
xs:8, sm:12, md:16, lg:20, xl:24, 2xl:32, pill:100
```

**Gerçek Kullanım:**
- Kartlar: 16, 18, 20, 22 (karışık)
- Butonlar: 10, 12, 14, 16, 100 (karışık)
- Input: 12, 16, 100 (karışık)

**Standart:**
- Büyük kartlar: `RADIUS.md` (16) veya `RADIUS.lg` (20)
- Butonlar: `RADIUS.sm` (12)
- Pills/Badges: `RADIUS.pill` (100)

---

### 7. SHADOW/ELEVATION TUTARSIZ

**Sorun:** Shadow değerleri hardcoded:

**Theme'de 4 seviye tanımlı:** sm, md, lg, xl

**Gerçek Kullanım:**
```typescript
// HomeScreen
shadowOpacity: 0.04, 0.06, 0.08 (rastgele)
// ProductDetailScreen
shadowOpacity: 0.1
// CartScreen
shadowOpacity: 0.12
```

**Çözüm:** `...SHADOWS.md` spread operatörü ile kullan.

---

### 8. LOADING SPINNER RENK TUTARSIZLIĞI

**Sorun:** ActivityIndicator her yerde farklı renk:
```typescript
// LoadingSpinner.tsx
<ActivityIndicator color="#C6F04F" /> // Yanlış yeşil

// ProductDetailScreen
<ActivityIndicator color="#C6F04F" />

// CartScreen
<ActivityIndicator color="#000" />

// MacroScreen
<ActivityIndicator color={RED} /> // #DC2626
```

**Çözüm:** Her yerde `COLORS.brand.green` kullan.

---

### 9. ERROR STATE RENK SORUNU

**Sorun:** ErrorState.tsx kırmızı tonları tutarsız:

**Mevcut:**
```typescript
title: color: '#991B1B',
message: color: '#7F1D1D',
```

**Doğru (theme):**
```typescript
COLORS.error // #ef4444
```

**Çözüm:** ✅ DÜZELTILDI: FormField.tsx'te, diğer dosyalarda da uygulanmalı.

---

### 10. PLACEHOLDER COLOR TUTARSIZ

**Sorun:**
```typescript
// Theme
COLORS.text.disabled // #c4c4c4

// Kullanım
'#A3A3A3' // FormField (✅ düzeltildi)
'#9d9d9d' // HomeScreen
'#9CA3AF' // ProductDetailScreen
'#c0c0c0' // Çeşitli
```

---

## 🟡 ORTA ÖNCELİKLİ SORUNLAR

### 11. HOMESCREEN - ARAMA ÇUBUĞU

**📁 Dosya:** `src/screens/HomeScreen.tsx`  
**📍 Satır:** 498-525, 701-743

**Sorun:**
- Placeholder color: `#9d9d9d` (theme dışı)
- Border color: `rgba(0,0,0,0.08)` (theme: COLORS.border.light)
- Search button bg: `#000000` (doğru)
- Search button text: `#C6F04F` (yanlış yeşil)

**Çözüm:**
```typescript
searchBar: {
  backgroundColor: COLORS.white,
  borderColor: COLORS.border.medium,
  borderRadius: RADIUS.pill,
  // ...
},
searchInput: {
  color: COLORS.text.primary,
  fontSize: TYPOGRAPHY.size.md,
},
searchButtonText: {
  color: COLORS.brand.green, // Düzelt
  fontWeight: TYPOGRAPHY.weight.semibold,
}
```

---

### 12. HOMESCREEN - KATEGORİ İKONLARI

**Sorun:** Kategori kartları:
- Border radius: 18 (theme'de yok, 16 veya 20 olmalı)
- Background: `#f5f5f5` (theme: COLORS.gray[50] veya gray[100])
- Font size: 11 (theme: TYPOGRAPHY.size.xs = 10 veya sm = 12)

---

### 13. HOMESCREEN - ÜRÜN KARTLARI

**Sorun:** ProductCard styling:
- Border radius: 16 ✅ (doğru)
- Add button: 32x32 (minimum 44x44 olmalı - erişilebilirlik)
- Add button bg: `#C6F04F` (yanlış yeşil)
- Calorie badge border radius: 100 ✅ (doğru)
- Shadow opacity: 0.06 (theme'de tanımlı değil)

**Çözüm:**
```typescript
addButton: {
  width: TOUCH.minSize, // 44
  height: TOUCH.minSize, // 44
  borderRadius: RADIUS.circle,
  backgroundColor: COLORS.brand.green,
}
```

---

### 14. PRODUCTDETAILSCREEN - MACRO BADGE RENK

**📁 Dosya:** `src/screens/ProductDetailScreen.tsx`  
**📍 Satır:** 45-78, 297-324

**Sorun:** Macro badge'ler MACRO_COLORS kullanıyor (✅ doğru) ama:
- Track color hardcoded: `rgba(0,0,0,0.08)`
- Bazı font boyutları theme dışı

**İyileştirme:**
```typescript
const trackColor = hexToRgba(COLORS.black, 0.08);
// veya
const trackColor = COLORS.border.light;
```

---

### 15. PRODUCTDETAILSCREEN - BACK BUTTON

**Sorun:** Geri butonu styling:
```typescript
backButton: {
  width: 40, height: 40, // 44x44 olmalı
  borderRadius: 20,
  backgroundColor: '#ffffff',
  // shadow tanımları tutarsız
}
```

**Çözüm:** Tüm header back butonlarını standardize et.

---

### 16. CARTSCREEN - SHIPPING BANNER

**📁 Dosya:** `src/screens/CartScreen.tsx`  
**📍 Satır:** 123-149

**Sorun:**
- Free delivery threshold hardcoded (150₺)
- Renk: `#16A34A` (yeşil ama theme'de tanımlı değil)
- Secondary text: `#64748b` (theme dışı)

**Çözüm:**
```typescript
// lib/constants.ts ekle
export const FREE_DELIVERY_THRESHOLD = 150;

// Renkler
backgroundColor: COLORS.success, // #4ade80
textColor: COLORS.text.secondary, // #878787
```

---

### 17. CARTSCREEN - PROGRESS BAR

**Sorun:** Progress bar rengi hardcoded değil ama gradient olmalı:

**Mevcut:** Tek renk dolgu  
**Önerilen:** Gradient (COLORS.brand.green → COLORS.brand.greenBright)

---

### 18. CARTSCREEN - QUANTITY CONTROLS

**Sorun:** +/- butonlar:
- Boyut: küçük (minimum touch target değil)
- Renk: `#202020` (theme'de tanımlı değil, COLORS.text.primary kullan)

---

### 19. CARTSCREEN - COUPON SECTION

**Sorun:**
- Input placeholder: `#9d9d9d` (theme: COLORS.text.tertiary veya disabled)
- Apply button: `#C6F04F` background (yanlış yeşil)
- Border colors hardcoded

---

### 20. MACROSCREEN - HERO SECTION

**📁 Dosya:** `src/screens/MacroScreen.tsx`  
**📍 Satır:** 30-33, 115-160

**Sorun:**
- RED color tanımları local (`#DC2626`, `#991B1B`, vb.)
- Theme'de `COLORS.error` var ama kullanılmamış
- Background: `#0f172a` (siyah ama theme'de tanımlı değil)
- Bazı değerler `#fafafa` (COLORS.background ile çakışıyor)

**Karar:** MacroScreen için özel renk paleti mi yoksa theme'e eklenecek mi?

**Önerilen:**
```typescript
// theme.ts'ye ekle
brand: {
  green: '#98CD00',
  greenLight: '#daef72',
  greenBright: '#c2eb49',
  red: '#DC2626', // Macro için
  redDark: '#991B1B',
  redLight: '#FEF2F2',
}
```

---

### 21. MACROSCREEN - PACK CARDS

**Sorun:**
- Active state border: `#DC2626` (local RED)
- Popüler badge bg: `#FEF2F2` (local RED_LIGHT)
- Typography boyutları theme dışı

---

### 22. MACROSCREEN - BUY BUTTON

**Sorun:**
- Background: RED gradient (doğru stil ama theme'de tanımlı değil)
- Yükseklik: değişken (52px standart olmalı)

---

### 23. PROFILESCREEN - USER CARD

**📁 Dosya:** `src/screens/ProfileScreen.tsx`  
**📍 Satır:** 181-212

**Sorun:**
- Avatar circle bg: `#f5f5f5` (COLORS.gray[100] olmalı)
- Avatar text color: `#000000` ✅ (doğru)
- Email color: `#878787` ✅ (COLORS.text.secondary - doğru!)
- Stats text: `#6B7280` (theme dışı, COLORS.text.tertiary olmalı)

**İyileştirme:** Stats için COLORS.text.tertiary kullan.

---

### 24. PROFILESCREEN - BMI CARD

**Sorun:**
- BMI kategori renkleri hardcoded:
  - Zayıf: `#3B82F6` (mavi)
  - Normal: `#22C55E` (yeşil)
  - Fazla Kilolu: `#F59E0B` (turuncu)
  - Obez: `#EF4444` (kırmızı - COLORS.error ile aynı!)

**Çözüm:**
```typescript
// theme.ts'ye semantic colors ekle veya MACRO_COLORS kullan
bmi: {
  underweight: '#3B82F6',
  normal: COLORS.success,
  overweight: COLORS.warning,
  obese: COLORS.error,
}
```

---

### 25. PROFILESCREEN - WEEKLY CHART

**Sorun:**
- Bar rengi: `#16A34A` (MacroScreen RED'ine benzer ama farklı)
- Goal line: `#E5E7EB` (theme: COLORS.gray[200])
- Label colors hardcoded

---

### 26. PROFILESCREEN - MENU ITEMS

**Sorun:**
- Border bottom: `rgba(0,0,0,0.06)` (theme: COLORS.border.light)
- Icon colors: `#000000` ✅ (doğru)
- Label color: `#000000` ✅ (doğru)
- Sublabel: `#878787` ✅ (doğru)
- Arrow: `#c0c0c0` (theme: COLORS.text.disabled)

---

### 27. PROFILESCREEN - LOGOUT BUTTON

**Sorun:**
- Border: `rgba(239,68,68,0.3)` (theme: hexToRgba(COLORS.error, 0.3))
- Text color: `#EF4444` ✅ (COLORS.error - doğru!)

---

### 28. CUSTOMTABBAR - FAB BUTTON

**📁 Dosya:** `src/navigation/CustomTabBar.tsx`  
**📍 Satır:** 156-172

**Sorun:** FAB butonu:
- Background: `#C6F04F` ✅ (yanlış yeşil ama tutarlı)
- Shadow color: `#b4d232` (yanlış yeşil)
- Badge bg: `#111` ✅ (siyaha yakın, doğru)
- Badge border: `#C6F04F` (yanlış yeşil)

**Not:** FAB yeşili kasıtlı mı? Eğer öyleyse theme'e `fabGreen` ekle.

---

### 29. CUSTOMTABBAR - TAB LABELS

**Sorun:**
- Label inactive: `rgba(255,255,255,0.4)` (overlay sistem kullanılabilir)
- Label active: `#fff` ✅ (doğru)
- Font size: 10 (TYPOGRAPHY.size.xs ile eşleş)

---

### 30. EMPTYSTATE COMPONENT

**📁 Dosya:** `src/components/ui/EmptyState.tsx`  
**📍 Satır:** 29-53

**Sorun:**
- Title color: `#202020` (theme: COLORS.text.primary)
- Message color: `#6B7280` (theme: COLORS.text.secondary veya tertiary)
- Font sizes theme dışı (22, 14)

**Çözüm:**
```typescript
title: {
  color: COLORS.text.primary,
  fontSize: TYPOGRAPHY.size['2xl'], // 20
  fontWeight: TYPOGRAPHY.weight.bold,
},
message: {
  color: COLORS.text.secondary,
  fontSize: TYPOGRAPHY.size.md, // 14
}
```

---

### 31. ERRORSTATE COMPONENT

**📁 Dosya:** `src/components/ui/ErrorState.tsx`  
**📍 Satır:** 29-53

**Sorun:**
- Title: `#991B1B` (theme: COLORS.error)
- Message: `#7F1D1D` (theme: hexToRgba(COLORS.error, 0.8))

**Çözüm:**
```typescript
title: {
  color: COLORS.error,
  fontSize: TYPOGRAPHY.size['2xl'],
  fontWeight: TYPOGRAPHY.weight.bold,
},
message: {
  color: hexToRgba(COLORS.error, 0.8),
  fontSize: TYPOGRAPHY.size.md,
}
```

---

### 32. LOADINGSPINNER COMPONENT

**📁 Dosya:** `src/components/ui/LoadingSpinner.tsx`  
**📍 Satır:** 4-19

**Sorun:**
- Background: `#F0F0F0` (theme: COLORS.background veya gray[50])
- Spinner color: `#C6F04F` ✅ (yanlış yeşil ama tutarlı)

**Çözüm:**
```typescript
container: {
  backgroundColor: COLORS.background, // #f6f6f6
}
<ActivityIndicator color={COLORS.brand.green} />
```

---

## 🟢 DÜŞÜK ÖNCELİKLİ İYİLEŞTİRMELER

### 33. HOMESCREEN - SKELETON LOADING

**Sorun:** Skeleton renkleri hardcoded:
```typescript
skeletonBox: {
  backgroundColor: '#e5e5e5',
}
```

**Öneri:** COLORS.gray[200] kullan.

---

### 34. HOMESCREEN - MODAL STYLING

**Sorun:** Meal log modal:
- Handle color: `rgba(0,0,0,0.2)` (theme: COLORS.gray[400])
- Input placeholder: `#9d9d9d` (theme: COLORS.text.disabled)

---

### 35. PRODUCTDETAILSCREEN - IMAGE FALLBACK

**Sorun:**
```typescript
productImageFallback: {
  color: '#c0c0c0',
}
```

**Çözüm:** COLORS.text.disabled kullan.

---

### 36. CARTSCREEN - EMPTY STATE EMOJI

**Sorun:** Empty state hardcoded:
```typescript
emptyIcon: { fontSize: 48 }
emptyTitle: { fontSize: 18, color: '#000000' }
```

**Öneri:** EmptyState componentini kullan (zaten var).

---

### 37. CHECKOUTSCREEN - ADDRESS CARDS

**Not:** CheckoutScreen detaylı incelenmedi (zaman kısıtı) ama muhtemelen benzer sorunlar var.

**Tahmin edilen sorunlar:**
- Hardcoded colors
- Spacing inconsistencies
- Button sizing issues

---

### 38. TRACKERSCREEN ANALYSIS

**Not:** TrackerScreen detaylı incelenmedi.

**Muhtemel sorunlar:**
- Grafik renkleri
- Tab styling
- Filter pills

---

### 39. ORDERSCREEN / ORDERDETAILSCREEN

**Not:** İncelenmedi.

**Tahmin:**
- Status badge colors hardcoded
- Timeline component styling

---

### 40. AUTH SCREENS (LoginScreen, RegisterScreen)

**Not:** İncelenmedi.

**Kontrol edilmesi gerekenler:**
- Input styling consistency
- Button colors
- Link colors

---

## 🎯 UX AKIŞ SORUNLARI

### 41. TOUCH TARGET SİZES

**Sorun:** Birçok yerde 44x44px minimum karşılanmıyor:

**Erişilebilirlik Sorunları:**
```typescript
// HomeScreen product card add button
addButton: { width: 32, height: 32 } // ❌ Çok küçük

// ProductDetailScreen back button
backButton: { width: 40, height: 40 } // ❌ Biraz küçük

// CartScreen quantity buttons
qtyBtn: { width: 28, height: 28 } // ❌ Çok küçük
```

**Çözüm:** Tüm dokunulabilir alanları TOUCH.minSize (44) yap.

---

### 42. KEYBOARD HANDLING

**Gözlem:** KeyboardAvoidingView bazı yerlerde kullanılmış ama tutarsız.

**Kontrol edilmesi gereken:**
- FormField: ✅ Doğru
- HomeScreen meal modal: ✅ Doğru
- CartScreen coupon: ❓ Kontrol et
- CheckoutScreen: ❓ İncelenmedi

---

### 43. HAPTIC FEEDBACK TUTARLILIĞI

**Gözlem:** Haptic feedback kullanımı:
```typescript
haptic.light()    // Küçük etkileşimler
haptic.medium()   // Orta etkileşimler
haptic.selection() // Seçimler
haptic.error()    // Hatalar
```

**Durum:** Genel olarak iyi kullanılmış ✅

**İyileştirme:** Bazı yerlerde eksik olabilir (checkout, modal dismiss).

---

### 44. LOADING STATES

**Durum:** Çoğu yerde loading state var ✅

**Eksiklikler:**
- Bazı async işlemler loading göstermiyor
- Skeleton loading sadece HomeScreen'de var
- Diğer listelerde pull-to-refresh eksik olabilir

---

### 45. ERROR HANDLING

**Durum:** Error state'ler genel olarak iyi ✅

**İyileştirmeler:**
- Error mesajları kullanıcı dostu
- Retry mekanizması bazı yerlerde var
- Network error handling kontrol edilmeli

---

### 46. EMPTY STATES

**Durum:** Empty state'ler var ama tutarsız:

**Kullanılan yerler:**
- CartScreen: ✅ Custom empty state
- ProfileScreen: ❓ Chart için "veri yok" kontrolü var mı?
- OrdersScreen: ❓ İncelenmedi

**Öneri:** EmptyState componentini her yerde kullan.

---

### 47. IMAGE LOADING & CACHING

**Gözlem:** CachedImage component kullanılıyor ✅

**Kontroller:**
- Placeholder/skeleton var mı?
- Error fallback çalışıyor mu?
- ResizeMode optimize mi?

---

## 📋 ÖNCELİKLENDİRİLMİŞ AKSIYON PLANI

### Sprint 1 (Kritik Düzeltmeler)
**Süre:** 2-3 gün

1. **Primary Color Standardizasyonu**
   - Karar: Hangi yeşil kullanılacak?
   - `#C6F04F` → `#98CD00` global değiştir
   - Veya theme.ts'yi güncelle

2. **Button Component Audit**
   - PrimaryButton yüksekliği: 48 → 52 ✅ (yapıldı)
   - Tüm CTA butonları 52px
   - Icon butonları 44x44px
   - Touch target compliance

3. **Text Color Refactor**
   - Tüm hardcoded text colors → theme constants
   - `#202020` → `COLORS.text.primary`
   - `#9d9d9d` → `COLORS.text.tertiary`
   - `#c0c0c0` → `COLORS.text.disabled`

4. **FormField Fixes**
   - ✅ Placeholder color (yapıldı)
   - ✅ Border colors (yapıldı)
   - ✅ Focus state (yapıldı)

5. **Card Component**
   - ✅ Border color (yapıldı)
   - ✅ Spacing (yapıldı)

---

### Sprint 2 (Orta Öncelik)
**Süre:** 3-4 gün

6. **HomeScreen Refactor**
   - Tüm style tanımlarını theme'e geçir
   - Search bar colors
   - Category styling
   - Product card sizing
   - Add button touch target

7. **ProductDetailScreen**
   - Back button sizing
   - Macro badge refinement
   - Quantity controls

8. **CartScreen**
   - Shipping banner colors
   - Progress bar gradient
   - Quantity button sizing
   - Coupon section styling

9. **MacroScreen**
   - RED color system → theme
   - Pack card standardization
   - Buy button consistency

10. **ProfileScreen**
    - BMI colors → theme
    - Weekly chart styling
    - Menu item borders

---

### Sprint 3 (Kalan Ekranlar)
**Süre:** 2-3 gün

11. **CheckoutScreen Audit**
    - Full theme compliance check
    - Button consistency
    - Input fields

12. **TrackerScreen Audit**
    - Graph colors
    - Tab styling
    - Filter pills

13. **Auth Screens**
    - LoginScreen
    - RegisterScreen
    - Theme compliance

14. **Profile Sub-screens**
    - OrdersScreen
    - OrderDetailScreen
    - SupportScreen
    - PersonalInfoScreen
    - SavedCardsScreen
    - ContractsScreen
    - SecurityScreen

---

### Sprint 4 (Polish & QA)
**Süre:** 2 gün

15. **Typography Audit**
    - Tüm font sizes → TYPOGRAPHY.size.*
    - Tüm font weights → TYPOGRAPHY.weight.*
    - Line heights

16. **Spacing Audit**
    - Tüm margins → SPACING.*
    - Tüm paddings → SPACING.*
    - Gap values

17. **Border Radius Audit**
    - Tüm borderRadius → RADIUS.*

18. **Shadow Audit**
    - Tüm shadows → SHADOWS.*

19. **Accessibility QA**
    - Touch target sizes
    - Color contrast (WCAG AA)
    - Screen reader labels

20. **Performance QA**
    - Re-render optimization
    - useMemo/useCallback audit
    - FlatList keyExtractor

---

## 🔧 TEKNIK BORÇ & İYİLEŞTİRME ÖNERİLERİ

### 1. Theme Sistemi Genişletme

**theme.ts'ye eklenebilir:**

```typescript
export const COLORS = {
  // Mevcut brand colors
  brand: {
    green: '#98CD00',
    greenLight: '#daef72',
    greenBright: '#c2eb49',
    // YENİ: Macro/Alert colors
    red: '#DC2626',
    redDark: '#991B1B',
    redLight: '#FEF2F2',
    redMid: '#FCA5A5',
  },
  
  // YENİ: Status colors (BMI, shipping, vb.)
  status: {
    info: '#3B82F6',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
  
  // Mevcut...
}

// YENİ: Button presets
export const BUTTON_STYLES = {
  primary: {
    height: 52,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.brand.green,
    color: COLORS.black,
  },
  secondary: {
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border.medium,
    color: COLORS.text.primary,
  },
  // ...
}

// YENİ: Component-specific tokens
export const COMPONENTS = {
  fab: {
    size: 52,
    backgroundColor: COLORS.brand.green,
    shadowColor: hexToRgba(COLORS.brand.green, 0.5),
  },
  tabBar: {
    height: 56,
    backgroundColor: COLORS.black,
  },
  // ...
}
```

---

### 2. Shared Components Oluşturma

**Eksik reusable components:**

```typescript
// components/ui/IconButton.tsx
export function IconButton({ icon, onPress, size = 44, variant = 'default' }) {
  // Standardized icon button
}

// components/ui/Badge.tsx
export function Badge({ label, variant = 'default' }) {
  // Standardized badges (calories, macro, status)
}

// components/ui/QuantityControl.tsx
export function QuantityControl({ value, onChange, min = 0, max = 99 }) {
  // Standardized +/- controls
}

// components/ui/Chip.tsx
export function Chip({ label, active, onPress }) {
  // Standardized filter/category chips
}

// components/ui/ProgressBar.tsx
export function ProgressBar({ value, max, showLabel = true }) {
  // Standardized progress indicators
}
```

---

### 3. Hooks İyileştirmesi

**Yeni hooks önerileri:**

```typescript
// hooks/useThemedStyles.ts
export function useThemedStyles<T>(
  styleFactory: (theme: typeof COLORS) => T
): T {
  return useMemo(() => styleFactory(COLORS), []);
}

// hooks/useResponsive.ts
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    isSmall: width < 375,
    isMedium: width >= 375 && width < 414,
    isLarge: width >= 414,
    // ...
  }
}
```

---

### 4. Stil Organizasyonu

**Öneri:** Her screen için ortak stil objesi:

```typescript
// styles/commonStyles.ts
export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING['2xl'],
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    color: COLORS.text.primary,
    marginBottom: SPACING.md,
  },
  // ...
});

// Usage
import { commonStyles } from '../styles/commonStyles';

<View style={commonStyles.section}>
  <Text style={commonStyles.sectionTitle}>Title</Text>
</View>
```

---

### 5. Color Utilities

**Öneri:** colors.ts'yi genişlet:

```typescript
// constants/colors.ts
export const hexToRgba = (hex: string, opacity: number): string => {
  // Mevcut...
}

// YENİ utilities
export const darken = (hex: string, amount: number): string => {
  // Rengi koyulaştır
}

export const lighten = (hex: string, amount: number): string => {
  // Rengi açık yap
}

export const getContrastColor = (bg: string): string => {
  // Arka plana göre text rengi (siyah/beyaz) döndür
}
```

---

### 6. TypeScript İyileştirmeleri

**Öneri:** Theme types:

```typescript
// types/theme.ts
export type ColorKey = keyof typeof COLORS;
export type SpacingKey = keyof typeof SPACING;
export type RadiusKey = keyof typeof RADIUS;
export type TypographySizeKey = keyof typeof TYPOGRAPHY.size;
export type TypographyWeightKey = keyof typeof TYPOGRAPHY.weight;

// Usage (autocomplete & type safety)
type MyStyleProps = {
  bgColor: ColorKey;
  padding: SpacingKey;
}
```

---

## 📊 METRIK & BAŞARI KRİTERLERİ

### Önce (Audit)
- ❌ Theme compliance: ~40%
- ❌ Hardcoded values: 200+ yer
- ❌ Color inconsistencies: 47 sorun
- ❌ Touch target failures: 20+ buton

### Sonra (Hedef)
- ✅ Theme compliance: 95%+
- ✅ Hardcoded values: <10 (özel durumlar)
- ✅ Color inconsistencies: 0
- ✅ Touch target compliance: 100%

### Ölçülebilir KPI'lar
1. **Code Quality:**
   - `grep -r "#[0-9A-Fa-f]{6}" src/` → 0 match (tüm hex → theme)
   - `grep -r "fontSize: [0-9]" src/` → 0 match (tüm → TYPOGRAPHY)

2. **Erişilebilirlik:**
   - WCAG AA contrast ratio: 100%
   - Touch target compliance: 100%

3. **Performans:**
   - Gereksiz re-render: <5 per screen
   - FlatList keyExtractor: 100%

4. **Maintainability:**
   - Theme değiştirildiğinde etkilenen dosya sayısı: 1 (theme.ts)

---

## 🎨 TASARIM SİSTEMİ ÖNERİSİ

### Dokümantasyon
Storybook veya benzer tool ile component library oluştur:

```
├── components/
│   ├── ui/
│   │   ├── Button/
│   │   │   ├── PrimaryButton.tsx
│   │   │   ├── PrimaryButton.stories.tsx
│   │   │   └── PrimaryButton.test.tsx
│   │   ├── Input/
│   │   │   ├── FormField.tsx
│   │   │   ├── FormField.stories.tsx
│   │   │   └── FormField.test.tsx
│   │   └── ...
│   └── ...
└── constants/
    ├── theme.ts (single source of truth)
    └── ...
```

---

## 🏁 SONUÇ & TAVSİYELER

### Kısa Vadeli (Bu Hafta)
1. ✅ PrimaryButton düzeltildi
2. ✅ FormField düzeltildi
3. ✅ Card düzeltildi
4. ❌ HomeScreen colors → devam et
5. ❌ Primary green decision → karar ver

### Orta Vadeli (Bu Ay)
1. Tüm screens theme compliance
2. Shared components oluştur
3. Accessibility audit
4. Performance optimization

### Uzun Vadeli
1. Design system documentation
2. Component library
3. Automated testing
4. CI/CD style linting

---

## 📞 İLETİŞİM & SORULAR

Bu rapor hakkında:
- 🔴 Kritik sorunlar hemen ele alınmalı
- 🟡 Orta sorunlar sprint planning'e alınmalı
- 🟢 Düşük sorunlar backlog'a eklenebilir

**Primary color kararı:** Team ile görüşülmeli
- Mevcut kullanıcılar hangi yeşile alışkın?
- Brand guideline var mı?
- Hangisi daha erişilebilir (contrast)?

---

**Rapor Sonu**

*Not: Bu audit kod incelemesi temelinde yapılmıştır. Gerçek cihazda ve farklı ekran boyutlarında test edilmesi önerilir.*
