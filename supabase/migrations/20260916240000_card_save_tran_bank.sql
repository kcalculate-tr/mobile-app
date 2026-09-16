-- Kayıtlı kart ödeme (Paynkolay "Saklı Kart" akışı) için eksik kolonlar.
-- Her iki tablo da 0 satır — veri kaybı riski yok.

-- cs_tran_id: Paynkolay kart listesinden dönen TranId. CardStorageCardDelete
-- hash formülü sx|customerKey|tranId|token|secret TranId İSTER (token'la
-- birlikte); token yeterli olsa da resmi formül boş bırakılırsa hash kayar,
-- bu yüzden sakli tutuluyor.
alter table public.user_card_secrets
  add column if not exists cs_tran_id text;

-- bank_name: mevcut şemada last4/brand var ama banka adı için kolon yoktu.
-- Kart Saklama görevinin 3. adımı ("maskeli kart / banka / marka bilgisini
-- user_cards'a yazsın") bunu gerektiriyor.
alter table public.user_cards
  add column if not exists bank_name text;
