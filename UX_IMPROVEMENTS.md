# 🎨 Kayıtlı Kartlar Sistemi - UX İyileştirmeleri

## ✅ Tamamlanan İyileştirmeler

### 1. Checkout.jsx - Esnek Ödeme Seçeneği

#### "Başka Bir Kart ile Öde" Butonu
- **Konum**: Kayıtlı kartlar listesinin altında
- **Görsel**: Dashed border, hover efekti, seçili durumda highlight
- **İşlevsellik**: 
  - Butona basıldığında `showNewCardForm: true`
  - Kayıtlı kart seçimi sıfırlanır (`selectedCardId: ''`)
  - Yeni kart formu açılır

#### Dinamik Kart Formu
```javascript
{showNewCardForm && (
  <motion.div> {/* Açılır/Kapanır animasyon */}
    <input placeholder="Kart Üzerindeki İsim" />
    <input placeholder="Kart Numarası" maxLength={19} />
    <input placeholder="AA/YY" maxLength={5} />
    <input placeholder="CVV" maxLength={3} />
    <button>Kayıtlı Kartlara Dön</button>
  </motion.div>
)}
```

#### Form Alanları
- **Kart Üzerindeki İsim**: Text input
- **Kart Numarası**: 16 haneli (0000 0000 0000 0000)
- **Son Kullanma**: AA/YY formatı (maxLength: 5)
- **CVV**: 3 haneli güvenlik kodu

#### Güvenlik Bildirimi
```
ℹ️ Kart bilgileri güvenli ödeme sayfasında işlenecektir.
```

#### "Kartı Kaydet" Checkbox
- Yalnızca yeni kart formu açıkken görünür
- Kullanıcı kaydetmek isterse işaretler

#### Validation Güncellemesi
```javascript
if (!selectedCardId && !showNewCardForm) {
  setError('Lütfen bir kart seçin veya yeni kart formu ile devam edin.');
  return;
}
```

---

### 2. Cards.jsx - Tam Fonksiyonel Yönetim Sayfası

#### Yeni Bileşenler

##### CardSkeleton (Loading Skeleton)
```javascript
function CardSkeleton() {
  return (
    <div className="aspect-[1.6/1] animate-pulse bg-gradient-to-br from-brand-dark/10...">
      <div className="h-4 w-32 rounded bg-brand-dark/10" />
      <div className="mt-8 h-6 w-3/4 rounded bg-brand-dark/10" />
      <div className="mt-6 flex items-end justify-between">
        <div className="h-10 w-32 rounded bg-brand-dark/10" />
        <div className="h-10 w-16 rounded bg-brand-dark/10" />
      </div>
    </div>
  );
}
```

##### Toast Notification (Bildirim Sistemi)
```javascript
function Toast({ message, type = 'success', onClose }) {
  // 3 saniye sonra otomatik kapanır
  // type: 'success', 'error', 'info'
  
  return (
    <motion.div className="fixed top-20 left-1/2 z-50...">
      {type === 'success' && <CheckCircle2 />}
      {type === 'error' && <AlertCircle />}
      <p>{message}</p>
    </motion.div>
  );
}
```

##### EditCardModal (Kart Adı Düzenleme)
```javascript
function EditCardModal({ card, onClose, onSave }) {
  const [alias, setAlias] = useState(card?.card_alias || '');
  
  return (
    <motion.div> {/* Modal backdrop */}
      <motion.div> {/* Modal content */}
        <h3>Kart Adını Düzenle</h3>
        <input 
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Örn: İş Kartım"
          maxLength={50}
        />
        <button onClick={onClose}>İptal</button>
        <button onClick={handleSave}>Kaydet</button>
      </motion.div>
    </motion.div>
  );
}
```

##### DeleteConfirmModal (Silme Onayı)
```javascript
function DeleteConfirmModal({ card, onClose, onConfirm }) {
  return (
    <motion.div> {/* Modal backdrop */}
      <Trash2 size={24} className="text-red-600" />
      <h3>Kartı Sil</h3>
      <p>{card?.brand} •••• {card?.last4} kartını silmek istediğinizden emin misiniz?</p>
      <button onClick={onClose}>İptal</button>
      <button onClick={handleConfirm} className="bg-red-600">Sil</button>
    </motion.div>
  );
}
```

---

#### Ana İşlevler (Database Entegrasyonu)

##### 1. Fetch Cards
```javascript
const fetchCards = async () => {
  const { data, error } = await supabase
    .from('user_cards')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  setCards(data || []);
};
```

##### 2. Set Default Card (Varsayılan Yap)
```javascript
const handleSetDefault = async (cardId) => {
  // Optimistic update
  setCards((prev) =>
    prev.map((c) => ({ ...c, is_default: c.id === cardId }))
  );

  const { error } = await supabase
    .from('user_cards')
    .update({ is_default: true })
    .eq('id', cardId);

  if (error) {
    fetchCards(); // Rollback
    setToast({ message: 'Hata oluştu', type: 'error' });
  } else {
    setToast({ message: 'Varsayılan kart güncellendi', type: 'success' });
  }
};
```

##### 3. Delete Card (Kart Silme)
```javascript
const handleDeleteCard = async () => {
  const cardId = deletingCard.id;

  // Optimistic update
  setCards((prev) => prev.filter((c) => c.id !== cardId));

  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('id', cardId);

  if (error) {
    fetchCards(); // Rollback
    setToast({ message: 'Kart silinemedi', type: 'error' });
  } else {
    setToast({ message: 'Kart başarıyla silindi', type: 'success' });
  }
};
```

##### 4. Edit Card Alias (Kart Adı Düzenleme)
```javascript
const handleEditCard = async (cardId, newAlias) => {
  // Optimistic update
  setCards((prev) =>
    prev.map((c) => (c.id === cardId ? { ...c, card_alias: newAlias } : c))
  );

  const { error } = await supabase
    .from('user_cards')
    .update({ card_alias: newAlias })
    .eq('id', cardId);

  if (error) {
    fetchCards(); // Rollback
    setToast({ message: 'Güncelleme başarısız', type: 'error' });
  } else {
    setToast({ message: 'Kart adı güncellendi', type: 'success' });
  }
};
```

---

#### Kart Görünümü (UI)

##### Gradient Kartlar
- 6 farklı gradient renk paleti
- Varsayılan kart: `ring-4 ring-brand-primary/30` + yıldız icon
- Son 4 hane: `•••• •••• •••• {last4}`

##### Kart Aksiyonları (3 Buton)
```javascript
<div className="grid grid-cols-3 gap-2">
  {/* 1. Düzenle */}
  <button onClick={() => setEditingCard(card)}>
    <Edit2 size={14} />
    Düzenle
  </button>

  {/* 2. Varsayılan Yap */}
  <button 
    onClick={() => handleSetDefault(card.id)}
    disabled={card.is_default}
  >
    <Star size={14} />
    {card.is_default ? 'Varsayılan' : 'Varsayılan Yap'}
  </button>

  {/* 3. Sil */}
  <button onClick={() => setDeletingCard(card)}>
    <Trash2 size={14} />
    Sil
  </button>
</div>
```

---

#### Empty State (Boş Liste)
```javascript
{cards.length === 0 && (
  <motion.div className="rounded-3xl border-2 border-dashed py-12">
    <CreditCard size={32} className="text-brand-dark/40" />
    <p>Kayıtlı kartınız bulunmuyor</p>
    <p>Sipariş sırasında "Kartı Kaydet" seçeneğini işaretleyin</p>
    <button onClick={() => navigate('/checkout')}>
      Sipariş Ver
    </button>
  </motion.div>
)}
```

---

#### "Yeni Kart Ekle" Info Butonu
```javascript
const handleAddNewCard = () => {
  setToast({
    message: 'Yeni kart eklemek için bir sipariş sırasında "Kartı Kaydet" seçeneğini işaretleyin',
    type: 'info',
  });
};
```

---

### 3. Error Handling (Kota/Limit Uyarıları)

#### Checkout.jsx
```javascript
// Henüz özel handling yok, Cards.jsx'te detaylı hata yönetimi var
```

#### Cards.jsx - Akıllı Hata Yönetimi
```javascript
// Fetch hatası
if (err?.code === '402' || err?.message?.includes('quota') || err?.message?.includes('limit')) {
  setError('Sistem yoğunluğu nedeniyle şu an işlem yapılamıyor. Lütfen birkaç dakika sonra tekrar deneyin.');
} else {
  setError('Kartlar yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
}

// Action hatası (Set Default, Delete, Edit)
if (err?.code === '402' || err?.message?.includes('quota')) {
  setToast({ message: 'Sistem yoğunluğu nedeniyle işlem yapılamadı', type: 'error' });
} else {
  setToast({ message: 'İşlem başarısız', type: 'error' });
}
```

#### Hata Mesajı UI
```javascript
{error && (
  <motion.div className="rounded-2xl border border-red-200 bg-red-50 p-4">
    <AlertCircle size={18} className="text-red-600" />
    <p className="text-sm font-medium text-red-900">{error}</p>
    <button onClick={fetchCards} className="text-xs underline">
      Tekrar Dene
    </button>
  </motion.div>
)}
```

---

## 🎯 Kullanıcı Deneyimi Akışları

### Senaryo 1: Kayıtlı Kart ile Ödeme
1. Checkout sayfasına gelir
2. Kayıtlı kartlarını görür (gradient tasarım)
3. Bir kart seçer
4. "Siparişi Tamamla" butonuna basar
5. Tosla ödeme sayfasına yönlendirilir

### Senaryo 2: Yeni Kart ile Ödeme
1. Checkout sayfasına gelir
2. "Başka Bir Kart ile Öde" butonuna basar
3. Yeni kart formu açılır (animasyonlu)
4. Kart bilgilerini girer
5. "Bu kartı kaydet" checkbox'ını işaretler (opsiyonel)
6. "Siparişi Tamamla" butonuna basar
7. Tosla ödeme sayfasına yönlendirilir

### Senaryo 3: Kart Yönetimi (/profile/cards)
1. "Hesabım > Kayıtlı Kartlarım" sayfasına gider
2. Kartlarını görür (loading skeleton ile premium yükleme deneyimi)
3. **Düzenle**: Kart adını değiştirir (modal açılır, inline editing)
4. **Varsayılan Yap**: Bir kartı varsayılan yapar (optimistic update + toast)
5. **Sil**: Silme onay modalı açılır, onaylar, kart silinir (toast bildirim)

### Senaryo 4: Boş Kart Listesi
1. İlk defa kullanıcı `/profile/cards` sayfasına gelir
2. Empty state görür: "Kayıtlı kartınız bulunmuyor"
3. "Sipariş Ver" butonuna basar
4. Checkout sayfasına yönlendirilir

### Senaryo 5: Sistem Yoğunluğu (402/Quota Hatası)
1. Kullanıcı kart silmeye çalışır
2. Supabase quota limit hatası döner
3. Optimistic update rollback yapılır (kart geri gelir)
4. Toast: "Sistem yoğunluğu nedeniyle işlem yapılamadı" (kırmızı, error)
5. Kullanıcı birkaç saniye bekler ve tekrar dener

---

## 🎨 UI/UX Highlights

### Checkout.jsx
- ✅ Esnek ödeme seçenekleri (kayıtlı vs yeni kart)
- ✅ Açılır/kapanır form (Framer Motion)
- ✅ Güvenlik bildirimi (mavi info box)
- ✅ "Kayıtlı Kartlara Dön" butonu
- ✅ Validation: Kayıtlı kart veya yeni form zorunlu

### Cards.jsx
- ✅ Premium gradient kartlar (6 farklı palet)
- ✅ Varsayılan kart badge (⭐ + ring)
- ✅ Loading skeleton (pulse animasyon)
- ✅ Toast notifications (success, error, info)
- ✅ Modal'lar (edit, delete confirmation)
- ✅ Optimistic updates (rollback + retry)
- ✅ Empty state (boş liste için şık tasarım)
- ✅ 3 aksiyon butonu (Düzenle, Varsayılan Yap, Sil)
- ✅ "Tekrar Dene" butonu (error state'te)

---

## 📊 State Yönetimi

### Checkout.jsx
```javascript
const [showNewCardForm, setShowNewCardForm] = useState(false);
const [saveCard, setSaveCard] = useState(false);
const [userSavedCards, setUserSavedCards] = useState([]);
const [cardsLoading, setCardsLoading] = useState(true);
const [selectedCardId, setSelectedCardId] = useState('');
```

### Cards.jsx
```javascript
const [cards, setCards] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [toast, setToast] = useState(null);
const [editingCard, setEditingCard] = useState(null);
const [deletingCard, setDeletingCard] = useState(null);
```

---

## 🔄 Optimistic Updates

### Avantajlar
- Anlık UI feedback (kullanıcı işlemin başarılı olduğunu hemen görür)
- Daha hızlı hissettiren UX
- Network gecikmesi kullanıcıyı etkilemez

### Rollback Mekanizması
```javascript
try {
  // Optimistic update
  setCards((prev) => /* yeni state */);

  // API call
  const { error } = await supabase...;

  if (error) throw error;
} catch (err) {
  // Rollback
  fetchCards(); // Database'den tekrar çek
  setToast({ message: 'Hata', type: 'error' });
}
```

---

## 🐛 Hata Senaryoları ve Çözümler

### 1. Supabase Quota Limit (402)
**Senaryo**: Ücretsiz tier limiti aşıldı
**Çözüm**: Kullanıcıya net mesaj + "Tekrar Dene" butonu
```
"Sistem yoğunluğu nedeniyle şu an işlem yapılamıyor. 
Lütfen birkaç dakika sonra tekrar deneyin."
```

### 2. Network Hatası
**Senaryo**: İnternet bağlantısı kesildi
**Çözüm**: Generic error + rollback + toast notification

### 3. Yetki Hatası (RLS)
**Senaryo**: Kullanıcı başka birinin kartını silmeye çalışır
**Çözüm**: RLS politikaları otomatik engeller, frontend'de "İşlem başarısız" mesajı

### 4. Validation Hatası
**Senaryo**: Boş kart adı kaydetmeye çalışır
**Çözüm**: `disabled={!alias.trim() || saving}` ile buton devre dışı

---

## 🚀 Performance Optimizations

### 1. Loading Skeleton
- İçerik yüklenmeden önce skeleton gösterilir
- Kullanıcı "boş sayfa" görmez

### 2. Optimistic Updates
- UI anında güncellenir
- Network gecikmesi UX'i etkilemez

### 3. AnimatePresence
- Framer Motion ile smooth list animations
- `layout` prop ile automatic reordering animations

### 4. Conditional Rendering
- Yalnızca gerekli bileşenler render edilir
- Modals: `{editingCard && <EditCardModal />}`

---

## 📱 Mobile-First Design

### Cards.jsx
- Tam ekran kartlar (aspect-ratio: 1.6:1)
- 3 kolonlu grid (Düzenle, Varsayılan, Sil)
- Modal'lar mobil-friendly (max-w-sm)

### Checkout.jsx
- Form alanları mobil-optimized
- Sticky bottom bar (Siparişi Tamamla)
- Touch-friendly button sizes

---

## 🎬 Animasyonlar

### Framer Motion Kullanımı

#### 1. Toast Slide-In
```javascript
initial={{ opacity: 0, y: -20 }}
animate={{ opacity: 1, y: 0 }}
exit={{ opacity: 0, y: -20 }}
```

#### 2. Modal Fade + Scale
```javascript
initial={{ opacity: 0, scale: 0.9 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.9 }}
```

#### 3. Card List (Stagger)
```javascript
<AnimatePresence mode="popLayout">
  {cards.map((card) => (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    />
  ))}
</AnimatePresence>
```

#### 4. Form Expand/Collapse
```javascript
{showNewCardForm && (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
  />
)}
```

---

## 🔐 Güvenlik

### Frontend
- Kart numarası asla state'de tutulmaz
- CVV bilgisi temporary input'ta kalır
- Tosla ödeme sayfasına redirect sonrası form temizlenir

### Backend
- Kart token'ları database'de saklanır
- RLS policies: Kullanıcı sadece kendi kartlarını görebilir/silebilir
- Edge Functions: Tüm hassas işlemler sunucu tarafında

---

## 📋 Checklist (Tüm Özellikler)

### Checkout.jsx
- [x] "Başka Bir Kart ile Öde" butonu
- [x] Yeni kart formu (açılır/kapanır)
- [x] Kart bilgileri inputları (isim, numara, SKT, CVV)
- [x] "Kayıtlı Kartlara Dön" butonu
- [x] Güvenlik bildirimi (info box)
- [x] "Kartı Kaydet" checkbox (yalnızca yeni kart formunda)
- [x] Validation güncellemesi

### Cards.jsx
- [x] Database'den kart çekme (`fetchCards`)
- [x] Loading skeleton
- [x] Gradient kart gösterimi
- [x] Varsayılan kart badge
- [x] "Düzenle" butonu + modal
- [x] "Varsayılan Yap" butonu + Supabase update
- [x] "Sil" butonu + onay modalı + Supabase delete
- [x] Toast notifications (success, error, info)
- [x] Optimistic updates + rollback
- [x] Empty state (boş liste)
- [x] "Yeni Kart Ekle" info butonu
- [x] Error handling (quota/limit)
- [x] "Tekrar Dene" butonu

---

## 🎯 Sonuç

**Durum**: ✅ Tamamlandı ve Production-Ready

Tüm UX iyileştirmeleri uygulandı. Sistem artık:
- Esnek ödeme seçenekleri sunuyor
- Tam fonksiyonel kart yönetimi sağlıyor
- Premium bir kullanıcı deneyimi veriyor
- Hataları zarif bir şekilde yönetiyor
- Mobile-first ve performans-odaklı

**Son Güncelleme**: 24 Şubat 2026
