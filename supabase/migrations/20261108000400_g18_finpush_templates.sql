-- G18-S4 md.3 — FinPush: 4 şablon (sipariş durumu · seri · sosyal · hatırlatma).
-- YALNIZ DOSYA — CANLIYA UYGULANACAK (Claude/İlter). Geriye uyumlu: yalnız yeni
-- `fin_*` anahtarları eklenir/güncellenir; mevcut şablonlara dokunulmaz.
-- Metinler `supabase/functions/send-notification/finPushTemplates.ts` ve istemci
-- `src/core/push/finPush.ts` ile birebir (TR). Başlık ≤ 35, gövde ≤ 90.
-- Dokunma yönlendirmesi `data.fin` ile (çağıran `data` içinde verir); deep_link yok.
insert into public.notification_templates (key, category, title_template, body_template, deep_link, is_active)
values
  ('fin_order_status', 'transactional', 'Siparişin yolda',
   '{{order}} numaralı siparişin kuryede. Tahmini varış {{min}} dk.', null, true),
  ('fin_streak', 'reminder', 'Serin {{n}}. gününde',
   'Bugün bir öğün logla, serin devam etsin. Gün bitmeden vaktin var.', null, true),
  ('fin_social', 'behavioral', '{{name}} yorum yaptı',
   'Paylaşımına yorum yazdı: “{{excerpt}}”', null, true),
  ('fin_reminder_breakfast', 'reminder', 'Kahvaltı öğününü henüz loglamadın',
   'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.', null, true),
  ('fin_reminder_lunch', 'reminder', 'Öğle öğününü henüz loglamadın',
   'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.', null, true),
  ('fin_reminder_dinner', 'reminder', 'Akşam öğününü henüz loglamadın',
   'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.', null, true),
  ('fin_reminder_snack', 'reminder', 'Ara öğününü henüz loglamadın',
   'Şimdi loglarsan günlük dengen güncel kalır. Bir dokunuşla ekleyebilirsin.', null, true)
on conflict (key) do update
  set title_template = excluded.title_template,
      body_template  = excluded.body_template,
      category       = excluded.category,
      is_active      = true,
      updated_at     = now();
