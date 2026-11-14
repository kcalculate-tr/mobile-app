# G53-S1 LOG: Keşfet profil kısayolu, profil fotoğrafı "+", paylaşım görsel kılavuzu, paywall neon kenar (14 Kas)

Dal `release/1.1.0`, worktree `.claude/worktrees/g23-s1`, başlangıç `7450ca2` (`docs/night/G52-S1-DONE` vardı). Yalnız JS/TS (OTA uyumlu). Yalnız mevcut paketler kullanıldı: expo-image-picker, reanimated, react-native-svg, zustand. Yeni paket yok. Deploy, OTA, canlı DB yazma ve migration yok.

## ÖZET
1. **md.1 Keşfet:** Üst çubuğun sağında kendi profil fotoğrafım var (yoksa baş harf dairesi). Ölçü 36 pt, dokunma alanı 44 pt, VoiceOver etiketi "Profilim, paylaşımlarım". Dokununca kendi `PublicProfile` ekranım açılır. Kullanıcı adı yoksa kendi profil önizlemem açılır. Oturum yoksa `Login` (AuthSheet, G47). Kimlik `myProfileStore` deposundan geliyor; Profil'de foto değişince Keşfet'teki avatar da anında güncellenir.
2. **md.2 "+" rozeti:** Lime rozet 24 pt, kenarı zemin renginde 2 pt (açık temada beyaz, koyuda koyu), dokunma alanı 44 pt. Yalnız **kendi** profilimde görünür: Profil sekmesi başlığında ve kendi açık profilimde (`PublicProfileScreen` içinde `isMe` iken ya da `ProfileSub › public`). Başkasının profilinde yok (testle doğrulandı). Seçenek sayfası: Fotoğraf çek · Galeriden seç · (foto varsa) Fotoğrafı kaldır. Seçim kare kırpılır (`allowsEditing` + 1:1). Yeni foto **anında** görünür ve üstünde küçük dönen gösterge çıkar. Yükleme mevcut yoldan gider: `avatars/{uid}.{ext}` + `update_public_profile`. Hata olursa eski foto geri gelir ve kısa bir uyarı çıkar ("Tekrar dene" ile).
3. **md.3 Görsel kılavuzu (i):** Composer'ın alt çubuğunda, Fotoğraf/Video düğmelerinin yanında 44 pt'lik "i" düğmesi var. Açılan sayfadaki **bütün sayılar koddan okunuyor** (aşağıdaki tablo). İlk paylaşım ekranında bir kez kendiliğinden açılır (ipucu satırıyla), sonra yalnız "i" ile. TR + EN.
4. **md.4 Neon kenar:** Paywall ve T1'de seçili plan kartının kenarında dolaşan bir ışık var. Yapı: 2 pt yarı saydam temel kenar, üstünde çevrenin %25'i kadar parlak bir parça (uçları yumuşak) ve dış parlama. Bir tur 2,8 sn sürer, hız sabit, döngü kesintisiz. Çizim `react-native-svg` yuvarlak dikdörtgeni üzerinde `strokeDashoffset` ile yapılıyor; animasyon `useAnimatedProps` ve reanimated **kare geri çağrısıyla UI thread'de** çalışıyor (JS zamanlayıcısı yok). Seçim değişince ışık yeni karta 200 ms'de geçer (ortak saat sayesinde aynı konumdan devam eder). Azaltılmış harekette dolaşma yok; sabit 2 pt kenar + hafif glow. Ekran odakta değilse ya da uygulama arka plandaysa döngü durur.
5. **Kontroller** (son kod, vitrin dahil): hygiene ✓ · tsc ✓ · unit 1383/1383 ✓ · jest 122 paket / 834 test / 3 anlık görüntü ✓ (`--ci`) · `expo export` iOS ✓ (3448 modül), Android ✓ (3455 modül).
6. Ekran görüntüleri `docs/night/g53/` altında, 19 dosya, açık + koyu.

## Commit
| commit | içerik |
|---|---|
| `5f9a48a` | md.1–md.4 kodu + testler |
| (sonraki) | docs(g53): vitrin sahneleri `G53-*` + `__DEV__` sayfa açma parametresi + ekran görüntüleri + bu LOG |
| (son) | `docs/night/G53-S1-DONE` |

## Değişen / yeni dosyalar
| dosya | ne |
|---|---|
| `src/modules/kesfet/ui/KesfetMe.tsx` (yeni) | `useKesfetMe` (hedef + kimlik) + `KesfetMeButton` (36/44 pt) |
| `src/modules/kesfet/ui/KesfetScreen.tsx` | başlıkta `me` (bildirimden sonra, en sağda) |
| `src/modules/profil/myProfileStore.ts` (yeni) | kendi kimliğim (avatar/handle/ad), zustand |
| `src/modules/profil/avatarChange.ts` (yeni, saf) | `runAvatarChange` / `runAvatarRemove` (iyimser + geri alma), `avatarSheetOptions`, `meShortcutTarget` |
| `src/modules/profil/avatarUpload.ts` | `pickAvatarImage` (kamera izni + kare kırpma), `uploadAvatarUri`, `saveAvatarUrl`, `removeAvatarUrl`; `pickAndUploadAvatar` bunlara dayanıyor (davranış aynı) |
| `src/modules/profil/ui/AvatarEditor.tsx` (yeni) | `useAvatarEditor`, `AvatarEditFrame` (rozet + gösterge), `AvatarOptionsSheet` |
| `ProfileSocialHeader.tsx`, `FinPrProfileScreen.tsx` | Profil başlığına rozet; sayfa + uyarı ekran kökünde; kimlik depoya yazılıyor |
| `PublicPreviewScreen.tsx` (+ `editable`), `PublicProfileScreen.tsx` (`editable={isMe}`), `ProfileSubRoute.tsx` | kendi açık profilime rozet |
| `SettingsPersonalScreen.tsx` | eski foto değiştirme yolu da depoyu güncelliyor |
| `src/modules/kesfet/shareGuide.ts` (yeni, saf), `ui/ShareGuideSheet.tsx` (yeni), `ComposerScreen.tsx` | kılavuz değerleri + sayfa + "i" + ilk açılış |
| `src/modules/kesfet/mediaPath.ts`, `media.ts`, `ui/MediaGrid.tsx` | sınırlar tek kaynakta: `PHOTO_QUALITY`, `POST_MEDIA_MAX_BYTES`, `FEED_SINGLE_MIN/MAX_H`, `feedSingleFrameHeight`; `MAX_PHOTOS` artık composer.ts'ten yeniden dışa açılıyor (değerler değişmedi) |
| `src/modules/subscription/ui/neon.ts` (yeni, saf), `ui/NeonBorder.tsx` (yeni) | neon geometrisi, kip kuralı, bileşen, `useNeonClock`, `useNeonVisible` |
| `PaywallScreen.tsx`, `kayit/screens/OfferScreen.tsx` | seçili kartta `NeonBorder` |
| `src/core/i18n/g53.ts` (yeni) + `dictionaries.ts` | `kesfet_me` · `avatar_edit` · `share_guide` (TR + EN) |
| `src/components/icons.ts` | `Stack`, `VideoCamera` |
| `src/dev/screenCatalog.ts`, `vitrinScreens.tsx`, `vitrinFixtures.ts` | yalnız `__DEV__` vitrin: `G53-*`, `publicMe`, `meAvatar` sahnesi |
| testler | unit: `subscription/__tests__/g53Neon`, `profil/__tests__/g53Avatar`, `kesfet/__tests__/g53ShareGuide` · jest: `g53Neon`, `g53AvatarEdit`, `g53KesfetMe` |

## md.3 kılavuz değerleri ve kaynakları
| ekranda | değer | kaynak |
|---|---|---|
| Kaç görsel | En fazla 4 fotoğraf (video açıksa "ve 1 video") | `composer.ts MAX_PHOTOS` (doğrulama + seçici `selectionLimit`). Video: Composer'da tek `video` durumu var, video satırı yalnız `kesfet_video` açıkken görünür |
| Sıkıştırma | %60 kalite | `mediaPath.ts PHOTO_QUALITY = 0.6` → `media.ts` seçici `quality` |
| En büyük dosya | 50 MB | `POST_MEDIA_MAX_BYTES` = `post-media` kovası `file_size_limit 52428800` (migration `20261104002000_g8_social.sql` §15; testte dosyadan okunup karşılaştırılıyor). Fotoğraf için istemcide ayrıca bir sınır yok |
| Kırpma notu | "kırpılmadan yüklenir; akışta 180–320 pt çerçeve, ortadan kırpılır" | Keşfet seçicisinde `allowsEditing` yok; `MediaGrid` tek görselde `feedSingleFrameHeight` + `contentFit="cover"` kullanıyor |
| Önerilen oran | 4:5 dikey (1080 × 1350), 1:1 kare (1080 × 1080) | Kodda net oran olmadığı için görevdeki öneri yazıldı. Testte 320–430 pt ekranlarda çerçeveyle çelişmediği doğrulandı: kare tam görünür (tavan 320 pt), 4:5 tavana takılır ve not doğru |
| Video | En fazla 60 sn ve 50 MB, orta kalite | `media/video/types.ts MAX_VIDEO_DURATION_S / MAX_VIDEO_BYTES`; `pickVideo` seçimden sonra ikisini de doğruluyor; `videoQuality Medium` |
Metin şablonlarında sınır sayısı yok (test): hepsi parametre olarak geliyor.

## Ekran görüntüleri (`docs/night/g53/`, "G40 iPhone" 402 pt)
- `G53-KesfetBar(-Dark)`: üst çubukta en sağda kendi fotoğrafım · `G53-KesfetBarInitial`: foto yok → baş harf "D"
- `G53-Profile(-Dark)`: Profil başlığı avatarında lime "+" · `G53-ProfileSheet(-Dark)`: seçenek sayfası (Çek · Galeri · Kaldır · Vazgeç)
- `G53-PublicMe(-Dark)`: kendi açık profilim, avatarda "+", tabak ızgarası
- `G53-ShareGuide(-Dark)`: Composer görsel kılavuzu (ilk açılış, ipucu satırıyla)
- `G53-Paywall-1/2/3` ve `G53-Paywall-Dark-1/2/3`: seçili Yıllık kartında dolaşan ışık, her karede farklı konumda (kareler arası ≈ 0,8 sn)
- `G53-T1(-Dark)`: T1 kayıt teklifi, seçili Balance kartında ışık parçası

Yöntem: Metro bu worktree'den çalıştı (8146, CI kipi, `--clear`). Çekim, G14 storage kipinin aynısı olan bir betikle yapıldı; betik repo dışında, `--initialUrl` + çoklu kare desteği eklendi. Native derleme yok. Sahneler sahte oturumla; `meAvatar` sahnesi kendi fotoğraf olarak vitrin tabak görselini veriyor. Çekimden sonra Metro durduruldu, simülatör görünümü sıfırlanıp kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı.

## Apple HIG (kod denetimi, kendi kontrolüm)
- Dokunma alanları: Keşfet avatarı 44, "+" 44, "i" 44, sayfa satırları ≥ 52, Vazgeç/Tamam ≥ 50 (testlerde ölçüldü).
- VoiceOver: "Profilim, paylaşımlarım", "Profil fotoğrafını değiştir", "Görsel kılavuzu". Yükleme göstergesi `progressbar` + "Fotoğraf yükleniyor". Neon katmanı erişilebilirlikten gizli (süs).
- Reduce Motion: neon sabit. Sayfalar mevcut `Sheet` kurallarını kullanıyor (azaltılmışta 200 ms opaklık).
- Dynamic Type: yeni metinlerde `numberOfLines` yok, satırlar kırılıyor.

## KARAR
1. **T1 neon rengi:** T1'de seçili kartın tamamı lime dolgulu (G44), bu yüzden lime bir parça kartın üstünde görünmez. Burada parça açık lime/beyaz çekirdekli, lime parlama kart dışına taşıyor, açık temada ince koyu-lime kontur var (`neonOnLimePalette`). Paywall'da çekirdek saf lime; açık temada koyu-lime kontur ve yarıya düşürülmüş glow kullanılıyor.
2. **Azaltılmış hareketteki sabit kenar:** Koyu temada lime (#B9EF14). Açık temada beyaz kartta lime okunmadığı için tasarım token'ı `limeLineOnLight` (#4A6B00) kullanıldı; bu token tam da "açık zeminde lime çizgi" için var. İkisinde de hafif glow var.
3. **"Görünür değil" tanımı:** Navigasyon odağı (`focus`/`blur`) + `AppState === 'active'`. Görünmezken kart sabit çizilir, kare döngüsü durur.
4. **Fotoğrafı kaldır:** `update_public_profile` NULL'ı "değiştirme" diye yorumluyor. Bu yüzden kaldırma, eski `ProfileScreen`'in yaptığı gibi kendi `profiles` satırına `avatar_url = null` yazarak yapılıyor. Şema değişikliği yok. Kovadaki eski dosya silinmiyor (bir sonraki yükleme aynı adın üstüne yazıyor).
5. **Kullanıcı adı yoksa** Keşfet kısayolu `ProfileSub › public` önizlemesini açıyor (aynı FinProfilePublic düzeni), çünkü handle olmadan herkese açık profil yok.
6. **Eski kabuk** (`yeni_kabuk` kapalı) `PublicProfileScreen` düzenine rozet eklenmedi; görev yeni kabuk ekranlarını tarif ediyor.
7. Seçenek sayfası kapanırken sistem seçicisi açılırsa iOS sunumu reddediyor. Bu yüzden seçici 350 ms gecikmeyle açılıyor.
8. Kılavuzun oran satırlarında nokta ayracı yok ("4:5 dikey (1080 × 1350)"); G17 kuralı.

## CANLIYA UYGULANACAK
Yok: migration da canlı DB değişikliği de yok.

## DEPLOY GEREKİR
Yalnız JS: 1.1.0 (build 32 / Android 25) için OTA'ya uygun. Canlıya gönderim İlter'in onayıyla (`eas update --channel production` onaysız yasak).

## SORULAR
1. Kendi açık profilimi `ProfileSub › public` önizlemesinden açınca düğme hâlâ "Takip et" görünüyor. Bu mevcut önizleme davranışı: etkileşimsiz, "başkaları böyle görür". `PublicProfile` rotasında ise kendi profilimde gizlilik düğmesi var. Önizlemede de gizlilik düğmesi gösterilsin mi?
2. Fotoğrafı kaldırınca kovadaki eski dosya da silinsin mi? Şu an yalnız profildeki URL boşaltılıyor.
3. Açık profilin tabak ızgarası canlıda hâlâ boş: yazara göre gönderi listesini veren bir RPC yok, durum G12'den beri aynı. Keşfet kısayolu doğru ekrana gidiyor, ama ızgaranın dolması için bu RPC gerekiyor.
