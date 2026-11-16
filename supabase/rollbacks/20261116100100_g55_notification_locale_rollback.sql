-- G55-S1 rollback — 20261116100100_g55_notification_locale.sql geri alınır.
-- UYARI: İngilizce metinler ve token dilleri silinir. send-notification (G55) kolonlar
-- olmadan da çalışır (herkes TR; kampanya sayaç alanları düşürülür) — önce fonksiyonu
-- geri almak gerekmez.
begin;

alter table public.push_tokens drop constraint if exists push_tokens_locale_check;
alter table public.push_tokens drop column if exists locale;

alter table public.notification_templates
  drop column if exists title_template_en,
  drop column if exists body_template_en;

alter table public.notification_campaigns
  drop column if exists title_en,
  drop column if exists body_en,
  drop column if exists skipped_count,
  drop column if exists error_message;

commit;
