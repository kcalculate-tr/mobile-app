-- G18-S5: 20261108000400_g18_finpush_templates.sql geri alma.
-- Migration yalnız yeni `fin_*` anahtarları ekliyor (mevcut şablonlara dokunmuyor) →
-- geri alma yalnız bu 7 anahtarı siler. Gönderim kodu `fin_*` bulamazsa bildirim atmaz.
delete from public.notification_templates
 where key in (
   'fin_order_status', 'fin_streak', 'fin_social',
   'fin_reminder_breakfast', 'fin_reminder_lunch', 'fin_reminder_dinner', 'fin_reminder_snack'
 );
