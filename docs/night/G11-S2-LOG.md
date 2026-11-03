# G11-S2 — Yeni kabuk (TabBarR3, sekmeler, Tara, geçişler, geliştirici önizlemesi)

## Özet (10 satır)
1. `yeni_kabuk: false` kayıt defterine eklendi; bayrak KAPALIYKEN uygulama 1.0.7 ile bire bir aynı (eski `CustomTabBar`/`TabNavigator` bayt bayt dokunulmadı).
2. `src/modules/shell/TabBarR3.tsx`: t20/TabBarR3 tasarımı birebir — cam hap (expo-blur), 4 sekme, aktif bubble, ayrık yuvarlak "Tara", tam/küçük durumlar, açık+koyu, TR/EN; ikonlar tasarım SVG yollarıyla `react-native-svg`.
3. Hareket yalnız `core/design/motion` token/hook'larıyla: açılışta bar aşağıdan yükselir (SPRING.ai), aktif gösterge nokta→hap morfu (TIMING.enter) + sekme değişiminde kayar (SPRING.ai), Tara `usePop`, küçülme/büyüme (DURATION.emphasis), REDUCED destekli; sekme İÇERİĞİ geçişi YOK.
4. `AppNavigator`: `useFeature('yeni_kabuk')` AÇILIŞTA BİR KEZ okunup donduruluyor (`useColdStartFeature`) → `TabNavigatorR3` ya da bugünkü `TabNavigator`; çalışma anı değişimi navigasyonu bozmaz, sonraki soğuk açılışta uygulanır.
5. R3 rotaları ad korumalı: `Tracker`(Ana sayfa) · `KesfetTab`(Keşfet; `kesfet` kapalıysa yok; `initialParams {asTab:true}`) · `Home`(eatkcal) · `Profile`; gizli `Cart`/`Subscriptions`; oturum kapıları bugünküyle aynı; açılış sekmesi kuralı; eatkcal sekmesinde sepet hapı → Cart.
6. AI stack geçişleri `AI_PUSH`/`AI_MODAL` ile DURATION.base token'ına bağlandı (Kesfet/Composer/PublicProfile/AiScan/SharedPost/SharedProfile/KcalAiSignUp); eatkcal rotalarına dokunulmadı.
7. `src/modules/shell/layout.ts` (`TAB_BAR_R3_HEIGHT`=96) + `scroll.tsx` (`useTabBarCollapse(scrollY)` + `TabBarCollapseProvider`/`useTabBarCollapsedValue`); ekranlara bağlamak S6'nın işi.
8. `linking.ts`: `kesfet` yolu kök `Kesfet` ekranına (iki kabukta da); gönderi/profil (`p/:postId`, `u/:handle`) zaten kabuktan bağımsız.
9. Geliştirici önizlemesi (yalnız __DEV__): Tanı ekranına "🚀 Yeni uygulamayı aç" ön ayarı + ayrı `restoran_yakında` + "Hepsini sıfırla"; Tasarım vitrinine "Bayraklar ve geliştirici ekranları →" çipi (Tanı'ya gider). Mock veri erişimi mevcut "Keşfet ve profil (veri)" linki.
10. Kontrol: `tsc --noEmit`=0 · `test:unit` 413/413 · `test:components` 36/36 (yeni TabBarR3+parite testleri dahil) · `expo export --platform ios` ✓. i18n `shell` ad alanı (tr+en) `common`'dan hemen sonra eklendi.

## Yapılan — dosyalar
- `src/core/flags/registry.ts` — `yeni_kabuk: false`.
- `src/modules/shell/` (YENİ): `TabBarR3.tsx`, `icons.tsx`, `layout.ts`, `scroll.tsx`, `tabs.ts`, `index.ts`, `__tests__/tabs.test.ts`, `__component_tests__/TabBarR3.test.tsx`.
- `src/navigation/AppNavigator.tsx` — `useColdStartFeature`, `TabNavigatorR3`, `TabsRoot`, AI geçiş token'ları; `Tabs` ekranı `TabsRoot`'a bağlandı. Eski `TabNavigator` DOKUNULMADI.
- `src/navigation/types.ts` — `TabParamList.KesfetTab`.
- `src/navigation/linking.ts` — `Kesfet: 'kesfet'`.
- `src/screens/DevDiagnosticsScreen.tsx` — ön ayar düğmeleri.
- `src/screens/DesignShowcaseScreen.tsx` — GELİŞTİRİCİ çipi.
- `src/core/i18n/dictionaries.ts` — `shell` ad alanı (tr+en).

## Test
- `npx tsc --noEmit` → 0 hata.
- `npm run test:unit` → 413 pass / 0 fail (yeni: `shell/__tests__/tabs.test.ts`, 9 test).
- `npm run test:components` → 36 pass / 0 fail (yeni: `shell/__component_tests__/TabBarR3.test.tsx`, 6 test; eski `CustomTabBar` paritesi dahil).
- `npx expo export --platform ios` → başarılı (exit 0).

## ENTEGRASYONA (S6 / ilgili oturumlar uygular)
- **S6 — kaydırınca küçülme bağlama:** Keşfet (`modules/kesfet/ui/KesfetScreen`) ve Tracker (`screens/TrackerScreen`) listelerinde bir `const scrollY = useSharedValue(0)` + `useTabBarCollapse(scrollY)` (from `src/modules/shell`) kullanıp `onScroll`'u `useAnimatedScrollHandler`'a bağla (`scrollY.value = e.contentOffset.y`). Liste `Animated.FlatList`/`Animated.ScrollView` olmalı.
- **S6 — alt boşluk sabiti:** S3/S4 paralel aşamada `route.params?.asTab` için `insets.bottom + 96` kullandı. S6 bunu `insets.bottom + TAB_BAR_R3_HEIGHT` (import `src/modules/shell`) ile değiştirsin (aynı değer; tek kaynak).
- **S3 — KesfetTab asTab:** `KesfetTab` sekmesi `initialParams: { asTab: true }` ile açılıyor; `KesfetScreen` sekme bağlamında alt boşluğu `asTab` ile vermeli (zaten sözleşmede S3 işi; burada rota kuruldu).
- **S1 — sunucu bayrak satırı:** `feature_flags`'e `yeni_kabuk` (enabled false, rollout_percent 0, min_app_version '1.1.0'). Yerel varsayılan S2'de eklendi.
- **Açılış sekmesi (Tracker-ilk):** `resolveInitialShellTab` sipariş geçmişini mevcut önbellekten alamıyor (kalıcı sipariş geçmişi store'u YOK) → oturumlu kullanıcıda `Home` açılıyor. S4/S6 bir sipariş-geçmişi sinyali (ör. son sipariş önbelleği) sağlarsa `TabNavigatorR3`'teki `hasOrderHistory` parametresine geçirilsin; `hasOrderHistory===false` iken Tracker-ilk kuralı kendiliğinden devreye girer.

## SORULAR
- Yok. (Tara basışında `usePop` kullanıldı — sözleşme madde 3 "Tara basışta usePop + haptic" diyor; `usePop` içindeki `success` haptiği günde 3 ile sınırlı olduğundan taşma zararsızca yutulur.)
