-- ROLLBACK — 20261102000400_tracking_schema
-- Taslak tracking şemasını ve tüm içeriğini kaldırır.
-- DİKKAT: şema silinince içindeki veri de silinir (bu taslakta veri taşınmadığı
-- için prod'da boş olmalı).

begin;

drop schema if exists tracking cascade;

commit;
