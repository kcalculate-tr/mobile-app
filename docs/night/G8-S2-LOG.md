# G8-S2 — Mobil: herkes için paylaşım, yorum, etkinlik, bildirim · LOG

## Özet (10 satır)
1. Dal `night8/social-ui` (taban `night7/release`), worktree `.claude/worktrees/g8-s2`. 3 commit.
2. 5 yeni bayrak eklendi, hepsi `false`: `kesfet_paylasim`, `kesfet_video`, `kesfet_yorum`, `etkinlik`, `sosyal_bildirim`.
3. Veri katmanı: `KesfetClient`'a G8 metotları (create_post, delete_my_post, moderate-content, add_comment, list_comments, delete_my_comment, did_it, log_activity, get_my_day_activity, list/mark_social_notifications) + tip/mock/normalizasyon.
4. Composer (madde 1): serbest/öğün/etkinlik, metin, foto ≤4 (expo-image-picker), öğün kartı (elle), etkinlik kartı canlı kcal; create_post → moderate-content → "Paylaşılıyor…/İnceleniyor"; hata: hız sınırı/ağ/reddedildi.
5. PostCard (madde 2): etkinlik kartı (ikon/tür/süre/mesafe/~kcal + "Ben de yaptım"); yorum aksiyonu+sayaç (`kesfet_yorum`); pending etiketi. Yorumlar alt sayfası (madde 3) + "Ben de yaptım"→did_it toast (madde 4).
6. Tracker (madde 5): `etkinlik` bayrağı arkasında "Etkinlik ekle"→log_activity + günün etkinlik toplamı (get_my_day_activity). **Bayrak kapalıyken Tracker birebir aynı** (tek canlı ekran dokunuşu, tam gated).
7. Bildirimler (madde 6): Keşfet zili + okunmamış rozeti + liste (`sosyal_bildirim`); dokun→gönderi/profil; ilk sosyal etkileşim sonrası tek sefer push izni ön sayfası. Kendi gönderin ⋯→Sil + pending (madde 7).
8. TR/EN tüm yeni metinler (`src/core/i18n/dictionaries.ts`), açık/koyu tema token'ları, a11y etiketleri (madde 8).
9. Testler: composer doğrulama, etkinlik kcal, yorum iyimser ekle/geri al, okunmamış sayısı, didIt/deletePost (+11). Toplam **392/392**.
10. Kontrol: **tsc 0**, **test:unit 392/392**, **expo export ios başarılı** (iOS bundle 8.29 MB). Bütün yeni davranış kapalı bayraklar arkasında — bayraklar false iken uygulama 1.0.7 ile aynı.

## Yapılanlar (madde madde)

### Veri katmanı (commit `042f04a`)
- `src/core/flags/registry.ts`: 5 G8 bayrağı `false` (flag testleri jenerik, kırılmadı).
- `src/modules/kesfet/types.ts`: `PostType`/`PostStatus`/`MediaKind`/`ActivityType`(12)/`ActivityCard`, FeedPost'a `post_type`/`status`/`activity_card`, FeedStats'a `comments`/`did_it`, FeedMedia'ya `kind`/`duration_s`/`thumb_path`, FeedMe'ye `is_author`; Comment/SocialNotification/CreatePostInput + `KesfetClient` G8 imzaları (G8-CONTRACT ile birebir).
- `client.ts`: tüm G8 RPC'leri + `moderate-content` edge fonksiyonu (`functions.invoke`, ai/scan/client.ts kalıbı) + `normalizePost` (get_feed eski şekli → G8 alanları güvenli varsayılan).
- `mock.ts`: deterministik yorum/bildirim/etkinlik (Date.now/Math.random yok); `withActivityPost` vitrin.
- `store.ts`: `didIt` (iyimser sayaç) + `deletePost` (iyimser düşür). `commentsStore.ts` (iyimser ekle/geri al, sayfalama, sil, şikayet, engelle). `notificationsStore.ts` (liste, okunmamış, markAllRead).
- `activity.ts`: saf `estimateActivityKcal` — sunucu `activity_kcal` aynası (MET × kilo × saat; MET tablosu sabit; varsayılan 70 kg). `composer.ts`: saf `validateComposer`/`activityDraftCard`/`buildCreateInput`.

### UI (commit `6b5a6a5`)
- `ui/ComposerScreen.tsx` (`Composer` rotası, `kesfet_paylasim||__DEV__`). `ui/media.ts` (foto seç+`user-media` yükle; index'ten dışa açılmaz → testler import etmez).
- `ui/ActivityCard.tsx`, `ui/CommentsSheet.tsx`, `ui/NotificationsSheet.tsx`, `ui/SocialPushPrompt.tsx`, `ui/TrackerActivityEntry.tsx`.
- `ui/PostCard.tsx`: etkinlik kartı + yorum aksiyonu (opsiyonel prop'lar → SharedPost kırılmadı) + pending etiketi. `ui/PostMenu.tsx`: `isMine` → Sil onayı.
- `ui/icons.tsx`: chat/trash/check/image/camera/x/clock/run (Phosphor path). `ui/format.ts`: PostCardModel G8 alanları.
- `KesfetScreen.tsx`: zil rozeti + composer düğmesi + yorum/bildirim/push sayfaları, hepsi kendi bayrağı arkasında. `AppNavigator` + `navigation/types.ts`: `Composer` rotası. `TrackerScreen.tsx`: tek noktada `{etkinlik ? <TrackerActivityEntry/> : null}`.
- i18n `dictionaries.ts`: `kesfet.compose/activity/comments/notif/push` + `ui.menu.delete`/`delete_confirm_*`/`post_deleted`/`a11y.comment` + `common.delete/you` (TR+EN). Yalnız ekleme; mevcut anahtar değişmedi (parite testi üst düzey, korunur).

### Testler (commit `1d96fc5`)
- `src/modules/kesfet/__tests__/g8.test.ts`: 11 test. `estimateActivityKcal` (686/123/override/0), `validateComposer` (serbest/öğün/etkinlik/foto üst sınır/uzunluk), `activityDraftCard`, `commentsStore.add` iyimser + hata geri alma, `notificationsStore` okunmamış + markAllRead, `didIt` iyimser, `deletePost` iyimser.

## Kontrol sonuçları
- `npx tsc --noEmit` → **0 hata**.
- `npm run test:unit` → **tests 392, pass 392, fail 0** (+11 G8).
- `npx expo export --platform ios` → **başarılı**, iOS bundle `index-*.hbc` 8.29 MB (çıktı iş klasörüne, repoya girmedi).

### Bayrak kapalı güvenliği (kodla doğrulandı)
| Alan | Durum (bayrak kapalı) | Kanıt |
|------|------------------------|-------|
| Tracker | "Etkinlik ekle" + toplam satırı render OLMAZ | `TrackerScreen.tsx:2004` `{etkinlik ? … : null}`; diff yalnız import + flag var + gated blok |
| Keşfet başlığı | Composer düğmesi (`kesfet_paylasim`), zil (`sosyal_bildirim`) yalnız bayrak açıkken | `KesfetScreen` Header `showCompose`/`showBell` prop'ları |
| PostCard | Yorum aksiyonu yalnız `showComment` (kesfet_yorum); etkinlik kartı yalnız `post_type==='etkinlik'` | `PostCard.tsx` koşullu render |
| Composer rotası | `kesfet_paylasim\|\|__DEV__` dışında kaydolmaz | `AppNavigator.tsx:310` |
| Yorum/Bildirim/Push sayfaları | KesfetScreen'de `kesfetYorum`/`sosyalBildirim` koşulu | `KesfetScreen` render bloğu |
| Keşfet ekranı | Zaten yalnız `kesfet\|\|__DEV__` ile erişilir (canlıda kapalı) | değişmedi |
| i18n | Additive; mevcut ekran `useT` kullanmaz | yalnız yeni/flag'li ekranlar |

## SORULAR / Kararlar (hiçbiri teslimi bloklamıyor)
1. **MET tablosu (S1 ile uzlaş)**: `activity.ts` istemci canlı önizleme için sabit MET tablosu kullanır (koşu 9.8, yürüyüş 3.5, bisiklet 7.5, yüzme 7.0, fitness 5.0, yoga 2.5, pilates 3.0, futbol 7.0, basketbol 6.5, tenis 7.0, dans 5.0, diğer 4.0). Sunucu `activity_kcal` (G8-S1) **aynı değerleri** kullanmalı; kayıt anındaki yetkili kcal zaten sunucudan (did_it/log_activity → kcal_est) döner. Değerler farklıysa S1 tablosu kaynaktır — `MET_TABLE`'ı ona eşitle.
2. **Composer öğün kartı — "ürün ara"**: Bu tabanda ürün arama RPC'si yok; composer öğün kartı **elle giriş** (ad + kcal + P/K/Y) olarak teslim edildi. "Ürün ara" ve "AI tarama sonucundan doldur" ek yüzeyler (bir arama RPC'si veya ScanEstimate köprüsü) sonraki tura kaldı; `buildCreateInput` `product_id`'yi geçirir (sunucu çözerse hazır).
3. **Medya yükleme kovası**: `user-media` varsayıldı (ai/scan `image_path` ile tutarlı); yol `${userId}/posts/...`. create_post `p_media` jsonb `{path,width,height,kind}` listesi alır (G8-CONTRACT `post_media` alanlarıyla uyumlu). RLS/kova adı S1'de farklıysa düzeltilir.
4. **`get_feed` G8 alanları**: istemci `normalizePost` ile eksik alanları güvenli varsayılana çeker; S1 `get_feed`/`get_post` `post_type`/`activity_card`/`status`/`stats.comments`/`stats.did_it`/`me.is_author` döndürmeli (sözleşmede var).
5. **Video**: `kesfet_video` bayrağı + şema alanları (FeedMedia.kind/duration_s/thumb_path) hazır; istemci yükleme UI'si G8-S3 (yerel paket onayı). Composer'da video düğmesi YOK (sözleşme).
6. **Push ön sayfası**: `requestPushPermissionOnly` (token almaz, DB'ye dokunmaz) ilk sosyal etkileşimden sonra tek sefer; `@kcal_social_push_prompt_shown` bayrağıyla kilitli.

İlgili: [G8-CONTRACT.md](../../.claude/night/G8-CONTRACT.md), [G7-S1-LOG.md](./G7-S1-LOG.md).
