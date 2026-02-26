# 🎨 Premium UI/UX Animasyon Rehberi

Bu dokümanda, projenizdeki 4 ana animasyon geliştirmesinin nasıl kullanılacağını bulabilirsiniz.

---

## 📦 1. Skeleton Loading (Yükleme Ekranları)

### Yeni Bileşen: `SkeletonCard`

**Dosya:** `src/components/SkeletonCard.jsx`

**Özellikler:**
- ✨ Gradyan tabanlı shimmer efekti
- 🎯 Önceden tanımlı 10+ varyant
- 🔄 Birden fazla iskelet render desteği
- 💫 Premium animate-pulse animasyonu

### Kullanım Örnekleri:

#### Ürün Kartı İskeleti
```jsx
import SkeletonCard from '../components/SkeletonCard';

// Tek ürün
<SkeletonCard variant="product" />

// Çoklu ürünler
<SkeletonCard variant="product" count={4} />

// Grid içinde
<div className="grid grid-cols-2 gap-2">
  <SkeletonCard variant="product" count={4} />
</div>
```

#### Sipariş Listesi İskeleti
```jsx
// Tek sipariş
<SkeletonCard variant="order" />

// Liste halinde
<div className="space-y-3">
  <SkeletonCard variant="order" count={3} />
</div>
```

#### Sepet İskeleti
```jsx
<SkeletonCard variant="cart" count={2} />
```

#### Favori Ürünler (Yatay Scroll)
```jsx
<div className="flex gap-2.5 overflow-x-auto">
  <SkeletonCard variant="favorite" count={2} />
</div>
```

#### Banner İskeleti
```jsx
<SkeletonCard variant="banner" />
```

#### Adres Kartı İskeleti
```jsx
<SkeletonCard variant="address" count={2} />
```

#### Tracker İskeleti
```jsx
<SkeletonCard variant="tracker" />
```

#### Custom İskelet
```jsx
<SkeletonCard className="h-40 w-full" />
```

### Mevcut Kodunuzu Güncelleme:

**Önce (Home.jsx):**
```jsx
{loading && (
  <div className="hide-scrollbar flex gap-2.5 overflow-x-auto">
    {[0, 1].map((item) => (
      <div
        key={`favorite-skeleton-${item}`}
        className="app-skeleton h-[250px] w-[214px]"
      />
    ))}
  </div>
)}
```

**Sonra (Home.jsx):**
```jsx
import SkeletonCard from '../components/SkeletonCard';

{loading && (
  <div className="hide-scrollbar flex gap-2.5 overflow-x-auto">
    <SkeletonCard variant="favorite" count={2} />
  </div>
)}
```

---

## 🎯 2. Mikro Etkileşimler (Buton Hissi)

### Otomatik Uygulanıyor! ✅

CSS'teki tüm butonlar artık otomatik olarak şu özelliklere sahip:

```css
/* index.css - Otomatik olarak tüm butonlara uygulanır */
button:not(:disabled):active {
  transform: scale(0.97);
}

/* Utility sınıfları */
.app-btn-green {
  @apply active:scale-[0.98] transition-all duration-200;
}

.app-btn-green-sm {
  @apply active:scale-[0.97] transition-all duration-200;
}

.app-btn-outline {
  @apply active:scale-[0.98] transition-all duration-200;
}
```

### Framer Motion ile Daha Gelişmiş:

Daha hassas kontrol için motion.button kullanın:

```jsx
import { motion } from 'framer-motion';

<motion.button
  whileTap={{ scale: 0.97 }}
  className="app-btn-green"
>
  Sepete Ekle
</motion.button>
```

**Örnek: Artı/Eksi Butonları**
```jsx
<motion.button
  whileTap={{ scale: 0.95 }}
  onClick={() => updateQuantity(id, quantity + 1)}
  className="rounded-full bg-[#98CD00] p-2"
>
  <Plus size={16} />
</motion.button>
```

---

## 🔄 3. Sayfa Geçişleri (Page Transitions)

### App.jsx'te Zaten Uygulanmış! ✅

Tüm route'lar için page transition sistemi App.jsx'te tanımlı:

```jsx
// App.jsx - Zaten mevcut
const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};
```

### Yeni Sayfalarda Kullanım:

Eğer yeni bir sayfa oluşturuyorsanız, hiçbir şey yapmanıza gerek yok! 
App.jsx'teki `withPageTransition` otomatik olarak uygulanır.

**Örnek: Yeni bir sayfa eklerken**
```jsx
// App.jsx içinde
const NewPage = React.lazy(() => import('./pages/NewPage'));

// Routes içinde
<Route path="/new-page" element={withPageTransition(<NewPage />)} />
```

### Bağımsız Sayfa Geçişi (Modal içinde vs.):

```jsx
import PageTransitionWrapper from '../components/PageTransitionWrapper';

function MyModal() {
  return (
    <PageTransitionWrapper>
      <div className="modal-content">
        {/* İçerik */}
      </div>
    </PageTransitionWrapper>
  );
}
```

---

## 📋 4. Liste Animasyonları (Stagger Effect)

### Yeni Bileşen: `StaggerContainer` & `StaggerItem`

**Dosya:** `src/components/StaggerContainer.jsx`

### Kullanım:

#### Temel Kullanım:

```jsx
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

function ProductList({ products }) {
  return (
    <StaggerContainer className="grid grid-cols-2 gap-2">
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <ProductCard product={product} />
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}
```

#### Custom Stagger Delay:

```jsx
// Daha hızlı animasyon
<StaggerContainer stagger={0.05} className="space-y-2">
  {items.map(item => (
    <StaggerItem key={item.id}>
      <ItemCard item={item} />
    </StaggerItem>
  ))}
</StaggerContainer>

// Daha yavaş, dramatik animasyon
<StaggerContainer stagger={0.2} className="flex flex-col gap-3">
  {orders.map(order => (
    <StaggerItem key={order.id}>
      <OrderCard order={order} />
    </StaggerItem>
  ))}
</StaggerContainer>
```

#### Direkt Variants Kullanımı (İleri Seviye):

```jsx
import { motion } from 'framer-motion';
import { staggerContainerVariants, staggerItemVariants } from '../components/StaggerContainer';

<motion.div 
  variants={staggerContainerVariants(0.1)} 
  initial="hidden" 
  animate="visible"
  className="grid grid-cols-2 gap-3"
>
  {products.map(product => (
    <motion.article key={product.id} variants={staggerItemVariants}>
      <ProductCard product={product} />
    </motion.article>
  ))}
</motion.div>
```

---

## 🎯 Gerçek Dünya Örnekleri

### Home.jsx - Ürün Grid'i

**Önce:**
```jsx
<div className="grid grid-cols-2 gap-2">
  {products.map((p) => (
    <article key={p.id} className="app-card">
      <ProductContent product={p} />
    </article>
  ))}
</div>
```

**Sonra:**
```jsx
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

<StaggerContainer className="grid grid-cols-2 gap-2">
  {products.map((p) => (
    <StaggerItem key={p.id}>
      <article className="app-card">
        <ProductContent product={p} />
      </article>
    </StaggerItem>
  ))}
</StaggerContainer>
```

### Orders.jsx - Sipariş Listesi

**Önce:**
```jsx
<div className="space-y-3">
  {orders.map((order) => (
    <article key={order.id} className="app-card">
      <OrderContent order={order} />
    </article>
  ))}
</div>
```

**Sonra:**
```jsx
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

<StaggerContainer className="space-y-3">
  {orders.map((order) => (
    <StaggerItem key={order.id}>
      <article className="app-card">
        <OrderContent order={order} />
      </article>
    </StaggerItem>
  ))}
</StaggerContainer>
```

### Cart.jsx - Sepet Elemanları

**Önce:**
```jsx
{loading ? (
  <div className="space-y-4">
    {[0, 1, 2].map((item) => (
      <div key={`cart-skeleton-${item}`} className="app-skeleton h-32" />
    ))}
  </div>
) : (
  <div className="space-y-4">
    {cart.map((item) => (
      <article key={item.id} className="app-card">
        <CartItemContent item={item} />
      </article>
    ))}
  </div>
)}
```

**Sonra:**
```jsx
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';

{loading ? (
  <div className="space-y-4">
    <SkeletonCard variant="cart" count={3} />
  </div>
) : (
  <StaggerContainer className="space-y-4">
    {cart.map((item) => (
      <StaggerItem key={item.id}>
        <article className="app-card">
          <CartItemContent item={item} />
        </article>
      </StaggerItem>
    ))}
  </StaggerContainer>
)}
```

---

## 🎨 Bonus: Kombine Kullanım

### Tam Premium Deneyim:

```jsx
import SkeletonCard from '../components/SkeletonCard';
import { StaggerContainer, StaggerItem } from '../components/StaggerContainer';
import { motion } from 'framer-motion';

function ProductsSection() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard variant="product" count={4} />
      </div>
    );
  }

  return (
    <StaggerContainer className="grid grid-cols-2 gap-2" stagger={0.08}>
      {products.map((product) => (
        <StaggerItem key={product.id}>
          <motion.article 
            className="app-card cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/product/${product.id}`)}
          >
            <img src={product.img} alt={product.name} />
            <h3>{product.name}</h3>
            <p>{product.price}</p>
            
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

---

## 📊 Performans İpuçları

1. **Skeleton Loading:** Animasyonu kapatmak için `animate={false}` prop'unu kullanın
2. **Stagger Effect:** Çok fazla eleman (>50) için stagger değerini düşürün (0.03-0.05)
3. **Page Transitions:** AnimatePresence'ın `mode="wait"` kullanımı zaten App.jsx'te mevcut
4. **Buton Animasyonları:** Disabled butonlarda otomatik olarak devre dışı kalır

---

## 🚀 Hızlı Başlangıç Checklist

- [ ] `SkeletonCard` bileşenini loading state'lerinde kullan
- [ ] Tüm listelere `StaggerContainer` + `StaggerItem` ekle
- [ ] Butonlarda `motion.button` + `whileTap={{ scale: 0.97 }}` kullan
- [ ] Yeni sayfaları App.jsx'teki `withPageTransition` ile sarma
- [ ] index.css'teki button stilleri otomatik uygulanıyor - ekstra bir şey yapma!

---

**Not:** Tüm bu geliştirmeler mevcut iş mantığına (Supabase, State, vb.) dokunmadan sadece görsel UX/UI katmanını iyileştirir.

**Oluşturan:** Senior UI/UX Motion Designer & React Architect
**Tarih:** 2026-02-24
