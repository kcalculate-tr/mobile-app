# G25-S1 — 1.1.0 inceleme öncesi düzeltmeler (A-S1 "A" listesi) · 11 Kas 2026

Dal `release/1.1.0` (worktree `.claude/worktrees/g23-s1`). Sürüm 1.1.0 kaldı. Yeni paket yok, deploy yok, canlı DB yazma yok.

## ÖZET
1. `night24/coach` → `release/1.1.0` birleşti (no-ff, çakışma yok). Koç `koc` + artık `abonelik` (bayrak + RevenueCat) açıkken görünür.
2. A1: Tanıtım + TbFirst "günde N ücretsiz tarama" sunucudan (`ai_daily_free`, yedek 2), TR/EN tekil/çoğul.
3. A2: Paywall ve Profil › Abonelik altında "Kullanım Koşulları (EULA)" (iOS Apple EULA / Android uygulama içi Koşullar) + Gizlilik.
4. A4/A10: iki yeni uzak bayrak, ikisi KAPALI → `yakinda_satirlari` (Yakında satırları, Macro "Öğün Aboneliği" sekmesi), `paylasim_baglanti` (gönderi Paylaş / Bağlantıyı kopyala). Migration DOSYASI + rollback.
5. A5: Macro ödül "Kullan" hedef yoksa gizli; varsa kupon sepete gider (sepet boşken bekler), 44 pt.
6. A8: Paywall yüklenirken kart iskeleti + "Planlar yükleniyor"; fiyat gelmezse aynı ekranda hata kartı + Tekrar dene; Geri yükle meşgul hâli.
7. A9: Hesap silme onayında abonelik uyarısı + "Aboneliği yönet" (iOS/Android mağaza bağlantısı), TR/EN.
8. A11/A12/A13: TbPace "—" gizli, Rozetler'de "Ad Soyad" yok; Takibe kaydı hata verirse toast + Tekrar dene (kutlama yalnız başarıda); Toast düğmeleri + öğün etiketi i18n.
9. Ses gizliliği: iOS `requiresOnDeviceRecognition: true` her zaman, Android `EXTRA_PREFER_OFFLINE` her zaman (ayrıntı KARAR 6).
10. Kontroller: tsc 0 · hygiene OK · unit 1056/0 (1 atlanan) · jest 431/431 (76 dosya) · deno check 3/3 · expo export iOS + Android OK · eksik çeviri anahtarı 0.

## Commit tablosu
| Madde | Commit | Özet |
|---|---|---|
| 0 | `0401d64` | merge night24/coach → release/1.1.0 |
| 12 | `1b93b61` | koç girişleri/ekranları `abonelik` kapalıyken gizli |
| 1 (A1) | `51f34b5` | "günde N ücretsiz" sunucu tavanı (yedek 2) |
| 2 (A2) + 5 (A8) | `e71343b` | EULA bağlantısı (Paywall + Profil › Abonelik); paywall iskelet / hata kartı / Geri yükle meşgul |
| 3 (A4) + 4 (A5) | `4221bab` | `yakinda_satirlari` + Macro "Kullan"; migration `20261111200100_g25_flags` (+`paylasim_baglanti`) |
| 7 (A10) | `b2884cf` | Paylaş / Bağlantıyı kopyala `paylasim_baglanti` arkasında |
| 6 (A9) | `7f9d4f0` | silme onayında abonelik uyarısı + Aboneliği yönet |
| 8 (A11) | `f664310` | Rozetler gerçek veri / boş hâl (TbPace aşağıdaki commit'te) |
| 8/9/10 (A11–A13) | `2021669` | TbPace satırı gizli; Takibe kayıt hatası toast + Tekrar dene; Toast + öğün etiketi i18n; usedKeysExist dinamik anahtarlar |
| 11 | `eeebb8d` | ses gizliliği seçenekleri |
| 13 (HIG) | `ec4c10e` | hata toast'ı büyük metinde kırpılmaz |
| — | (bu commit) | LOG; ardından `G25-S1-DONE` |

## KARAR
1. **Koç + abonelik (md.12)**: `useCoachEnabled` = `koc` && `useSubscriptionEnabled()` (bayrak `abonelik` + RevenueCat yapılandırılmış). RC yoksa paywall çalışmaz → koç da gizli. Koç rotaları navigatörde `koc && abonelik` bayraklarıyla kayıtlı.
2. **EULA (md.2)**: tek bağlantı "Kullanım Koşulları (EULA)": iOS'ta Apple standart EULA (tarayıcı; açılamazsa uygulama içi Koşullar), Android'de uygulama içi Koşullar. Paywall'daki eski "Kullanım Koşulları" bağlantısının yerini aldı; bizim Koşullar'ımız iOS'ta Profil › Sözleşmeler'den açılıyor. (Hukuk abonelik maddesini Koşullar'a ekleyince iOS paywall'a ayrıca "Koşullar" konabilir — SORULAR 2.)
3. **Paywall fiyat hatası (md.5)**: eskiden tam ekran "Satın alma tamamlanamadı" (yanlış metin) çıkıyordu → artık aynı ekranda "Planlar yüklenemedi" kartı + Tekrar dene; başlık, Geri yükle ve hukuk bağlantıları yerinde kalıyor (boş alan yok). Satın alma hatası yine FinSubResult.
4. **Yakında (md.3)**: kodda "Vital" satırı YOK (grep: hiçbir dosyada). Gizlenenler: ProfileSubSection "Yakında" bloğu (Egzersiz rehberi, Öğün aboneliği, dipnot), FinPrMacro sekme seçici + "Öğün Aboneliği" sekmesi, Profil "Macro aboneliğim" satırı (yalnız o sekmeyi açıyordu; Macro bakiyesi "Macro" satırından açılmaya devam ediyor). Eski kabuktaki `MacroScreen.tsx` "Yakında" kartına dokunulmadı (1.0.x'te zaten yayında, eski kabuk).
5. **Macro "Kullan" (md.4)**: hedef = eatkcal v2 sepeti (`yeni_siparis` açık + kuponun kodu var). Dokununca `EkCart { couponCode }`; sepet doluysa `validate_coupon_v2` ile bir kez uygulanır ("uygulandı" toast'ı / kupon hata metni), boşsa kod bekler ve ürün eklenince uygulanır. `yeni_siparis` kapalıysa düğme gizli.
6. **Ses gizliliği (md.11)** — kütüphane kaynağı okundu (`node_modules/expo-speech-recognition` ios/android):
   - iOS: `requiresOnDeviceRecognition: true` her zaman gönderiliyor. Kütüphane bunu yalnız `SFSpeechRecognizer.supportsOnDeviceRecognition` true ise isteğe yazıyor; **desteklemeyen cihaz/dilde bayrak yok sayılır ve tanıma Apple'ın sunucusunda yapılır** (hata yok). Önceki kod da aynı sonucu veriyordu (destek varsa true).
   - Android: `androidIntentOptions.EXTRA_PREFER_OFFLINE: true` her zaman (yalnız tercih; tanıyıcıya göre etkisiz olabilir). `requiresOnDeviceRecognition` yalnız `isOnDeviceRecognitionAvailable` true ise — Android 13+'ta bu cihaz içi tanıyıcıyı ZORLAR, model yoksa başlatma hata verirdi. **Cihaz içi tanıma yoksa varsayılan tanıyıcı (genelde Google) kullanılır ve ses Google'ın konuşma hizmetine gidebilir.**
   - Her iki platformda ses BİZİM sunucumuza gitmez, kayıt saklanmaz; sunucuya yalnız metin gider. Gizlilik metni: "Sesli girişte konuşman telefonunda ya da işletim sisteminin konuşma tanıma hizmetinde (Apple / Google) yazıya çevrilir; kcal'e yalnız metin ulaşır."
7. **Takibe kayıt hatası (md.9)**: hata → toast (kendiliğinden kapanmaz, "Tekrar dene"), taslak korunur, "Profil hazır" kutlaması ve geçiş yok. TbFirst'te (Tara / Elle ekle / Keşfet) aynı kural; Tekrar dene aynı hedefe gider. Analitik olay eklenmedi (olay adı sözlükte yok; yeni olay = sunucu sözlüğü işi).
8. **Rozetler (md.8)**: örnek kişi satırları yerine üstte kendi durumun (doğrulanmışsa ad + mühür + rol çipi; değilse boş hâl) ve altta rol çipleri + tek cümlelik anlamları (TR/EN yeni metinler).
9. **i18n (md.10)**: Toast "Geri al / Gör / Tekrar dene" → `common.undo/view/retry`; Ana sayfa öğün etiketi `meal.${slot}` (EN "Logged to Dinner"). `usedKeysExist` şablonla çağrılan bu anahtarları ayrıca denetliyor.
10. **Paylaşım (md.7)**: profil "Bağlantıyı kopyala/Paylaş" düğmesi kodda yok; gizlenenler gönderi kartı Paylaş, video Paylaş, gönderi detayı Paylaş + menü "Bağlantıyı kopyala", paylaşılan gönderi (eski ekran) Paylaş. `linking.ts` (Universal Link / `kcal://`) aynen duruyor.

## HIG kod denetimi (paywall, silme, toast + değişen ekranlar)
- Paywall: iskelet hareketsiz (Reduce Motion sorunu yok), `progressbar` + busy + canlı bölge metni; hata kartı başlık rolü, Tekrar dene 48 pt; Geri yükle 44 pt, `busy/disabled` durumu ve göstergesi; EULA/Gizlilik 44 pt, `link` rolü, büyük metinde alt satıra sarar. ✓
- Hesap silme: onay kartı ScrollView içinde (Dynamic Type'ta düğmeler kırpılmaz), başlık `header`, "Aboneliği yönet" 44 pt `link`. ✓
- Toast: eylemler 44×44, etiketler yerelleştirilmiş; hata tonunda `assertive` canlı bölge ve metin satır sınırı yok (düzeltildi `ec4c10e`). Not: hata toast'ında ayrı kapat düğmesi yok — Tekrar dene ya da ekrandan devam (SORULAR 5).
- Macro "Kullan" 44 pt; FinPrMacro sekme seçici gizliyken başlık doğrudan Macro içeriği. ✓
- Rozetler: satırlar tek VoiceOver öğesi (ad, Onaylı, rol); çipler `minHeight` ile sarar. ✓
- `apple-design-skill` ile ayrı otomatik denetim çalıştırılmadı (zaman); yukarıdaki elle kod denetimi.

## CANLIYA UYGULANACAK (sıra)
1. `supabase/migrations/20261111100100_g24_coach.sql` (G24; koç tablo/RPC + `koc` bayrağı kapalı) — rollback `supabase/rollbacks/20261111100100_g24_coach_rollback.sql`.
2. **`supabase/migrations/20261111200100_g25_flags.sql`** — `yakinda_satirlari` ve `paylasim_baglanti` satırları (ikisi `enabled false`, rollout 0, min 1.1.0, `on conflict do nothing`). Rollback `supabase/rollbacks/20261111200100_g25_flags_rollback.sql`. Satır uygulanmasa da istemci varsayılanı `false` (gizli) → 1.1.0 incelemesi için migration ŞART DEĞİL; yalnız sonradan açabilmek için.
3. `supabase functions deploy coach-chat` (G24; koç açılırken). Bayrak açma sırası: `abonelik` → (`koc`). `paylasim_baglanti` yalnız `l.eatkcal.com` DNS + AASA/assetlinks + /p /u önizleme sayfaları yayında olunca.

## DERLEME KOMUTU
```
cd ~/dev/kcal-mobile/.claude/worktrees/g23-s1
npx tsc --noEmit && npm run hygiene && npm run test:unit && npx jest
deno check supabase/functions/analyze-ai-scan/index.ts supabase/functions/revenuecat-webhook/index.ts supabase/functions/coach-chat/index.ts
npx expo export --platform ios --output-dir /tmp/g25-ios && npx expo export --platform android --output-dir /tmp/g25-android
```
Native değişiklik YOK (yeni paket/izin yok) → mevcut 1.1.0 derleme yapılandırması yeterli; mağaza derlemesi İlter onayıyla.

## SORULAR
1. **Ses gizlilik metni**: Android'de cihaz içi tanıma yoksa ses Google'ın konuşma hizmetine, iOS'ta desteklenmeyen cihaz/dilde Apple'a gidebiliyor (KARAR 6). Gizlilik Politikası + App Privacy etiketine bu cümle eklensin mi? (Öneri metni KARAR 6'da.)
2. **iOS paywall'da kendi Koşullar'ımız**: şu an yalnız Apple EULA + Gizlilik. Hukuk Koşullar'a kcalAI otomatik yenileme maddesini ekleyince iOS'a ayrıca "Koşullar" bağlantısı eklensin mi? ASC uygulama açıklamasına EULA bağlantısı (A2'nin ASC kısmı) İlter'de.
3. **Vital**: A4 maddesindeki "Vital" satırı kodda bulunamadı — başka bir dalda/tasarımda mı? (Şimdilik yapılacak bir şey yok.)
4. **Eski `MacroScreen.tsx` "Yakında" kartı** (eski kabuk, 1.0.x'te yayında) bayrağa bağlansın mı? Yeni kabuk kapalıyken inceleyici görebilir.
5. **Hata toast'ına kapat düğmesi**: Takibe kayıt hatası toast'ı Tekrar dene ile kalıcı; ayrı "Kapat" ister misin?
6. A-S1'in kod dışı A maddeleri bu oturumun kapsamı dışında, açık: A3 (Gizlilik metni + ConsentSheet Gizlilik bağlantısı), A6 (`eatkcal.com/support` 404), A7 (IAP/RC teklif/inceleme hesabı), A10 DNS kısmı.
