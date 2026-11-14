-- G48-S1 md.4 — eatkcal konum kapısı olayları. DURUM: YALNIZ DOSYA (canlıya UYGULANMADI).
-- İdempotent: tekrar çalıştırmak güvenli. Rollback: supabase/rollbacks/20261114200100_g48_eatkcal_gate_events_rollback.sql
-- Önkoşul: analytics_event_names (D-S1, yoksa atlanır). src/lib/metrics/events.ts ile birebir.
-- Kişisel veri YOK: telefon / e-posta / restoran adı olaya yazılmaz (yalnız ülke, şehir, ilçe, hizmet var/yok, form türü).
begin;

do $$
begin
  if to_regclass('public.analytics_event_names') is null then
    raise notice 'g48_eatkcal_gate_events: analytics_event_names yok — olay satırları atlandı';
    return;
  end if;
  insert into public.analytics_event_names
    (name, category, source, description_tr, description_en, props_hint, alias_of, is_kpi)
  values
    ('eatkcal_gate_view', 'commerce', 'client', 'eatkcal konum kapısı görüldü', 'eatkcal location gate viewed', 'state: address|soon', null, false),
    ('eatkcal_gate_select', 'commerce', 'client', 'eatkcal konum kapısında konum seçildi', 'eatkcal location gate selection', 'country, city, district, served: bool', null, false),
    ('eatkcal_waitlist_submit', 'commerce', 'client', 'eatkcal bekleme listesi formu gönderildi', 'eatkcal waitlist form submitted', 'kind: restaurant_add|restaurant_suggest', null, false)
  on conflict (name) do nothing;
end $$;

commit;
