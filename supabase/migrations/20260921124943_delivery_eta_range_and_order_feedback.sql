-- 1) Teslimat süresi ARALIĞI
-- Mevcut estimated_delivery_minutes tek bir sayı tutuyordu ("45 dk"). Müşteriye
-- dürüst bir aralık göstermek için üst sınır kolonu eklendi; mevcut kolon artık
-- aralığın ALT sınırı. max null ise app "~X dk" diye tek sayı gösterir.
alter table public.delivery_zones
  add column if not exists estimated_delivery_minutes_max int;

comment on column public.delivery_zones.estimated_delivery_minutes is
  'Tahmini teslimat süresi alt sınırı (dk).';
comment on column public.delivery_zones.estimated_delivery_minutes_max is
  'Tahmini teslimat süresi üst sınırı (dk). Null ise tek sayı gösterilir.';

update public.delivery_zones
   set estimated_delivery_minutes = 30,
       estimated_delivery_minutes_max = 45,
       updated_at = now()
 where district in ('Karabağlar', 'Konak');

update public.delivery_zones
   set estimated_delivery_minutes = 45,
       estimated_delivery_minutes_max = 55,
       updated_at = now()
 where district in ('Balçova', 'Narlıdere');

-- 2) Teslimattan sonra geri bildirim push şablonu
insert into public.notification_templates (key, category, title_template, body_template, deep_link, is_active)
values (
  'order_feedback',
  'behavioral',
  'Deneyimin nasıldı? ⭐',
  'Görüşlerine önem veriyoruz. Hizmet kalitemizi artırmak için 1 dakikanı ayırır mısın?',
  'Feedback',
  true
)
on conflict (key) do update
  set title_template = excluded.title_template,
      body_template  = excluded.body_template,
      deep_link      = excluded.deep_link,
      is_active      = true,
      updated_at     = now();
