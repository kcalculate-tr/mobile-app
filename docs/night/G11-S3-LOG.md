# G11-S3 — Keşfet: tasarım eşleşmesi, hareket, ürün ara, düzenleme, durumlar

## Özet (10 satır)
1. Dal `night11/kesfet` (taban `night10/release`), worktree `.claude/worktrees/g11-s3`. Yalnız sözleşmedeki S3 dosyaları.
2. Tasarım kaynağı: `t22` yok → `t20`. Eşleşme tablosu aşağıda (açık + koyu + EN tek ekran/tek tema sisteminden; `useTheme` + i18n).
3. **asTab**: `route.params?.asTab` → geri düğmesi yok, alt boşluk `insets.bottom + 96` (geçici; S6 `TAB_BAR_R3_HEIGHT`). Stack açılışı bugünkü gibi (`+120`).
4. **Hareket**: giriş stagger (`useFeedCardEnter`, ≤6), beğen/kaydet ikon pop + sayaç yuvarlanma + kaydet noktası, "Günüme ekle" → `LogTrail` + "…'ye loglandı" toast, "Ben de yaptım" → success haptik + kcal hapı, sheet'ler `SPRING.sheet`, zil rozeti pop, iskelet parıltısı, çek-yenile. Olumsuz anlar sessiz (kırmızı yok). Azaltılmış harekete tüm hook'lar uyar. Yeni hook'lar `src/modules/kesfet/motion.ts` (yalnız motion.tsx token'larıyla beslenir).
5. **Ürün ara** (composer): `search_products`; seçilen ürün öğün kartını doldurur (kullanıcı düzeltir); RPC yoksa (`available:false`) düğme gizli; mock modunda 5 sahte ürün.
6. **Gönderi düzenleme**: kendi gönderinde PostMenu "Düzenle" → `update_my_post`; pending dönerse kartta "İncelemede"; RPC yoksa seçenek gizli.
7. **Durumlar**: pending "İncelemede" rozeti, çevrimdışı sakin hâli (`FeedOffline` + NetInfo), boş Takip (`FollowingEmpty`), kaldırılmış gönderi sakin landing (`SharedPostScreen`), rate limit sakin (kırmızısız) composer mesajı.
8. **Video** (madde 7): mevcut `FeedVideo` zaten yalnız görünürken + sessiz oynar, çıkınca durur, kapak önce; `kesfet_video` kapalıyken düz kapak. Kontrol etiketleri TR/EN'e bağlandı.
9. **Erişilebilirlik**: TR/EN etiketler, dokunma alanları ≥44 (PostCard ⋯ ve aksiyon satırı 44'e çıkarıldı).
10. **Kontrol**: `tsc --noEmit` = 0; `test:unit` 410/410; `test:components` 43/43 (4 yeni Keşfet süiti); `expo export --platform ios` geçer. Son commit `docs/night/G11-S3-DONE`.

## Tasarım ↔ bileşen eşleşme tablosu
Not: Tek ekran, `useTheme` ile açık+koyu; i18n `kesfet`/`share_card` ile tr+en. Bu yüzden Feed-D1 / Feed-D1-Dark / Feed-EN AYNI bileşen ağacının üç varyantıdır (ayrı kod yok); renk eşlemesi RULES'taki token'lara bağlı.

| Tasarım (t20) | Bileşen | Durum / G11 farkı |
|---|---|---|
| T20Feed-D1 / -Dark / -EN | `KesfetScreen` + `PostCard` + `MealCard` + `GunRingStrip` | Yapı/metin/boşluk eşleşti (G6/G8). G11: giriş stagger, beğen/kaydet pop+nokta+sayaç yuvarlanma, ⋯ dokunma alanı 40→44. Açık+koyu token, EN i18n. |
| T20FollowingEmpty | `states.tsx` → `FollowingEmpty` + `SuggestionRow` | Başlık/açıklama/"Önerilen hesaplar"/"Takip et" eşleşti; öneriler gerçek `can_post` yazarlarından (uydurma yok). |
| T20Compose | `ComposerScreen` | İptal/Paylaş başlık, metin, ≤4 foto eşleşti. G11 EK: "Ürün ara" paneli (tasarımda yok; yeni özellik). Hata çubuğu kırmızı→sakin (motion §2). |
| T20AddSheet | `AddToDaySheet` | Öğün/porsiyon seçimi + canlı makro (G6). G11: `SPRING.sheet` yükseliş (`BottomSheet`). |
| T20AddToast | `AddToast` + `KesfetScreen.onAdd` | Toast + "Günüme paylaş" eylemi eşleşti. METİN KARARI: tasarım "…'ye eklendi" derken Hareket Kitabı §3 + görev "…'ye loglandı / Logged to …" diyor → motion kitabı esas alındı; mevcut (i18n testiyle kilitli) `kesfet.added_toast` anahtarı kullanıldı. "Logla izi" `LogTrail` ile oynatılıyor. |
| T20PostMenu | `PostMenu` | Kopyala/Şikayet/Engelle/Sil + şikayet nedenleri eşleşti (G8). G11 EK: kendi gönderinde "Düzenle" (RPC varsa). |
| T20PostMenuBlock | `PostMenu` (block görünümü) | Engelle onay adımı eşleşti. |
| T20ShareCard / T20ShareCardGuide | `src/screens/share/*` + `share_card` i18n | Derin bağlantı/paylaşım kartı (G5-S4/G7). Kaldırılmış/erişilemez gönderi → sakin `DeepLinkLanding` (madde 6). Bu turda yapısal değişiklik yok. |

Eksik ekran/hâl bulunmadı; eklenen yeni hâller: çevrimdışı (`FeedOffline`), composer ürün arama paneli, gönderi düzenleme alt-sayfası (`EditPostSheet`).

## Dosyalar
- Yeni: `src/modules/kesfet/motion.ts`, `src/modules/kesfet/ui/EditPostSheet.tsx`, `src/modules/kesfet/__tests__/g11.test.ts`, `src/modules/kesfet/ui/__component_tests__/{PostCard,PostMenu,states,ComposerSearch}.test.tsx`.
- Değişen: `client.ts`, `types.ts`, `store.ts`, `mock.ts`, `ui/{KesfetScreen,PostCard,PostMenu,ComposerScreen,BottomSheet,NotificationsSheet,CommentsSheet,ActivityCard,MediaGrid,states,icons}.tsx`, `media/video/ui/FeedVideo.tsx`, `core/i18n/dictionaries.ts` (yalnız `kesfet` ad alanı; tr+en).

## ENTEGRASYONA (S6 / başka sahipler)
1. **Tab bar yüksekliği** — `KesfetScreen` asTab alt boşluğu şimdilik `insets.bottom + 96`. S6: `src/modules/shell/layout.ts` → `TAB_BAR_R3_HEIGHT`'a bağla (G11-CONTRACT m.38).
2. **Kaydırınca küçülme** — S2 `src/modules/shell/scroll.ts` → `useTabBarCollapse()`. S6: Keşfet `FlatList` (`KesfetScreen` body) ve Tracker listelerine bağla (contract m.39). Keşfet listesi tek `FlatList`; `onScroll` eklenebilir.
3. **jest.setup.js** (S3 sahibi değil) — `@react-native-google-signin/google-signin` ve `expo-video` için taklit ekle; o zaman `PostCard.test.tsx` içindeki yerel `jest.mock('../MediaGrid', …)` kaldırılabilir ve video akışı da bileşen testinde render edilebilir. Önerilen satır (setupFilesAfterEach bloğuna):
   ```js
   jest.mock('@react-native-google-signin/google-signin', () => ({ GoogleSignin: { configure(){}, hasPlayServices: async()=>true, signIn: async()=>({}), signOut: async()=>{} }, statusCodes: {}, isSuccessResponse: ()=>false, isErrorWithCode: ()=>false }));
   jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ play(){}, pause(){}, muted: true, loop: true }), VideoView: () => null }));
   ```
4. **Sunucu RPC'leri (S1)** — `search_products` ve `update_my_post` canlıda yok; istemci "fonksiyon bulunamadı" (`PGRST202`/`42883`) → özelliği gizler. S1 bu RPC'leri yazınca özellikler kendiliğinden açılır (ek istemci değişikliği gerekmez).

## SORULAR
Yok (karar gerektiren açık nokta çıkmadı).
