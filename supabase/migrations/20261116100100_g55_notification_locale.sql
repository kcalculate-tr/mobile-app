-- G55-S1 md.0 + md.1 — bildirim dili + kampanya sayaçları.
-- DURUM: YALNIZ DOSYA (canlıya UYGULANMADI). İdempotent: tekrar çalıştırmak güvenli.
-- Rollback: supabase/rollbacks/20261116100100_g55_notification_locale_rollback.sql
--
-- 1) push_tokens.locale: uygulama (≥ G55 OTA) token kaydında arayüz dilini yazar.
--    Eski sürümler alanı yazmaz → varsayılan 'tr' (bugünkü davranış). Mevcut satırlar 'tr' olur.
-- 2) notification_templates.title_template_en / body_template_en,
--    notification_campaigns.title_en / body_en: boşsa (null/'') gönderim TR'ye düşer.
-- 3) notification_campaigns.skipped_count / error_message: by_campaign atlanan sayısını ve
--    hedef > 0 iken 0 gönderimde 'failed' nedenini yazar (14 Kas 829 hedef / 0 gönderim olayı).
--
-- SIRA: bu migration send-notification deploy'undan ÖNCE uygulanmalı. (Fonksiyon kolonlar
-- yoksa da çalışır — locale olmadan herkes TR, sayaç alanları düşürülür — ama dil desteği olmaz.)
begin;

-- 1) push_tokens.locale
alter table public.push_tokens
  add column if not exists locale text not null default 'tr';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.push_tokens'::regclass and conname = 'push_tokens_locale_check'
  ) then
    alter table public.push_tokens
      add constraint push_tokens_locale_check check (locale in ('tr', 'en'));
  end if;
end $$;

comment on column public.push_tokens.locale is
  'G55: bildirim dili (tr|en) — uygulama arayüz dilinden; eski sürümler yazmaz → tr';

-- 2) İngilizce metin alanları
alter table public.notification_templates
  add column if not exists title_template_en text,
  add column if not exists body_template_en text;

alter table public.notification_campaigns
  add column if not exists title_en text,
  add column if not exists body_en text;

-- 3) Kampanya sayaçları
alter table public.notification_campaigns
  add column if not exists skipped_count integer not null default 0,
  add column if not exists error_message text;

-- 4) Şablonların İngilizcesi (değişkenler TR ile aynı). Yalnız mevcut anahtarlar güncellenir;
--    satır yoksa hiçbir şey eklenmez.
update public.notification_templates t
set title_template_en = v.title_en,
    body_template_en  = v.body_en,
    updated_at        = now()
from (values
  ('cart_abandoned',         'Your cart misses you 🛒',                     'Finish your order before the good stuff gets cold 😋'),
  ('inactive_user',          'Where did you go? 🥺',                        'Your plate''s been empty. New dishes are waiting 🍲'),
  ('macro_reminder',         'Your macros are asking: what did we eat? 📊', 'Log it in one tap and call it a day.'),
  ('fin_reminder_breakfast', 'Breakfast, where are you? 🍳',                'Log it in one tap to keep your day balanced.'),
  ('fin_reminder_lunch',     'Lunch gone missing? 🥗',                      'Log it in one tap to keep your day balanced.'),
  ('fin_reminder_dinner',    'Did we forget dinner? 🍽️',                    'Log it in one tap to keep your day balanced.'),
  ('fin_reminder_snack',     'Don''t keep that snack a secret 🍎',          'Log it in one tap to keep your day balanced.'),
  ('fin_streak',             'Day {{n}} of your streak 🔥',                 'Log one meal today to keep the fire going.'),
  ('fin_social',             '{{name}} commented 💬',                       '“{{excerpt}}”'),
  ('order_feedback',         'How was it? ⭐',                              'Give us one minute and make our kitchen very happy 👨‍🍳'),
  ('coupon_expiring',        'Your coupon is leaving ⏰',                   'It''ll be heartbroken if you don''t use it. Don''t miss out!'),
  ('delivery_tomorrow',      'See you tomorrow 📅',                         'Take a quick look at your delivery details.'),
  ('subscription_renewal',   'Your membership renews soon 🔄',              'Your Macro membership renews in {{days}} days.'),
  ('order_confirmed',        'Order received 🎉',                           'The kitchen is warming up. We''ll keep you posted.'),
  ('order_preparing',        'Things are heating up in the kitchen 👨‍🍳',    'Your order is being prepared.'),
  ('order_shipped',          'We''re on our way 🚚',                        'Your order is with the courier. Almost there!'),
  ('fin_order_status',       'Your order is on the way 🛵',                 'Order {{order}} is with the courier, about {{min}} min.'),
  ('order_delivered',        'Enjoy your meal! 🍽️',                         'Your order is at your door. Tell us how it was 😊'),
  ('payment_failed',         'Payment hiccup 😕',                           'Mind trying once more? Your cart is waiting.')
) as v(key, title_en, body_en)
where t.key = v.key;

commit;
