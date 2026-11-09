# Günlük takip · Gün halkası · Su · Etkinlik · Seri — açılış kontrol listesi (G19-S2, 9 Kas)

Dal `night19/track` (taban `night18/release`). Bu liste bayrakları **herkese** açmadan önce
sırayla işaretlenir. Bayrak değişikliği = `feature_flags` satırı (Supabase); uygulama
1.1.0+ (`min_app_version`). Kapatma anahtarı her adımda aynı satırın `enabled=false`'u —
uygulama bir sonraki bayrak okumasında (açılış / ön plan) eski davranışa döner.

## 0. Ön koşullar (bir kez)
- [ ] 1.1.0 mağazada; yeni kabuk paketinde native değişiklik yok (bu dal yalnız JS/OTA).
- [ ] Migration'lar uygulandı (sırayla): `20261106000100_g15_water.sql` (su), `20261108000400_g18_finpush_templates.sql`
      (fin_* şablonları), D-S1 `20261109100300_d_s1_kpi.sql` (olay sözlüğü), **`20261109200100_g19_s2_track.sql`**
      (ogun_hatirlatma satırı · etkinlik üst sınırı · 7 takip olayı). Her birinin rollback'i `supabase/rollbacks/`.
- [ ] Ön kontrol SQL'i: `select key, enabled, rollout_percent, min_app_version from feature_flags where key in
      ('yeni_kabuk','gun_halkasi','su_takibi','etkinlik','ogun_hatirlatma','ai_tarama');`
- [ ] `select count(*) from activity_logs where minutes > 600 or distance_km > 300;` = 0 değilse NOT VALID CHECK
      yeni yazımları yine denetler; eski satırlar için karar (İlter).

## 1. Bayrak planı
| Bayrak | Ne açar | Bağımlı | %10 | %50 | %100 | Kapatma etkisi |
|---|---|---|---|---|---|---|
| `yeni_kabuk` | Yeni Ana sayfa (FinHomeR3), sekme çubuğu, kayıt kuyruğu, gece yarısı yenileme | — | 1. gün | 3. gün | 7. gün | 1.0.7 Tracker AYNEN (bayrak kapalı snapshot testi) |
| `gun_halkasi` | Gün halkası şeridi + görüntüleyici (FinGunView/End/Done/Empty) | yeni_kabuk | yeni_kabuk %50 ile | %100 | %100 | şerit gizlenir |
| `su_takibi` | Su halkası sunucuda (water_daily + log_water) | yeni_kabuk | %10 | %50 | %100 | cihaz içi 8 bardak sayacı (özellik kaybı yok) |
| `etkinlik` | "Bugünkü etkinlikler" + Etkinlik ekle + Geri al | yeni_kabuk | %10 | %50 | %100 | bölüm gizlenir |
| `ogun_hatirlatma` | Öğün saatinde kayıt yoksa yerel bildirim (10:30 · 14:30 · 21:00 İstanbul) | yeni_kabuk | yeni_kabuk %100'den **sonra** %10 | %50 | %100 | kurulu hatırlatmalar bir sonraki açılışta iptal edilir |

Kural: bir bayrak bir üst adıma ancak **2. bölümdeki alarmlar 48 saat yeşilse** çıkar.

## 2. İzlenecek metrikler ve alarmlar
| Metrik (kaynak) | Sağlıklı | Alarm → eylem |
|---|---|---|
| `log_add` / DAU (analytics_events) | açılış öncesi 1.0.7 log oranı ±%20 | %30 düşüş → `yeni_kabuk` bir adım geri |
| `log_add{offline:true}` payı | < %5 | > %15 → kuyruk boşalmıyor olabilir; Sentry `[home]`/queue hataları |
| `log_delete{undone:false}` / `log_add` | < %10 | > %20 → yanlış kayıt / çift kayıt şüphesi (aynı dakikada aynı kcal) |
| Kalıcı kuyruk hatası (Alert "Kaydedilemedi" + Sentry) | ~0 | > 0,5 % kullanıcı → RLS/CHECK (42501/23514) incele |
| `water_add{undo:true}` / `water_add` | < %15 | yüksekse dokunma alanı yanlış tetikleniyor |
| `streak_day` / DAU, `ring_complete` / DAU | izleme | ani düşüş → gün sınırı / kova hatası (aşağıdaki SQL ile karşılaştır) |
| Gün toplamı tutarlılığı | 0 fark | `get_nutrition_summary` ile istemci toplamı farkı → md.1 kuralı (aşağıda) |
| Bildirim: `ogun_hatirlatma` açık kullanıcıda izin iptali (iOS ayar) | izleme | artış → saatleri/sıklığı düşür, bayrak %50'ye geri |

Gün sınırı kontrol SQL'i (canlıda salt-okuma):
```sql
select (consumed_at at time zone 'Europe/Istanbul')::date d, count(*), sum(calories)
  from meal_consumptions where user_id = '<test kullanıcı>' and consumed_at > now() - interval '3 days'
 group by 1 order by 1;
```

## 3. Doğruluk kuralları (koda yazılı + testli)
- **Gün sınırı = Europe/Istanbul gece yarısı**, cihaz saat dilimi ne olursa olsun (Berlin/New York/Tokyo testleri:
  `src/modules/gun/track/__tests__/g19track.test.ts`, testler 5 saat diliminde koşuldu). Yuva (kahvaltı/öğle/akşam/ara)
  ve satır saati de İstanbul saatiyle. Selamlama ("Günaydın") cihaz saatinde kalır.
- Gece yarısı geçince açık Ana sayfa yeni günü yükler (zamanlayıcı + ön plana dönüş kontrolü) — bileşen testi.
- **Toplam = kayıtların toplamı**; kcal satır başına tam sayı, P/K/Y ham toplam bir kez yuvarlanır (`track/totals.ts`).
- **Hedef yoksa** uydurma 2.000 yok: halkada "Hedef belirlenmedi", başlıkta "1.240 kcal, hedef belirlenmedi".
- **Seri**: o İstanbul gününde ≥ 1 öğün kaydı (0 kcal dahil); bugün kayıt yoksa dünden sayılır; su/etkinlik saydırmaz
  (sunucu `get_user_day_progress` ile aynı). Kutlama 3/7 kullanıcı başına bir kez, ekrana geldiği an işaretlenir;
  7 gösterildiyse 3 bir daha çıkmaz.

## 4. Elle doğrulama (gerçek cihaz, test kullanıcısı — gerçek sipariş YOK)
- [ ] 23:58'de Elle 300 kcal logla → 00:00'dan sonra uygulama açık beklerken liste boşalır, seri çipi değişmez.
- [ ] Uçak modunda Elle logla → "Çevrimdışı kaydedildi…" → ağ gelince satır sunucuda (ikinci cihazda görünür), çift kayıt yok.
- [ ] Kaldır → "Kayıt kaldırıldı · Geri al" → Geri al → aynı saat/kcal ile geri gelir.
- [ ] Kaydı başka öğüne taşı (⌄ Öğün) → yuva değişir, diğer cihazda odakla gelir.
- [ ] Su 250 ml × n → 20 L'de "su sınırı" toast'ı; Geri al yalnız eklenen kadar.
- [ ] Etkinlik 601 dk → Kaydet pasif + uyarı; 45 dk ekle → Geri al → satır kalkar.
- [ ] Bildirim izni açık + `ogun_hatirlatma` açık: öğle loglanmadan 14:30'da bildirim; "30 dk ertele" 15:00'te tekrar;
      "Bugün sessize al" → o gün başka öğün hatırlatması yok. Sessiz saat 20:30–08:00 → 21:00 hatırlatması gelmez.
- [ ] Cihaz dili EN: bütün yeni metinler EN.

## 5. Geri dönüş
- Uygulama: ilgili bayrak `enabled=false` (anında, OTA gerekmez).
- Veri: kuyruk istemci tarafında; bayrak kapanınca kuyruk okunmaz ama cihazda kalır, bayrak açılınca gönderilir
  (kayıp yok). Kalıcı silme gerekmez.
- Sunucu: `supabase/rollbacks/20261109200100_g19_s2_track_rollback.sql`.

## 6. Açık kalan / sonraki
- Sunucu tarafı hatırlatma (uygulama hiç açılmayan kullanıcı) bu sürümde YOK — yerel bildirim yalnız son 7 günde
  kaydı olana kurulur. Sunucu tarafı gerekiyorsa `send-notification` + pg_cron (fin_reminder_* şablonları hazır) — ayrı iş.
- Silinip geri alınan Tara kaydının fotoğrafı (`photo_path`) geri gelmez (istemci listesi bu kolonu okumuyor) — SORULAR.
