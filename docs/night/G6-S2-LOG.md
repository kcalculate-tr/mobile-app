# G6-S2 — Keşfet arayüzü (Dalga 1) · LOG

## Özet (10 satır)
1. Dal `night6/kesfet-ui` (taban `night5/feed-client`), worktree `.claude/worktrees/g6-s2`.
2. Keşfet ekranı + tüm bileşenler `src/modules/kesfet/ui/` altında; veri katmanı night5'ten değişmeden kullanıldı.
3. PostCard (avatar/rozet/@handle·süre/metin/1–4 görsel/MealCard) + aksiyon satırı YALNIZ Beğen·Kaydet·Paylaş.
4. AddToDaySheet (öğün + porsiyon + canlı makro + Ekle), AddToast ("…ye eklendi · Günüme paylaş"), PostMenu (kopyala/şikayet/engelle+onay).
5. GunRingStripPlaceholder (props `rings`,`onOpen` — G6-S3 arayüzü), FollowingEmpty (önerilen hesaplar gerçek veriden), iskelet/hata/boş durumlar.
6. Navigasyon: `useFeature('kesfet')` açıkken (veya `__DEV__`) stack ekranı kaydolur; **bayrak kapalı + üretimde HİÇ kaydolmaz**, CustomTabBar'a dokunulmadı.
7. TR/EN metinler (`kesfet.ui.*`), açık/koyu tema (design token), dinamik yazı (AppText scaleCap), erişilebilirlik etiketleri.
8. Testler: `format.test.ts` (kart view-model + yardımcılar) ve `moderation.test.ts` (engelle+şikayet); iyimser beğen geri alma store.test'te mevcut.
9. Kontrol: `npx tsc --noEmit` = 0 · `npm run test:unit` = 346/346 · `npx expo export --platform ios` = başarılı (iOS bundle yazıldı).
10. Composer (madde 8) ERTELENDİ (gerekçe aşağıda); "Bağlantıyı kopyala" expo-clipboard yokken sistem paylaşımına düşüyor (SORULAR).

## Yapılanlar (madde madde)
1. **KesfetScreen** (`ui/KesfetScreen.tsx`): başlık "Keşfet" + Ara/Bildirim ikonları; sekmeler Sana Özel / Takip (`kesfet_takip` kapalıysa Takip gizli, sekme oradaysa for_you'ya düşer); üstte Gün halkası şeridi; FlatList akış, pull-to-refresh, sayfa sonu yükleme. Şerit verisi `modules/gun` `getDayRings()`'ten çekilir.
2. **PostCard** (`ui/PostCard.tsx` + `MealCard.tsx` + `MediaGrid.tsx` + `Avatar.tsx`): avatar (kurumsal "kcal" baloncuğu / görsel / baş harf), ad + doğrulama mührü (`verified`) + rol rozeti (Resmi/Diyetisyen/Üretici), `@handle · süre`, metin (serbest sarar), 1–4 görsel (expo-image), MealCard. Aksiyon satırı yalnız Beğen·Kaydet·Paylaş; yanıt/sponsorlu/besin notu/alıntı YOK.
3. **AddToDaySheet** (`ui/AddToDaySheet.tsx`): öğün Kahvaltı/Öğle/Akşam/Ara öğün → `breakfast|lunch|dinner|snack` (MealType; aşağıda SORULAR), porsiyon 0,5/1/1,5/2, kcal ve P/K/Y porsiyona göre canlı; "Ekle" → `store.addToDay` (idempotent). Ardından **AddToast**: "<Öğün>'ye eklendi · Günüme paylaş" → `gun.shareMealToDay(consumption_id)` çağıran callback (bu akış mevcut olduğundan "Geri al" yerine "Günüme paylaş" gösterilir).
4. **PostMenu** (`ui/PostMenu.tsx`): Bağlantıyı kopyala (`https://l.eatkcal.com/p/<id>`), Şikayet et (neden listesi → `store.report`→`report_content`), Engelle (onay adımı "<Ad> engellensin mi?" → `store.blockAuthor`→`block_user`; akıştan anında düşer).
5. **Boş/yükleme/hata** (`ui/states.tsx`): FollowingEmpty (başlık + açıklama + 3 önerilen hesap — for_you akışındaki `can_post` rozetli yazarlardan türetilir, uydurma yok), FeedSkeleton iskelet kartlar, FeedError + "Tekrar dene", FeedEmpty, sayfa sonu "Hepsi bu kadar".
6. **Paylaş**: RN `Share` sistem paylaşım sayfası, `/p/<id>` bağlantısı.
7. **Navigasyon** (`AppNavigator.tsx`, `navigation/types.ts`): `Kesfet` stack ekranı `(kesfetEnabled || __DEV__)` ile koşullu. Bayrak kapalı + üretimde ekran kaydolmaz, lazy chunk hiç yüklenmez → uygulama bugünküyle **bire bir aynı**. `__DEV__`'de FeedDataLab'a "Keşfet arayüzü →" düğmesi eklendi (mock/real + TR/EN ile önizleme).
9. TR/EN (`core/i18n/dictionaries.ts` → `kesfet.ui.*`, `gun.my_day`), açık/koyu tema `useTheme` token'ları, dinamik yazı boyutu AppText `maxFontSizeMultiplier` ile, tüm dokunulabilir öğelerde `accessibilityRole`/`accessibilityLabel`, lime yalnız dolgu (üstü koyu).
10. **Testler**: `ui/__tests__/format.test.ts` (kart render = postCardModel + relativeTime/scaleMacros/roleBadgeKey/mediaItems/postLink), `__tests__/moderation.test.ts` (blockAuthor akıştan düşme + hatada geri alma, report). İyimser beğen geri alma `__tests__/store.test.ts`'te zaten var.

## Commit'ler (night6/kesfet-ui)
- `be09ca0` feat(kesfet): i18n UI metinleri + store engelle/şikayet aksiyonları
- `0a40d08` feat(kesfet): Keşfet arayüzü bileşenleri ve ekranı (Dalga 1)
- `c7a4ba0` feat(kesfet): navigasyon — bayrak kapılı Keşfet ekranı + dev önizleme
- `bc53697` test(kesfet): kart view-model + engelle/şikayet store testleri
- (bu dosya) docs(gece-s2): G6-S2-LOG

## Kontrol sonuçları
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → tests 346, pass 346, fail 0 (yeni format + moderation testleri dahil).
- `npx expo export --platform ios` → başarılı; iOS bundle (`index-*.hbc`, 8.04 MB) + metadata yazıldı. Çıktı iş klasörüne alındı, repo'ya girmedi.

## Bayrak kapalıyken değişmezlik (doğrulama)
Çalışma zamanında dokunulan tek canlı yol `AppNavigator`'daki `useFeature('kesfet')` çağrısıdır; bayrak kapalıyken `false` döner, koşullu `Stack.Screen` render edilmez ve lazy import tetiklenmez. i18n yalnız yeni anahtar ekledi (mevcutlar değişmedi; i18n top-level namespace testi geçiyor). store yalnız yeni metot ekledi (mevcut metotlar aynı). CustomTabBar/TabNavigator'a dokunulmadı. Yani bayrak kapalı + üretimde uygulama bugünküyle aynı.

## SORULAR / Kararlar
- **MealType adları**: Görev dosyası Türkçe kod (`kahvalti|ogle|aksam|atistirma`) diyor; G5-S3 istemcisi (`kesfet/types.ts`) `breakfast|lunch|dinner|snack` kullanıyor. G6-CONTRACT "sunucu istemci adlarına uyar" dediği için İngilizce kanonik adlar esas alındı; görünen etiketler i18n'den TR/EN (Kahvaltı/Öğle/…). Sunucu farklı kod bekliyorsa G6-S1 teyit etsin.
- **"Bağlantıyı kopyala"**: `expo-clipboard` kurulu değil ve yeni paket kurmak bu gece yasak. Şimdilik "Bağlantıyı kopyala" sistem paylaşım sayfasını açıyor (bağlantı orada kopyalanabiliyor). Gerçek panoya kopyalama için `expo-clipboard` eklenmesi gerekir (onay + kurulum).
- **Canlı "Keşfet sekmesi"**: Mevcut canlı tab bar eatkcal kabuğu (Home/Tracker/Cart/Macro/Profile) ve `CustomTabBar` 4 sabit slotluk animasyon dizisiyle çalışıyor; 5. sekme eklemek hem onu bozar hem de TabBarR3 tasarımıyla (Home/Keşfet/eatkcal/Profil + Tara — ayrı Kcalculate-AI kabuğu) çelişir; yani "mevcut tab bar'ı değiştirmek" olurdu (yasak). Bu yüzden Keşfet bayrak kapılı stack ekranı olarak teslim edildi; TabBarR3 kabuğuna yerleştirme G6-S3/sonraki oturuma bırakıldı.
- **Önerilen hesaplar**: `creators.can_post` için ayrı bir RPC yok; öneriler for_you akışındaki rozetli (kurum/dietitian/üretici) yazarlardan türetildi (gerçek veri). Takip et aksiyonu `profil` modülünün `follow`'unu çağırıyor. Özel bir "önerilenler" RPC'si istenirse G6-S1/S3.

## Ertelendi
- **Composer (madde 8, T20Compose)**: Fotoğraf seçimi bir resim seçici (ör. `expo-image-picker`) gerektiriyor; paket durumu teyit edilmeden ve yeni paket kurma yasağı altında güvenli şekilde tamamlanamıyor. Madde dosyasındaki izin uyarınca (editoryal gönderiler panelden/tohumdan da girilebilir) ERTELENDİ. Kalan her şey (1–7, 9, 10) tamam ve doğrulandı.
