# G6-S3 — Gün halkası, profil, Kcal AI kaydı (UI)

## Özet (10 satır)
1. G6-S3.md'deki 8 madde `night6/gun-profil-ui` dalında işlendi (worktree `.claude/worktrees/g6-s3`, taban `night5/feed-client`).
2. Yeni: `src/modules/gun/ui` (GunRingStrip, GunViewer, GunEmpty), `src/modules/profil/ui` (PrivacySheet, PublicProfileScreen, TakibeBaslaCTA, Kcal AI kaydı 3 adım).
3. `check_handle` eklendi (salt okur, rezervasyon yapmaz); `useHandleClaim` artık canlı kontrolde onu kullanıyor, `claim_handle` yalnız submit anında çağrılıyor.
4. `GunRingStrip` props'u (`rings`, `onOpen(userId)`) G6-S2'nin `GunRingStripPlaceholder` arayüzüyle BİREBİR aynı — doğrudan yerine geçebilir.
5. Hiçbir canlı/üretim ekranı değişmedi: `UnifiedLoginScreen`'e dokunulmadı (Kcal AI kaydı kendi ekranında, aynı `useAuth` çağrılarını kullanıyor); yeni rotalar (`PublicProfile`, `KcalAiSignUp`) kayıtlı ama hiçbir mevcut ekrandan çağrılmıyor.
6. `__DEV__` vitrini: `GunProfilUiLabScreen` (mock veriyle gerçek bileşen render'ı) + DevDiagnostics'e iki yeni bağlantı.
7. Kontroller: **tsc 0**, **344/344 birim test geçti** (29 yeni), **`expo export --platform ios` başarılı**, eslint yeni dosyalarda 0 hata/uyarı.
8. 2 SORU G6-S1'e aşağıda: `DayCard`'da P/K/Y eksik, başkasının gün kartını kendi günlüğüne ekleme RPC'si sözleşmede yok.
9. Rota notu: `/u/:handle` derin bağlantısı `night5/share-links`'te, bu dalda yok; `PublicProfile` rotası kayıtlı, deep-link eşlemesi G6-S1 birleştirmesinde kurulmalı.
10. Dal push edilmedi (RULES: PR yok).

## Yapılanlar (madde madde)

### Madde 1 — `GunRingStrip` · commit `9197721`
`src/modules/gun/ui/GunRingStrip.tsx`: yatay `ScrollView`, ilk öğe (`rings[0]`, sözleşme gereği her zaman "ben") "Günüm" etiketi + lime "+" rozeti; diğerleri avatar + isim. Halka = `core/design`'daki `ProgressRing` (`color={accentLine}` → `#4A6B00`). `has_new` için küçük nokta rozeti. Props **değiştirilmedi**: `rings: DayRing[]`, `onOpen: (userId: string) => void` — G6-S2'nin kullanacağı placeholder ile aynı.

### Madde 2 — `GunViewer` · commit `9197721`
`src/modules/gun/ui/GunViewer.tsx` (+ `viewerQueue.ts` SAF mantık, 3 test): seçilen halkadan başlayıp şeritteki sonraki kullanıcılara ilerler (geri sarma yok, IG hikâyeleri gibi son kullanıcıda biter — `buildViewerQueue`). Üstte ilerleme çubukları, avatar+ad+öğün·sıra, foto (`photo_url` varsa `CachedImage`, yoksa tema zemini), alt kartta öğün adı+saat, kcal/P/K/Y HER ZAMAN görünür ("—" ile K/Y eksikse, bkz. SORU 1), "Günüme ekle" (her zaman görünür, `onAddToDay` verilmezse devre dışı görünür ama buton kalır — bkz. SORU 2). Dokun: sol yarı geri, sağ yarı ileri. Aşağı kaydır: `PanResponder` ile kapat (`react-native-gesture-handler` paketi KULLANILMADI, yeni paket yok). Son kart günün özeti: %N dolu halka ya da (%100) "Gün tamamlandı", öğün küçük görselleri, "Bugün paylaşılan N öğün · seri N gün".

### Madde 3 — `GunEmpty` · commit `9197721`, `bca8123`
`src/modules/gun/ui/GunEmpty.tsx`: "Günün henüz boş" + lime "İlk öğününü paylaş" (dışarıdan `onLogMeal` ile — bu bileşen navigasyon bilmiyor) + outline "Bugünkü kayıtlarımdan seç" → `BottomSheet` picker → `getTodayConsumptions()` (bugünkü `meal_consumptions`, `src/modules/gun/todayConsumptions.ts`, TrackerScreen'in sorguladığı aynı tablo/RLS) → seçince `shareMealToDay(consumptionId)`. Dışa basit sarmalayıcı `shareMealToDay(consumptionId: string): Promise<void>` `src/modules/gun/index.ts`'ten export edildi (G6-S2'nin `AddToDaySheet` toast'u bunu çağırabilir).

### Madde 4 — Privacy sheet · commit `4409f4e`
`src/modules/profil/ui/PrivacySheet.tsx` (mevcut `components/BottomSheet.tsx` üzerine): yalnız "Herkese açık" / "Gizli hesap", başka seçenek yok. Onayda `getProfilClient().setPrivacy({ isPrivate })` → `set_profile_privacy`. Gizliden açığa geçişte bekleyen istekler SUNUCUDA otomatik onaylanır (G6-CONTRACT.md); istemci ek bir şey yapmıyor.

### Madde 5 — `PublicProfileScreen` (`/u/:handle`) · commit `4409f4e`
`src/modules/profil/ui/PublicProfileScreen.tsx`: avatar, ad, @handle, bio, sayaçlar (gönderi/takipçi/takip), Takip et/İstek gönderildi/Takiptesin (`follow({user, on})`'dan dönen `state`). Gizli + takip etmiyorsam içerik yerine "Bu hesap gizli" (`canViewProfileContent` SAF yardımcı, `src/modules/profil/visibility.ts`, 4 test). Kendi profilimse: Takip butonu yerine gizlilik butonu (PrivacySheet açar) + `TakibeBaslaCTA`. **Rota notu**: G5-S4'ün yer tutucu `SharedProfileScreen`'i `night5/share-links` dalında, bu dal (`night5/feed-client` tabanlı) onu içermiyor — görev metninin izniyle `src/modules/profil/ui/PublicProfileScreen` olarak yazıldı. `RootStackParamList.PublicProfile: { handle }` eklendi ve `AppNavigator`'da (koşulsuz, davranış değişmiyor çünkü hiçbir ekran ona navigate etmiyor) kayıtlı — ama deep-link (`/u/:handle` → route) eşlemesi `share-links` dalında; **G6-S1 birleştirmesinde kurulmalı**.

### Madde 6 — Kcal AI kaydı, 3 ekran · commit `4409f4e`
`src/modules/profil/ui/signup/KcalAiSignUpScreen.tsx` (+ `KcalAiSignUpRoute.tsx` navigasyon kabuğu): `useFeature('kesfet')` arkasında, kapalıyken `null` döner.
1. Karşılama + Apple/Google/E-posta — **UnifiedLoginScreen DEĞİŞMEDİ**; aynı `useAuth()` çağrıları (`signInWithApple`, `signInWithGoogle`, `signInWithOtp`, `verifyEmailOtp`) doğrudan kullanıldı. `resolvePostSocialAuth` (eatkcal'ın telefon-kapısı mantığı) KULLANILMADI — bunun yerine `profiles.handle` dolu mu diye bakılıyor (`hasProfileHandle`); doluysa (zaten kayıtlı) adım 2/3 atlanıp `onDone()` çağrılıyor.
2. Ad Soyad + @kullanıcı adı — mevcut `useKcalculateAiRegistration` hook'u (G5-S3) birebir kullanıldı: `check_handle` ile anlık "müsait", `submit()` içinde `claim_handle` + `update_public_profile`. Kalori/kilo sorusu YOK.
3. Foto (isteğe bağlı, `avatarUpload.ts` — `ProfileScreen.tsx`'teki `pickAvatar` ile AYNI mekanik: galeri izni → seç → base64 → `avatars` kovası → `update_public_profile`'a URL) + bio ("Atla" ile geçilebilir) → `onDone()`.
`icons.ts`'e `AppleLogo`/`GoogleLogo` eklendi (phosphor, ek paket değil).

### Madde 7 — Takibe başla · commit `4409f4e`
`src/modules/profil/ui/TakibeBaslaCTA.tsx`: hesaplama YENİDEN YAZILMADI — mevcut `NutritionProfileScreen`'e (`{ firstTime: true }`) yönlendiriyor; o ekran zaten "Şimdi değil" ile atlanabilir ve `lib/nutrition.ts`'teki hesaplamayı kullanıyor. Profil ekranımda (kendi profilimde) gösteriliyor; Günüm'den erişim `GunEmpty`'nin `onLogMeal` callback'i üzerinden çağırana bırakıldı (bu bileşen navigasyon bilmiyor, G6-S1/entegrasyon sekme bağlarken karar verir).

### Madde 8 — TR/EN, testler, kontrol · commit `69c4540`, hepsi
`src/core/i18n/dictionaries.ts`'e `gun.*`/`profil.*` altına ~35 yeni anahtar (TR+EN). Testler: `viewerQueue.test.ts` (3, halka sırası/ilerleme), `profil.test.ts`'e `checkHandle` (3, müsait/alınmış/biçimsiz — rezerve ETMEDİĞİNin kanıtı dahil), `visibility.test.ts` (4, gizli profil görünümü). Toplam **344/344** (29 yeni).

## SORULAR (G6-S1'e)
1. `get_day_cards` yanıtında `carbs_g`/`fat_g` YOK (G5-CONTRACT.md: yalnız `kcal`, `protein_g`). T20GunView tasarımı P/K/Y'yi HER ZAMAN gösteriyor. `DayCard` tipine (`src/modules/gun/types.ts`) isteğe bağlı `carbs_g?`/`fat_g?` eklendi; sunucu eklemeden gerçek veride UI "—" gösterir. **Öneri**: `get_day_cards`'a bu iki alan eklensin.
2. GunViewer'da başkasının paylaştığı kartı "Günüme ekle" ile kendi günlüğüme (meal_consumptions) kaydetmek için sözleşmede RPC yok (yalnız Keşfet gönderileri için `add_post_meal_to_day` var). Aday imza `src/modules/gun/types.ts`'te not edildi: `add_day_card_to_day(p_card uuid, p_idempotency_key text) → {consumption_id}`. Sunucu eklemeden gerçek istemci (`client.ts`) bu RPC adını bulamayıp hata fırlatır; mock (`mock.ts`) çalışır durumda.

## Rota notu (ayrıntı)
- `PublicProfile` ve `KcalAiSignUp` rotaları `AppNavigator`'a koşulsuz eklendi (davranış DEĞİŞMEDİ — hiçbir mevcut ekran onlara navigate etmiyor).
- Kcal AI kaydının son adımı (`KcalAiSignUpRoute.tsx`, `onDone`) şu an `Tabs`→`Home`'a dönüyor; Keşfet sekmesi `night6/kesfet-ui`'de, bu dalda yok. **G6-S1 entegrasyonunda `onDone` hedefi Keşfet'e çevrilmeli.**
- `/u/:handle` deep-link eşlemesi (`l.eatkcal.com/u/...` → `PublicProfile` route) `night5/share-links`'teki linking config'de; bu dal onu içermiyor. **G6-S1 birleştirmesinde kurulmalı.**

## Kontrol
- `npx tsc --noEmit`: 0 hata
- `npm run test:unit`: 344/344 geçti
- `npx expo export --platform ios`: başarılı (`dist/`)
- `npx eslint` (bu oturumun yeni/değişen dosyaları): 0 hata, 0 uyarı
- Bayrak kapalıyken (`kesfet`/`gun_halkasi` varsayılan `false`) davranış değişmedi: yeni bileşenler yalnız yeni rotalarda/`__DEV__` vitrininde; `KcalAiSignUpScreen` ayrıca `useFeature('kesfet')` kapalıyken `null` döner.

## Commit'ler
- `d31f51a` feat(profil): check_handle + useHandleClaim
- `bca8123` feat(gun): addDayCardToDay + bugünkü kayıtlar + shareMealToDay sarmalayıcı
- `9197721` feat(gun): GunRingStrip, GunViewer, GunEmpty
- `4409f4e` feat(profil): PrivacySheet, PublicProfileScreen, TakibeBaslaCTA, Kcal AI kaydı
- `69c4540` feat(i18n): gun/profil yeni ekran metinleri TR/EN
- `e050c34` feat(nav): PublicProfile/KcalAiSignUp rotaları + __DEV__ vitrini
