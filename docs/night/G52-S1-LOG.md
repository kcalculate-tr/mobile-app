# G52-S1 LOG — "kcalAI" → Kcalculate logosu + "AI" (14 Kas)

Dal `release/1.1.0` · worktree `.claude/worktrees/g23-s1` · başlangıç `cb5d69a` (`docs/night/G51-S1-DONE` vardı). Yalnız JS/TS (OTA uyumlu). Yeni paket yok. Deploy / OTA / canlı DB yok. Migration yok.

## ÖZET
1. **md.1 İşaret:** `KcalAiMark` = Kcalculate logosu (`assets/brand/kcalculate-logo.svg`, `BrandLogo`) + **bir boşluk** + "AI". Boşluk artık Bricolage Bold'un gerçek boşluk genişliği (hmtx 230/1000 em; önceden yüksekliğin %25'i). "AI" Bricolage Bold (mevcut işaretin fontu), cap-height = logo yüksekliği. Renk kuralı aynı: tema metin rengi (açıkta siyah, koyuda beyaz) ya da çağıranın rengi (lime kartta siyah).
2. Yeni prop'lar: `suffix` (aynı satır, aynı font: "AI Koç" / "AI Coach"), `role` ('header'), `kcalAiHeightFor(fontSize, 'heading'|'body')` (yerine geçtiği yazının cap-height'ı: Bricolage 0,66 · Plus Jakarta 0,745, OS/2 sCapHeight).
3. **Tek bileşen, tüm işaret konumları:** Paywall (zaten) · abonelik sonucu (zaten) · **Koç Ana sayfa kartı** başlığı · **Koç sohbet başlığı** · **Koç tanıtım başlığı** · **Profil › Kcalculate AI grup başlığı** (`ProfileAiSectionLabel`, Profil ekranı + `ProfileSubSection`). Düz yazı olarak çizilen eski işaret kalmadı.
4. **md.2 Metinler:** görünen her "kcalAI" → "Kcalculate AI" (TR + EN): abonelik, Koç, rıza, plan, kişisel plan, kayıt/onboarding, ses, tarama, hesap silme, metrik panel etiketleri. Kimlikler (`kcalai_*`), RevenueCat adları, olay/bayrak/dosya/bileşen adları, DB değerleri değişmedi.
5. **Uzunluk:** "Kcalculate AI planları (çok yakında)" düğmeleri (tarama hata sayfası + limit sayfası) tek satır + sabit 52 pt'ydi → 2 satıra kırılır, `minHeight` 52 (küçültme yok). Diğer değişen metinlerde `numberOfLines`/`adjustsFontSizeToFit` yok (taranarak doğrulandı). İşaret 1,3× Dynamic Type'ta logo + "AI" birlikte büyür; satır `flexWrap`.
6. **Kontroller** (son kod `8e38a76` + vitrin sahnesi): hygiene ✓ · tsc ✓ · unit 1361/1361 ✓ · jest 119 paket / 816 test / 3 anlık görüntü ✓ (`--ci`). `expo export` iOS ✓ (3435 modül) Android ✓ (3442 modül).
7. Ekran görüntüleri `docs/night/g52/` (açık + koyu): Ana sayfa Koç kartı, Koç sohbet başlığı, Paywall, Profil abonelik grubu.

## Commit
| commit | içerik |
|---|---|
| `8e38a76` | md.1 + md.2: `KcalAiMark`, işaret konumları, metinler, uzun düğme, testler |
| (sonraki) | docs(g52): vitrin sahnesi `G39-Profile` + ekran görüntüleri + bu LOG |
| (son) | `docs/night/G52-S1-DONE` |

## Değişen dosyalar
| dosya | ne |
|---|---|
| `src/modules/subscription/ui/KcalAiMark.tsx` | boşluk = boşluk karakteri, `suffix`, `role`, `kcalAiHeightFor`, `CAP_HEIGHT`, fontScale ≤ 1,3, varsayılan etiket "Kcalculate AI" |
| `src/modules/coach/ui/entries.tsx` | Ana sayfa kartı başlığı → işaret (13 pt gövde cap-height 9,7; satır yüksekliği 24 korunur) |
| `src/modules/coach/screens/CoachChatScreen.tsx` | başlık → işaret (19 pt Bricolage; satır 24 korunur) |
| `src/modules/coach/screens/CoachIntroScreen.tsx` | başlık → işaret (26 pt; `role="header"`, satır 32 korunur) |
| `src/modules/subscription/ui/ProfileSubSection.tsx` | `ProfileAiSectionLabel` (13 pt gövde kalın cap-height, ikincil renk) |
| `src/modules/profil/ui/screens/FinPrProfileScreen.tsx` | grup başlığı → `ProfileAiSectionLabel` |
| `src/modules/coach/i18n.ts` | `coach.mark_suffix` (Koç / Coach) + metinler |
| i18n: `core/i18n/dictionaries.ts`, `lib/subscription/i18n.ts`, `lib/consent/i18n.ts`, `modules/{plan,kayit,personalPlan}/i18n.ts`, `modules/ai/scan/voice/i18n.ts`, `lib/metrics/events.ts` (yalnız tr/en etiketleri) | "kcalAI" → "Kcalculate AI" |
| `src/modules/ai/scan/ui/FinScanErrorSheet.tsx`, `ScanLimitSheet.tsx` | uzun etiket 2 satır, `minHeight` |
| `src/dev/screenCatalog.ts` | yalnız `__DEV__` vitrin: `G39-Profile(-Dark)` |
| testler | `g39Brand` (boşluk 0,23 em, 1,3× tavanı, etiket; sözlükte "kcalAI" yok; `coach.name` = "Kcalculate AI " + ek), `g39CoachCard` (açık/koyu işaret + renk), `g24Coach` (sohbet + tanıtım işareti), `g25Yakinda` (Profil grup işareti), `g22Subscription`, `g36Preview`, `g44Kayit` (onboarding metin özeti: tek fark çevrilerek G42 özetine eşit + yeni özet), `g49HomeProfile` anlık görüntüsü (Koç kartı başlığı) |

## Ekran görüntüleri (`docs/night/g52/`, "G40 iPhone" 402 pt)
- `G52-HomeCoach(-Dark).jpg`: profilli Ana sayfa, Koç kartı (lime, iki temada siyah işaret "AI Koç")
- `G52-CoachChat(-Dark).jpg`: sohbet başlığı işareti + "Merhaba, ben Kcalculate AI Koç"
- `G52-PaywallFresh(-Dark).jpg`: üst işaret + "Günde 50 AI tarama ve Kcalculate AI Koç"
- `G52-Profile(-Dark).jpg`: Profil › Kcalculate AI grup başlığı işareti + "Abonelik · Kcalculate AI planları" + AI Koç

Yöntem: Metro bu worktree'den (8146, CI kipi, `--clear`), storage kipi (bekleyen pano AsyncStorage'a, uygulama `--initialUrl` ile yeniden açıldı; betik repo dışında, G14 betiğinin aynısı). Native derleme yok. Mevcut G39 sahneleri + yeni `G39-Profile`. Çekimden sonra Metro durduruldu, simülatör kapatıldı. İlter'in "iPhone 17" simülatörüne dokunulmadı.

## `grep -rI "kcalAI" src` (testler hariç, 52 satır)
Hepsi yorum, yalnız iki istisna:
- `src/core/flags/registry.ts:55`: satır sonu yorumu (`abonelik: false, // G22-S1: kcalAI …`)
- `src/lib/subscription/purchases.ts:100`: geliştirici log etiketi `console.warn('[kcalAI] …')`. Kullanıcıya görünmüyor, kimlik gibi bırakıldı.

Tam liste:
- `src/core/flags/registry.ts:55`
- `src/core/flags/registry.ts:56`
- `src/core/i18n/dictionaries.ts:44`
- `src/navigation/types.ts:90`
- `src/navigation/types.ts:93`
- `src/navigation/AppNavigator.tsx:114`
- `src/navigation/AppNavigator.tsx:449`
- `src/navigation/AppNavigator.tsx:657`
- `src/navigation/AppNavigator.tsx:660`
- `src/screens/TrackerScreen.tsx:2998`
- `src/components/icons.ts:24`
- `src/lib/subscription/i18n.ts:1`
- `src/lib/subscription/i18n.ts:107`
- `src/lib/subscription/purchases.ts:100`
- `src/lib/metrics/events.ts:177`
- `src/lib/metrics/events.ts:192`
- `src/lib/consent/i18n.ts:51`
- `src/lib/subscription/plans.ts:1`
- `src/lib/subscription/limits.ts:9`
- `src/modules/profil/ui/finUi.tsx:239`
- `src/modules/profil/ui/screens/FinPrProfileScreen.tsx:106`
- `src/modules/profil/ui/screens/FinPrProfileScreen.tsx:293`
- `src/modules/kayit/ui/parts.tsx:121`
- `src/modules/profil/ui/screens/SettingsDataConsentScreen.tsx:101`
- `src/modules/subscription/ui/SubResult.tsx:93`
- `src/modules/subscription/screens/SubProfileScreen.tsx:68`
- `src/modules/subscription/screens/PaywallScreen.tsx:4`
- `src/modules/subscription/screens/PaywallScreen.tsx:14`
- `src/modules/subscription/screens/PaywallScreen.tsx:246`
- `src/modules/coach/model.ts:1`
- `src/modules/coach/i18n.ts:1`
- `src/modules/coach/client.ts:1`
- `src/modules/coach/ui/entries.tsx:1`
- `src/modules/coach/ui/entries.tsx:5`
- `src/modules/coach/ui/Composer.tsx:1`
- `src/modules/coach/types.ts:1`
- `src/modules/coach/ui/sheets.tsx:1`
- `src/modules/coach/ui/mascot.ts:1`
- `src/modules/subscription/ui/ProfileSubSection.tsx:1`
- `src/modules/subscription/ui/ProfileSubSection.tsx:39`
- `src/modules/coach/screens/CoachChatScreen.tsx:1`
- `src/modules/coach/screens/CoachChatScreen.tsx:4`
- `src/modules/coach/screens/CoachIntroScreen.tsx:1`
- `src/modules/coach/access.ts:1`
- `src/modules/coach/ui/cards.tsx:1`
- `src/modules/ai/scan/screens/ScanScreen.tsx:85`
- `src/modules/ai/scan/screens/ScanScreen.tsx:849`
- `src/modules/coach/actions.ts:1`
- `src/modules/coach/ui/parts.tsx:1`
- `src/modules/coach/ui/CoachHomeMascot.tsx:1`
- `src/modules/ai/scan/ui/ScanLimitSheet.tsx:2`
- `src/modules/onboarding/consent/ConsentSheet.tsx:16`

## HIG (kod denetimi)
- Dynamic Type: işaret yazı ölçeğiyle büyür (en çok 1,3×; logo ve "AI" orantısı korunur), satır `flexWrap`; kırpılma yok. Uzun düğmeler 2 satıra kırılır, küçültme yok.
- VoiceOver: işaret tek öğe, etiket "Kcalculate AI" / "Kcalculate AI Koç"; tanıtımda başlık özelliği (`role="header"`). Sohbet başlığı mevcut gruplu başlık etiketini kullanmaya devam ediyor.
- Kontrast: işaret tema metin rengi (açık #0A0A0A, koyu beyaz), lime kartta siyah (≥ 7:1), Profil'de ikincil renk (FinSectionLabel ile aynı).
- Dokunma alanı / hareket: değişmedi.

## KARAR
1. **Boşluk = Bricolage Bold boşluk karakteri (0,23 em).** Brif "bir boşluk" diyor. G39'daki "yüksekliğin %25'i" (≈ 0,165 em) dar kalıyordu. Paywall ve sonuç işaretleri de bu boşlukla çiziliyor.
2. **"AI"dan sonraki ek aynı fontta (Bricolage Bold).** "Kcalculate AI Koç" başlıkları logo + "AI Koç" olarak çiziliyor. Tek metin düğümü olduğu için taban çizgisi ortak.
3. **İşaret yüksekliği = yerine geçtiği yazının cap-height'ı.** Koç kartında 13 pt Plus Jakarta (9,7 pt), sohbette 19 pt Bricolage (12,5), tanıtımda 26 pt (17,2), Profil grubunda 13 pt (9,7). Eski satır yükseklikleri (24/24/32) sarmalayıcıyla korunuyor, kart ve başlık düzeni kaymıyor.
4. **Profil grup başlığı da işaret oldu.** Önceden düz "Kcalculate AI" yazısıydı; brif "Profil grubu"nu işaret konumu sayıyor. eatkcal grup başlığı zaten logo olduğu için iki grup tutarlı.
5. **İşaret Dynamic Type ile büyüyor (≤ 1,3×).** G39'da hiç büyümüyordu; HIG ve brifteki 1,3× kuralı için logo + "AI" birlikte ölçekleniyor. `allowFontScaling={false}` kaldı: ölçek elle uygulanıyor, orantı bozulmasın diye.
6. **Metrik panel etiketleri** (`events.ts` tr/en) görünen metin sayıldı ve değişti. Olay adı (`coach_opened` vb.) aynı.
7. Kullanılmayan `sub.profile.section` anahtarı ("Kcalculate AI") silinmedi (iki dilde de var, zararsız).

## CANLIYA UYGULANACAK
- Yok (migration yok).

## DEPLOY GEREKİR
- Yalnız JS. Bir sonraki 1.1.0 OTA / build ile gider; bu oturumda deploy yapılmadı.

## SORULAR
- **Sunucu istemleri hâlâ "kcalAI" diyor:** `supabase/functions/coach-chat/prompt.ts:48` ("You are kcalAI Coach…"), `supabase/functions/meal-plan-generate/rank.ts:60,68` ("kcalAI Coach" / "Sen kcalAI Koç'sun"). Koç yanıtlarında kendini "kcalAI" diye tanıtabilir. Bu tur yalnız JS (OTA), deploy yasak ve backend commit'leri main'e cherry-pick gerektiriyor; bu yüzden dokunulmadı. Ayrı bir backend turunda "Kcalculate AI" yapılıp fonksiyonlar deploy edilmeli. Migration/yorum satırlarındaki geçişler tarihsel, değişmez.
- Sohbet boş hâlindeki "Merhaba, ben Kcalculate AI Koç" 402 pt'de iki satıra kırılıyor ("… Kcalculate AI / Koç"). Kırpılma yok. "AI Koç" arasına bölünmez boşluk istenirse tek satırlık değişiklik.
