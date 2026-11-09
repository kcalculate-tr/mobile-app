# L-S2 — Hukuk taslaklarına şirket kimliği — LOG

**Tarih:** 2026-11-09 · **Dal:** `legal/global` · **Worktree:** `.claude/worktrees/l-s2` (l-s1 worktree yoktu) · push yok
**Kapsam:** yalnız `docs/legal/` + bu LOG. Kod, uygulama/web metni, canlı DB değiştirilmedi. `kcal-web` yalnız okundu.

## ÖZET (10 satır)
1. Şirket adı tüm TR/EN taslaklarda ve iç belgelerde **SEKULART LTD** yapıldı (İlter kararı, 9 Kas).
2. MERSİS 0759-1148-7410-0001, VKN 7591148741, adres "Basın Sitesi Mah. 177/3 Sk. No:3A, 35150 Karabağlar / İzmir" dolduruldu (EN'de ", Türkiye").
3. Kaynak: yayındaki `kcal-web/apps/eatkcal/content/legal/mesafeli.ts` (yalnız okundu).
4. Vergi dairesi ve KEP mevcut metinlerde yok → satırlar kaldırıldı, yer tutucu bırakılmadı; BOSLUKLAR B-20'ye not.
5. KEP başvuru kanalı (aydınlatma listesi, başvuru formu, yanıt seçeneği) da kaldırıldı; listeler yeniden numaralandı.
6. KURUMSAL_KIMLIK: "kısa ad = tescilli ad" kuralı "SEKULART LTD her yerde" kararıyla güncellendi; footer/fatura örnekleri dolduruldu.
7. README, VERI_ENVANTERI başlığı, ENTEGRASYON `company_identity` (doldurulmuş JSON örneği) güncellendi.
8. Kontrol grep'i (TAM UNVAN / FULL LEGAL NAME / MERSİS / MERSIS / VKN / ADRES / ADDRESS / KEP) → 0 sonuç.
9. Kalan yer tutucular (e-posta kutuları, telefon, sicil no, yürürlük tarihi, kişi atamaları, işletme kararları) `docs/legal/L-S2-NOT.md`'de listelendi.
10. Tamamlanamayan kısım yok.

## Commit tablosu

| Commit | İş | Dosyalar |
|---|---|---|
| (1) | Kimlik işlendi + not + LOG | `docs/legal/**` (24 dosya), `docs/legal/L-S2-NOT.md`, `docs/night/L-S2-LOG.md` |
| (2) | DONE | `docs/night/L-S2-DONE` |

## KARAR
- "Değer teyit edilmeli" notları MERSİS yanından kaldırıldı: değer artık İlter kararıyla yayındaki metinden alınıyor.
- `MESAFELI_KARSILASTIRMA.md` kapsamda yoktu; satır 1 eski yer tutucu tarifini gösterdiği için yalnız o satır güncellendi.
- İhlal planındaki "Kurul'a gerekirse KEP ile bildirim" cümlesi ve başvuru formundaki Tebliğ md.5 inceleme notu, mevzuat tarifi olduğu için bırakıldı.
- Ticaret sicil no / sicil müdürlüğü yer tutucuları kapsam dışı bırakıldı (mevcut metinlerde yok, kaldırma talimatı da yoktu).

## CANLIYA UYGULANACAK
Yok.

## DEPLOY GEREKİR
Yok.

## SORULAR
- KEP zorunluluğu (TTK md.18/3) teyidi; adres alınırsa kimlik bloklarına ve KVKK başvuru kanallarına geri eklensin mi?
- Vergi dairesi adı (fatura sisteminden) — künyeye eklensin mi?
