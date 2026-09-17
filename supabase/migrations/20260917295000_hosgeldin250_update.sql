-- HOSGELDİN250 kampanyasını YERİNDE güncelle (yeni kayıt açılmıyor —
-- campaign_uses geçmişi, id'ye bağlı olduğu için korunur). Kod, Türkçe
-- karakterli "İ" yerine ASCII "I" olacak şekilde düzeltildi; min_cart_total
-- 0'dan 650'ye çıkarıldı; first_order_only=true ile telefon/adres/kart/
-- fingerprint tabanlı kötüye kullanım engeli devreye alındı.
update public.campaigns
set code = 'HOSGELDIN250',
    first_order_only = true,
    min_cart_total = 650
where id = '1e841ba8-6eaf-48fa-97aa-3d344f2577a6';
