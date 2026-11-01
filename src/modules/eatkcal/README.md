# modules/eatkcal — Öğün siparişi servisi

**eatkcal** (öğün siparişi) akışının modül sınırı. Bu S2 oturumunda sipariş
akışının çekirdek ekranları buraya taşındı:

- `screens/CartScreen.tsx` — sepet
- `screens/CheckoutScreen.tsx` — sipariş özeti / ödeme
- `screens/OrderSuccessScreen.tsx` — sipariş başarılı
- `screens/PaymentScreen.tsx` — PaynKolay hosted ödeme ekranı

Sadece taşıma + import güncellemesi yapıldı; **davranış/görünüm değişmedi**.

## Henüz taşınmayanlar (bilinçli, sonraki faz)
Katalog/adres/kampanya ekranları (Categories, CategoryProducts, ProductDetail,
BrandLanding, Addresses, Offers) ve sipariş-domain lib'leri (`orders`, `cart`,
`delivery`, `reorder`, `checkoutPayment` …) şimdilik merkezde kaldı. Bunlar
AI servisiyle kısmen paylaşıldığından ve import yüzeyleri geniş olduğundan,
risksiz ve `tsc`-doğrulanabilir bir sonraki adımda taşınacak. Ortak altyapı
(`src/core/`) her iki serviste paylaşılır.
