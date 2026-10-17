-- Ödeme düşüş noktası — "neden tamamlanmadı" sorusunun cevabı.
--
-- 27.09.2026 tespiti: 167 sipariş status='expired', 173'ünde
-- payment_failure_reason BOŞ. PaymentScreen'in handleFailure'ı yalnızca
-- analytics olayı yazıyordu, sipariş satırına dokunmuyordu; müşteri ödeme
-- ekranından geri çıktığında ise hiçbir şey yazılmıyordu. Sipariş
-- pending_payment kalıyor, 10 dk sonra 'expire-abandoned-orders' cron'u
-- sessizce 'expired' yapıyor ve hangi aşamada koptuğu kayboluyor.
--
-- Biçim: "<sebep>@<aşama>" — ör. abandoned@provider_page
-- (bkz. src/lib/paymentDrop.ts, birim testleri var).
alter table public.orders
  add column if not exists payment_drop_stage text;

comment on column public.orders.payment_drop_stage is
  'Ödeme akışının koptuğu nokta: "<sebep>@<asama>". '
  'sebep: abandoned | failed | init_error · asama: init | provider_page | returned. '
  'Uygulama yazar; expire cron''u DOKUNMAZ.';

create index if not exists orders_payment_drop_stage_idx
  on public.orders (payment_drop_stage)
  where payment_drop_stage is not null;;
