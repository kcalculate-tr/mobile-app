-- Geri alma: 20261108000100_g18_onboarding_state.sql
-- Kolon silme kuralı (RULES › Veritabanı) gereği kolon BIRAKILIR; yalnız bayrak satırları kaldırılır.
-- Kolonun kaldırılması gerekirse İlter kararıyla ayrı migration.
begin;
delete from public.feature_flags where key in ('onb_welcome_variant_b', 'onb_welcome_variant_c');
commit;
