-- Torbalı teslimata kapatılıyor: 60 mahalle, iki şubeye de uzaklığı makul
-- değil ve hiçbirine bağlanmadı. Satırlar silinmiyor, yalnız pasifleştiriliyor —
-- ileride şube açılırsa ücret/süre bilgileriyle birlikte geri açılır.
update public.delivery_zones
   set is_active = false,
       allow_immediate = false,
       allow_scheduled = false,
       updated_at = now()
 where district = 'Torbalı' and is_active;;
