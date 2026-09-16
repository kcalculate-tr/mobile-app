-- ACİL: orders.payment_provider varsayılanı 'tosla' idi. Draft oluşturma
-- (createOrderDraftForPayment, createMacroPurchaseOrder) bu kolonu hiç
-- yazmıyor; init fonksiyonu hiç çağrılmadan terk edilen (expired) siparişler
-- bu yüzden gerçekte hiçbir sağlayıcıya hiç gitmediği halde 'tosla' görünüyordu
-- — analitik/rapor sorgularını yanıltıyordu. Doğrulandı: son 90 gündeki 28
-- "tosla" siparişinin 26'sı payment_status=pending/status=expired (hiç
-- ödemeye gitmemiş terk edilmiş taslak), 1'i admin'in ₺0 test siparişi,
-- 1'i failed/cancelled — gerçek yakın zamanlı Tosla trafiği yok.
alter table public.orders
  alter column payment_provider drop default;
