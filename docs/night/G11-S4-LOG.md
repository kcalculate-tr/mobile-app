# G11-S4 — Ana sayfa (Tracker), Gün halkası, Profil, Tara, kayıt (opus)

## Özet (10 satır)
1. G11-S4.md'deki 10 madde `night11/gun-profil` dalında (worktree `.claude/worktrees/g11-s4`, taban `night10/release`) işlendi.
2. Hareket/sayı altyapısı: `src/modules/gun/motion.ts` (SAF `groupDigits` TR `1.840`/EN `1,840`, `isSilentEvening`) + `src/modules/gun/ui/RollingNumber.tsx` (hane bazlı odometre, sabit genişlik slot, STAGGER ile sağ en çok döner, azaltılmış harekette anında). İmza anlar `core/design` hazır bileşenlerinden (ProgressRing dolumu, LogTrail, StreakMoment, Toast, usePop).
3. Ana sayfa (madde 2): `src/screens/tracker/TrackerDayHeader.tsx` — `yeni_kabuk` açıkken gün halkası şeridi (`gun_halkasi`) + halka dolumu imza anı (kontur→lime + merkez RollingNumber + dolunca tek nefes) + Logla izi (LogTrail+zaman hapı) + seri çipi (yalnız streak>0) + akşam/boş sessiz an. Bayrak kapalıyken eski kalori halkası yerinde, ekran birebir aynı.
4. Profil (madde 3): `src/modules/profil/ui/ProfileSocialHeader.tsx` — avatar/ad/@handle/sayaçlar (RollingNumber) + gizlilik satırı → PrivacySheet + "Macro aboneliğim" → Subscriptions; `yeni_kabuk` arkasında, mevcut sipariş/kart/adres/kupon listesine dokunulmadı.
5. Herkese açık profil (madde 4): takip düğmesi açılışta `usePop`, sayaçlar RollingNumber ile yuvarlanır, gizli hesap hâli (T20Privacy), engelli hâli (`PublicProfile.blocked?` opsiyonel; sunucu döndürmezse gösterilmez).
6. Tara (madde 5): `ScanFrame` (köşe kilidi STAGGER.scanCorners + tarama çizgisi TIMING.sweep), sonuç makro kartı P/K/Y hapları + RollingNumber, "Günüme ekle" → LogTrail, T20ScanLimit sessiz an; `ai_tarama` arkasında.
7. Kayıt (madde 6): KcalAiSignUpScreen T20SignupAI'a uygun; rezerve ad → "Bu kullanıcı adı ayrılmış" (`useHandleClaim` → `profil.handle_reserved`; `handle.ts` S1'in, dokunulmadı). Müsaitlik çipi "müsait".
8. EatHome/CityGate (madde 7): T20Eat eşleşmesi, "Sipariş ver" SPRING.eat, CityGateSheet SPRING.sheet; gerçek şube verisi, sipariş/ödeme akışına dokunulmadı; `restoran_yakinda` arkasında.
9. i18n: `gun`, `meal`, `profil`, `ai_scan`, `eatkcal` ad alanlarına TR+EN anahtarlar (reserved, sessiz an, Logla hapı, Macro aboneliği, gizli/engelli rozetleri). `common` ve diğer ad alanlarına dokunulmadı.
10. Kontrol: **tsc 0**, **`npm run test:unit` geçti**, **`npm run test:components` 7 süit / 37 test geçti** (yeni: ProfileSocialHeader, TrackerDayHeader, handleReserved), **`npx expo export --platform ios` geçti**. Son commit `docs/night/G11-S4-DONE`.

## Bayrak kapalıyken birebirlik (en kritik kural)
`yeni_kabuk` yerel varsayılanı yok (S2 registry'ye ekler; S6 birleştirene dek `mergeFlags` tanımadığı anahtarı `false`'a çözer). Bu yüzden:
- TrackerScreen: yeni başlık `{yeniKabuk ? <TrackerDayHeader/> : null}`; eski `BigCalorieRing` kartı yalnız `{!yeniKabuk ? … : null}` ile gizlenir. Kapalıyken: yeni başlık yok + eski halka var = bugünkü ekran. `asTab` alt boşluğu yalnız `route.params.asTab===true` (yalnız yeni kabuk tab'ı geçirir) iken değişir.
- ProfileScreen: `{yeniKabuk ? <ProfileSocialHeader/> : null}` en üste eklenir; başka hiçbir satır (sipariş/kart/adres/kupon/BMI kartı) değişmez.
- Logla izi tetikleyici (`logToken`, `lastMealLabel`) yalnız yeni başlık okur; eski kabukta görünür etkisi yok.
Doğrulama: component testleri yeni UI'nin yalnız bayrak/veri açıkken render olduğunu gösteriyor (`TrackerDayHeader`/`ProfileSocialHeader` izole testleri).

## Madde 1 — Eşleşme denetimi (tasarım → bileşen)
Açık + koyu: tüm yeni bileşenler `core/design` `useTheme()` token'larını kullanır (ink/secondary/line/accent/accentLine/onAccent; RULES hex eşlemesi). EN: tüm metin `useT()` üzerinden (TR+EN anahtarlar mevcut). `[N]`/`[Ad]` yer tutucuları gerçek veriden; veri yoksa "—" ya da satır hiç gösterilmez (uydurma yok).

| Tasarım (t20) | Bileşen(ler) | Boş / yükleniyor / hata | Not |
|---|---|---|---|
| T19GunEnd / T19GunDone | `GunViewer` (son kart %N / "Gün tamamlandı") | foto yoksa tema zemini; K/Y yoksa "—" | gün özeti halkası + öğün küçük görselleri |
| T20GunEmpty | `GunEmpty` | boş = asıl durum; "İlk öğününü paylaş" | TrackerDayHeader'dan erişilir |
| T20GunView | `GunViewer` cam kart | K/Y eksik "—"; add yoksa buton pasif | "Günüme ekle" → addDayCardToDay |
| T20Privacy | `PrivacySheet` | — | seçili 2px/dolu radyo, seçilmemiş 1.5px |
| T20Scan | `ScanFrame` + `ScanScreen` + `ScanQuotaChip` | kalan null → çip gizli; analiz → tarama çizgisi | köşe kilidi STAGGER.scanCorners, çizgi TIMING.sweep |
| T20ScanLimit | `ScanLimitSheet` | hak 0 → deklanşör 0.35, sheet; "Pro" 0.45 pasif | olumsuz an: success haptik yok, kırmızı yok |
| T20SignupAI (3) | `KcalAiSignUpScreen` | handle: idle/checking/available/taken/**reserved**/invalid | reserved → handle_reserved |
| T20SignupEat (ekran 1) | `EatHomeScreen` + `CityGateSheet` | şehir geçilmişse sheet yok | İzmir aktif, diğer "Haber ver" |
| T20TakibeBasla | `TakibeBaslaCTA` → NutritionProfile | "Şimdi değil" ile atlanır | hesaplama mevcut `lib/nutrition` |
| T20Eat | `EatHomeScreen` | şube yoksa liste boş; nearby "Çok yakında" | "Sipariş ver" SPRING.eat |
| (yeni) Ana sayfa halka/şerit/seri/Logla izi/sessiz an | `TrackerDayHeader` (+ ProgressRing/RollingNumber/LogTrail/GunRingStrip/GunViewer/Toast) | streak 0 → seri yok; akşam+boş → "Yarın yeni halka." | halka merkezi RollingNumber (Orta) |
| (yeni) Profil sosyal başlık | `ProfileSocialHeader` (+ RollingNumber/PrivacySheet) | handle/RPC yoksa sayaç gizli | gizlilik → PrivacySheet, Macro → Subscriptions |

## ENTEGRASYONA (G11-S6 uygular)
1. **`src/core/flags/registry.ts`** (S2 sahibi): `yeni_kabuk: false` satırı eklenmeli (S2 zaten ekliyor). O zamana dek Tracker/Profile'daki `useFeature('yeni_kabuk' as FlagKey)` `mergeFlags` tarafından `false`'a çözülür — ekran bugünküyle aynı. Eklendiğinde yeni kabuk otomatik çalışır (ek kod gerekmez).
2. **Alt boşluk sabiti**: TrackerDayHeader'ı barındıran TrackerScreen `asTab` iken alt boşluğu `insets.bottom + 96` veriyor (G11-CONTRACT geçici değer). S6 bunu `src/modules/shell/layout.ts` → `TAB_BAR_R3_HEIGHT`'e bağlamalı.
3. **Kaydırınca küçülme**: TrackerDayHeader/şerit, S2'nin `useTabBarCollapse()`'ine S6 tarafından bağlanabilir (opsiyonel).
4. **`PublicProfile.blocked`**: istemci tipi opsiyonel `blocked?` ekledi; `get_public_profile` RPC'si çift yönlü engel durumunu bu alanla dönerse "engelli hâli" otomatik görünür (S1/sunucu kararı — şu an dönmüyorsa hâl gösterilmez, güvenli).
5. **AI tarama "Günüme ekle"**: `saveAiScanEstimate` G6-S1 `meal_consumptions_source_check` güncellemesi gelince `source:'ai_scan'`e çevrilebilir (mevcut kayıt davranışı korundu).

## Kontrol
- `npx tsc --noEmit`: 0 hata
- `npm run test:unit`: geçti (yeni: `gun/__tests__/motion.test.ts` — groupDigits TR/EN, isSilentEvening)
- `npm run test:components`: 7 süit / 37 test geçti (yeni: ProfileSocialHeader, TrackerDayHeader ×4, handleReserved ×2)
- `npx expo export --platform ios`: geçti
- Dal push edilmedi (RULES: PR yok).

## Commit'ler
- `d3e3492` feat(gun): RollingNumber + groupDigits + i18n reserved/sessiz an (madde 8)
- `0127351` feat(tracker): yeni kabuk Ana sayfa başlığı (madde 2)
- `4bb87bd` feat(ai): Tara imza hareketleri + makro kartı (madde 5)
- `400e353` feat(eatkcal): EatHome/CityGate T20Eat + SPRING.eat (madde 7)
- `5929bff` feat(profil): yeni kabuk Profil sosyal başlık (madde 3)
- `affe074` feat(profil): herkese açık profil — pop/sayaç/gizli/engelli (madde 4)
- `8ec499b` feat(profil): SignupAI reserved mesajı + "müsait" çipi (madde 6)
- `27aba86` test(g11-s4): yeni kabuk bileşen testleri (madde 9)
- `docs/night/G11-S4-DONE` (bu LOG + bitiş işareti)
