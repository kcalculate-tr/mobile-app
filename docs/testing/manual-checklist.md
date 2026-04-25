# KCAL Manuel Test Playbook (Kritik Akışlar)

Bu doküman iOS ve Android EAS preview build'lerinde sprint içi manuel doğrulama için hazırlanmıştır.

## Test Ortamı ve Ön Koşullar

- [ ] **PASS** / [ ] **FAIL** iOS cihaz veya simülatör hazır
- [ ] **PASS** / [ ] **FAIL** Android cihaz veya emülatör hazır
- [ ] **PASS** / [ ] **FAIL** Güncel EAS preview build yüklü
- [ ] **PASS** / [ ] **FAIL** Test kullanıcı e-postası erişilebilir (verification code için)
- [ ] **PASS** / [ ] **FAIL** Test kartı / 3DS senaryosu hazır
- [ ] **PASS** / [ ] **FAIL** Push izni cihazda sıfırlandı (ilk izin ekranı test edilebilsin)

---

## 1) Onboarding + Kayıt

### Amaç
Onboarding swipe, kayıt, e-posta doğrulama ve push token kaydı zincirini doğrulamak.

### Adımlar

- [ ] **PASS** / [ ] **FAIL** Uygulama temiz başlangıçla açılır, onboarding ilk ekranı görünür
- [ ] **PASS** / [ ] **FAIL** 3 hero ekranı yatay swipe ile sorunsuz geçilir
- [ ] **PASS** / [ ] **FAIL** Kayıt ekranına geçiş yapılır
- [ ] **PASS** / [ ] **FAIL** Geçersiz e-posta formatı (`abc`, `abc@`) girildiğinde Türkçe validation mesajı görünür
- [ ] **PASS** / [ ] **FAIL** Geçerli e-posta + şifre ile kayıt aksiyonu çalışır
- [ ] **PASS** / [ ] **FAIL** Kullanıcı mail kutusundan gelen doğrulama kodu girilir
- [ ] **PASS** / [ ] **FAIL** Kod doğruysa doğrulama başarılı mesajı / akış geçişi olur
- [ ] **PASS** / [ ] **FAIL** Notification permission prompt gösterilir
- [ ] **PASS** / [ ] **FAIL** İzin verildikten sonra ana sayfaya düşülür
- [ ] **PASS** / [ ] **FAIL** Supabase'de ilgili user için push token kaydı oluşur

### Beklenen Sonuç

- [ ] **PASS** / [ ] **FAIL** Kullanıcı authenticated durumda Home ekranında
- [ ] **PASS** / [ ] **FAIL** Auth + push token zinciri hatasız tamamlandı

---

## 2) Sepet + Ürün Ekleme

### Amaç
Home ürün kartından sepete ekleme sonrası FloatingCartPill davranışı ve toplamların doğruluğunu doğrulamak.

### Adımlar

- [ ] **PASS** / [ ] **FAIL** HomeScreen açılır ve ürün listesi görünür
- [ ] **PASS** / [ ] **FAIL** Bir ürün kartındaki `+` ikonuna basılır (Phosphor icon)
- [ ] **PASS** / [ ] **FAIL** FloatingCartPill alttan slide animasyonu ile görünür
- [ ] **PASS** / [ ] **FAIL** Pill üzerinde quantity ve price değerleri dolu görünür
- [ ] **PASS** / [ ] **FAIL** Pill'e tıklanır ve CartScreen'e gidilir
- [ ] **PASS** / [ ] **FAIL** CartScreen'de ürün satırı ve miktar Home'daki seçimle eşleşir

### Beklenen Sonuç

- [ ] **PASS** / [ ] **FAIL** `totalQty` doğru hesaplanır
- [ ] **PASS** / [ ] **FAIL** `totalPrice` doğru hesaplanır

---

## 3) ProductDetail -> Sepete Ekle -> Stepper

### Amaç
Ürün detay sticky bar, animasyonlu ekleme, stepper davranışı ve AnimatedNumberText geçişini doğrulamak.

### Adımlar

- [ ] **PASS** / [ ] **FAIL** Home'dan bir ürün detay ekranı açılır
- [ ] **PASS** / [ ] **FAIL** Alt sticky bar'da `Toplam Tutar` ve `Sepete Ekle` görünür
- [ ] **PASS** / [ ] **FAIL** `Sepete Ekle` basıldığında animasyonlu state geçişi olur
- [ ] **PASS** / [ ] **FAIL** Stepper (`-`, adet, `+`) ve `Sepete Git` butonu görünür
- [ ] **PASS** / [ ] **FAIL** `+` ile miktar artırıldığında adet ve toplam anlık güncellenir
- [ ] **PASS** / [ ] **FAIL** `-` ile miktar azaltıldığında adet ve toplam anlık güncellenir
- [ ] **PASS** / [ ] **FAIL** AnimatedNumberText vertical slide gözlemlenir
- [ ] **PASS** / [ ] **FAIL** `Sepete Git` ile CartScreen'e geçilir

### Beklenen Sonuç

- [ ] **PASS** / [ ] **FAIL** Cart state (Zustand `cartStore`) detail seçimleriyle tutarlı
- [ ] **PASS** / [ ] **FAIL** Animasyonlar kırılma/jank olmadan çalışır

---

## 4) Checkout -> Ödeme -> Onay

### Amaç
Checkout kombinasyonları, zone kuralları, ödeme/3DS ve sipariş doğrulama zincirini doğrulamak.

### Adımlar

- [ ] **PASS** / [ ] **FAIL** CartScreen'de `Ödemeye Geç` aktif görünür
- [ ] **PASS** / [ ] **FAIL** Checkout ekranında adres seçimi yapılır
- [ ] **PASS** / [ ] **FAIL** Çeşme benzeri `allow_immediate=false` zone ile test edilir
- [ ] **PASS** / [ ] **FAIL** Bu durumda `Hemen` seçeneği disabled, `Randevulu` otomatik seçili gelir
- [ ] **PASS** / [ ] **FAIL** Eve Teslim / Gel-Al seçenekleri arasında geçiş yapılır
- [ ] **PASS** / [ ] **FAIL** Zone hiç teslimat almıyorsa banner görünür: `Bu bölgeye teslimat yapılmıyor`
- [ ] **PASS** / [ ] **FAIL** Banner varken `Ödemeye Geç` butonu disabled olur
- [ ] **PASS** / [ ] **FAIL** Tosla WebView (veya aktifse PayTR iFrame) ödeme formu açılır
- [ ] **PASS** / [ ] **FAIL** Test kartı bilgileri girilir, 3DS challenge tamamlanır
- [ ] **PASS** / [ ] **FAIL** Başarılı ödeme sonrası OrderConfirmScreen açılır
- [ ] **PASS** / [ ] **FAIL** Supabase `orders.status='confirmed'` görülür
- [ ] **PASS** / [ ] **FAIL** Macro siparişte `macro_balance` güncellenir
- [ ] **PASS** / [ ] **FAIL** `Siparişin alındı 🎉` push bildirimi gelir

### Beklenen Sonuç

- [ ] **PASS** / [ ] **FAIL** Checkout edge-case kuralları doğru uygulanır
- [ ] **PASS** / [ ] **FAIL** Sipariş ve ödeme sonucu backend state ile tutarlı

---

## 5) Push Notifications End-to-End

### Amaç
Order status değişimine bağlı push tetikleme, bildirimden deep link ve doğru sipariş açılışını doğrulamak.

### Adımlar

- [ ] **PASS** / [ ] **FAIL** Test siparişi için backend'de status `preparing` yapılır
- [ ] **PASS** / [ ] **FAIL** Uygulama background'dayken `Siparişin hazırlanıyor 👨‍🍳` push gelir
- [ ] **PASS** / [ ] **FAIL** Push teslim süresi ölçülür (`<3sn` hedef)
- [ ] **PASS** / [ ] **FAIL** Bildirime tıklanınca uygulama `ProfileOrders` rotasına açılır
- [ ] **PASS** / [ ] **FAIL** Sipariş detay ekranında doğru `orderId` açılır

### Beklenen Sonuç

- [ ] **PASS** / [ ] **FAIL** Push delivery SLA karşılanır
- [ ] **PASS** / [ ] **FAIL** Deep link + navigation (React Navigation 6) doğru çalışır

---

## Kapanış Notları

- [ ] **PASS** / [ ] **FAIL** Her başarısız adım için ekran görüntüsü + kısa log notu eklendi
- [ ] **PASS** / [ ] **FAIL** iOS/Android farkları ayrıca işaretlendi
- [ ] **PASS** / [ ] **FAIL** Açılan bug'lar flow başlığına göre etiketlendi (`onboarding`, `cart`, `checkout`, `push`)
