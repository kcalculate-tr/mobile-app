# 💳 Checkout Ödeme Akışı - Final Implementation

## 📋 Genel Bakış

Checkout.jsx'teki ödeme akışı iki farklı senaryoyu destekler:
1. **Kayıtlı Kart ile Ödeme**: Sadece `cardToken` gönderilir
2. **Yeni Kart ile Ödeme**: Kart bilgileri (numara, CVV, vb.) gönderilir

---

## 🎨 UI Yapısı

### 1. Kayıtlı Kartlar Listesi (Üstte)
```javascript
{!cardsLoading && userSavedCards.length > 0 && (
  <div className="space-y-2">
    <p>Kayıtlı Kartlarım</p>
    {userSavedCards.map((card) => (
      <button onClick={() => setSelectedCardId(card.id)}>
        {card.brand} •••• {card.last4}
      </button>
    ))}
  </div>
)}
```

**Özellikler:**
- Database'den (`user_cards`) çekilen kartlar
- Gradient tasarım
- Varsayılan kart badge (⭐)
- Tıklanabilir, seçili olduğunda highlight

---

### 2. "Başka Bir Kart ile Öde" Butonu (Listenin Altında)
```javascript
{!cardsLoading && (userSavedCards.length > 0 || savedCards.length > 0) && (
  <button
    onClick={() => {
      setShowNewCardForm(true);
      setSelectedCardId('');
      setSaveCard(false);
    }}
  >
    {showNewCardForm ? 'Yeni Kart Formu Açık' : 'Başka Bir Kart ile Öde'}
  </button>
)}
```

**Davranış:**
- Butona basıldığında `showNewCardForm: true`
- Kayıtlı kart seçimi sıfırlanır (`selectedCardId: ''`)
- "Kartı Kaydet" checkbox sıfırlanır

---

### 3. Yeni Kart Formu (Açılır/Kapanır)
```javascript
{showNewCardForm && (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
  >
    <input 
      value={newCardData.holderName}
      onChange={(e) => setNewCardData(prev => ({ ...prev, holderName: e.target.value.toUpperCase() }))}
      placeholder="Kart Üzerindeki İsim"
    />
    <input 
      value={newCardData.cardNumber}
      onChange={/* Auto-format: 0000 0000 0000 0000 */}
      placeholder="Kart Numarası"
      maxLength={19}
    />
    <input 
      value={newCardData.expiryDate}
      onChange={/* Auto-format: AA/YY */}
      placeholder="Son Kullanma"
      maxLength={5}
    />
    <input 
      value={newCardData.cvv}
      onChange={/* Only digits */}
      placeholder="CVV"
      maxLength={3}
    />
  </motion.div>
)}
```

**State:**
```javascript
const [newCardData, setNewCardData] = useState({
  holderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
});
```

**Auto-Formatting:**
- **Kart Numarası**: `0000 0000 0000 0000` (boşluklarla gruplandırma)
- **SKT**: `AA/YY` (otomatik slash ekleme)
- **CVV**: Sadece rakamlar
- **İsim**: Otomatik UPPERCASE

**Güvenlik Bildirimi:**
```
ℹ️ Kart bilgileri güvenli ödeme sayfasında işlenecektir.
```

**"Kayıtlı Kartlara Dön" Butonu:**
- Formu kapatır
- Input değerlerini sıfırlar
- `setShowNewCardForm(false)`

---

## ✅ Validation (handleSubmit)

### 1. Kart Seçimi Kontrolü
```javascript
if (!selectedCardId && !showNewCardForm) {
  setError('Lütfen bir kart seçin veya yeni kart formu ile devam edin.');
  return;
}
```

### 2. Yeni Kart Formu Validasyonu
```javascript
if (showNewCardForm) {
  // İsim kontrolü
  if (!newCardData.holderName.trim()) {
    setError('Lütfen kart üzerindeki ismi girin.');
    return;
  }

  // Kart numarası (15-16 hane)
  const cardNumberDigits = newCardData.cardNumber.replace(/\s/g, '');
  if (cardNumberDigits.length < 15 || cardNumberDigits.length > 16) {
    setError('Lütfen geçerli bir kart numarası girin (15-16 hane).');
    return;
  }

  // SKT formatı (AA/YY)
  if (newCardData.expiryDate.length !== 5 || !newCardData.expiryDate.includes('/')) {
    setError('Lütfen son kullanma tarihini AA/YY formatında girin.');
    return;
  }

  // CVV (3 hane)
  if (newCardData.cvv.length < 3) {
    setError('Lütfen geçerli bir CVV kodu girin (3 hane).');
    return;
  }
}
```

---

## 🔄 Payment Flow (handleSubmit)

### Aşama 1: Sipariş Tutarı Hesaplama
```javascript
const finalPayableTotal = Number(
  Math.max(0, subtotalAmount + deliveryFeeAmount - confirmedDiscountAmount).toFixed(2)
);
```

**Önemli:** Artık sadece `finalPayableTotal` kullanılıyor. `payableTotal` karmaşası giderildi.

---

### Aşama 2: Sipariş Kaydı
```javascript
const orderPayload = {
  status: 'pending',
  payment_status: 'pending',
  total_amount: finalPayableTotal,
  subtotal_amount: subtotalAmount,
  delivery_fee: deliveryFeeAmount,
  discount_amount: confirmedDiscountAmount,
  tosla_oid: orderOid,
  order_uuid: orderUUID,
  // ... diğer alanlar
};

const { data: insertedOrder } = await insertOrderWithFallback(orderPayload);
```

---

### Aşama 3: Tosla Ödeme İsteği

#### Senaryo A: Kayıtlı Kart Seçiliyse
```javascript
if (selectedCardId && !showNewCardForm) {
  toslaPaymentParams.cardToken = selectedCard?.card_token || null;
  toslaPaymentParams.saveCard = false; // Zaten kayıtlı
}
```

**Edge Function'a Gönderilen:**
```json
{
  "amount": "250.00",
  "orderId": "KCAL-1234567890-abc123",
  "customerName": "ALI YILMAZ",
  "customerEmail": "ali@example.com",
  "cardToken": "tok_xyz123abc456" // ✅ Sadece token
}
```

#### Senaryo B: Yeni Kart Formu Aktifse
```javascript
else if (showNewCardForm) {
  toslaPaymentParams.cardHolderName = newCardData.holderName;
  toslaPaymentParams.cardNumber = newCardData.cardNumber.replace(/\s/g, '');
  toslaPaymentParams.cardExpiry = newCardData.expiryDate;
  toslaPaymentParams.cardCvv = newCardData.cvv;
  toslaPaymentParams.saveCard = saveCard; // Checkbox değeri
}
```

**Edge Function'a Gönderilen:**
```json
{
  "amount": "250.00",
  "orderId": "KCAL-1234567890-abc123",
  "customerName": "ALI YILMAZ",
  "customerEmail": "ali@example.com",
  "cardHolderName": "ALI YILMAZ", // ✅ Kart bilgileri
  "cardNumber": "4355084355084358",
  "cardExpiry": "12/28",
  "cardCvv": "000",
  "saveCard": true
}
```

---

### Aşama 4: Tosla API Çağrısı (Edge Function)

#### Edge Function: `tosla-payment-init/index.ts`

**Kayıtlı Kart ile:**
```typescript
if (cardToken) {
  paymentPayload.CardToken = cardToken
  paymentPayload.SaveCard = false // Zaten kayıtlı
}
```

**Yeni Kart ile:**
```typescript
else if (cardNumber) {
  paymentPayload.CardHolderName = cardHolderName
  paymentPayload.CardNumber = cardNumber
  paymentPayload.CardExpiry = cardExpiry
  paymentPayload.CardCvv = cardCvv
  paymentPayload.SaveCard = saveCard === true
}
```

**Tosla API Request:**
```json
{
  "ClientId": "xxx",
  "Amount": "250.00",
  "Currency": "TRY",
  "OrderId": "KCAL-1234567890-abc123",
  "SuccessUrl": "http://localhost:5173/payment-success",
  "FailUrl": "http://localhost:5173/payment-fail",
  "CustomerName": "ALI YILMAZ",
  "CustomerEmail": "ali@example.com",
  
  // Kayıtlı kart seçenekleri
  "CardToken": "tok_xyz123abc456", // (varsa)
  
  // VEYA Yeni kart seçenekleri
  "CardHolderName": "ALI YILMAZ",
  "CardNumber": "4355084355084358",
  "CardExpiry": "12/28",
  "CardCvv": "000",
  "SaveCard": true
}
```

---

### Aşama 5: Redirect
```javascript
const toslaPayment = await initiateToslaPayment(toslaPaymentParams);

if (!toslaPayment.success) {
  throw new Error(toslaPayment.error || 'Ödeme başlatılamadı');
}

// Payment URL'yi database'e kaydet
await supabase
  .from('orders')
  .update({ payment_url: toslaPayment.paymentUrl })
  .eq('id', finalOrderId);

// LocalStorage'a pending order kaydet
localStorage.setItem(`pending_order_${orderOid}`, JSON.stringify({
  orderId: finalOrderId,
  orderCode: orderCode,
  toslaOid: orderOid,
  amount: finalPayableTotal,
  timestamp: Date.now(),
}));

// Tosla ödeme sayfasına yönlendir
window.location.href = toslaPayment.paymentUrl;
```

---

## ❌ Error Handling

### Validation Hataları
```javascript
setError('Lütfen kart üzerindeki ismi girin.');
setError('Lütfen geçerli bir kart numarası girin (15-16 hane).');
setError('Lütfen son kullanma tarihini AA/YY formatında girin.');
setError('Lütfen geçerli bir CVV kodu girin (3 hane).');
```

### API Hataları
```javascript
catch (err) {
  console.error('Checkout Error Detayı:', err?.message, err?.details);
  
  // Failed payment log
  const failedAmount = Math.max(0, subtotalAmount + deliveryFeeAmount - (discountAmount || 0));
  await logFailedPayment(user?.id, err?.message, failedAmount, {
    payment_method: 'kredi-karti',
    card_last4: failedCard?.last4,
    error_code: err?.code,
    attempt_number: paymentAttempts,
  });

  setError('Ödeme işlemi tamamlanamadı. Lütfen kart bilgilerinizi kontrol edip tekrar deneyin.');
  
  // Yeni deneme için UUID yenile
  setOrderUUID(generateOrderUUID());
}
```

---

## 🔒 Güvenlik

### Frontend
- ✅ Kart numarası asla database'e yazılmaz
- ✅ CVV asla log'lanmaz
- ✅ Tosla'ya redirect sonrası input'lar temizlenir
- ✅ Tüm kart bilgileri HTTPS üzerinden iletilir

### Backend (Edge Function)
- ✅ Kart bilgileri frontend'e asla geri dönmez
- ✅ Bearer token server-side oluşturulur
- ✅ API secrets `Deno.env` ile korunur
- ✅ CORS headers yapılandırılmış

---

## 📊 State Yönetimi

### Checkout.jsx States
```javascript
const [showNewCardForm, setShowNewCardForm] = useState(false);
const [newCardData, setNewCardData] = useState({
  holderName: '',
  cardNumber: '',
  expiryDate: '',
  cvv: '',
});
const [saveCard, setSaveCard] = useState(false);
const [userSavedCards, setUserSavedCards] = useState([]);
const [selectedCardId, setSelectedCardId] = useState('');
```

### State Flow
1. **Başlangıç**: Kayıtlı kartlar yüklenir (`userSavedCards`)
2. **Kayıtlı Kart Seçimi**: `selectedCardId` set edilir
3. **Yeni Kart Formu**: `showNewCardForm: true`, `selectedCardId: ''`
4. **Form Dolduruluyor**: `newCardData` güncellenir
5. **Submit**: `initiateToslaPayment` çağrılır
6. **Başarı**: Tosla'ya redirect

---

## 🎯 Kullanıcı Senaryoları

### Senaryo 1: Kayıtlı Kart ile Ödeme
1. Kullanıcı checkout sayfasına gelir
2. Kayıtlı kartlarını görür (gradient tasarım)
3. Bir kart seçer → `selectedCardId: 'card123'`
4. "Siparişi Tamamla" butonuna basar
5. **Backend**: Sadece `cardToken` gönderilir
6. Tosla ödeme sayfasına yönlendirilir

### Senaryo 2: Yeni Kart ile Ödeme (Kaydetmeden)
1. Kullanıcı checkout sayfasına gelir
2. "Başka Bir Kart ile Öde" butonuna basar
3. Form açılır → `showNewCardForm: true`
4. Kart bilgilerini girer:
   - İsim: "ALI YILMAZ"
   - Numara: "4355 0843 5508 4358"
   - SKT: "12/28"
   - CVV: "000"
5. "Kartı Kaydet" checkbox'ını **işaretlemez**
6. "Siparişi Tamamla" butonuna basar
7. **Backend**: Kart bilgileri gönderilir, `saveCard: false`
8. Tosla ödeme sayfasına yönlendirilir
9. Ödeme başarılı, kart **kaydedilmez**

### Senaryo 3: Yeni Kart ile Ödeme (Kaydederek)
1. Kullanıcı checkout sayfasına gelir
2. "Başka Bir Kart ile Öde" butonuna basar
3. Form açılır
4. Kart bilgilerini girer
5. "Kartı Kaydet" checkbox'ını **işaretler** → `saveCard: true`
6. "Siparişi Tamamla" butonuna basar
7. **Backend**: Kart bilgileri gönderilir, `saveCard: true`
8. Tosla ödeme sayfasına yönlendirilir
9. Ödeme başarılı, Tosla `CardToken` döner
10. `tosla-callback` Edge Function kartı `user_cards` tablosuna kaydeder

### Senaryo 4: Form Açıp Vazgeçme
1. Kullanıcı "Başka Bir Kart ile Öde" butonuna basar
2. Form açılır, kart bilgilerini girmeye başlar
3. Fikri değişir, "Kayıtlı Kartlara Dön" butonuna basar
4. Form kapanır, input'lar temizlenir
5. Kayıtlı kartlar listesi tekrar görünür

---

## 🐛 Bilinen Sorunlar ve Çözümler

### Sorun 1: `finalPayableTotal` vs `payableTotal`
**Önceki Durum:** İki farklı isim kullanılıyordu, catch bloğunda hata veriyordu.

**Çözüm:**
```javascript
// handleSubmit içinde
const finalPayableTotal = Number(
  Math.max(0, subtotalAmount + deliveryFeeAmount - confirmedDiscountAmount).toFixed(2)
);

// catch bloğunda
const failedAmount = Math.max(0, subtotalAmount + deliveryFeeAmount - (discountAmount || 0));
await logFailedPayment(user?.id, err?.message, failedAmount, { ... });
```

### Sorun 2: Kart Bilgileri Frontend'de Tutuluyordu
**Çözüm:** State'te sadece form input değerleri tutulur, submit sonrası Edge Function'a gönderilir ve frontend'de temizlenir.

### Sorun 3: Kayıtlı Kart ile Ödeme Sırasında Kart Bilgileri İsteniyordu
**Çözüm:** Conditional rendering:
```javascript
{showNewCardForm && (
  <motion.div> {/* Yeni kart formu */} </motion.div>
)}
```

---

## 📝 Checklist

### Checkout.jsx
- [x] `newCardData` state eklendi
- [x] Auto-formatting (kart numarası, SKT)
- [x] Yeni kart formu validasyonu
- [x] Kayıtlı kart vs yeni kart ayrımı
- [x] `initiateToslaPayment` parametreleri güncellendi
- [x] `finalPayableTotal` / `payableTotal` karmaşası giderildi

### Edge Function
- [x] Yeni parametreler eklendi (`cardHolderName`, `cardNumber`, vb.)
- [x] Conditional logic (kayıtlı vs yeni kart)
- [x] TypeScript tipleri düzeltildi (`paymentPayload: any`)

### UI/UX
- [x] "Başka Bir Kart ile Öde" butonu
- [x] Yeni kart formu açılır/kapanır animasyon
- [x] "Kayıtlı Kartlara Dön" butonu
- [x] Güvenlik bildirimi

---

## 🚀 Sonuç

**Durum:** ✅ Tamamlandı ve Test Edilmeye Hazır

Ödeme akışı artık:
- 2 farklı senaryoyu destekliyor (kayıtlı/yeni kart)
- Güvenli (kart bilgileri frontend'de saklanmıyor)
- Kullanıcı dostu (auto-formatting, validation)
- Tutarlı (tek bir `finalPayableTotal` değişkeni)

**Son Güncelleme:** 24 Şubat 2026
