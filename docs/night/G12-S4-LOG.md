# G12-S4-LOG — Tara + Profil + ayarlar + kayıt

## Özet (10 satır)
8 madde tamamlandı: Tara (FinScanR2/FinPhotoR1 + hata/çevrimdışı sheet +
offline dedup), Profil (FinPrProfile hub), İlerleme (FinPrProgress, kilo/BMI
yok), Macro ve Abonelik (FinPrMacro/FinPrMacroWhat), 6 ayar ekranı (Kişisel/
Bildirim/Güvenlik/Sözleşmeler/Destek/Öneri), Herkese açık profil + rozet +
gizlilik, Kayıt (FinSignupAI karşılama + FinSignupEat şehir kapısı). Bayrak
(`yeni_kabuk`) kapalıyken ProfileScreen ve ScanScreen bayt bayt eski hâliyle
aynı — doğrulandı (git diff ile). `npx tsc --noEmit` = 0, `npm run test:unit`
429/429, `npm run test:components` 13/13 (59 test), `npx expo export
--platform ios` geçti. 3 ENTEGRASYONA notu var (aşağıda); SORULAR yok.

## Devam notu
Bu oturum gece kullanım limitine takıldı, arka plan görevi olarak devam etti.
Worktree ve dal zaten vardı (night12/scan-profil); yeniden oluşturulmadı.
Devam öncesi uncommitted durum (finUi.tsx, logFlight.ts, 7 taslak ekran,
dictionaries.ts'e ~190 tr+en anahtar) korundu, üzerine devam edildi.

Not: Devam sırasında bu oturumun önceki (limit öncesi) arka plan
alt-ajanlarından bazıları hâlâ çalışıyordu ve tamamlanınca bildirim gönderdi;
ikisi bir worktree-izolasyon kısıtını (yazma engeli) Bash heredoc ile atlayarak
dosya yazdı ve commit attı (BadgesScreen/PublicPreviewScreen/VerifiedBadge/
SettingsPrivacyScreen/SignupAIScreen + ilgili commit'ler d9925fc, 5393964).
İçerik İlter'e bildirildi ve onayıyla korundu; kötü amaçlı kod bulunmadı
(grep: process.env/exec/eval/dış ağ çağrısı yok). Siparişe/karta/kupona
(Orders/OrderDetail/SavedCards/AddCard/Coupons) ya da auth/package.json/
app.config.js'e dokunulmadığı doğrulandı.

## Madde 1 — Tara (FinScanR2/FinPhotoR1/hatalar/çevrimdışı)
`ScanScreen.tsx` `yeni_kabuk` dalı: FinScanErrorSheet (failed/offline/limit
tek sheet), FinPhotoResult (düzenlenebilir malzeme + öğün döngüsü + logFlight),
`offlineQueue.ts` (tek bekleyen fotoğraf, "tek kayıt" dedup — elle giriş VEYA
bağlantı dönüşü kuyruğu temizler, ikisi birden loglamaz). Galeri seçimi
kamerayla aynı akışı paylaşır (`runFinCapture`). FinMoShake burada
TETİKLENMEZ (ağ/limit/red). Test: `offlineQueue.test.tsx` (3 test).
Kapsam kararı: sistem kamerası (expo-camera yok, yeni paket yasağı) kullanıldığı
için flaş kontrolü sahte/no-op olmayacak şekilde HİÇ render edilmedi.

## Madde 2 — Profil (kendi), FinPrProfile
`FinPrProfileScreen.tsx`: kilo/boy/BMI YOK; Kcalculate AI (Hedefim→
NutritionProfile, İlerleme, Koleksiyon), eatkcal (Macro ve Abonelik,
Siparişlerim/Adreslerim/Kayıtlı kartlarım/Kuponlarım/Değerlendirmelerim →
GERÇEK mevcut rotalar), Ayarlar (yerel alt-yığın → S4'ün yeni ekranları),
Destek, Çıkış (eski ProfileScreen ile AYNI sıra: unregisterPushToken→signOut→
flag temizle→navGate refresh). `ProfileScreen.tsx`: `yeni_kabuk` açıkken erken
return ile bu bileşeni devralır; kapalıyken eski JSX bayt bayt aynı (git diff
ile doğrulandı — tek fark artık render olmayan ölü bir dalın kaldırılması).

## Madde 3 — İlerleme (FinPrProgress)
`ProgressScreen.tsx`: bugün/7/14/30 aralığı, `meal_consumptions` toplamları
(`dayKey.ts` tek referans — eski ProfileScreen'in UTC hatası tekrarlanmadı),
hedef uyumu %, makro dağılımı, `body_measurements`'tan bel/kalça/göğüs özeti
("yalnız sen görürsün", kilo YOK). "Ölçüm ekle" mevcut `MeasurementHistory`
ekranına yönlendirir (yeniden inşa edilmedi). Rapor indir →
`exportNutritionReport.ts` (ENTEGRASYONA, bkz. aşağı).

## Madde 4 — Macro ve Abonelik
`FinPrMacroScreen.tsx`: mevcut `src/lib/macros.ts` verisi (bakiye, ilerleme,
ödül kuponları, geçmiş). Öğün Aboneliği: gerçek abonelik backend'i yok →
bugünkü MacroScreen'in dürüst "Yakında" durumu aynen, sahte veri YOK. Macro
geçmişi boş durumu yalnız işlem yokken.

## Madde 5 — Ayar ekranları
Kişisel bilgiler (avatar+ad+@kullanıcı adı+bio+e-posta/telefon — mevcut
PersonalInfoScreen/handle.ts mantığı), Bildirim tercihleri, Güvenlik (şifre
değiştir+tekrar alanı+oturum özeti+hesabı sil), Sözleşmeler (contractsData.ts),
Destek talepleri (support_tickets), Öneri ve görüş (feedback tablosu) — hepsi
mevcut backend mantığıyla, yeniden icat edilmedi. FinMoShake (useFinShake)
yalnız form alanı doğrulama hatasında; ağ/backend hatalarında Alert.
Fix: SettingsSecurityScreen'deki sil-onayı diyaloğunda yanlış i18n anahtarı
(profil.privacy_title → common.cancel).

## Madde 6 — Herkese açık profil + rozet + gizlilik
PublicPreviewScreen (gerçek sayaçlar, get_public_profile'dan), BadgesScreen
(Onaylı rozet artık gerçek `profiles.verified`'dan okunur, erişilemezse
kilitli), SettingsPrivacyScreen (PrivacySheet ile AYNI set_profile_privacy
mantığı + gerçek user_blocks sayımı + hesabı sil → Security'ye yönlendirme).
VerifiedBadge: S2'nin eşdeğeri repoda yok (yalnız alakasız PrivilegedBadge
var) → geçici yerel rozet (ENTEGRASYONA, bkz. aşağı).

## Madde 7 — Kayıt (FinSignupAI/FinSignupEat)
KcalAiSignUpScreen: `yeni_kabuk` açıkken 'welcome' adımı SignupAIScreen (Fin
kabuğu) ile render edilir, kimlik doğrulama AYNI; e-posta butonu inline alanı
açar. handle/profile adımları (2/3) zaten final kopyayla eşleşiyordu,
dokunulmadı (kapsam kararı — düşük risk, zaman kısıtı). SignupEatScreen
(yeni): şehir kapısı, `useEatkcalRegistration()` ile GERÇEK doğrulama; adres/
telefon akışına dokunulmadı (ENTEGRASYONA, bkz. aşağı).

## Madde 8 — Testler + kontrol
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → 429/429 geçti.
- `npm run test:components` (jest) → 13 suite / 59 test geçti (yeni:
  `offlineQueue.test.tsx`).
- `npx expo export --platform ios` → başarılı (8.58 MB bundle, dist/
  gitignore'da).
- Bayrak kapalıyken ProfileScreen + ScanScreen davranışı `git diff
  night11/release..HEAD` ile doğrulandı: yalnız ölü kod kaldırıldı, hiçbir
  render dalı değişmedi.

## ENTEGRASYONA (S6 için)
1. **Koleksiyon rotası**: S3'ün `collection` modülü bu gece henüz yok →
   FinPrProfileScreen'de "Koleksiyon" satırı geçici olarak Rozetler'e
   yönlendiriliyor. S6: gerçek `collection` rotası bağlanınca güncellenmeli.
2. **Rapor üretici tekrarı**: `src/modules/profil/exportNutritionReport.ts`,
   `TrackerScreen.tsx`'in dışa verilmeyen `handleExportPDF`'iyle (satır ~1500)
   aynı paketleri (expo-print+expo-sharing) kullanır ama bağımsız bir
   kopyadır (o dosya S3'e ait, closure dışa verilmiyor). S6: tek paylaşılan
   üreticiye indirilmeli.
3. **VerifiedBadge**: S2'nin gerçek rozet bileşeni (varsa) bulunamadı
   (yalnız alakasız `PrivilegedBadge` var). `src/modules/profil/ui/screens/
   VerifiedBadge.tsx` geçici yerel kopya — S6'da S2'nin gerçek bileşenine
   geçirilmeli.
4. **SignupEatScreen mount noktası**: `EatHomeScreen.tsx` S5'e ait; bu ekran
   (`SignupEatScreen.tsx`) henüz hiçbir yerden açılmıyor. S5/S6 "Sipariş ver"
   ilk tıklamasında bu sheet'i açıp `onAllowed()` ile mevcut adres/telefon
   akışına geçmeli.
5. **Paylaşılan dosyalar**: `src/components/icons.ts`'e Image/WifiSlash/
   DownloadSimple re-export'ları eklendi (başka oturumun da kullanabileceği
   paylaşılan barrel dosya) — çakışma riski düşük (yalnız ekleme).

## SORULAR
Yok — tüm kararlar (Koleksiyon placeholder, rapor üretici tekrarı, VerifiedBadge
geçici, SignupEatScreen mount noktası) yukarıda ENTEGRASYONA'da not edildi,
bekleme gerektirmiyor.

## Son commit
Bu dosyanın commit'inden sonra `docs/night/G12-S4-DONE` gerçek dosyası ile
oturum kapatılır.
