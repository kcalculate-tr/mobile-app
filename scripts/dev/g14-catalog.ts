// G14-S1 — g14-shots.sh için katalog dökümü: "<Pano>\t<scheme>\t<content_size>" satırları.
// Argüman verilirse yalnız o panolar (bilinmeyen ad → hata).
import { allPanoNames, resolvePano } from '../../src/dev/screenCatalog';

const args = process.argv.slice(2);
const names = args.length ? args : allPanoNames();
const rows: string[] = [];
for (const n of names) {
  const e = resolvePano(n);
  if (!e) {
    console.error(`bilinmeyen pano: ${n}`);
    process.exit(1);
  }
  rows.push([n, e.scheme, e.textSize ?? 'large'].join('\t'));
}
// Aynı görünüm ayarlarını grupla (daha az appearance geçişi).
rows.sort((a, b) => {
  const [, sa, za] = a.split('\t');
  const [, sb, zb] = b.split('\t');
  return (sa + za).localeCompare(sb + zb);
});
console.log(rows.join('\n'));
