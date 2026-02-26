# ⚡ Hızlı Referans Kılavuzu

En sık kullanılan animasyon ve bileşenlerin hızlı referansı.

---

## 📦 Import Statements

```jsx
// Skeleton Loading için
import SkeletonCard from '../components/SkeletonCard';

// Liste Animasyonları için
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

// Sayfa Geçişi için
import PageTransitionWrapper from '../components/PageTransitionWrapper';

// Framer Motion (zaten projede var)
import { motion, AnimatePresence } from 'framer-motion';
```

---

## 🎯 1 Dakikada Kullanım

### Skeleton Loading

```jsx
// KULLANIM 1: Ürün iskeleti
{loading && <SkeletonCard variant="product" count={4} />}

// KULLANIM 2: Sipariş iskeleti
{loading && <SkeletonCard variant="order" count={3} />}

// KULLANIM 3: Sepet iskeleti
{loading && <SkeletonCard variant="cart" count={2} />}

// KULLANIM 4: Banner iskeleti
{loading && <SkeletonCard variant="banner" />}

// KULLANIM 5: Custom iskelet
{loading && <SkeletonCard className="h-40 w-full" />}
```

### Liste Animasyonları

```jsx
// TEK SATIRDA:
<StaggerContainer className="grid grid-cols-2 gap-2">
  {items.map(item => (
    <StaggerItem key={item.id}>
      <ItemCard item={item} />
    </StaggerItem>
  ))}
</StaggerContainer>

// CUSTOM STAGGER:
<StaggerContainer stagger={0.15} className="space-y-3">
  {/* ... */}
</StaggerContainer>
```

### Buton Animasyonları

```jsx
// TAP ANIMASYONU:
<motion.button whileTap={{ scale: 0.97 }}>
  Tıkla
</motion.button>

// HOVER + TAP:
<motion.button 
  whileHover={{ scale: 1.05 }} 
  whileTap={{ scale: 0.95 }}
>
  Tıkla
</motion.button>

// ICON BUTON:
<motion.button whileTap={{ scale: 0.95 }} className="rounded-full p-2">
  <Plus size={16} />
</motion.button>
```

### Kart Animasyonları

```jsx
// HOVER EFEKTI:
<motion.article whileHover={{ scale: 1.02 }}>
  {/* içerik */}
</motion.article>

// HOVER + TAP:
<motion.article 
  whileHover={{ scale: 1.02, y: -4 }}
  whileTap={{ scale: 0.98 }}
>
  {/* içerik */}
</motion.article>
```

---

## 📋 Varyantlar Listesi

### SkeletonCard Varyantları:

| Varyant | Kullanım Yeri | Örnek |
|---------|---------------|-------|
| `product` | Ürün kartları | `<SkeletonCard variant="product" />` |
| `order` | Sipariş listesi | `<SkeletonCard variant="order" />` |
| `cart` | Sepet elemanları | `<SkeletonCard variant="cart" />` |
| `favorite` | Favori ürünler | `<SkeletonCard variant="favorite" />` |
| `list` | Genel liste | `<SkeletonCard variant="list" />` |
| `banner` | Banner/slider | `<SkeletonCard variant="banner" />` |
| `address` | Adres kartları | `<SkeletonCard variant="address" />` |
| `tracker` | Tracker sayfası | `<SkeletonCard variant="tracker" />` |
| `default` | Özel durum | `<SkeletonCard className="h-40" />` |

---

## ⚙️ Yaygın Parametreler

### StaggerContainer Props:

```jsx
<StaggerContainer
  className="grid grid-cols-2"  // Layout sınıfı
  stagger={0.1}                  // Elemanlar arası gecikme (saniye)
>
```

**Önerilen stagger değerleri:**
- Hızlı: `0.05`
- Normal: `0.1` (varsayılan)
- Yavaş: `0.15-0.2`

### Motion Button Props:

```jsx
<motion.button
  whileTap={{ scale: 0.97 }}         // Tıklama anında
  whileHover={{ scale: 1.05 }}       // Hover'da
  transition={{ duration: 0.2 }}     // Animasyon süresi
>
```

**Önerilen scale değerleri:**
- Büyük butonlar: `scale: 0.98`
- Normal butonlar: `scale: 0.97`
- Küçük butonlar: `scale: 0.95`

### Motion Card Props:

```jsx
<motion.article
  whileHover={{ scale: 1.02, y: -4 }}  // Hover efekti
  whileTap={{ scale: 0.98 }}            // Tıklama efekti
  transition={{ duration: 0.2 }}        // Animasyon süresi
>
```

---

## 🔥 Copy-Paste Şablonlar

### Şablon 1: Loading State ile Liste

```jsx
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';
import { motion } from 'framer-motion';

function MyList({ items, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonCard variant="list" count={5} />
      </div>
    );
  }

  return (
    <StaggerContainer className="space-y-3">
      {items.map(item => (
        <StaggerItem key={item.id}>
          <motion.div whileHover={{ scale: 1.01 }} className="app-card">
            {item.content}
          </motion.div>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

### Şablon 2: Ürün Grid

```jsx
function ProductGrid({ products, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard variant="product" count={6} />
      </div>
    );
  }

  return (
    <StaggerContainer className="grid grid-cols-2 gap-2" stagger={0.08}>
      {products.map(product => (
        <StaggerItem key={product.id}>
          <motion.article
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="app-card cursor-pointer"
          >
            <img src={product.img} alt={product.name} />
            <h3>{product.name}</h3>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="app-btn-green-sm"
            >
              Sepete Ekle
            </motion.button>
          </motion.article>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

### Şablon 3: Boş State

```jsx
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="app-card p-8 text-center"
    >
      <ShoppingBag size={32} className="mx-auto text-gray-300" />
      <p className="mt-3">Henüz ürün yok</p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        className="app-btn-green mt-4"
      >
        Alışverişe Başla
      </motion.button>
    </motion.div>
  );
}
```

### Şablon 4: Modal/Drawer

```jsx
function MyModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal içeriği */}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

## 🎨 Easing Curves

Framer Motion'da kullanılabilecek easing değerleri:

```jsx
// Premium (önerilen)
transition={{ ease: [0.22, 1, 0.36, 1] }}

// Linear
transition={{ ease: "linear" }}

// Ease In/Out
transition={{ ease: "easeInOut" }}

// Spring (elastik)
transition={{ type: "spring", stiffness: 300, damping: 25 }}
```

---

## 💡 Hızlı Hatırlatıcılar

### ✅ YAPMALI:
- Loading state'lerde `SkeletonCard` kullan
- Listelerde `StaggerContainer` kullan
- Butonlarda `whileTap={{ scale: 0.97 }}` kullan
- Kartlarda `whileHover` ekle

### ❌ YAPMA:
- Çok fazla elemana (>50) stagger ekleme (performans)
- Her şeye motion ekleme (gereksiz)
- Çok yüksek scale değerleri (>1.1) kullanma
- Çok yavaş animasyonlar (>0.5s) yapma

---

## 🔍 Troubleshooting

### Animasyon çalışmıyor:
```jsx
// ✅ Doğru
<motion.div>

// ❌ Yanlış
<div motion>
```

### Stagger çalışmıyor:
```jsx
// ✅ Doğru - StaggerItem kullan
<StaggerContainer>
  <StaggerItem><Card /></StaggerItem>
</StaggerContainer>

// ❌ Yanlış - Direkt card
<StaggerContainer>
  <Card />
</StaggerContainer>
```

### Skeleton doğru görünmüyor:
```jsx
// ✅ Doğru - Variant kullan
<SkeletonCard variant="product" />

// ❌ Yanlış - Variant yok
<SkeletonCard />  // default olur
```

---

## 📱 Responsive Değerler

Mobil için optimize edilmiş değerler:

```jsx
// Butonlar
<motion.button whileTap={{ scale: 0.97 }}>  // Mobilde iyi
<motion.button whileTap={{ scale: 0.95 }}>  // Küçük butonlar için

// Kartlar
<motion.div whileHover={{ scale: 1.02 }}>   // Mobilde dikkatli
<motion.div whileTap={{ scale: 0.98 }}>     // Mobilde tercih et

// Stagger
<StaggerContainer stagger={0.08}>            // Mobilde hızlı
<StaggerContainer stagger={0.05}>            // Çok fazla eleman varsa
```

---

## 🎯 En Çok Kullanılanlar (Top 5)

### 1. Loading State:
```jsx
{loading && <SkeletonCard variant="product" count={4} />}
```

### 2. Liste Animasyonu:
```jsx
<StaggerContainer className="grid grid-cols-2 gap-2">
  {items.map(item => (
    <StaggerItem key={item.id}><Card /></StaggerItem>
  ))}
</StaggerContainer>
```

### 3. Buton Animasyonu:
```jsx
<motion.button whileTap={{ scale: 0.97 }} className="app-btn-green">
  Tıkla
</motion.button>
```

### 4. Kart Hover:
```jsx
<motion.div whileHover={{ scale: 1.02 }} className="app-card">
  İçerik
</motion.div>
```

### 5. Modal Animasyonu:
```jsx
<AnimatePresence>
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      {/* Modal içeriği */}
    </motion.div>
  )}
</AnimatePresence>
```

---

**Hazırlayan:** Senior UI/UX Motion Designer  
**Güncelleme:** 2026-02-24  

**💡 İpucu:** Bu dosyayı yer imlerine ekle, sık kullanacaksın!
