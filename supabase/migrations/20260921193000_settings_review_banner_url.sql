-- Değerlendirme pop-up'ının görseli. Daha önce ana sayfadaki kcalculate
-- marka banner'ından okunuyordu; markalar bölümündeki görsel değişince
-- pop-up da değişiyordu. Artık ayrı: boşsa marka görseline düşer.
alter table public.settings
  add column if not exists review_banner_url text;

comment on column public.settings.review_banner_url is
  'Sipariş değerlendirme pop-up''ındaki üst görselin URL''i (1200x400, 3:1). Boşsa uygulama kcalculate marka görseline düşer.';
