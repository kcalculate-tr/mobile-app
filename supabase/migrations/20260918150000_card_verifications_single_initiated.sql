-- Kart Ekle: kullanıcı başına AYNI ANDA en fazla BİR açık ('initiated') doğrulama.
-- verify_start iki eşzamanlı istekte çift kayıt/çift 1 TL çekimi başlatmasın diye
-- kural DB'de zorunlu (uygulama katmanı yalnızca kullanıcı dostu mesajı üretir).
-- Zaman aşımına uğrayan kayıtlar 'failed' (note='timeout') yapılıp yeni deneme açılır.
create unique index if not exists card_verifications_one_initiated_per_user
  on public.card_verifications (user_id)
  where status = 'initiated' and user_id is not null;
