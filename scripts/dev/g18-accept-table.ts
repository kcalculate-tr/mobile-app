// G18-S5 md.3 — Final pano kabul tablosu (markdown) üretici.
// Girdi: g18-accept.ts TSV çıktısı. Her Final panosu için: uygulamadaki karşılık
// (katalog: rota yığını / bileşen sahnesi + durum), ölçüm, durum ve dayanaklı fark.
// Kullanım: npx tsx scripts/dev/g18-accept-table.ts <olcum.tsv> > tablo.md
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolvePano, type RouteSpec } from '../../src/dev/screenCatalog';

const ROOT = resolve(__dirname, '../..');
const REF = process.env.G18_REF ?? resolve(ROOT, '../../night/design/final/png');
const tsv = readFileSync(process.argv[2], 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
const rows = new Map(tsv.map((r) => [r[0], r]));
const finals = readdirSync(REF).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -5)).sort();

function routeName(rs: RouteSpec[]): string {
  const last = rs[rs.length - 1];
  if (!last) return '?';
  const p = last.params as { screen?: string } | undefined;
  if (last.state) return routeName(last.state.routes);
  return p?.screen ? `${last.name}›${p.screen}` : last.name;
}

function counterpart(p: string): string {
  const e = resolvePano(p);
  if (!e) return '— (katalogda yok)';
  const t = e.target;
  const where = t.kind === 'route' ? `rota ${routeName(t.routes)}` : `${t.kind === 'motion' ? 'hareket' : 'bileşen'} ${t.key}`;
  const st = [e.scene ? `sahne ${e.scene}` : '', e.data !== 'default' ? e.data : '', e.lang === 'en' ? 'EN' : '', e.scheme === 'dark' ? 'koyu' : '', e.textSize && e.textSize !== 'large' ? 'XL' : '']
    .filter(Boolean)
    .join(', ');
  return st ? `${where} (${st})` : where;
}

/** Eşiğin altındaki panolar için dayanak (kural / veri / ortam) — S1–S4 LOG'ları + bu oturum. */
function reason(p: string): string {
  const b = p.replace(/-Dark$/, '').replace(/EN(?=$|-)/, '');
  if (/^FinTabBar/.test(b)) return 'İSTİSNA 1: seçili hap gri (Final siyah); bar alt boşluğu home indicator + 4 (G16-S2) → dikey −12';
  if (b === 'FinRecipe') return 'İSTİSNA 4: "Haftanın tarifi" şimdilik FinDetail\'e açılır; FinRecipe ekranı uygulanmadı (SORULAR)';
  if (/^FinMo/.test(b)) return 'Hareket panosu (çok kareli storyboard): yalnız 1. kare ölçüldü; kare dizileri S1/S2 LOG + bu LOG FinOpen 10 fps';
  if (/^Fin(Stress|Components)/.test(b)) return 'Stres/bileşen dökümü panosu — tek ekran değil, düzen örnek';
  if (/^FinPush/.test(b)) return 'Bildirim kartını OS çizer; vitrin kartı temsilî, metin/sınır üretim kodundan (S4)';
  if (/^FinScanR2|^FinScanOffline/.test(b)) return 'Simülatörde kamera alanı siyah (pano gri yer tutucu) + "Detay ekle" hapı (G17-S2 Ek 9, görev S4 md.5)';
  if (/^FinPhoto|^FinCollectCut/.test(b)) return 'Tara sonucu: gerçek fotoğraf alanı + sağ X (gezinme kuralı, G17-S1)';
  if (/^FinEkAddress/.test(b)) return 'Gerçek MapView haritası (pano çizim)';
  if (/^FinEk(Home|Store|Product|Cart$|Orders$|OrderDetail|Reviews|Info)|^FinHomeIzmir/.test(b)) return 'Gerçek menü fotoğrafları/verisi (pano stok yemek fotoğrafı + [N] örnek; ORTAK #6) — düzen S3 bölge ölçümünde';
  if (/^FinEk/.test(b)) return 'Mantık varsayılanı/gerçek veri (S3 tablosu: ödeme "Yeni kart", hata kodu metinleri)';
  if (/XL/.test(b)) return 'Erişilebilirlik yazı boyutu: satır kırılımı iOS fontuyla (pano tarayıcı)';
  if (/^FinCeleb|^FinCelebrate$/.test(b)) return 'Cam nesne kase/kupa (ORTAK #14; Final alev) + gerçek öğün adı/kcal';
  if (/^FinHome|^FinOrient[13]|^FinTracker/.test(b)) return 'Halka merkezi ALEV (ORTAK #14; Final damla) + vitrin verisi (öğün/banner/etkinlik satırları)';
  if (/^Fin(Feed|Detail|Video|ActivityCard|Serbest|Streak|Following|Comments|Compose|Posting|PostMenu|Report|Notifications|AddSheet|AddToast|ProfilePublic|Gun|Collect|Orient4)/.test(b))
    return 'Keşfet/sosyal içerik: gerçek/örnek gönderi metni-fotoğrafı (pano [Ad]/[N]); nokta ayraçsız etiketler ve sağ X (G17-S1 kuralı)';
  if (/^FinOnbAccountKeyboard/.test(b)) return 'Gerçek iOS klavyesi ↔ panodaki gri "Klavye" kutusu';
  if (/^Fin(Onb|Open|Tb|SignupAI|SignupEat|Intro)/.test(b)) return 'Cihaz 402×874 ↔ pano 393×852: alta sabitli kart/düğmeler 5–8 pt kayar; bölge ölçümü S1 tablosunda';
  if (/^FinPr|^FinPrivacy|^FinBadges/.test(b)) return 'Profil: gerçek/örnek kullanıcı verisi (rozet, makro geçmişi, kart son 4)';
  if (/^Fin(CityR1|WaitlistR1|WaitlistAdd|WaitlistSuggest)/.test(b)) return 'Örnek veri: panoda "[İl]" ve 20 örnek il; uygulamada gerçek il adı ve 81 il alfabetik (S3) — sheet/kart düzeni aynı';
  if (/^FinEatBerlin/.test(b)) return 'Panodaki "[Restoran adı]" satırları örnek; veri yok → gizli (ORTAK #6, S3)';
  if (/^Fin(SheetNotify|Rules|ErrLimit|ErrFailed|ErrOffline|ScanError)/.test(b)) return 'Sheet aynı; arkasındaki bağlam farklı (pano örnek Ana sayfa/kamera, vitrin bileşen sahnesinde boş zemin) + sheet yüksekliği cihaz 874 pt';
  if (/^FinOrient2/.test(b)) return 'Arka plan Tara sonucu örnek içeriği/kaydırma konumu farklı; balon ve delik S1 bölge ölçümünde 0,81';
  return 'Eşik altı — yan yana çift ile incelenmeli (SORULAR)';
}

const out: string[] = [];
let n = 0, ok = 0, band = 0, part = 0, diff = 0, miss = 0, dyCount = 0;
out.push('| # | Final panosu | Uygulamadaki karşılık (ekran/durum) | σ1,5 SSIM bütün @dy | Bölgeler üst · orta · alt (SSIM@dy) | Durum | Fark / dayanak |');
out.push('|---|---|---|---|---|---|---|');
for (const p of finals) {
  n++;
  const r = rows.get(p);
  const cp = counterpart(p);
  if (!r || !r[1]) {
    const why = !resolvePano(p)
      ? /^FinHome(FocusB|FocusC|BannerB)/.test(p)
        ? 'YALNIZ REFERANS (SON_HAL v3: odak = a, banner = a; B/C uygulanmaz)'
        : p === 'FinTur26'
          ? 'Değişiklik listesi panosu (ekran değil)'
          : 'Katalogda karşılık yok'
      : `Çekim yok (${r?.[7] ?? 'ölçülmedi'})`;
    const ref = /REFERANS|listesi/.test(why);
    if (!ref) miss++;
    out.push(`| ${n} | ${p} | ${cp} | — | — | ${ref ? 'REFERANS' : '🔴 EKSİK'} | ${why} |`);
    continue;
  }
  const [, all, dy, u, o, a, , status] = r;
  const tr = { UYUMLU: '✅ UYUMLU', 'BOLGE-UYUMLU': '✅ BÖLGE', KISMI: '🟡 KISMİ', FARK: '🟠 FARK' } as Record<string, string>;
  // SSIM ≥ 0,80 ama |dy| > 4: görünüm eşiği geçiyor, konum ölçütü geçmiyor. Ayrı sayılır, gizlenmez.
  const dyOnly = status !== 'UYUMLU' && Number(all) >= 0.8;
  if (dyOnly) {
    dyCount++;
    out.push(`| ${n} | ${p} | ${cp} | ${all} @${dy} | ${[u, o, a].filter(Boolean).join(' · ') || 'şerit'} | 🟢 SSIM ✓ · dy | Görünüm eşiği (≥ 0,80) geçiyor; dikey konum farkı ${Math.abs(Number(dy))} pt > 4 (cihaz 402×874 ↔ pano 393×852 ölçeği ve/veya bölüm aralıkları) — md.9 konum ölçütü KARŞILANMADI, düzeltilmedi (SORULAR). ${reason(p)} |`);
    continue;
  }
  if (status === 'UYUMLU') ok++;
  else if (status === 'BOLGE-UYUMLU') band++;
  else if (status === 'KISMI') part++;
  else diff++;
  const bands = [u, o, a].filter(Boolean).join(' · ') || 'şerit';
  out.push(`| ${n} | ${p} | ${cp} | ${all} @${dy} | ${bands} | ${tr[status] ?? status} | ${status === 'UYUMLU' ? '—' : reason(p)} |`);
}
console.log(
  `**Özet:** ${n} Final panosu · ✅ uyumlu (bütün ≥ 0,80, |dy| ≤ 4) ${ok} · ✅ bölge-uyumlu (her bölge ≥ 0,80, |dy| ≤ 4) ${band} · 🟢 SSIM ≥ 0,80 ama |dy| > 4 ${dyCount} · 🟡 kısmi (en az bir bölge) ${part} · 🟠 fark (dayanaklı) ${diff} · 🔴 eksik ${miss} · referans ${n - ok - band - part - diff - miss - dyCount}\n`,
);
console.log(out.join('\n'));
