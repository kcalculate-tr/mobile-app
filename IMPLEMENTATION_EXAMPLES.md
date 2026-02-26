# 🎬 Uygulama Örnekleri - Önce & Sonra

Bu dosya, mevcut kodlarınızı nasıl güncelleyeceğinize dair somut örnekler içerir.

---

## 📄 Örnek 1: Home.jsx - Favori Ürünler Bölümü

### ❌ ÖNCE (Mevcut Kod):

```jsx
// src/pages/Home.jsx - FavoritesRow bileşeni içinde

{loading ? (
  <div className="hide-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
    {[0, 1].map((item) => (
      <div
        key={`favorite-skeleton-${item}`}
        className="app-skeleton h-[250px] w-[214px] min-[390px]:w-[226px]"
      />
    ))}
  </div>
) : (
  <div className="hide-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
    {favoriteProducts.map((p, index) => (
      <article
        key={`deal-${String(p?.id ?? `idx-${index}`)}`}
        onClick={() => onProductNavigate(p.id)}
        className="flex h-full w-[214px] shrink-0 flex-col rounded-2xl bg-white"
      >
        {/* Ürün içeriği */}
      </article>
    ))}
  </div>
)}
```

### ✅ SONRA (Güncellenmiş Kod):

```jsx
// src/pages/Home.jsx - Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';
import { motion } from 'framer-motion';

// FavoritesRow bileşeni içinde
{loading ? (
  <div className="hide-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
    <SkeletonCard variant="favorite" count={2} />
  </div>
) : (
  <div className="hide-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
    {favoriteProducts.map((p, index) => (
      <motion.article
        key={`deal-${String(p?.id ?? `idx-${index}`)}`}
        onClick={() => onProductNavigate(p.id)}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1, duration: 0.3 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex h-full w-[214px] shrink-0 flex-col rounded-2xl bg-white cursor-pointer"
      >
        {/* Ürün içeriği */}
      </motion.article>
    ))}
  </div>
)}
```

---

## 📄 Örnek 2: Home.jsx - Ürün Grid'i

### ❌ ÖNCE:

```jsx
// src/pages/Home.jsx - ProductsGrid bileşeni

{loading ? (
  <div className="grid grid-cols-2 gap-2 pb-2">
    {[0, 1, 2, 3].map((item) => (
      <div key={`products-skeleton-${item}`} className="app-skeleton h-[215px]" />
    ))}
  </div>
) : (
  <div className="grid grid-cols-2 gap-2 pb-2">
    {recommendedProducts.map((p, index) => (
      <article
        key={`recommended-${String(p?.id ?? `idx-${index}`)}`}
        onClick={() => onProductNavigate(p.id)}
        className="flex h-full flex-col rounded-2xl bg-white"
      >
        {/* Ürün kartı içeriği */}
      </article>
    ))}
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

// ProductsGrid bileşeni içinde
{loading ? (
  <div className="grid grid-cols-2 gap-2 pb-2">
    <SkeletonCard variant="product" count={4} />
  </div>
) : (
  <StaggerContainer className="grid grid-cols-2 gap-2 pb-2" stagger={0.08}>
    {recommendedProducts.map((p, index) => (
      <StaggerItem key={`recommended-${String(p?.id ?? `idx-${index}`)}`}>
        <motion.article
          onClick={() => onProductNavigate(p.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex h-full flex-col rounded-2xl bg-white cursor-pointer"
        >
          {/* Ürün kartı içeriği */}
        </motion.article>
      </StaggerItem>
    ))}
  </StaggerContainer>
)}
```

---

## 📄 Örnek 3: Orders.jsx - Sipariş Listesi

### ❌ ÖNCE:

```jsx
// src/pages/Orders.jsx

{loading && (
  <div className="space-y-3 py-3">
    {[0, 1, 2].map((item) => (
      <div key={`orders-skeleton-${item}`} className="app-skeleton h-[132px]" />
    ))}
  </div>
)}

{!loading && !error && (
  <div>
    {visibleOrders.map((order) => (
      <article
        key={order.id}
        className="app-card mb-3 space-y-4"
      >
        {/* Sipariş içeriği */}
      </article>
    ))}
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

{loading && (
  <div className="space-y-3 py-3">
    <SkeletonCard variant="order" count={3} />
  </div>
)}

{!loading && !error && (
  <StaggerContainer className="space-y-3">
    {visibleOrders.map((order) => (
      <StaggerItem key={order.id}>
        <motion.article
          whileHover={{ scale: 1.01 }}
          className="app-card space-y-4"
        >
          {/* Sipariş içeriği */}
        </motion.article>
      </StaggerItem>
    ))}
  </StaggerContainer>
)}
```

**Not:** Orders.jsx'te zaten ORDER_LIST_VARIANTS ve ORDER_ITEM_VARIANTS var! 
Bunları koruyabilir veya yeni StaggerContainer'a geçebilirsiniz.

---

## 📄 Örnek 4: Cart.jsx - Sepet Elemanları

### ❌ ÖNCE:

```jsx
// src/pages/Cart.jsx

{cart.length === 0 ? (
  <div className="app-card p-8 text-center">
    <ShoppingBag size={32} className="mx-auto text-gray-300" />
    <p className="mt-3">Sepetiniz boş</p>
  </div>
) : (
  <div className="space-y-4">
    {cart.map((item) => (
      <article key={item.lineKey} className="app-card p-3.5">
        {/* Sepet elemanı içeriği */}
      </article>
    ))}
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

{loading ? (
  <div className="space-y-4">
    <SkeletonCard variant="cart" count={3} />
  </div>
) : cart.length === 0 ? (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="app-card p-8 text-center"
  >
    <ShoppingBag size={32} className="mx-auto text-gray-300" />
    <p className="mt-3">Sepetiniz boş</p>
  </motion.div>
) : (
  <StaggerContainer className="space-y-4" stagger={0.1}>
    {cart.map((item) => (
      <StaggerItem key={item.lineKey}>
        <article className="app-card p-3.5">
          {/* Sepet elemanı içeriği */}
        </article>
      </StaggerItem>
    ))}
  </StaggerContainer>
)}
```

**Not:** Cart.jsx'te zaten LIST_STAGGER ve LIST_ITEM variants var! 
Yeni bileşenlere geçmenize gerek yok, mevcut yapı zaten iyi.

---

## 📄 Örnek 5: Addresses.jsx - Adres Listesi

### ❌ ÖNCE:

```jsx
// src/pages/profile/Addresses.jsx

{loading && (
  <div className="space-y-3">
    {[0, 1].map((item) => (
      <div key={`address-skeleton-${item}`} className="app-skeleton h-[116px]" />
    ))}
  </div>
)}

{!loading && addresses.length > 0 && (
  <div className="space-y-3">
    {addresses.map((address) => (
      <div key={address.id} className="app-card">
        {/* Adres içeriği */}
      </div>
    ))}
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

{loading && (
  <div className="space-y-3">
    <SkeletonCard variant="address" count={2} />
  </div>
)}

{!loading && addresses.length > 0 && (
  <StaggerContainer className="space-y-3" stagger={0.1}>
    {addresses.map((address) => (
      <StaggerItem key={address.id}>
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="app-card"
        >
          {/* Adres içeriği */}
        </motion.div>
      </StaggerItem>
    ))}
  </StaggerContainer>
)}
```

---

## 📄 Örnek 6: Tracker.jsx - Makro Takip

### ❌ ÖNCE:

```jsx
// src/pages/Tracker.jsx

{loading && (
  <div>
    <div className="app-skeleton h-4 w-40" />
    <div className="app-skeleton mx-auto h-[210px] w-[210px] rounded-full" />
    <div className="grid grid-cols-2 gap-2.5 pt-6">
      {[0, 1, 2, 3].map((item) => (
        <div key={`tracker-macro-skeleton-${item}`} className="app-skeleton h-24" />
      ))}
    </div>
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';

{loading && (
  <SkeletonCard variant="tracker" />
)}

// Ya da daha detaylı:
{loading && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="space-y-4"
  >
    <SkeletonCard variant="tracker" />
  </motion.div>
)}
```

---

## 📄 Örnek 7: ProductDetail.jsx - Ürün Detay Sayfası

### ✅ YENİ ÖRNEK:

```jsx
// src/pages/ProductDetail.jsx
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonCard from '../components/SkeletonCard';

export default function ProductDetail() {
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F0F0] p-4">
        <div className="space-y-4">
          {/* Ana ürün görseli */}
          <SkeletonCard variant="banner" />
          
          {/* Ürün bilgileri */}
          <div className="space-y-3">
            <div className="h-8 w-3/4 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
            <div className="h-4 w-full rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
            <div className="h-4 w-5/6 rounded-lg bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" />
          </div>

          {/* Makro grid */}
          <div className="grid grid-cols-2 gap-2">
            <SkeletonCard className="h-24" count={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-[#F0F0F0]"
    >
      {/* Ürün içeriği */}
      <motion.img
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        src={product.img}
        alt={product.name}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h1>{product.name}</h1>
        <p>{product.description}</p>
      </motion.div>

      <motion.button
        whileTap={{ scale: 0.97 }}
        className="app-btn-green mt-6"
      >
        Sepete Ekle
      </motion.button>
    </motion.div>
  );
}
```

---

## 📄 Örnek 8: Global Banner (HomeBanner)

### ❌ ÖNCE:

```jsx
// src/pages/Home.jsx - HomeBanner bileşeni

{bannersLoading ? (
  <div className="px-4 w-full">
    <div className="h-[200px] w-full rounded-2xl bg-gray-200 animate-pulse" />
  </div>
) : banners.length > 0 && (
  <div className="relative w-full">
    {/* Banner slider */}
  </div>
)}
```

### ✅ SONRA:

```jsx
// Dosya başına import ekle
import SkeletonCard from '../components/SkeletonCard';

{bannersLoading ? (
  <div className="px-4 w-full">
    <SkeletonCard variant="banner" />
  </div>
) : banners.length > 0 && (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="relative w-full"
  >
    {/* Banner slider */}
  </motion.div>
)}
```

---

## 🎯 Buton Örnekleri (Tüm Sayfalarda Geçerli)

### Basit Buton:

```jsx
// Önce
<button className="app-btn-green">
  Devam Et
</button>

// Sonra (otomatik active:scale zaten var, ama daha hassas kontrol için)
<motion.button
  whileTap={{ scale: 0.97 }}
  className="app-btn-green"
>
  Devam Et
</motion.button>
```

### Icon Butonları:

```jsx
// Önce
<button className="rounded-full bg-[#98CD00] p-2">
  <Plus size={16} />
</button>

// Sonra
<motion.button
  whileTap={{ scale: 0.95 }}
  whileHover={{ scale: 1.05 }}
  className="rounded-full bg-[#98CD00] p-2"
>
  <Plus size={16} />
</motion.button>
```

### Geri Butonu:

```jsx
// Önce
<button onClick={() => navigate(-1)}>
  <ChevronLeft size={18} />
</button>

// Sonra
<motion.button
  whileTap={{ scale: 0.95 }}
  onClick={() => navigate(-1)}
  className="rounded-full p-2 bg-white"
>
  <ChevronLeft size={18} />
</motion.button>
```

---

## 🔥 Kombine Örnek: Tam Premium Ürün Listesi

```jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

export default function PremiumProductList() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  // Loading durumu
  if (loading) {
    return (
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <SkeletonCard variant="product" count={6} />
        </div>
      </div>
    );
  }

  // Boş durum
  if (products.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="app-card p-8 text-center"
      >
        <p>Henüz ürün bulunmuyor</p>
      </motion.div>
    );
  }

  // Ürünler yüklü
  return (
    <StaggerContainer 
      className="grid grid-cols-2 gap-2.5 p-4" 
      stagger={0.08}
    >
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <motion.article
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            className="app-card cursor-pointer overflow-hidden"
          >
            <motion.img
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={product.img}
              alt={product.name}
              className="w-full object-cover"
            />
            
            <div className="p-3">
              <h3 className="font-bold text-sm">{product.name}</h3>
              <p className="text-xs text-gray-500">{product.description}</p>
              
              <div className="flex items-center justify-between mt-3">
                <span className="font-bold">{product.price} ₺</span>
                
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className="bg-[#98CD00] text-white rounded-full p-2"
                >
                  <Plus size={16} />
                </motion.button>
              </div>
            </div>
          </motion.article>
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

---

## 📝 Özet Checklist

Her sayfa için:

- [ ] Loading state'e `SkeletonCard` ekle
- [ ] Liste render'ını `StaggerContainer` + `StaggerItem` ile sar
- [ ] Butonlara `motion.button` + `whileTap={{ scale: 0.97 }}` ekle
- [ ] Kartlara `whileHover={{ scale: 1.02 }}` ekle
- [ ] Sayfa root'una `initial`, `animate` props ekle (gerekirse)

---

**Sonuç:** Minimal kod değişikliğiyle maksimum premium hissiyat! 🚀
