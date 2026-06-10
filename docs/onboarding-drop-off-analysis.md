# Onboarding Adres Drop-off Analizi

**Tarih:** 2026-05-24
**Konu:** 44 müşterinin 16'sı (%36) onboarding sırasında adres ekleyememiş. Sebep ve fix önerileri.

---

## Onboarding adres akışının durumu

**Zorunluluk:** Form 4 alanı (ilçe, mahalle, sokak, açık adres) **strict required**. `canSubmit` 4'ü de doluyken aktif olur ([RegisterAddressScreen.tsx:105-109](../src/screens/auth/RegisterAddressScreen.tsx#L105-L109)). **Skip / sonra ekle butonu YOK.**

**Akış sırası ve session yaratma noktası:**

| # | Ekran | DB yazımı | Auth session? |
|---|-------|-----------|---------------|
| 1 | RegisterEmail | yok | yok |
| 2 | **VerifyOtp** | yok | **EVET** — `supabase.auth.verifyOtp` session yaratır ([VerifyOtpScreen.tsx:32-37](../src/screens/auth/VerifyOtpScreen.tsx#L32-L37)) |
| 3 | RegisterIdentity | yok (sadece in-memory Zustand) | session var |
| 4 | RegisterAddress | `profiles UPDATE` + `addresses INSERT` (atomik değil) | session var |

**Kritik:** session #2'de yaratılıyor, profil + adres yazımı #4'te. Yani user #2-#3 arasında veya #4'te submit'ten önce kapatırsa, `auth.users` satırı var ama `addresses` satırı YOK.

**Gate'in bayatlık davranışı:** `@kcal_onboarding_done` flag'i sadece `NutritionSummaryScreen` veya `LoginScreen`'de set ediliyor ([NutritionSummaryScreen.tsx:70](../src/screens/onboarding/nutrition/NutritionSummaryScreen.tsx#L70), [LoginScreen.tsx:56](../src/screens/auth/LoginScreen.tsx#L56)). RegisterAddress'te set EDILMEZ; bunun yerine `@kcal_needs_nutrition_profile=true` yazılıp NutritionGender'a navigate edilir. NutritionSummary tamamlanmadan iki flag de yarım kalır.

Submit handler hata yönetimi: catch sadece `errors.general` set eder, kullanıcı aynı formda kalır ([RegisterAddressScreen.tsx:168-172](../src/screens/auth/RegisterAddressScreen.tsx#L168-L172)). Retry yok, network fail uyarısı yok.

---

## Drop-off için en olası 3 sebep

### 1. Auth session OTP'de yaratılıyor, adres 2 ekran sonra — abandonment window büyük
%50+ ihtimal. Mobile telefonla 4 ekranlık form doldurmak, OTP girdikten sonra "ben bunu sonra hallederim" reflexi tetikler. App kapanır, yeniden açıldığında session restore olur ama:
- `@kcal_onboarding_done = null` → gate user'ı OnboardingStack'in `Welcome` ekranına atar
- Kullanıcı tekrar register denerse "email already in use" hatası alır
- Şüphe ile `Login`'i denerse → LoginScreen `@kcal_onboarding_done='true'` + `@kcal_needs_nutrition_profile='false'` yazar ([LoginScreen.tsx:56-57](../src/screens/auth/LoginScreen.tsx#L56-L57)) → **adres ekranını bir daha asla göremez**, direkt Tabs'a düşer

Bu, 16 adressiz müşterinin **ana üretim mekanizması.**

### 2. `mahalle` picker `delivery_zones` tablosuna bağımlı — coverage gap = stuck user
%30 ihtimal. `neighborhoodOptions` ilçe seçildikten sonra `delivery_zones` tablosundan filtreleniyor ([RegisterAddressScreen.tsx:65-68](../src/screens/auth/RegisterAddressScreen.tsx#L65-L68)). Kullanıcının yaşadığı ilçe `delivery_zones`'da yoksa veya mahallesi listede yoksa, hiçbir seçenek görünmez, free-text alternatifi YOK, "diğer" yok. User çıkmaz. Form zorunlu olduğu için ilerleyemez. Kapatır.

İzmir dışından veya yeni mahallelerden gelen kullanıcılar bu duvara çarpar.

### 3. "Konumumu kullan" reverse-geocode pattern eşleşmeleri kırılgan
%15 ihtimal. Lokasyon alındıktan sonra `geo.subregion/district/name` ile `delivery_zones` arası `norm()` (lowercase) eşleşmesi aranıyor ([RegisterAddressScreen.tsx:85-97](../src/screens/auth/RegisterAddressScreen.tsx#L85-L97)). Apple/Google reverse geocoder'ın döndürdüğü "Karşıyaka" vs DB'deki "Karsiyaka" / "Karşıyaka Mh." gibi varyasyonlar match etmez. User "bu uygulama benim konumumu bulamadı" diyip çıkar. Manuel dropdown ile devam edebilirler ama deneyim kırılmış olur.

---

## Önerilen 3 fix

### Fix A — Resume guard'ı AppNavigator'a ekle (en yüksek ROI)
**Ne:** App launch'ta, session var ama henüz `addresses` satırı yoksa, kullanıcıyı `OnboardingStack` → `RegisterIdentity` ekranına zorla pinle.

**Nasıl:** [AppNavigator.tsx:108-132](../src/navigation/AppNavigator.tsx#L108-L132) içine, `user?.id` set olduğunda Supabase'ten `select count() from addresses where user_id = $user_id` çek; sıfırsa `inOnboardingStack=true` kalmaya zorla VE `initialRouteName='RegisterIdentity'` ata. `LoginScreen`'deki kestirme flag-yazımını da kaldır — gate kararını DB state'e bırak.

**Etki:** Sebep 1'i tamamen kapatır. Re-login sonrası abandon eden 16 müşterinin önemli kısmı bir sonraki app açılışında adres ekranına dönecek.

**Risk:** App launch'ta 1 ekstra Supabase query. Cache'lenebilir; user session'ı zaten DB roundtrip içeriyor.

### Fix B — `delivery_zones` boş ilçe + free-text fallback
**Ne:** Mahalle picker'da seçenek yoksa, free-text input göster. İlçe listesinde yoksa, manuel "Diğer" + free-text. Backend validation'ı gevşet; yeni adres `delivery_zones`'da olmasa bile kaydet, sadece `is_delivery_zone=false` işaretle ve admin panelde flag göster.

**Nasıl:** `RegisterAddressScreen` 196-228 satırlarına: `neighborhoodOptions.length === 0 && ilce` ise `GlassInput` ile manuel mahalle. `addresses.insert` payload'ına `is_outside_delivery_zone: neighborhoodOptions.length === 0` boolean ekle. Migration: `ALTER TABLE addresses ADD COLUMN is_outside_delivery_zone boolean DEFAULT false`. Admin panel'de bu müşterilere "teslimat dışı bölge" rozeti göster.

**Etki:** Sebep 2'yi kapatır. Coverage gap'inden kaynaklı abandoner'ları yakalar. Bonus: admin'in teslimat coverage'ı genişletmesi için sinyal verir.

**Risk:** Müşteri teslimat dışı bölgeden sipariş vermeye çalışırsa CheckoutScreen ayrı bir guard'ta engellemeli (`deliveryRuleStatus` zaten var [CheckoutScreen.tsx:350](../src/screens/CheckoutScreen.tsx#L350)). Yani fix'in tamamlanması için CheckoutScreen tarafında da "Bu adrese teslimat yok, lütfen değiştir" akışı doğrulanmalı.

### Fix C — VerifyOtp sonrası profile placeholder + persist-as-you-go
**Ne:** Her ekranda DB'ye partial save yap. VerifyOtp success'te `profiles UPSERT` (boş row), RegisterIdentity submit'te `first_name/last_name/phone UPDATE`, RegisterAddress submit'te `addresses INSERT`. Böylece kullanıcı her noktada bırakırsa yarım data zaten DB'de.

**Nasıl:**
- `VerifyOtpScreen` line 37: `await supabase.from('profiles').upsert({ id: user.id, onboarding_step: 'identity' })` ekle
- `RegisterIdentityScreen.handleNext` (line 29-40): in-memory `setIdentity` öncesi `await supabase.from('profiles').update({ first_name, last_name, phone, onboarding_step: 'address' }).eq('id', user.id)`
- `RegisterAddressScreen` mevcut akış kalır ama `onboarding_step='complete'` ile bitirir

Migration: `ALTER TABLE profiles ADD COLUMN onboarding_step text DEFAULT 'not_started'`.

**Etki:** Drop-off'u önlemez ama drop-off'u **görülebilir** kılar. Admin panel'de "%X kullanıcı `identity`'de takılmış" gibi funnel analytics çıkarılabilir. Fix A ile birleşince user `RegisterAddress`'e geri pinlendiğinde önceki girdileri (firstName/lastName) hazır gelir, motivasyon artar.

**Risk:** RLS — `profiles UPDATE` policy'si zaten user_id = auth.uid()'yi izin verir (genelde). Yeni kolon (`onboarding_step`) güvenli.

---

## Karar gereken konu

3 fix bağımsız ve aditiv. Önerim sıralı uygulama:
1. **Fix A** önce (1 dosya, mevcut bug'ı geri çevirir) → adres ekleyememiş 16 müşterinin bir kısmı yeni app açılışında düzelir
2. **Fix B** sonra (coverage gap'i + admin sinyal)
3. **Fix C** opsiyonel (analytics değeri ana motive)

Hangisini başlatalım?
